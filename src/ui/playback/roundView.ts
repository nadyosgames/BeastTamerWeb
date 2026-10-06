import type { DurabilitySource, IncomeDetail, RoundEvent } from '../../core/engine/events.ts'
import type { HitBlock, HuntEvent, HuntOutcome, HuntState } from '../../core/hunt.ts'
import type { AbilityTrigger, CardDef, Intent, LinkState } from '../../core/types.ts'

/**
 * Motorun olay akışından ekrandaki tur durumunu türeten saf reducer.
 * Oyun mantığı burada yeniden hesaplanmaz; yalnızca olaylar uygulanır. Unity'deki
 * oynatıcı da aynı kuralla yazılır: olay → görsel durum.
 */
export interface SlotView {
  durability: number
  /** Kalkandaki "x/y"nin y'si: basılı dayanıklılık, tur içinde kazanılan dayanıklılıkla büyür. */
  maxDurability: number
  passive: boolean
  ward: boolean
  /** Uyuyor (Slumber ya da Kükreme): bu geçişe kadar tetiklenmez. */
  sleepUntil: number
  income: number | null
  /** Av: vuruşun etiketi (SAVUŞTU, ZIRH...) ya da null. */
  note: string | null
  pulse: number
  total: number
  /** Av: bu kartın bu turda yaratığa işlettiği hasar. */
  dealt: number
}

export interface RoundView {
  slots: SlotView[]
  pass: number
  total: number
  heat: number
  links: { left: number; right: number; state: LinkState }[]
  active: number | null
  passTotals: number[]
  log: LogEntry[]
  done: boolean
  capped: boolean
}

/** Olay kaydı satırı. Metne çevirme ve renklendirme UI'da (RoundLog) yapılır. */
export type LogEntry =
  /** pass 0 = tur başı (Howl, kutuplar, tur başı etkileri). */
  | { k: 'section'; pass: number }
  | {
      k: 'ability'
      slot: number
      on: AbilityTrigger | 'retrigger'
      income: number
      detail: IncomeDetail
      cost?: { from: number; to: number }
      /** Av: yaratığa işleyen hasar ve engelleyen özellik. */
      hit?: { damage: number; blocked: HitBlock | null }
      guard?: number
    }
  /** by: değişime yol açan yeteneğin sahibi (yetenek kaynaklıysa). */
  | { k: 'durability'; slot: number; from: number; to: number; source: DurabilitySource; by: number | null }
  | { k: 'heat'; value: number; by: number | null }
  | { k: 'status'; slot: number; what: 'ward' | 'exhausted' | 'rebirth' | 'reactivated' | 'slumber' }
  | { k: 'cap' }
  | { k: 'end'; total: number; triggers: number; passes: number }
  /** Av: yaratığın tur sonu hamlesi. */
  | { k: 'action'; intent: Intent; attack: number; absorbed: number; tamerDamage: number; recovered: number; fled: boolean }
  | { k: 'prey'; what: 'down' | 'revive' | 'phase'; text?: string; hp?: number }
  | { k: 'huntEnd'; damage: number; guard: number; outcome: HuntOutcome | null }

export function initialView(cards: readonly CardDef[]): RoundView {
  return {
    slots: cards.map((c) => ({
      durability: c.durability,
      maxDurability: c.durability,
      passive: false,
      ward: (c.keywords ?? []).includes('ward'),
      sleepUntil: c.slumber ?? 0,
      income: null,
      note: null,
      pulse: 0,
      total: 0,
      dealt: 0,
    })),
    pass: 0,
    total: 0,
    heat: 0,
    links: [],
    active: null,
    passTotals: [],
    log: [],
    done: false,
    capped: false,
  }
}

/** Motor Isı'yı yetenek satırından önce yayar; kayıtta Isı satırı onu üreten yeteneğin altına taşınır. */
function withAbility(log: LogEntry[], entry: Extract<LogEntry, { k: 'ability' }>): LogEntry[] {
  let i = log.length
  while (i > 0 && log[i - 1].k === 'heat' && (log[i - 1] as { by: number | null }).by === entry.slot) i--
  return [...log.slice(0, i), entry, ...log.slice(i)]
}

