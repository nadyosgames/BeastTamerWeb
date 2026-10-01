import { compileModifiers, type ModifierSet } from './engine/modifiers.ts'
import { resolveRound, type RoundResult } from './engine/round.ts'
import type { EventSink } from './engine/events.ts'
import type { RoundContext } from './engine/state.ts'
import { shuffle, type Rng } from './rng.ts'
import type { CardDef, Modifier, TamerDef, WeatherDef } from './types.ts'

/**
 * Gün = bir maç: deste karılır, slot sayısı kadar kartlık turlara bölünür,
 * her tur oyuncu (ya da bot) kartları dizer ve tur çözülür. Turlar arası durum taşınmaz.
 */
export const DEFAULT_TRIGGER_CAP = 60

export interface DaySetup {
  deck: readonly CardDef[]
  tamer: TamerDef
  weather?: WeatherDef | null
  passives?: Modifier[]
  triggerCap?: number
}

export interface DayPlan {
  mods: ModifierSet
  slots: number
  hands: CardDef[][]
  triggerCap: number
}

/** Oyuncunun/botun dizilim kararı: eldeki kartları slot sırasına koyar. */
export type Arranger = (hand: readonly CardDef[], ctx: RoundContext) => CardDef[]

export interface DayResult {
  total: number
  triggers: number
  steps: number
  rounds: RoundResult[]
}

export function planDay(setup: DaySetup, rng: Rng): DayPlan {
  const slots = setup.tamer.slots
  const order = shuffle(setup.deck, rng)
  const hands: CardDef[][] = []
  for (let i = 0; i < order.length; i += slots) hands.push(order.slice(i, i + slots))
  return {
    mods: compileModifiers({ weather: setup.weather, tamer: setup.tamer, passives: setup.passives }),
    slots,
    hands,
    triggerCap: setup.triggerCap ?? DEFAULT_TRIGGER_CAP,
  }
}

export function roundContext(plan: DayPlan, roundIndex: number): RoundContext {
  return { mods: plan.mods, roundIndex, roundCount: plan.hands.length, triggerCap: plan.triggerCap }
}

export function playRound(plan: DayPlan, roundIndex: number, arrangement: readonly CardDef[], emit?: EventSink) {
  return resolveRound(arrangement, roundContext(plan, roundIndex), emit)
}

/** Tüm günü bir dizilim stratejisiyle oynar (simülasyon). */
export function playDay(setup: DaySetup, rng: Rng, arrange: Arranger): DayResult {
  const plan = planDay(setup, rng)
  const result: DayResult = { total: 0, triggers: 0, steps: 0, rounds: [] }
  plan.hands.forEach((hand, i) => {
    const ctx = roundContext(plan, i)
    const r = resolveRound(arrange(hand, ctx), ctx)
    result.total += r.total
    result.triggers += r.triggers
    result.steps += r.steps
    result.rounds.push(r)
  })
  return result
}
