import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { dateOf, generateWeekWeather } from '../core/calendar.ts'
import { quotaForWeek } from '../core/economy.ts'
import { createRng, deriveSeed } from '../core/rng.ts'
import { content } from '../ui/content.ts'
import type { Speed } from '../ui/playback/useRoundPlayback.ts'
import { playerDeck, playerDeckCards, playerDeckStatus, type PlayerDeck } from './decks.ts'

/**
 * Playtest profili (tarayıcıda kalıcı): takvim, haftalık kota ve her günün ayrıntılı kaydı.
 * Kayıtlar "JSON indir" ile dışa aktarılır; gerçek oyuncu verisi simülasyon varsayımlarıyla
 * (planlama süresi, usta bota göre verim) karşılaştırılır.
 */
export interface RoundLog {
  hand: string[]
  arrangement: string[]
  total: number
  /** Aynı elin en iyi dizilimdeki geliri (usta bot). */
  best: number
  planningSec: number
}

export interface DayLog {
  dayIndex: number
  week: number
  weather: string
  deck: string
  tamer: string
  total: number
  best: number
  rounds: RoundLog[]
  seconds: number
  finishedAt: string
}

export interface WeekLog {
  week: number
  quota: number
  income: number
  passed: boolean
}

interface Profile {
  version: 1
  seed: number
  dayIndex: number
  weekIncome: number
  weekOf: number
  weekWeather: string[]
  lifetime: number
  days: DayLog[]
  weeks: WeekLog[]
  deckId: string
  tamerId: string
  /** Her destenin kendi Tamer'ı; deste seçimi iki kimliği birlikte değiştirir. */
  deckTamers: Record<string, string>
  customDecks: Record<string, PlayerDeck>
  speed: Speed
  preview: boolean
  /** Eğitim bitirildi ya da atlandı; OYNA artık eğitimi önermez. */
  tutorialDone: boolean
}

interface GameActions {
  ensureWeek(): void
  setDeck(id: string): void
  setTamer(id: string): void
  setDeckTamer(deckId: string, tamerId: string): void
  createDeck(name: string, tamerId: string): string
  renameDeck(deckId: string, name: string): void
  resetPresetDeck(deckId: string): boolean
  addDeckCard(deckId: string, cardId: string): boolean
  removeDeckCard(deckId: string, cardId: string): void
  setSpeed(s: Speed): void
  setPreview(v: boolean): void
  setTutorialDone(v: boolean): void
  /** Günü kaydeder; hafta bittiyse hafta sonucunu döner. */
  recordDay(log: Omit<DayLog, 'dayIndex' | 'week' | 'finishedAt'>): WeekLog | null
  reset(): void
}

const fresh = (): Profile => ({
  version: 1,
  seed: (Math.random() * 2 ** 32) >>> 0,
  dayIndex: 0,
  weekIncome: 0,
  weekOf: -1,
  weekWeather: [],
  lifetime: 0,
  days: [],
  weeks: [],
  deckId: content.starter.deck,
  tamerId: content.starter.tamer,
  deckTamers: Object.fromEntries(content.decks.map((d) => [d.id, d.tamer])),
  customDecks: {},
  speed: 1,
  preview: false,
  tutorialDone: false,
})

