import { create } from 'zustand'
import { DEFAULT_TRIGGER_CAP, planDay, roundContext, type DayPlan } from '../core/day.ts'
import { compileModifiers } from '../core/engine/modifiers.ts'
import type { RoundEvent } from '../core/engine/events.ts'
import { resolveRound } from '../core/engine/round.ts'
import { createRng, deriveSeed } from '../core/rng.ts'
import type { CardDef } from '../core/types.ts'
import { masterArranger } from '../sim/arrangers.ts'
import { content } from '../ui/content.ts'
import { useGame, type RoundLog, type WeekLog } from './game.ts'
import { playerDeckCards, playerDeckStatus } from './decks.ts'

/**
 * Bir günün (maçın) akışı: deste karılır (tohum: profil + gün), her turda kartlar ele gelir,
 * oyuncu hepsini slotlara yerleştirir, motor turu çözer ve UI olayları oynatır.
 * Kalıcı değildir: sayfa yenilenirse gün baştan başlar (aynı tohum → aynı eller).
 *
 * Elin modeli: `hand` bu turda çekilen kartlar (indeks = kart örneği), `slots[i]` o slottaki
 * kartın el indeksi ya da boş. Slotta olmayan kartlar eldedir.
 */
export type RunStatus = 'idle' | 'arrange' | 'playing' | 'roundDone' | 'dayDone'

export interface RoundRecord extends RoundLog {
  bestArrangement: string[]
}

interface RunState {
  status: RunStatus
  /** 'tutorial': sabit eller, hava/Tamer yok, profil ve haftalık kota etkilenmez. */
  mode: 'day' | 'tutorial'
  deckId: string
  tamerId: string
  weatherId: string
  dayIndex: number
  plan: DayPlan | null
  roundIndex: number
  hand: CardDef[]
  slots: (number | null)[]
  /** Oynanan dizilim (BAŞLAT sonrası; olay akışının slot indeksleri buna göredir). */
  arrangement: CardDef[]
  events: RoundEvent[] | null
  rounds: RoundRecord[]
  dayStartedAt: number
  roundStartedAt: number
  weekResult: WeekLog | null
  startDay(): void
  /** Verilen sabit ellerle eğitim günü başlatır (slot sayısı = el büyüklüğü). */
  startTutorial(hands: CardDef[][]): void
  /** El kartını (k) slota koyar; slot doluysa kartlar yer değiştirir (eldeki karta karşılık ele döner). */
  place(k: number, slot: number): void
  /** Kartı slottan ele geri alır. */
  unplace(k: number): void
  /** Eldeki kartları boş slotlara sırayla yerleştirir. */
  autoFill(): void
  /** Tüm kartları ele geri alır. */
  clearSlots(): void
  play(): void
  playbackDone(): void
  next(): void
  leave(): void
}

const idle = {
  status: 'idle' as RunStatus,
  mode: 'day' as RunState['mode'],
  plan: null,
  roundIndex: 0,
  hand: [],
  slots: [],
  arrangement: [],
  events: null,
  rounds: [],
  weekResult: null,
}

const emptySlots = (hand: CardDef[]) => Array.from({ length: hand.length }, () => null)

