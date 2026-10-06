import { DEFAULT_TRIGGER_CAP } from './day.ts'
import type { RoundEvent } from './engine/events.ts'
import { compileModifiers, type ModifierSet } from './engine/modifiers.ts'
import { resolveRound } from './engine/round.ts'
import { roundIncome } from './math.ts'
import { shuffle, type Rng } from './rng.ts'
import type { CardDef, HuntDef, Intent, Modifier, PreyTrait, TamerDef, WeatherDef } from './types.ts'

/**
 * Av katmanı (GDD v0.8 "Av kuralları"). Tur çözücünün üstüne oturur, ona dokunmaz:
 *
 *  1. Turdan önce yaratığın niyeti görünür. Kartlara dokunan niyetler (Yırtma, Kuyruk Savurma,
 *     Kükreme, Alev Yağmuru) tur başı modifier'larına çevrilir; Ward bunları da engeller.
 *  2. Tur çözülür. Her yetenek çözümünün geliri hasara çevrilir (`ctx.hit` kancası):
 *     direnç/zayıflık → Yarı Saydam → Savuşturma → Zırh → Kabuk. Can 0'a inerse yaratık o tetikte
 *     bayılır, tur ve av biter (ikinci can çubuğu varsa bir kez döner).
 *  3. Tur sonu: yaratık ayaktaysa niyetini uygular. Saldırı bu turda biriken Koruma kadar azalır,
 *     kalanı Tamer'ın canından düşer. Faz eşiği geçildiyse niyet döngüsü değişir.
 *
 * Saf fonksiyonlardır: aynı durum + dizilim = aynı sonuç. UI olay akışını oynatır, simülasyon
 * olaysız çağırır. Unity portu bu dosyayı C#'a birebir taşır.
 */

export type HuntOutcome =
  /** Yaratık bayıldı ve koleksiyona katıldı. */
  | 'captured'
  /** Son turun sonunda yaratık ayaktaydı. */
  | 'escaped'
  /** Kaçış Hazırlığı tuttu. */
  | 'fled'
  /** Tamer'ın canı bitti. */
  | 'tamerDown'
  /** Kuşatmanın günü bitti, yaratık ertesi gün kaldığı candan devam eder (Kadim Av). */
  | 'nightfall'

/** Vuruşun neden eksik işlediği (UI etiketi). */
export type HitBlock = 'evade' | 'armor' | 'shell' | 'veil'

export type HuntEvent =
  | RoundEvent
  /** Bir yetenek çözümünün yaratığa işleyen hasarı; ilgili `ability` olayının hemen ardından gelir. */
  | { t: 'hit'; slot: number; income: number; damage: number; guard: number; blocked: HitBlock | null; preyHp: number }
  /** İkinci can çubuğu: yaratık bir kez bu canla döner. */
  | { t: 'revive'; hp: number }
  | { t: 'preyDown' }
  /** Turun kapanışı: yaratığın niyeti uygulanır (bayıldıysa uygulanmaz). */
  | {
      t: 'preyAction'
      intent: Intent
      acted: boolean
      attack: number
      absorbed: number
      tamerDamage: number
      tamerHp: number
      preyHp: number
      recovered: number
      fled: boolean
    }
  | { t: 'phase'; phase: number; text: string }
  | { t: 'huntRoundEnd'; damage: number; guard: number; outcome: HuntOutcome | null }

export interface PreyState {
  hp: number
  /** Şu anki can çubuğunun üst sınırı. */
  maxHp: number
  /** 0 = temel; k = phases[k-1]. */
  phase: number
  intentIndex: number
  charged: boolean
  revived: boolean
}