export const useGame = create<Profile & GameActions>()(
  persist(
    (set, get) => ({
      ...fresh(),
      ensureWeek() {
        const s = get()
        const week = currentWeek(s.dayIndex)
        if (s.weekOf === week && s.weekWeather.length) return
        const prev = s.weekWeather.at(-1)
        const weather = generateWeekWeather(content.weather, content.calendar, createRng(deriveSeed(s.seed, week, 77)), prev)
        set({ weekOf: week, weekWeather: weather })
      },
      setDeck(deckId) {
        const deck = playerDeck(get(), deckId)
        if (!deck) return
        const tamerId = deck.tamer
        if (!playerDeckStatus(get(), deckId).ready) return
        set({ deckId, tamerId })
      },
      setTamer: (tamerId) => get().setDeckTamer(get().deckId, tamerId),
      setDeckTamer(deckId, tamerId) {
        const deck = playerDeck(get(), deckId)
        const tamer = content.tamerById.get(tamerId)
        if (!deck || !tamer || playerDeckCards(get(), deckId).length > tamer.deckSize) return
        set((s) => ({
          deckTamers: { ...s.deckTamers, [deckId]: tamerId },
          ...(s.deckId === deckId ? { tamerId } : {}),
        }))
      },
      createDeck(name, tamerId) {
        if (!content.tamerById.has(tamerId)) return ''
        const id = `deck_${crypto.randomUUID().replaceAll('-', '')}`
        const deck: PlayerDeck = { id, name: name.trim().slice(0, 40) || 'Yeni Deste', tamer: tamerId, text: '', cards: [] }
        set((s) => ({ customDecks: { ...s.customDecks, [id]: deck }, deckTamers: { ...s.deckTamers, [id]: tamerId } }))
        return id
      },
      renameDeck(deckId, name) {
        const deck = playerDeck(get(), deckId)
        if (!deck || !name.trim()) return
        set((s) => ({ customDecks: { ...s.customDecks, [deckId]: { ...deck, name: name.trim().slice(0, 40) } } }))
      },
      resetPresetDeck(deckId) {
        const preset = content.deckById.get(deckId)
        if (!preset) return false
        set((s) => {
          const customDecks = { ...s.customDecks }
          delete customDecks[deckId]
          return { customDecks, deckTamers: { ...s.deckTamers, [deckId]: preset.tamer }, ...(s.deckId === deckId ? { tamerId: preset.tamer } : {}) }
        })
        return true
      },
      addDeckCard(deckId, cardId) {
        const s = get()
        const deck = playerDeck(s, deckId)
        const card = content.cardById.get(cardId)
        if (!deck || !card) return false
        const entry = deck.cards.find((c) => c.card === cardId)
        if ((entry?.count ?? 0) >= content.economy.rarities[card.rarity].deckLimit) return false
        if (playerDeckCards(s, deckId).length >= content.tamer(deck.tamer).deckSize) return false
        const cards = entry ? deck.cards.map((c) => c.card === cardId ? { ...c, count: c.count + 1 } : c) : [...deck.cards, { card: cardId, count: 1 }]
        set({ customDecks: { ...s.customDecks, [deckId]: { ...deck, cards } } })
        return true
      },
      removeDeckCard(deckId, cardId) {
        const s = get()
        const deck = playerDeck(s, deckId)
        if (!deck) return
        const cards = deck.cards.map((c) => c.card === cardId ? { ...c, count: c.count - 1 } : c).filter((c) => c.count > 0)
        set({ customDecks: { ...s.customDecks, [deckId]: { ...deck, cards } } })
      },
      setSpeed: (speed) => set({ speed }),
      setPreview: (preview) => set({ preview }),
      setTutorialDone: (tutorialDone) => set({ tutorialDone }),
      recordDay(log) {
        const s = get()
        const week = currentWeek(s.dayIndex)
        const day: DayLog = { ...log, dayIndex: s.dayIndex, week, finishedAt: new Date().toISOString() }
        const weekIncome = s.weekIncome + log.total
        const dayIndex = s.dayIndex + 1
        const weekEnded = dayIndex % content.calendar.daysPerWeek === 0
        let weekLog: WeekLog | null = null
        if (weekEnded) {
          const quota = weekQuota(week, s.weeks)
          weekLog = { week, quota, income: weekIncome, passed: weekIncome >= quota }
        }
        set({
          days: [...s.days, day],
          dayIndex,
          lifetime: s.lifetime + log.total,
          weekIncome: weekEnded ? 0 : weekIncome,
          weeks: weekLog ? [...s.weeks, weekLog] : s.weeks,
        })
        return weekLog
      },
      reset: () => set(fresh()),
    }),
    {
      name: 'canavar-deste-playtest-v1',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      merge(persisted, current) {
        const saved = persisted as Partial<Profile> | undefined
        const deckTamers = { ...current.deckTamers, ...saved?.deckTamers }
        const customDecks = { ...current.customDecks, ...saved?.customDecks }
        // Eski profilin aktif Tamer seçimini bağlı olduğu destede koru.
        if (!saved?.deckTamers && saved?.deckId && saved.tamerId) deckTamers[saved.deckId] = saved.tamerId
        const deckId = playerDeck({ customDecks, deckTamers }, saved?.deckId ?? '') ? saved!.deckId! : current.deckId
        const candidate = deckTamers[deckId]
        const tamerId = content.tamerById.has(candidate) ? candidate : playerDeck({ customDecks, deckTamers }, deckId)!.tamer
        return { ...current, ...saved, deckId, deckTamers, customDecks, tamerId }
      },
    },
  ),
)

export function currentWeek(dayIndex: number): number {
  return Math.floor(dayIndex / content.calendar.daysPerWeek)
}

/** Haftanın kotası (kalibre eğri) + art arda kaçırılan haftalarda yumuşak başarısızlık indirimi. */
export function weekQuota(week: number, weeks: WeekLog[]): number {
  const base = quotaForWeek(week, content.economy, content.balance)
  const { missedWeeks, quotaReductionPct } = content.economy.softFail
  const recent = weeks.slice(-missedWeeks)
  const softFail = recent.length === missedWeeks && recent.every((w) => !w.passed)
  return softFail ? Math.round(base * (1 - quotaReductionPct / 100)) : base
}

export function calendarLabel(dayIndex: number): string {
  const d = dateOf(dayIndex, content.calendar)
  const z = content.calendar.zodiac.find((x) => x.id === d.zodiacId)?.name ?? d.zodiacId
  return `${z} Yılı · Ay ${d.month} · Hafta ${d.week}`
}
