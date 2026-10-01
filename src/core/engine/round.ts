import { roundIncome } from '../math.ts'
import type { AbilityTrigger, CardDef, Effect, Target } from '../types.ts'
import { CUSTOM_OPS, type IncomeAccumulator } from './custom.ts'
import type { DurabilitySource, EventSink } from './events.ts'
import type { IncomeMod } from './modifiers.ts'
import { evalCond, evalCount, matchFilter, neighbor, type CondEnv } from './rules.ts'
import type { CompiledCard, RoundContext, RoundState, SlotState } from './state.ts'

/**
 * Tur çözücü (GDD "Tur ve gün" + "Hesaplama sırası").
 *
 *  1. Tur başı: hava/Tamer/albüm dayanıklılık etkileri, Elektrik kutup bağlantıları, Howl.
 *  2. Geçişler: aktif kartlar Swift → soldan sağa → Heavy sırasıyla Harvest tetikler,
 *     her tetikte 1 (Overload: 2) dayanıklılık kaybeder (Ward ilk kaybı engeller).
 *     Dayanıklılığı 0 olan kart: Last Breath → (Rebirth ile geri dönüş | pasif + Haunt).
 *     Uyuyan (Slumber N) kart ilk N-1 geçişte tetiklenmez.
 *  3. Tüm kartlar bitince Epilogue, tur kapanır.
 *
 * Saf fonksiyondur: aynı girdi = aynı çıktı. Simülasyon milyonlarca kez çağırır,
 * bu yüzden `emit` verilmezse olay nesnesi oluşturulmaz.
 */

export interface SlotResult {
  income: number
  triggers: number
  durabilityLeft: number
}

export interface RoundResult {
  total: number
  /** Harvest tetik sayısı. */
  triggers: number
  /** Tüm yetenek çözümleri (Howl, Last Breath, Haunt, Epilogue dahil). Animasyon süresi bundan. */
  steps: number
  passes: number
  capped: boolean
  slots: SlotResult[]
}

const compiledCache = new WeakMap<CardDef, CompiledCard>()

export function compileCard(card: CardDef): CompiledCard {
  let c = compiledCache.get(card)
  if (c) return c
  const byTrigger: CompiledCard['byTrigger'] = {}
  const aura: CompiledCard['aura'] = []
  for (const ab of card.abilities) {
    ;(byTrigger[ab.on] ??= []).push(...ab.effects)
    if (ab.on === 'aura') for (const e of ab.effects) if (e.op === 'aura') aura.push(e)
  }
  const kw = card.keywords ?? []
  c = {
    byTrigger,
    aura,
    swift: kw.includes('swift'),
    heavy: kw.includes('heavy'),
    overload: kw.includes('overload'),
    ward: kw.includes('ward'),
    rebirth: kw.includes('rebirth'),
    slumber: card.slumber ?? 0,
  }
  compiledCache.set(card, c)
  return c
}

export function resolveRound(cards: readonly CardDef[], ctx: RoundContext, emit?: EventSink): RoundResult {
  const slots: SlotState[] = cards.map((card, index) => {
    const c = compileCard(card)
    return {
      index,
      card,
      c,
      durability: card.durability,
      ward: c.ward,
      rebirth: c.rebirth,
      lastBreathDone: false,
      triggers: 0,
      passRaw: 0,
      passRawPass: -1,
      income: 0,
      leftLink: null,
      rightLink: null,
    }
  })

  const elements = new Set<string>()
  for (const s of slots) for (const e of s.card.elements) elements.add(e)

  const rs: RoundState = {
    slots,
    ctx,
    heat: 0,
    pass: 0,
    steps: 0,
    triggers: 0,
    total: 0,
    capped: false,
    distinctElements: elements.size,
    auraSources: slots.filter((s) => s.c.aura.length > 0),
    emit,
  }

  emit?.({ t: 'roundStart', slots: slots.length })

  // 1a. Tur başı dayanıklılık etkileri (Kuraklık, Demirci, Horoz...).
  for (const m of ctx.mods.startDurability) {
    for (const s of slots) {
      if (!matchFilter(s, m.filter) || !evalCond(rs, s, m.if, NOT_LAST)) continue
      if (m.amount > 0) gainDurability(rs, s, m.amount, 'start')
      else if (m.amount < 0) {
        const loss = Math.min(-m.amount, Math.max(0, s.durability - m.min))
        if (loss > 0) loseDurability(rs, s, loss, 'start')
      }
    }
  }

  // 1b. Elektrik kutup bağlantıları: her kutuplu kart sağdaki bir sonraki kutuplu karta bağlanır.
  let prev: SlotState | null = null
  const links: { left: number; right: number; state: 'compatible' | 'clash' }[] = []
  for (const s of slots) {
    if (!s.card.polarity) continue
    if (prev) {
      const state = prev.card.polarity!.right !== s.card.polarity.left ? 'compatible' : 'clash'
      prev.rightLink = state
      s.leftLink = state
      if (emit) links.push({ left: prev.index, right: s.index, state })
    }
    prev = s
  }
  if (emit && links.length) emit({ t: 'links', links })

  // 1c. Howl.
  for (const s of slots) runAbility(rs, s, 'howl', NOT_LAST)

  // 2. Geçişler.
  while (!rs.capped && slots.some((s) => s.durability > 0)) {
    rs.pass++
    emit?.({ t: 'passStart', pass: rs.pass })
    for (const s of passOrder(rs)) {
      if (rs.capped) break
      if (s.durability > 0) triggerSlot(rs, s)
    }
    emit?.({ t: 'passEnd', pass: rs.pass })
    if (rs.pass > 1000) break // teorik güvenlik
  }

  // 3. Epilogue (tetik sınırına takılsa bile tur kapanırken çalışır).
  for (const s of slots) runAbility(rs, s, 'epilogue', NOT_LAST, true)

  emit?.({ t: 'roundEnd', total: rs.total, triggers: rs.triggers, passes: rs.pass })

  return {
    total: rs.total,
    triggers: rs.triggers,
    steps: rs.steps,
    passes: rs.pass,
    capped: rs.capped,
    slots: slots.map((s) => ({ income: s.income, triggers: s.triggers, durabilityLeft: s.durability })),
  }
}