export interface HuntSetup {
  hunt: HuntDef
  /** Yaratığın can çubuğu (kalibre ya da tasarım değeri). */
  hp: number
  /** Kalan can: yaralı yaratık ya da kuşatmanın sonraki günü. Verilmezse tam can. */
  startHp?: number
  deck: readonly CardDef[]
  tamer: TamerDef
  tamerHp: number
  /** Av gününün havası (Efsanevi Av'da yaratığın kendi havası). */
  weather?: WeatherDef | null
  /** Bölge buff'ları gibi kalıcı pasifler. */
  passives?: Modifier[]
  /** Kadim Av: önceki gün oynanan kartlar −1 dayanıklılıkla başlar (en az 1). */
  fatigued?: ReadonlySet<string>
  /** Kadim Av: son turdan sonra yaratık ayaktaysa ertesi güne kalır (son gün değilse). */
  siegeContinues?: boolean
  triggerCap?: number
}

export interface HuntState {
  hunt: HuntDef
  prey: PreyState
  tamer: TamerDef
  tamerHp: number
  tamerMaxHp: number
  weather: WeatherDef | null
  passives: Modifier[]
  hands: CardDef[][]
  /** Sıradaki turun indeksi (0 tabanlı). */
  round: number
  triggerCap: number
  siegeContinues: boolean
  outcome: HuntOutcome | null
  damageDealt: number
  tamerDamageTaken: number
  /** Bayıltılan turun indeksi (hız bonusu ve yıldız için). */
  capturedRound: number | null
}

export interface HuntRoundResult {
  roundIndex: number
  intent: Intent
  /** Yaratığa işleyen hasar. */
  damage: number
  /** Motorun ham geliri (hasar öncesi). */
  income: number
  guard: number
  attack: number
  absorbed: number
  tamerDamage: number
  preyHpBefore: number
  preyHpAfter: number
  tamerHpAfter: number
  captured: boolean
  outcome: HuntOutcome | null
}

/** Turun sabit girdileri: niyet, özellikler, derlenmiş modifier'lar. Botlar bir kez hazırlar, çok dizilim dener. */
export interface HuntRoundPrep {
  intent: Intent
  traits: PreyTrait[]
  mods: ModifierSet
  armor: number
  shell: number
  veiled: boolean
  evade: boolean
  thorns: number
}

// ---------------------------------------------------------------------------
// Kurulum
// ---------------------------------------------------------------------------

const fatigueCache = new WeakMap<CardDef, CardDef>()
function fatigue(card: CardDef): CardDef {
  let c = fatigueCache.get(card)
  if (!c) {
    c = { ...card, durability: Math.max(1, card.durability - 1) }
    fatigueCache.set(card, c)
  }
  return c
}

/**
 * Kalibre cana göre ölçeklenmiş av: ikinci can çubuğu, Toparlanma miktarı ve Kaçış Hazırlığı eşiği tasarım
 * canına oranla yazılır; kalibrasyon canı değiştirince bu oran korunur. Pençe hasarı Tamer'ın canına göredir
 * ve ölçeklenmez.
 */
export function scaleHunt(hunt: HuntDef, hp: number): HuntDef {
  if (hp === hunt.hp) return hunt
  const k = hp / hunt.hp
  const s5 = (n: number) => Math.max(5, Math.round((n * k) / 5) * 5)
  const intents = (xs: readonly Intent[]): Intent[] =>
    xs.map((it) => (it.kind === 'recover' ? { ...it, amount: s5(it.amount) } : it.kind === 'flee' ? { ...it, damage: s5(it.damage) } : it))
  return {
    ...hunt,
    revive: hunt.revive ? Math.max(1, Math.round(hunt.revive * k)) : undefined,
    intents: intents(hunt.intents),
    phases: hunt.phases?.map((p) => ({ ...p, intents: intents(p.intents) })),
  }
}

