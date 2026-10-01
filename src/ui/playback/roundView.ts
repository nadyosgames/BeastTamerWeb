import type { RoundEvent } from '../../core/engine/events.ts'
import type { CardDef, LinkState } from '../../core/types.ts'

/**
 * Motorun olay akışından ekrandaki tur durumunu türeten saf reducer.
 * Oyun mantığı burada yeniden hesaplanmaz; yalnızca olaylar uygulanır. Unity'deki
 * oynatıcı da aynı kuralla yazılır: olay → görsel durum.
 */
export interface SlotView {
  durability: number
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
  log: string[]
  done: boolean
  capped: boolean
}

export function initialView(cards: readonly CardDef[]): RoundView {
  return {
    slots: cards.map((c) => ({
      durability: c.durability,
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

const ON_LABEL: Record<string, string> = {
  harvest: 'Harvest',
  howl: 'Howl',
  lastBreath: 'Last Breath',
  epilogue: 'Epilogue',
  haunt: 'Haunt',
  retrigger: 'Ek tetik',
  aura: 'Aura',
}

export function applyEvent(v: RoundView, e: RoundEvent, cards: readonly CardDef[]): RoundView {
  const slots = v.slots.map((s) => ({ ...s, income: null as number | null }))
  const name = (i: number) => cards[i]?.name ?? `#${i + 1}`
  switch (e.t) {
    case 'roundStart':
      return v
    case 'links':
      return { ...v, links: e.links }
    case 'passStart':
      return { ...v, slots, pass: e.pass, active: null, passTotals: [...v.passTotals, 0], log: [...v.log, `— Geçiş ${e.pass} —`] }
    case 'ability': {
      const s = slots[e.slot]
      s.income = e.income
      s.pulse = v.slots[e.slot].pulse + 1
      s.total += e.income
      const passTotals = v.passTotals.length ? [...v.passTotals] : [0]
      passTotals[passTotals.length - 1] += e.income
      const d = e.detail
      const why = [
        `${+d.flat.toFixed(2)}`,
        d.mult !== 1 ? `×${+d.mult.toFixed(2)}` : '',
        d.copied ? `+${+d.copied.toFixed(2)} kopya` : '',
        d.global !== 1 ? `×${+d.global.toFixed(2)} global` : '',
      ].join(' ')
      return {
        ...v,
        slots,
        active: e.slot,
        total: v.total + e.income,
        passTotals,
        log: [...v.log, `${name(e.slot)} · ${ON_LABEL[e.on]} +${e.income}  (${why.trim()})`],
      }
    }
    case 'durability':
      slots[e.slot].durability = e.to
      return { ...v, slots }
    case 'ward':
      slots[e.slot].ward = false
      return { ...v, slots, log: [...v.log, `${name(e.slot)} · Ward kaybı engelledi`] }
    case 'exhausted':
      slots[e.slot].passive = true
      return { ...v, slots, log: [...v.log, `${name(e.slot)} pasife geçti`] }
    case 'rebirth':
      slots[e.slot].durability = 1
      return { ...v, slots, log: [...v.log, `${name(e.slot)} · Rebirth`] }
    case 'reactivated':
      slots[e.slot].passive = false
      return { ...v, slots }
    case 'heat':
      return { ...v, heat: e.value }
    case 'passEnd':
      return v
    case 'cap':
      return { ...v, capped: true, log: [...v.log, 'Tetik sınırı aşıldı, tur kapandı'] }
    case 'roundEnd':
      return { ...v, slots, active: null, done: true, log: [...v.log, `Tur bitti: ${e.total} kaynak, ${e.triggers} tetik`] }
  }
}

/** Görsel olarak "adım" sayılan olaylar (bunlar arasında bekleme yapılır). */
export function isBeat(e: RoundEvent): boolean {
  return e.t === 'ability' || e.t === 'exhausted' || e.t === 'rebirth'
}