const NOT_LAST: CondEnv = { isLastTrigger: false }
const IS_LAST: CondEnv = { isLastTrigger: true }

function passOrder(rs: RoundState): SlotState[] {
  const swift: SlotState[] = []
  const normal: SlotState[] = []
  const heavy: SlotState[] = []
  for (const s of rs.slots) {
    if (s.durability <= 0) continue
    if (s.c.slumber > 0 && rs.pass < s.c.slumber) continue
    if (s.c.swift) swift.push(s)
    else if (s.c.heavy) heavy.push(s)
    else normal.push(s)
  }
  return swift.concat(normal, heavy)
}

function triggerSlot(rs: RoundState, s: SlotState) {
  const cost = s.c.overload ? 2 : 1
  const isLast = !s.ward && s.durability - cost <= 0
  runAbility(rs, s, 'harvest', isLast ? IS_LAST : NOT_LAST)
  if (rs.capped) return
  s.triggers++
  rs.triggers++
  loseDurability(rs, s, cost, 'trigger')
}

/**
 * Bir kartın belirli türdeki yeteneklerini çözer, gelirini yazar, aksiyonlarını çalıştırır.
 * Harvest yeteneği olmayan kart da tetiklenir (gelir 0) ve dayanıklılık kaybeder.
 */
function runAbility(
  rs: RoundState,
  s: SlotState,
  on: AbilityTrigger,
  env: CondEnv,
  ignoreCap = false,
  retrigger = false,
) {
  const effects = s.c.byTrigger[on]
  if (!effects && on !== 'harvest') return
  const times = on === 'harvest' ? 1 : rs.ctx.mods.repeat[on]
  for (let i = 0; i < times; i++) {
    if (!ignoreCap && rs.steps >= rs.ctx.triggerCap) {
      if (!rs.capped) {
        rs.capped = true
        rs.emit?.({ t: 'cap' })
      }
      return
    }
    rs.steps++
    evaluate(rs, s, on, effects ?? [], env, retrigger)
  }
}