export function startHunt(setup: HuntSetup, rng: Rng): HuntState {
  const slots = setup.tamer.slots
  const deck = setup.fatigued?.size ? setup.deck.map((c) => (setup.fatigued!.has(c.id) ? fatigue(c) : c)) : setup.deck
  const order = shuffle(deck, rng)
  const hands: CardDef[][] = []
  for (let i = 0; i < order.length; i += slots) hands.push(order.slice(i, i + slots))
  const hp = Math.max(1, Math.min(setup.startHp ?? setup.hp, setup.hp))
  return {
    hunt: setup.hunt,
    prey: { hp, maxHp: setup.hp, phase: phaseFor(setup.hunt, hp, setup.hp, 0), intentIndex: 0, charged: false, revived: false },
    tamer: setup.tamer,
    tamerHp: setup.tamerHp,
    tamerMaxHp: setup.tamer.hp,
    weather: setup.weather ?? null,
    passives: setup.passives ?? [],
    hands,
    round: 0,
    triggerCap: setup.triggerCap ?? DEFAULT_TRIGGER_CAP,
    siegeContinues: setup.siegeContinues ?? false,
    outcome: null,
    damageDealt: 0,
    tamerDamageTaken: 0,
    capturedRound: null,
  }
}

/** Canın girdiği en derin faz (fazlar geri dönmez). */
function phaseFor(hunt: HuntDef, hp: number, maxHp: number, current: number): number {
  let phase = current
  ;(hunt.phases ?? []).forEach((p, i) => {
    if (i + 1 > phase && hp <= (maxHp * p.belowPct) / 100) phase = i + 1
  })
  return phase
}

// ---------------------------------------------------------------------------
// Niyet ve özellikler
// ---------------------------------------------------------------------------

export function phaseIntents(hunt: HuntDef, phase: number): Intent[] {
  return phase > 0 ? hunt.phases![phase - 1].intents : hunt.intents
}

/** Fazın özellikleri temel özelliklere eklenir. */
export function preyTraits(hunt: HuntDef, phase: number): PreyTrait[] {
  const base = hunt.traits ?? []
  return phase > 0 ? [...base, ...(hunt.phases![phase - 1].traits ?? [])] : base
}

export function preyIntent(state: Pick<HuntState, 'hunt' | 'prey'>): Intent {
  const intents = phaseIntents(state.hunt, state.prey.phase)
  return intents[state.prey.intentIndex % intents.length]
}

/** Önümüzdeki n niyet (mevcut faz içinde; faz değişirse döngü baştan başlar). */
export function upcomingIntents(state: Pick<HuntState, 'hunt' | 'prey'>, n: number): Intent[] {
  const intents = phaseIntents(state.hunt, state.prey.phase)
  return Array.from({ length: n }, (_, i) => intents[(state.prey.intentIndex + i) % intents.length])
}

/** Kartlara dokunan niyetlerin tur başı modifier karşılığı (slot sayısı elin büyüklüğüdür). */
export function intentModifiers(intent: Intent, slots: number): Modifier[] {
  switch (intent.kind) {
    case 'rend':
      return intent.slot <= slots ? [{ kind: 'durabilityAtStart', amount: -1, min: 0, if: { kind: 'slot', index: intent.slot } }] : []
    case 'tailSweep':
      return Array.from({ length: Math.min(intent.count, slots) }, (_, i) => ({
        kind: 'durabilityAtStart' as const,
        amount: -1,
        min: 0,
        if: { kind: 'slot' as const, index: slots - i },
      }))
    case 'roar':
      return intent.slot <= slots ? [{ kind: 'slumberAtStart', passes: 2, if: { kind: 'slot', index: intent.slot } }] : []
    case 'scorch':
      return [{ kind: 'durabilityAtStart', amount: -1, min: 1 }]
    case 'claw':
    case 'evade':
    case 'recover':
    case 'charge':
    case 'flee':
      return []
  }
}