export function applyEvent(v: RoundView, e: RoundEvent): RoundView {
  const slots = v.slots.map((s) => ({ ...s, income: null as number | null, note: null as string | null }))
  const log = (entry: LogEntry) => [...v.log, entry]
  switch (e.t) {
    case 'roundStart':
      return { ...v, log: log({ k: 'section', pass: 0 }) }
    case 'links':
      return { ...v, links: e.links }
    case 'slumber':
      slots[e.slot].sleepUntil = e.until
      return { ...v, slots, log: log({ k: 'status', slot: e.slot, what: 'slumber' }) }
    case 'passStart':
      return { ...v, slots, pass: e.pass, active: null, passTotals: [...v.passTotals, 0], log: log({ k: 'section', pass: e.pass }) }
    case 'ability': {
      const s = slots[e.slot]
      s.income = e.income
      s.pulse = v.slots[e.slot].pulse + 1
      s.total += e.income
      // Tur başı (Howl) geliri hiçbir geçişe yazılmaz; geçiş toplamları geçiş numarasıyla eşleşir.
      const passTotals = [...v.passTotals]
      if (v.pass > 0) passTotals[v.pass - 1] += e.income
      return {
        ...v,
        slots,
        active: e.slot,
        total: v.total + e.income,
        passTotals,
        log: withAbility(v.log, { k: 'ability', slot: e.slot, on: e.on, income: e.income, detail: e.detail, guard: e.guard || undefined }),
      }
    }
    case 'durability': {
      slots[e.slot].durability = e.to
      slots[e.slot].maxDurability = Math.max(slots[e.slot].maxDurability, e.to)
      // Tetik kaybı, tetikleyen yetenek satırına eklenir; diğer değişimler kendi satırını alır.
      let at = v.log.length - 1
      while (at >= 0 && v.log[at].k === 'heat') at--
      const last = v.log[at]
      if (e.source === 'trigger' && last?.k === 'ability' && last.slot === e.slot) {
        const log = [...v.log]
        log[at] = { ...last, cost: { from: e.from, to: e.to } }
        return { ...v, slots, log }
      }
      const by = e.source === 'ability' ? v.active : null
      return { ...v, slots, log: log({ k: 'durability', slot: e.slot, from: e.from, to: e.to, source: e.source, by }) }
    }
    case 'ward':
      slots[e.slot].ward = false
      return { ...v, slots, log: log({ k: 'status', slot: e.slot, what: 'ward' }) }
    case 'exhausted':
      slots[e.slot].passive = true
      return { ...v, slots, log: log({ k: 'status', slot: e.slot, what: 'exhausted' }) }
    case 'rebirth':
      slots[e.slot].durability = 1
      return { ...v, slots, log: log({ k: 'status', slot: e.slot, what: 'rebirth' }) }
    case 'reactivated':
      slots[e.slot].passive = false
      return { ...v, slots, log: log({ k: 'status', slot: e.slot, what: 'reactivated' }) }
    case 'heat':
      return { ...v, heat: e.value, log: log({ k: 'heat', value: e.value, by: e.slot }) }
    case 'passEnd':
      return v
    case 'cap':
      return { ...v, capped: true, log: log({ k: 'cap' }) }
    case 'roundEnd':
      return { ...v, slots, active: null, done: true, log: log({ k: 'end', total: e.total, triggers: e.triggers, passes: e.passes }) }
  }
}

/** Görsel olarak "adım" sayılan olaylar (bunlar arasında bekleme yapılır). */
export function isBeat(e: RoundEvent): boolean {
  return e.t === 'ability' || e.t === 'exhausted' || e.t === 'rebirth'
}

// ---------------------------------------------------------------------------
// Av görünümü: tur olaylarına ek olarak hasar, Koruma ve yaratığın hamlesi
// ---------------------------------------------------------------------------

export const BLOCK_LABEL: Record<HitBlock, string> = { evade: 'SAVUŞTU', armor: 'ZIRH', shell: 'KABUK', veil: 'SİS' }

