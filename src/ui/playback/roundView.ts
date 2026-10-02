import type { DurabilitySource, IncomeDetail, RoundEvent } from '../../core/engine/events.ts'
import type { AbilityTrigger, CardDef, LinkState } from '../../core/types.ts'

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
  income: number | null
  pulse: number
  total: number
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
  | { k: 'ability'; slot: number; on: AbilityTrigger | 'retrigger'; income: number; detail: IncomeDetail; cost?: { from: number; to: number } }
  /** by: değişime yol açan yeteneğin sahibi (yetenek kaynaklıysa). */
  | { k: 'durability'; slot: number; from: number; to: number; source: DurabilitySource; by: number | null }
  | { k: 'heat'; value: number; by: number | null }
  | { k: 'status'; slot: number; what: 'ward' | 'exhausted' | 'rebirth' | 'reactivated' }
  | { k: 'cap' }
  | { k: 'end'; total: number; triggers: number; passes: number }

export function initialView(cards: readonly CardDef[]): RoundView {
  return {
    slots: cards.map((c) => ({
      durability: c.durability,
      maxDurability: c.durability,
      passive: false,
      ward: (c.keywords ?? []).includes('ward'),
      income: null,
      pulse: 0,
      total: 0,
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
  const slots = v.slots.map((s) => ({ ...s, income: null as number | null }))
  const log = (entry: LogEntry) => [...v.log, entry]
  switch (e.t) {
    case 'roundStart':
      return { ...v, log: log({ k: 'section', pass: 0 }) }
    case 'links':
      return { ...v, links: e.links }
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
        log: withAbility(v.log, { k: 'ability', slot: e.slot, on: e.on, income: e.income, detail: e.detail }),
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