export function prepareHuntRound(state: HuntState, slots: number): HuntRoundPrep {
  const intent = preyIntent(state)
  const traits = preyTraits(state.hunt, state.prey.phase)
  const weatherId = state.weather?.id ?? ''
  let armor = 0
  let shell = 0
  let thorns = 0
  let veiled = false
  let agile = false
  for (const t of traits) {
    if (t.kind === 'armor' && !(t.offIn ?? []).includes(weatherId)) armor += t.amount
    else if (t.kind === 'shell') shell += t.amount
    else if (t.kind === 'thorns') thorns += t.amount
    else if (t.kind === 'veiled') veiled = true
    else if (t.kind === 'agile') agile = true
  }
  const mods = compileModifiers({
    weather: state.weather,
    tamer: state.tamer,
    passives: [...state.passives, ...intentModifiers(intent, slots)],
  })
  return { intent, traits, mods, armor, shell, veiled, evade: agile || intent.kind === 'evade', thorns }
}

/** Direnç ve zayıflık: kartın elementlerinden biri eşleşirse yüzdeler toplanır. */
function elementPct(traits: readonly PreyTrait[], card: CardDef | undefined): number {
  if (!card) return 0
  let pct = 0
  for (const t of traits) {
    if (t.kind === 'resist' && card.elements.includes(t.element)) pct -= t.pct
    else if (t.kind === 'weak' && card.elements.includes(t.element)) pct += t.pct
  }
  return pct
}

// ---------------------------------------------------------------------------
// Tur
// ---------------------------------------------------------------------------