export interface HuntView extends RoundView {
  preyHp: number
  preyMax: number
  /** Bu turda yaratığa işleyen hasar ve biriken Koruma. */
  damage: number
  guard: number
  tamerHp: number
  /** Yaratık vurulduğunda artar (sarsılma animasyonu). */
  preyPulse: number
  lastDamage: number
  /** Tamer vurulduğunda artar. */
  tamerPulse: number
  action: Extract<HuntEvent, { t: 'preyAction' }> | null
  phaseText: string | null
  revived: boolean
  down: boolean
  outcome: HuntOutcome | null
}

export function initialHuntView(cards: readonly CardDef[], before: HuntState): HuntView {
  return {
    ...initialView(cards),
    preyHp: before.prey.hp,
    preyMax: before.prey.maxHp,
    damage: 0,
    guard: 0,
    tamerHp: before.tamerHp,
    preyPulse: 0,
    lastDamage: 0,
    tamerPulse: 0,
    action: null,
    phaseText: null,
    revived: false,
    down: false,
    outcome: null,
  }
}

export function applyHuntEvent(v: HuntView, e: HuntEvent): HuntView {
  switch (e.t) {
    case 'hit': {
      const slots = v.slots.slice()
      slots[e.slot] = { ...slots[e.slot], income: e.damage, dealt: slots[e.slot].dealt + e.damage, note: e.blocked && e.damage === 0 ? BLOCK_LABEL[e.blocked] : null }
      // Vuruş sonucu, kendisini doğuran yetenek satırına eklenir.
      const log = [...v.log]
      for (let i = log.length - 1; i >= 0; i--) {
        const entry = log[i]
        if (entry.k === 'ability' && entry.slot === e.slot && !entry.hit) {
          log[i] = { ...entry, hit: { damage: e.damage, blocked: e.blocked } }
          break
        }
      }
      return {
        ...v,
        slots,
        log,
        preyHp: e.preyHp,
        damage: v.damage + e.damage,
        guard: v.guard + e.guard,
        preyPulse: e.damage > 0 ? v.preyPulse + 1 : v.preyPulse,
        lastDamage: e.damage,
      }
    }
    case 'revive':
      return { ...v, preyHp: e.hp, preyMax: e.hp, revived: true, log: [...v.log, { k: 'prey', what: 'revive', hp: e.hp }] }
    case 'preyDown':
      return { ...v, preyHp: 0, down: true, active: null, log: [...v.log, { k: 'prey', what: 'down' }] }
    case 'preyAction':
      return {
        ...v,
        active: null,
        action: e,
        tamerHp: e.tamerHp,
        preyHp: e.preyHp,
        tamerPulse: e.tamerDamage > 0 ? v.tamerPulse + 1 : v.tamerPulse,
        log: [...v.log, { k: 'action', intent: e.intent, attack: e.attack, absorbed: e.absorbed, tamerDamage: e.tamerDamage, recovered: e.recovered, fled: e.fled }],
      }
    case 'phase':
      return { ...v, phaseText: e.text, log: [...v.log, { k: 'prey', what: 'phase', text: e.text }] }
    case 'huntRoundEnd':
      return { ...v, active: null, done: true, outcome: e.outcome, log: [...v.log, { k: 'huntEnd', damage: e.damage, guard: e.guard, outcome: e.outcome }] }
    case 'roundEnd':
      // Av turunu motorun roundEnd'i değil huntRoundEnd kapatır (yaratığın hamlesi ondan sonra gelir).
      return { ...v, slots: v.slots.map((s) => ({ ...s, income: null, note: null })), active: null }
    default:
      return { ...v, ...applyEvent(v, e) }
  }
}

/** Avda vuruş (hit) adımdır; yetenek olayı onunla aynı adımda gösterilir. */
export function isHuntBeat(e: HuntEvent): boolean {
  return e.t === 'hit' || e.t === 'exhausted' || e.t === 'rebirth' || e.t === 'preyAction' || e.t === 'preyDown' || e.t === 'phase' || e.t === 'revive'
}