export const useRun = create<RunState>((set, get) => ({
  ...idle,
  deckId: '',
  tamerId: '',
  weatherId: '',
  dayIndex: 0,
  dayStartedAt: 0,
  roundStartedAt: 0,

  startDay() {
    if (!playerDeckStatus(useGame.getState(), useGame.getState().deckId).ready) return
    useGame.getState().ensureWeek()
    const { dayIndex, seed, deckId, tamerId, weekWeather } = useGame.getState()
    const weatherId = weekWeather[dayIndex % content.calendar.daysPerWeek] ?? 'calm'
    const deck = playerDeckCards(useGame.getState(), deckId)
    const plan = planDay(
      { deck, tamer: content.tamer(tamerId), weather: content.weatherById.get(weatherId) },
      createRng(deriveSeed(seed, dayIndex)),
    )
    const now = performance.now()
    const hand = plan.hands[0].slice()
    set({
      ...idle,
      status: 'arrange',
      deckId,
      tamerId,
      weatherId,
      dayIndex,
      plan,
      hand,
      slots: emptySlots(hand),
      dayStartedAt: now,
      roundStartedAt: now,
    })
  },

  startTutorial(hands) {
    const plan: DayPlan = { mods: compileModifiers({}), slots: hands[0].length, hands, triggerCap: DEFAULT_TRIGGER_CAP }
    const now = performance.now()
    const hand = hands[0].slice()
    set({
      ...idle,
      mode: 'tutorial',
      status: 'arrange',
      deckId: '',
      tamerId: '',
      weatherId: '',
      plan,
      hand,
      slots: emptySlots(hand),
      dayStartedAt: now,
      roundStartedAt: now,
    })
  },

  place(k, slot) {
    const s = get()
    if (s.status !== 'arrange' || slot < 0 || slot >= s.slots.length) return
    const slots = s.slots.slice()
    const from = slots.indexOf(k)
    if (from === slot) return
    const occupant = slots[slot]
    slots[slot] = k
    if (from >= 0) slots[from] = occupant
    set({ slots })
  },

  unplace(k) {
    const s = get()
    if (s.status !== 'arrange') return
    set({ slots: s.slots.map((x) => (x === k ? null : x)) })
  },

  autoFill() {
    const s = get()
    if (s.status !== 'arrange') return
    const slots = s.slots.slice()
    const inHand = s.hand.map((_, k) => k).filter((k) => !slots.includes(k))
    for (let i = 0; i < slots.length && inHand.length; i++) if (slots[i] === null) slots[i] = inHand.shift()!
    set({ slots })
  },

  clearSlots() {
    const s = get()
    if (s.status === 'arrange') set({ slots: emptySlots(s.hand) })
  },

  play() {
    const s = get()
    if (s.status !== 'arrange' || !s.plan || s.slots.some((x) => x === null)) return
    const arrangement = s.slots.map((k) => s.hand[k!])
    const ctx = roundContext(s.plan, s.roundIndex)
    const events: RoundEvent[] = []
    const result = resolveRound(arrangement, ctx, (e) => events.push(e))
    const best = masterArranger(arrangement, ctx)
    const bestTotal = resolveRound(best, ctx).total
    const record: RoundRecord = {
      hand: s.hand.map((c) => c.id),
      arrangement: arrangement.map((c) => c.id),
      total: result.total,
      best: Math.max(bestTotal, result.total),
      planningSec: Math.round((performance.now() - s.roundStartedAt) / 100) / 10,
      bestArrangement: best.map((c) => c.id),
    }
    set({ status: 'playing', arrangement, events, rounds: [...s.rounds, record] })
  },

  playbackDone() {
    if (get().status === 'playing') set({ status: 'roundDone' })
  },

  next() {
    const s = get()
    if (s.status !== 'roundDone' || !s.plan) return
    const nextRound = s.roundIndex + 1
    if (nextRound < s.plan.hands.length) {
      const hand = s.plan.hands[nextRound].slice()
      set({
        status: 'arrange',
        roundIndex: nextRound,
        hand,
        slots: emptySlots(hand),
        arrangement: [],
        events: null,
        roundStartedAt: performance.now(),
      })
      return
    }
    if (s.mode === 'tutorial') {
      set({ status: 'dayDone', weekResult: null })
      return
    }
    const total = s.rounds.reduce((a, r) => a + r.total, 0)
    const weekResult = useGame.getState().recordDay({
      weather: s.weatherId,
      deck: s.deckId,
      tamer: s.tamerId,
      total,
      best: s.rounds.reduce((a, r) => a + r.best, 0),
      rounds: s.rounds.map(({ bestArrangement: _b, ...r }) => r),
      seconds: Math.round((performance.now() - s.dayStartedAt) / 1000),
    })
    set({ status: 'dayDone', weekResult })
  },

  leave: () => set({ ...idle }),
}))

export function remainingCards(plan: DayPlan | null, roundIndex: number): number {
  if (!plan) return 0
  return plan.hands.slice(roundIndex + 1).reduce((a, h) => a + h.length, 0)
}