export function resolveHuntRound(
  state: HuntState,
  arrangement: readonly CardDef[],
  emit?: (e: HuntEvent) => void,
  prep: HuntRoundPrep = prepareHuntRound(state, arrangement.length),
): { state: HuntState; result: HuntRoundResult } {
  if (state.outcome) throw new Error('Av bitti, yeni tur oynanamaz')
  const { intent, traits } = prep
  const prey: PreyState = { ...state.prey }
  const preyHpBefore = prey.hp

  let damage = 0
  let guard = 0
  let shellLeft = prep.shell
  let thornsAcc = 0
  // Diken kart başına turda bir kez yansır: hasar vuruş sayısıyla değil masadaki kartla büyür.
  const thornSlots = new Set<number>()
  let evadedPass = -1
  let down = false
  const buffer: HuntEvent[] | null = emit ? [] : null
  let cut = -1

  const r = resolveRound(
    arrangement,
    {
      mods: prep.mods,
      roundIndex: state.round,
      roundCount: state.hands.length,
      triggerCap: state.triggerCap,
      hit: (slot, on, pass, income, g) => {
        if (down) return
        guard += g
        if (on === 'harvest' && prep.thorns > 0 && !thornSlots.has(slot)) {
          thornSlots.add(slot)
          thornsAcc += prep.thorns
        }
        let dmg = income
        let blocked: HitBlock | null = null
        if (prep.evade && on === 'harvest' && pass >= 1 && evadedPass !== pass) {
          evadedPass = pass
          blocked = 'evade'
          dmg = 0
        } else if (dmg > 0) {
          const pct = elementPct(traits, arrangement[slot])
          if (pct !== 0) dmg = roundIncome(dmg * Math.max(0, 1 + pct / 100))
          if (prep.veiled && pass === 1) {
            dmg = Math.floor(dmg / 2)
            blocked = 'veil'
          }
          if (prep.armor > 0 && dmg > 0) {
            const a = Math.min(prep.armor, dmg)
            dmg -= a
            blocked ??= 'armor'
          }
          if (shellLeft > 0 && dmg > 0) {
            const a = Math.min(shellLeft, dmg)
            shellLeft -= a
            dmg -= a
            blocked = 'shell'
          }
        }
        if (income === 0 && !blocked && g === 0) return
        damage += dmg
        prey.hp -= dmg
        buffer?.push({ t: 'hit', slot, income, damage: dmg, guard: g, blocked, preyHp: Math.max(0, prey.hp) })
        if (prey.hp <= 0) {
          if (state.hunt.revive && !prey.revived) {
            prey.revived = true
            prey.hp = state.hunt.revive
            prey.maxHp = state.hunt.revive
            buffer?.push({ t: 'revive', hp: prey.hp })
          } else {
            prey.hp = 0
            down = true
            if (buffer) cut = buffer.length
          }
        }
      },
    },
    buffer ? (e) => buffer.push(e) : undefined,
  )

  const out: HuntEvent[] = buffer ? (cut >= 0 ? buffer.slice(0, cut) : buffer) : []
  const last = state.round + 1 >= state.hands.length
  let attack = 0
  let absorbed = 0
  let tamerDamage = 0
  let recovered = 0
  let fled = false

  if (down) {
    out.push({ t: 'preyDown' })
  } else {
    attack = thornsAcc
    switch (intent.kind) {
      case 'claw':
        attack += intent.damage * (prey.charged ? 2 : 1)
        prey.charged = false
        break
      case 'charge':
        prey.charged = true
        break
      case 'recover': {
        const before = prey.hp
        prey.hp = Math.min(prey.maxHp, prey.hp + intent.amount)
        recovered = prey.hp - before
        break
      }
      case 'flee':
        fled = prey.hp <= (prey.maxHp * intent.belowPct) / 100 && damage < intent.damage
        break
      case 'rend':
      case 'tailSweep':
      case 'roar':
      case 'evade':
      case 'scorch':
        break
    }
    absorbed = Math.min(attack, guard)
    tamerDamage = attack - absorbed
  }
  const tamerHp = Math.max(0, state.tamerHp - tamerDamage)
  if (!down)
    out.push({ t: 'preyAction', intent, acted: true, attack, absorbed, tamerDamage, tamerHp, preyHp: prey.hp, recovered, fled })

  const outcome: HuntOutcome | null = down
    ? 'captured'
    : tamerHp <= 0
      ? 'tamerDown'
      : fled
        ? 'fled'
        : last
          ? state.siegeContinues
            ? 'nightfall'
            : 'escaped'
          : null

  if (!outcome) {
    const phase = phaseFor(state.hunt, prey.hp, prey.maxHp, prey.phase)
    if (phase !== prey.phase) {
      prey.phase = phase
      prey.intentIndex = 0
      out.push({ t: 'phase', phase, text: state.hunt.phases![phase - 1].text })
    } else {
      prey.intentIndex++
    }
  }
  out.push({ t: 'huntRoundEnd', damage, guard, outcome })
  if (emit) for (const e of out) emit(e)

  const next: HuntState = {
    ...state,
    prey,
    tamerHp,
    round: state.round + 1,
    outcome,
    damageDealt: state.damageDealt + damage,
    tamerDamageTaken: state.tamerDamageTaken + tamerDamage,
    capturedRound: down ? state.round : state.capturedRound,
  }
  return {
    state: next,
    result: {
      roundIndex: state.round,
      intent,
      damage,
      income: r.total,
      guard,
      attack,
      absorbed,
      tamerDamage,
      preyHpBefore,
      preyHpAfter: prey.hp,
      tamerHpAfter: tamerHp,
      captured: down,
      outcome,
    },
  }
}

/** Avın sıradaki eli (bittiyse boş). */
export function currentHand(state: HuntState): CardDef[] {
  return state.outcome ? [] : (state.hands[state.round] ?? [])
}

/**
 * Bir dizilimin bu turdaki değeri (botların ve "en iyi dizilim" karşılaştırmasının ölçüsü):
 * bayıltan dizilim her zaman önde, sonra hasar + gelen saldırıyı karşılayan Koruma.
 */
export function huntArrangementValue(result: HuntRoundResult, prepAttackEstimate: number): number {
  if (result.captured) return 1e6 + result.damage
  return result.damage + Math.min(result.guard, prepAttackEstimate)
}

/** Niyetin tur sonundaki beklenen saldırısı (Şarj dahil), Diken hariç. */
export function expectedAttack(state: Pick<HuntState, 'hunt' | 'prey'>): number {
  const intent = preyIntent(state)
  return intent.kind === 'claw' ? intent.damage * (state.prey.charged ? 2 : 1) : 0
}
