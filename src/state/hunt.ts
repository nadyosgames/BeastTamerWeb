import { create } from 'zustand'
import { hashId, huntWeather } from '../core/expedition.ts'
import { prepareHuntRound, resolveHuntRound, startHunt as newHunt, type HuntEvent, type HuntRoundResult, type HuntState } from '../core/hunt.ts'
import { createRng, deriveSeed } from '../core/rng.ts'
import type { CardDef, HuntDef, Intent, TamerDef } from '../core/types.ts'
import { bestHuntArrangement, runHunt } from '../sim/hunt.ts'
import { content } from '../ui/content.ts'
import { playerDeck, playerDeckCards, playerDeckStatus } from './decks.ts'
import { huntAvailability, huntStartHp, todayWeather, useGame, worldPassives, type HuntReport, type HuntSummary, type RoundLog } from './game.ts'

/**
 * Bir avın akışı (GDD v0.8): yaratığın niyeti görünür → oyuncu eldeki kartları dizer → BAŞLAT →
 * av katmanı turu çözer, olaylar oynatılır (hasar, Koruma, yaratığın saldırısı) → sonraki tur ya da
 * avın sonucu. Kalıcı değildir: sayfa yenilenirse av yarıda kalır, profil etkilenmez.
 *
 * Elin modeli: `hand` bu turda çekilen kartlar (indeks = kart örneği), `slots[i]` o slottaki kartın
 * el indeksi ya da boş. Slotta olmayan kartlar eldedir.
 */
export type HuntStatus = 'idle' | 'arrange' | 'playing' | 'roundDone' | 'huntDone'

export interface RoundRecord extends RoundLog {
  bestArrangement: string[]
  result: HuntRoundResult
}

interface HuntFlow {
  status: HuntStatus
  mode: 'hunt' | 'tutorial'
  huntId: string
  deckId: string
  tamerId: string
  weatherId: string
  /** Yaratığın av başındaki canı (yaralı ya da kuşatma). */
  startHp: number
  /** Turun başındaki durum (oynatma bunun üstüne kurulur). */
  before: HuntState | null
  /** Son çözülen turdan sonraki durum (dizimde before ile aynı). */
  state: HuntState | null
  roundIndex: number
  hand: CardDef[]
  slots: (number | null)[]
  arrangement: CardDef[]
  events: HuntEvent[] | null
  rounds: RoundRecord[]
  played: string[]
  startedAt: number
  roundStartedAt: number
  summary: HuntSummary | null
  /** Ava başlar; olmazsa nedenini döner. */
  startHunt(huntId: string): string | null
  startTutorial(hunt: HuntDef, hands: CardDef[][]): void
  place(k: number, slot: number): void
  unplace(k: number): void
  autoFill(): void
  clearSlots(): void
  play(): void
  playbackDone(): void
  next(): void
  /** Avdan çekilir: yaratık kaçmış sayılır (yaralı kalır, seri bozulur). Eğitimde yalnızca çıkar. */
  abandon(): void
  leave(): void
}

const idle = {
  status: 'idle' as HuntStatus,
  mode: 'hunt' as HuntFlow['mode'],
  before: null,
  state: null,
  roundIndex: 0,
  hand: [],
  slots: [],
  arrangement: [],
  events: null,
  rounds: [],
  played: [],
  summary: null,
}

const emptySlots = (hand: CardDef[]) => Array.from({ length: hand.length }, () => null)

/** Eğitim avının Tamer'ı: pasif yok, hava yok. */
export const TUTORIAL_TAMER: TamerDef = { id: 'tutorial', name: 'Sen', deckSize: 9, slots: 3, hp: 30, modifiers: [], text: '', unlock: { kind: 'start' } }