function evaluate(
  rs: RoundState,
  s: SlotState,
  on: AbilityTrigger,
  effects: readonly Effect[],
  env: CondEnv,
  retrigger: boolean,
) {
  const acc: IncomeAccumulator = { flat: 0, mult: 1, copied: 0 }
  let actions: Effect[] | null = null

  for (const e of effects) {
    switch (e.op) {
      case 'gain':
        if (evalCond(rs, s, e.if, env)) acc.flat += e.amount
        break
      case 'gainPer':
        if (evalCond(rs, s, e.if, env)) acc.flat += e.amount * evalCount(rs, s, e.per)
        break
      case 'mult':
        if (evalCond(rs, s, e.if, env)) acc.mult *= e.value
        break
      case 'copyIncome': {
        if (!evalCond(rs, s, e.if, env)) break
        const n = neighbor(rs, s, e.from)
        if (n && n.passRawPass === rs.pass) acc.copied += (n.passRaw * e.pct) / 100
        break
      }
      case 'addHeat':
        if (evalCond(rs, s, e.if, env)) {
          rs.heat += e.amount
          rs.emit?.({ t: 'heat', value: rs.heat })
        }
        break
      case 'addDurability':
      case 'retrigger':
        if (evalCond(rs, s, e.if, env)) (actions ??= []).push(e)
        break
      case 'aura':
        break
      case 'custom': {
        const fn = CUSTOM_OPS[e.id]
        if (!fn) throw new Error(`Bilinmeyen custom op: ${e.id} (kart ${s.card.id})`)
        fn({ rs, self: s, acc, params: e.params ?? {} })
        break
      }
    }
  }

  // Aura: masadaki (aktif, pasif ya da uyuyan) aura kaynakları Harvest'i güçlendirir.
  if (on === 'harvest' && rs.auraSources.length) {
    const auraScale = rs.ctx.mods.abilityScale.aura
    for (const src of rs.auraSources) {
      for (const a of src.c.aura) {
        if (src === s && !a.includeSelf) continue
        if (!matchFilter(s, a.filter)) continue
        if (a.gain) acc.flat += a.gain * auraScale
        if (a.mult) acc.mult *= 1 + (a.mult - 1) * auraScale
      }
    }
  }

  const raw = acc.flat * acc.mult + acc.copied
  const scale = rs.ctx.mods.abilityScale[on]
  const global = globalMultiplier(rs, s)
  const income = roundIncome(raw * scale * global)

  if (on === 'harvest') {
    s.passRaw = raw
    s.passRawPass = rs.pass
  }
  s.income += income
  rs.total += income

  rs.emit?.({
    t: 'ability',
    slot: s.index,
    on: retrigger ? 'retrigger' : on,
    pass: rs.pass,
    income,
    detail: { flat: acc.flat, mult: acc.mult, copied: acc.copied, scale, global, raw },
  })

  if (actions) for (const a of actions) runAction(rs, s, a)
}

function sumPct(rs: RoundState, s: SlotState, mods: readonly IncomeMod[]): number {
  let pct = 0
  for (const m of mods) if (matchFilter(s, m.filter) && evalCond(rs, s, m.if, NOT_LAST)) pct += m.pct
  return pct
}

function globalMultiplier(rs: RoundState, s: SlotState): number {
  const { weatherIncome, passiveIncome, tamerIncome } = rs.ctx.mods
  let g = (1 + sumPct(rs, s, weatherIncome) / 100) * (1 + sumPct(rs, s, passiveIncome) / 100)
  for (const m of tamerIncome) if (matchFilter(s, m.filter) && evalCond(rs, s, m.if, NOT_LAST)) g *= 1 + m.pct / 100
  return Math.max(0, g)
}

function targets(rs: RoundState, s: SlotState, target: Target): SlotState[] {
  switch (target) {
    case 'self':
      return [s]
    case 'left':
    case 'right': {
      const n = neighbor(rs, s, target)
      return n ? [n] : []
    }
    case 'others':
      return rs.slots.filter((o) => o !== s)
    case 'all':
      return rs.slots
  }
}

function runAction(rs: RoundState, s: SlotState, e: Effect) {
  if (e.op === 'addDurability') {
    for (const t of targets(rs, s, e.target)) {
      if (!matchFilter(t, e.filter)) continue
      if (e.amount > 0) gainDurability(rs, t, e.amount, 'ability')
      else if (e.amount < 0) loseDurability(rs, t, -e.amount, 'ability')
    }
  } else if (e.op === 'retrigger') {
    // Ek tetik: dayanıklılık harcamaz, pasif kartı da tetikleyebilir.
    for (const t of targets(rs, s, e.target)) {
      if (!matchFilter(t, e.filter)) continue
      runAbility(rs, t, 'harvest', NOT_LAST, false, true)
    }
  }
}

function gainDurability(rs: RoundState, s: SlotState, amount: number, source: DurabilitySource) {
  const from = s.durability
  s.durability += amount
  rs.emit?.({ t: 'durability', slot: s.index, from, to: s.durability, source })
  if (from === 0 && s.durability > 0) rs.emit?.({ t: 'reactivated', slot: s.index })
}

function loseDurability(rs: RoundState, s: SlotState, amount: number, source: DurabilitySource) {
  if (s.durability <= 0) return
  if (s.ward) {
    s.ward = false
    rs.emit?.({ t: 'ward', slot: s.index })
    return
  }
  const from = s.durability
  s.durability = Math.max(0, from - amount)
  rs.emit?.({ t: 'durability', slot: s.index, from, to: s.durability, source })
  if (s.durability === 0) onExhausted(rs, s)
}

function onExhausted(rs: RoundState, s: SlotState) {
  if (!s.lastBreathDone) {
    s.lastBreathDone = true
    runAbility(rs, s, 'lastBreath', IS_LAST)
  }
  if (s.rebirth) {
    s.rebirth = false
    s.durability = 1
    rs.emit?.({ t: 'rebirth', slot: s.index })
    return
  }
  rs.emit?.({ t: 'exhausted', slot: s.index })
  for (const o of rs.slots) {
    if (o !== s && o.c.byTrigger.haunt) runAbility(rs, o, 'haunt', NOT_LAST)
  }
}