/** Av kurulumunun ortak kısmı: ekran avı ve Hızlı Av aynı kuralla başlar. */
function huntSetup(huntId: string): { error: string } | { setup: Parameters<typeof newHunt>[0]; weather: string; seed: number; deckId: string } {
  const g = useGame.getState()
  const hunt = content.hunt(huntId)
  const exp = g.expedition
  const avail = huntAvailability(g, hunt)
  if (!avail.ok) return { error: avail.text }
  if (!exp) return { error: 'Önce sefere çık' }
  const deck = playerDeck(g, g.deckId)
  if (!deck || !playerDeckStatus(g, g.deckId).ready) return { error: 'Seçili deste ava hazır değil' }
  if (deck.tamer !== exp.tamer) return { error: `Bu sefer ${content.tamer(exp.tamer).name} ile: onun destelerinden birini seç` }
  const siege = exp.siege?.hunt === hunt.id ? exp.siege : null
  const siegeDay = siege?.day ?? 0
  if (hunt.siege && siege?.decks.includes(deck.id)) return { error: 'Kuşatmanın her günü farklı bir deste ister' }
  const weather = huntWeather(hunt, todayWeather(g, hunt.region), siegeDay)
  return {
    weather,
    deckId: deck.id,
    seed: deriveSeed(g.seed, g.day, hashId(hunt.id)),
    setup: {
      hunt: content.scaledHunt(hunt.id),
      hp: content.huntHp(hunt.id),
      startHp: huntStartHp(g, hunt),
      deck: playerDeckCards(g, deck.id),
      tamer: content.tamer(exp.tamer),
      tamerHp: exp.tamerHp,
      weather: content.weatherById.get(weather) ?? null,
      passives: worldPassives(g),
      fatigued: siege ? new Set(siege.fatigued) : undefined,
      siegeContinues: !!hunt.siege && siegeDay + 1 < hunt.siege.weathers.length,
    },
  }
}

export function intentLabel(intent: Intent): string {
  switch (intent.kind) {
    case 'claw':
      return `Pençe ${intent.damage}`
    case 'rend':
      return `Yırtma (${intent.slot}. slot)`
    case 'tailSweep':
      return `Kuyruk Savurma (sağdaki ${intent.count})`
    case 'roar':
      return `Kükreme (${intent.slot}. slot)`
    case 'evade':
      return 'Savuşturma'
    case 'recover':
      return `Toparlanma ${intent.amount}`
    case 'charge':
      return 'Şarj'
    case 'flee':
      return `Kaçış Hazırlığı (${intent.damage})`
    case 'scorch':
      return 'Alev Yağmuru'
  }
}

export const useHunt = create<HuntFlow>((set, get) => ({
  ...idle,
  huntId: '',
  deckId: '',
  tamerId: '',
  weatherId: '',
  startHp: 0,
  startedAt: 0,
  roundStartedAt: 0,

  startHunt(huntId) {
    const r = huntSetup(huntId)
    if ('error' in r) return r.error
    const state = newHunt(r.setup, createRng(r.seed))
    const hand = state.hands[0].slice()
    const now = performance.now()
    set({
      ...idle,
      status: 'arrange',
      huntId,
      deckId: r.deckId,
      tamerId: r.setup.tamer.id,
      weatherId: r.weather,
      startHp: state.prey.hp,
      before: state,
      state,
      hand,
      slots: emptySlots(hand),
      startedAt: now,
      roundStartedAt: now,
    })
    return null
  },

  startTutorial(hunt, hands) {
    const base = newHunt({ hunt, hp: hunt.hp, deck: hands.flat(), tamer: TUTORIAL_TAMER, tamerHp: TUTORIAL_TAMER.hp }, createRng(1))
    const state: HuntState = { ...base, hands }
    const hand = hands[0].slice()
    const now = performance.now()
    set({
      ...idle,
      mode: 'tutorial',
      status: 'arrange',
      huntId: hunt.id,
      deckId: '',
      tamerId: TUTORIAL_TAMER.id,
      weatherId: '',
      startHp: hunt.hp,
      before: state,
      state,
      hand,
      slots: emptySlots(hand),
      startedAt: now,
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
    if (s.status !== 'arrange' || !s.state || s.slots.some((x) => x === null)) return
    const arrangement = s.slots.map((k) => s.hand[k!])
    const prep = prepareHuntRound(s.state, arrangement.length)
    const events: HuntEvent[] = []
    const { state: next, result } = resolveHuntRound(s.state, arrangement, (e) => events.push(e), prep)
    const best = bestHuntArrangement(s.state, arrangement, prep)
    const bestResult = resolveHuntRound(s.state, best.arrangement, undefined, prep).result
    const record: RoundRecord = {
      hand: s.hand.map((c) => c.id),
      arrangement: arrangement.map((c) => c.id),
      intent: intentLabel(prep.intent),
      damage: result.damage,
      guard: result.guard,
      best: Math.max(bestResult.damage, result.damage),
      planningSec: Math.round((performance.now() - s.roundStartedAt) / 100) / 10,
      bestArrangement: best.arrangement.map((c) => c.id),
      result,
    }
    set({
      status: 'playing',
      before: s.state,
      state: next,
      arrangement,
      events,
      rounds: [...s.rounds, record],
      played: [...new Set([...s.played, ...record.arrangement])],
    })
  },

  playbackDone() {
    if (get().status === 'playing') set({ status: 'roundDone' })
  },

  next() {
    const s = get()
    if (s.status !== 'roundDone' || !s.state) return
    const st = s.state
    if (!st.outcome) {
      const hand = st.hands[st.round].slice()
      set({ status: 'arrange', before: st, roundIndex: st.round, hand, slots: emptySlots(hand), arrangement: [], events: null, roundStartedAt: performance.now() })
      return
    }
    if (s.mode === 'tutorial') {
      set({ status: 'huntDone', summary: null })
      return
    }
    set({ status: 'huntDone', summary: useGame.getState().finishHunt(report(s, st, st.outcome)) })
  },

  abandon() {
    const s = get()
    if (s.status === 'idle' || s.status === 'huntDone' || s.status === 'playing' || !s.state) return
    if (s.mode === 'tutorial') {
      set({ ...idle })
      return
    }
    // Çözülmüş son turdan sonraki durum (dizimdeyse turun başı) yazılır.
    const st = s.status === 'roundDone' ? s.state : s.before!
    if (st.outcome) {
      get().next()
      return
    }
    set({ status: 'huntDone', summary: useGame.getState().finishHunt(report(s, st, 'escaped')) })
  },

  leave: () => set({ ...idle }),
}))

function report(s: HuntFlow, st: HuntState, outcome: NonNullable<HuntState['outcome']>): HuntReport {
  return {
    hunt: s.huntId,
    deck: s.deckId,
    tamer: s.tamerId,
    weather: s.weatherId,
    outcome,
    capturedRound: st.capturedRound,
    rounds: st.hands.length,
    startHp: s.startHp,
    preyHpEnd: st.prey.hp,
    damage: st.damageDealt,
    tamerDamage: st.tamerDamageTaken,
    tamerHpEnd: st.tamerHp,
    played: s.played,
    roundLogs: s.rounds.slice(0, st.round).map(({ bestArrangement: _b, result: _r, ...r }) => r),
    seconds: Math.round((performance.now() - s.startedAt) / 1000),
  }
}

/**
 * Hızlı Av (GDD v0.8): ★★★ alınmış yaratık, oyuncunun destesiyle usta bot tarafından aynı kurallarla
 * oynanır. Sonuç normal av gibi yazılır (başarısız da olabilir). Kopya toplamayı angaryadan çıkarır.
 */
export function quickHunt(huntId: string): HuntSummary | string {
  const g = useGame.getState()
  if ((g.hunts[huntId]?.stars ?? 0) < 3) return 'Hızlı Av için yaratığı ★★★ ile bayıltmış olmalısın'
  const r = huntSetup(huntId)
  if ('error' in r) return r.error
  const run = runHunt(
    {
      hunt: r.setup.hunt,
      hp: r.setup.hp,
      revive: r.setup.hunt.revive,
      startHp: r.setup.startHp,
      deck: r.setup.deck,
      tamer: r.setup.tamer,
      tamerHp: r.setup.tamerHp,
      weather: r.setup.weather ?? null,
      passives: r.setup.passives,
      fatigued: r.setup.fatigued,
      siegeContinues: r.setup.siegeContinues,
    },
    'aware',
    r.seed,
  )
  return g.finishHunt({
    hunt: huntId,
    deck: r.deckId,
    tamer: r.setup.tamer.id,
    weather: r.weather,
    outcome: run.outcome,
    capturedRound: run.capturedRound === null ? null : run.capturedRound - 1,
    rounds: Math.ceil(r.setup.deck.length / r.setup.tamer.slots),
    startHp: r.setup.startHp ?? r.setup.hp,
    preyHpEnd: run.preyHpEnd,
    damage: run.damage,
    tamerDamage: run.tamerDamage,
    tamerHpEnd: run.tamerHpEnd,
    played: [...run.played],
    roundLogs: [],
    seconds: 0,
    quick: true,
  })
}
