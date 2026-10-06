import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { packPrice, type Collection } from '../core/economy.ts'
import {
  huntReward,
  huntStars,
  huntUnlocked,
  regionBookComplete,
  regionForecast,
  regionUnlocked,
  restHeal,
  startExpedition as newExpedition,
  woundedHp,
  type Expedition,
  type HuntReward,
} from '../core/expedition.ts'
import type { HuntOutcome } from '../core/hunt.ts'
import { addToCollection, openPack } from '../core/packs.ts'
import { createRng, deriveSeed } from '../core/rng.ts'
import type { CardDef, Element, HuntDef, Modifier, RegionDef, TamerDef } from '../core/types.ts'
import { content } from '../ui/content.ts'
import type { Speed } from '../ui/playback/useRoundPlayback.ts'
import { playerDeck, playerDeckCards, playerDeckStatus, type PlayerDeck } from './decks.ts'

/**
 * Oyuncu profili (tarayıcıda kalıcı, GDD v0.8): koleksiyon, öz bakiyesi, sefer, av kayıtları.
 * Kurallar src/core'dadır (expedition.ts, hunt.ts); burada yalnızca durum ve kayıt tutulur.
 * Av kayıtları "JSON indir" ile dışa aktarılır, simülasyon varsayımlarıyla karşılaştırılır.
 */
export interface RoundLog {
  hand: string[]
  arrangement: string[]
  intent: string
  damage: number
  guard: number
  /** Aynı elin en iyi dizilimdeki değeri (yaratığı bilen usta bot). */
  best: number
  planningSec: number
}

export interface HuntLog {
  day: number
  hunt: string
  deck: string
  tamer: string
  weather: string
  outcome: HuntOutcome
  rounds: RoundLog[]
  damage: number
  tamerDamage: number
  essence: number
  stars: number
  quick: boolean
  seconds: number
  finishedAt: string
}

export interface HuntRecord {
  stars: 0 | 1 | 2 | 3
  captures: number
  attempts: number
  /** En hızlı bayıltma turu (1 tabanlı). */
  bestRound: number | null
}

/** Kadim kuşatmanın günler arası durumu. */
export interface SiegeState {
  hunt: string
  /** Sıradaki kuşatma günü (0 tabanlı). */
  day: number
  preyHp: number
  /** Önceki günlerde kullanılan desteler (her gün farklı deste). */
  decks: string[]
  /** Dün oynanan kartlar: bugün −1 dayanıklılıkla başlar. */
  fatigued: string[]
}

export interface ActiveExpedition extends Expedition {
  /** Seferin Tamer'ı: canı sefer boyunca taşınır; yalnızca bu Tamer'ın desteleri oynanır. */
  tamer: string
  tamerHp: number
  siege: SiegeState | null
}

/** Avın sonucunu profile yazmak için av akışının verdiği rapor. */
export interface HuntReport {
  hunt: string
  deck: string
  tamer: string
  weather: string
  outcome: HuntOutcome
  /** Bayıltılan tur (0 tabanlı) ya da null. */
  capturedRound: number | null
  rounds: number
  startHp: number
  preyHpEnd: number
  damage: number
  tamerDamage: number
  tamerHpEnd: number
  played: string[]
  roundLogs: RoundLog[]
  seconds: number
  quick?: boolean
}

export interface HuntSummary {
  outcome: HuntOutcome
  hunt: string
  stars: 0 | 1 | 2 | 3
  reward: HuntReward | null
  /** Kart koleksiyona eklendi mi (sınırı aştıysa kopya → öz). */
  cardAdded: boolean
  duplicateEssence: number
  bagLost: number
  bagBanked: number
  woundedHp: number | null
  siegeDay: number | null
  newlyUnlocked: string[]
  newTamers: string[]
  /** Bu bayıltmayla açılan bölgeler (Final). */
  newRegions: string[]
  bookCompleted: boolean
}

export interface PackPurchase {
  cards: CardDef[]
  added: CardDef[]
  duplicates: CardDef[]
  essence: number
  price: number
}

interface Profile {
  version: 2
  seed: number
  /** Gün sayacı: hava bununla ilerler (av, dinlenme ve kampa dönüş birer gün). */
  day: number
  /** Öz bakiyesi (kampta). Seferdeki öz çantadadır. */
  essence: number
  lifetimeEssence: number
  collection: Collection
  packsOpened: number
  pity: number
  hunts: Record<string, HuntRecord>
  /** Dünya haritasında odaktaki bölge: kamptayken sefer buraya çıkar, hava tahmini bunu gösterir. */
  regionId: string
  expedition: ActiveExpedition | null
  logs: HuntLog[]
  deckId: string
  tamerId: string
  /** Her destenin kendi Tamer'ı; deste seçimi iki kimliği birlikte değiştirir. */
  deckTamers: Record<string, string>
  customDecks: Record<string, PlayerDeck>
  speed: Speed
  preview: boolean
  /** Eğitim bitirildi ya da atlandı. */
  tutorialDone: boolean
  /** Playtest kolaylığı: tüm kartlar ve Tamer'lar açık (koleksiyon kısıtı yok). */
  sandbox: boolean
}

interface GameActions {
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
  setSandbox(v: boolean): void
  /** Dünya haritasında bölgeye odaklan (seferdeyken sefer bölgesi değişmez). */
  setRegion(id: string): void
  /** Kamptan odaktaki bölgeye sefere çıkar (aktif destenin Tamer'ıyla). Bölge kilitliyse çıkılmaz. */
  startExpedition(): boolean
  /** 1 Erzak harcar, Tamer'ı iyileştirir, bir gün geçer. Kuşatma varsa biter. */
  rest(): boolean
  /** Çantayı bakiyeye geçirir, sefer biter, bir gün geçer. */
  returnToCamp(): number
  /** Avın sonucunu uygular (ödül, çanta, yara, kuşatma, kayıt). */
  finishHunt(report: HuntReport): HuntSummary
  buyPack(packId: string, element?: Element): PackPurchase | null
  reset(): void
}

export type GameState = Profile & GameActions

const STORAGE_KEY = 'canavar-deste-v08'
const LEGACY_KEY = 'canavar-deste-playtest-v1'

function starterCollection(): Collection {
  const out: Collection = {}
  for (const c of content.starterDeck()) out[c.id] = (out[c.id] ?? 0) + 1
  return out
}

const fresh = (): Profile => ({
  version: 2,
  seed: (Math.random() * 2 ** 32) >>> 0,
  day: 0,
  essence: content.starter.resource,
  lifetimeEssence: 0,
  collection: starterCollection(),
  packsOpened: 0,
  pity: 0,
  hunts: {},
  regionId: content.regions[0].id,
  expedition: null,
  logs: [],
  deckId: content.starter.deck,
  tamerId: content.starter.tamer,
  deckTamers: Object.fromEntries(content.decks.map((d) => [d.id, d.tamer])),
  customDecks: {},
  speed: 1,
  preview: false,
  tutorialDone: false,
  sandbox: false,
})

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      ...fresh(),
      setDeck(deckId) {
        const deck = playerDeck(get(), deckId)
        if (!deck || !playerDeckStatus(get(), deckId).ready) return
        set({ deckId, tamerId: deck.tamer })
      },
      setTamer: (tamerId) => get().setDeckTamer(get().deckId, tamerId),
      setDeckTamer(deckId, tamerId) {
        const s = get()
        const deck = playerDeck(s, deckId)
        const tamer = content.tamerById.get(tamerId)
        if (!deck || !tamer || !tamerUnlocked(s, tamer) || playerDeckCards(s, deckId).length > tamer.deckSize) return
        set((p) => ({
          deckTamers: { ...p.deckTamers, [deckId]: tamerId },
          ...(p.deckId === deckId ? { tamerId } : {}),
        }))
      },
      createDeck(name, tamerId) {
        const tamer = content.tamerById.get(tamerId)
        if (!tamer || !tamerUnlocked(get(), tamer)) return ''
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
        const inDeck = entry?.count ?? 0
        if (inDeck >= content.economy.rarities[card.rarity].deckLimit) return false
        if (!s.sandbox && inDeck >= (s.collection[cardId] ?? 0)) return false
        if (playerDeckCards(s, deckId).length >= content.tamer(deck.tamer).deckSize) return false
        const cards = entry ? deck.cards.map((c) => (c.card === cardId ? { ...c, count: c.count + 1 } : c)) : [...deck.cards, { card: cardId, count: 1 }]
        set({ customDecks: { ...s.customDecks, [deckId]: { ...deck, cards } } })
        return true
      },
      removeDeckCard(deckId, cardId) {
        const s = get()
        const deck = playerDeck(s, deckId)
        if (!deck) return
        const cards = deck.cards.map((c) => (c.card === cardId ? { ...c, count: c.count - 1 } : c)).filter((c) => c.count > 0)
        set({ customDecks: { ...s.customDecks, [deckId]: { ...deck, cards } } })
      },
      setSpeed: (speed) => set({ speed }),
      setPreview: (preview) => set({ preview }),
      setTutorialDone: (tutorialDone) => set({ tutorialDone }),
      setSandbox: (sandbox) => set({ sandbox }),
      setRegion(id) {
        if (get().expedition || !content.regionById.has(id)) return
        set({ regionId: id })
      },

      startExpedition() {
        const s = get()
        if (s.expedition || !playerDeckStatus(s, s.deckId).ready || !regionOpen(s, s.regionId)) return false
        const tamer = content.tamer(s.tamerId)
        set({ expedition: { ...newExpedition(s.regionId, s.day, content.economy.expedition), tamer: tamer.id, tamerHp: tamer.hp, siege: null } })
        return true
      },
      rest() {
        const s = get()
        const exp = s.expedition
        if (!exp || exp.rations <= 0) return false
        const tamer = content.tamer(exp.tamer)
        set({ day: s.day + 1, expedition: { ...exp, rations: exp.rations - 1, tamerHp: restHeal(exp.tamerHp, tamer.hp, content.economy.expedition), siege: null } })
        return true
      },
      returnToCamp() {
        const s = get()
        const exp = s.expedition
        if (!exp) return 0
        set({ day: s.day + 1, essence: s.essence + exp.bag, lifetimeEssence: s.lifetimeEssence + exp.bag, expedition: null })
        return exp.bag
      },
      finishHunt(report) {
        const s = get()
        const exp = s.expedition
        if (!exp) throw new Error('Sefer yok: av sonucu yazılamaz')
        const cfg = content.economy.expedition
        const hunt = content.hunt(report.hunt)
        const card = content.card(hunt.card)
        const tamer = content.tamer(exp.tamer)
        const regionHunts = content.regionHunts(hunt.region)
        const capturedBefore = capturedSet(s)
        const unlockedBefore = new Set(regionHunts.filter((h) => huntUnlocked(h, regionHunts, capturedBefore, exp.trail)).map((h) => h.id))
        const tamersBefore = new Set(content.tamers.filter((t) => tamerUnlocked(s, t)).map((t) => t.id))
        const regionsBefore = new Set(content.regions.filter((r) => regionOpen(s, r.id)).map((r) => r.id))
        const bookBefore = regionBookComplete(regionHunts, capturedBefore)

        const record: HuntRecord = { ...(s.hunts[hunt.id] ?? { stars: 0, captures: 0, attempts: 0, bestRound: null }) }
        record.attempts++
        let next: ActiveExpedition | null = { ...exp, tamerHp: report.tamerHpEnd, hunts: exp.hunts + 1, wounded: { ...exp.wounded } }
        let collection = s.collection
        let essence = s.essence
        let lifetime = s.lifetimeEssence
        const summary: HuntSummary = {
          outcome: report.outcome,
          hunt: hunt.id,
          stars: 0,
          reward: null,
          cardAdded: false,
          duplicateEssence: 0,
          bagLost: 0,
          bagBanked: 0,
          woundedHp: null,
          siegeDay: null,
          newlyUnlocked: [],
          newTamers: [],
          newRegions: [],
          bookCompleted: false,
        }

        switch (report.outcome) {
          case 'captured': {
            const reward = huntReward(card.rarity, report.capturedRound ?? report.rounds - 1, report.rounds, exp.streak, cfg)
            const stars = huntStars('captured', report.capturedRound, report.tamerDamage, tamer.hp)
            collection = { ...collection }
            const added = addToCollection(collection, [card], content.economy)
            summary.reward = reward
            summary.stars = stars
            summary.cardAdded = added.added.length > 0
            summary.duplicateEssence = added.essence
            record.captures++
            record.stars = Math.max(record.stars, stars) as HuntRecord['stars']
            record.bestRound = Math.min(record.bestRound ?? 99, (report.capturedRound ?? 0) + 1)
            delete next.wounded[hunt.id]
            next = { ...next, bag: next.bag + reward.essence + added.essence, trail: next.trail + 1, streak: next.streak + 1, siege: null }
            break
          }
          case 'escaped':
          case 'fled': {
            const left = woundedHp(report.startHp, report.damage, cfg)
            if (!hunt.siege) {
              next.wounded[hunt.id] = left
              summary.woundedHp = left
            }
            next = { ...next, streak: 0, siege: null }
            break
          }
          case 'nightfall': {
            const prev = exp.siege?.hunt === hunt.id ? exp.siege : null
            const heal = Math.ceil((tamer.hp * cfg.siegeNightHealPct) / 100)
            next = {
              ...next,
              tamerHp: Math.min(tamer.hp, report.tamerHpEnd + heal),
              siege: { hunt: hunt.id, day: (prev?.day ?? 0) + 1, preyHp: report.preyHpEnd, decks: [...(prev?.decks ?? []), report.deck], fatigued: report.played },
            }
            summary.siegeDay = next.siege!.day
            break
          }
          case 'tamerDown': {
            summary.bagLost = Math.round((next.bag * cfg.bagLossPct) / 100)
            summary.bagBanked = next.bag - summary.bagLost
            essence += summary.bagBanked
            lifetime += summary.bagBanked
            next = null
            break
          }
        }

        const hunts = { ...s.hunts, [hunt.id]: record }
        const after: Profile = { ...s, hunts, collection, essence, lifetimeEssence: lifetime, expedition: next, day: s.day + 1 }
        const capturedAfter = capturedSet(after)
        const trail = next?.trail ?? 0
        summary.newlyUnlocked = regionHunts.filter((h) => !unlockedBefore.has(h.id) && huntUnlocked(h, regionHunts, capturedAfter, trail)).map((h) => h.id)
        summary.newTamers = content.tamers.filter((t) => !tamersBefore.has(t.id) && tamerUnlocked(after, t)).map((t) => t.id)
        summary.newRegions = content.regions.filter((r) => !regionsBefore.has(r.id) && regionOpen(after, r.id)).map((r) => r.id)
        summary.bookCompleted = !bookBefore && regionBookComplete(regionHunts, capturedAfter)

        const log: HuntLog = {
          day: s.day,
          hunt: hunt.id,
          deck: report.deck,
          tamer: report.tamer,
          weather: report.weather,
          outcome: report.outcome,
          rounds: report.roundLogs,
          damage: report.damage,
          tamerDamage: report.tamerDamage,
          essence: (summary.reward?.essence ?? 0) + summary.duplicateEssence,
          stars: summary.stars,
          quick: report.quick ?? false,
          seconds: report.seconds,
          finishedAt: new Date().toISOString(),
        }
        set({ hunts, collection, essence, lifetimeEssence: lifetime, expedition: next, day: s.day + 1, logs: [...s.logs, log] })
        return summary
      },
      buyPack(packId, element) {
        const s = get()
        const pack = content.economy.packs.find((p) => p.id === packId)
        if (!pack) return null
        const price = packPrice(pack, content.economy)
        if (s.essence < price) return null
        const collection = { ...s.collection }
        const opened = openPack(pack, content.packPool, collection, content.economy, createRng(deriveSeed(s.seed, s.packsOpened, 91)), { element, pity: s.pity })
        const added = addToCollection(collection, opened.cards, content.economy)
        set({ collection, essence: s.essence - price + added.essence, packsOpened: s.packsOpened + 1, pity: opened.pity })
        return { cards: opened.cards, added: added.added, duplicates: added.duplicates, essence: added.essence, price }
      },
      reset: () => set(fresh()),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 2,
      merge(persisted, current) {
        const saved = (persisted as Partial<Profile> | undefined) ?? legacyProfile()
        const deckTamers = { ...current.deckTamers, ...saved?.deckTamers }
        const customDecks = { ...current.customDecks, ...saved?.customDecks }
        const deckId = playerDeck({ customDecks, deckTamers }, saved?.deckId ?? '') ? saved!.deckId! : current.deckId
        const candidate = deckTamers[deckId]
        const tamerId = content.tamerById.has(candidate) ? candidate : playerDeck({ customDecks, deckTamers }, deckId)!.tamer
        const regionId = saved?.regionId && content.regionById.has(saved.regionId) ? saved.regionId : current.regionId
        return { ...current, ...saved, deckId, deckTamers, customDecks, tamerId, regionId }
      },
    },
  ),
)

/** v0.6 playtest profilinden yalnızca deste düzenlemeleri ve ayarlar taşınır (takvim ve kota artık yok). */
function legacyProfile(): Partial<Profile> | undefined {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return undefined
    const old = JSON.parse(raw)?.state ?? {}
    return { deckTamers: old.deckTamers, customDecks: old.customDecks, deckId: old.deckId, speed: old.speed, tutorialDone: old.tutorialDone }
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------------------
// Türetilmiş durum (UI ve av akışı kullanır)
// ---------------------------------------------------------------------------

type ProfileView = Pick<Profile, 'hunts' | 'sandbox' | 'seed' | 'day' | 'expedition' | 'regionId'>

export function capturedSet(p: Pick<Profile, 'hunts'>): Set<string> {
  return new Set(Object.entries(p.hunts).filter(([, r]) => r.captures > 0).map(([id]) => id))
}

export function captureCount(p: Pick<Profile, 'hunts'>): number {
  return capturedSet(p).size
}

export function tamerUnlocked(p: Pick<Profile, 'hunts' | 'sandbox'>, tamer: TamerDef): boolean {
  if (p.sandbox || tamer.unlock.kind === 'start') return true
  return captureCount(p) >= tamer.unlock.count
}

/** Bölgenin bugünden başlayan hava tahmini. */
export function forecast(p: Pick<Profile, 'seed' | 'day'>, regionId: string, days = 5): string[] {
  const region = content.region(regionId)
  return regionForecast(content.weather, region.climate, p.seed, region.id, p.day, days)
}

export function todayWeather(p: Pick<Profile, 'seed' | 'day'>, regionId: string): string {
  return forecast(p, regionId, 1)[0]
}

/** Bölge açık mı: başlangıç bölgesi ya da bağlı bölgelerin Finalleri bayıltıldı (sandbox'ta hepsi açık). */
export function regionOpen(p: Pick<Profile, 'hunts'> & Partial<Pick<Profile, 'sandbox'>>, regionId: string): boolean {
  if (p.sandbox) return true
  return regionUnlocked(content.region(regionId), (id) => content.regionFinal(id)?.id, capturedSet(p))
}

/** Bölgenin kilidini açan şart (oyuncuya gösterilen metin). */
export function regionUnlockText(region: RegionDef): string {
  if (region.unlock.kind === 'start') return 'Açık'
  const names = region.unlock.regions.map((id) => {
    const fin = content.regionFinal(id)
    return fin ? `${content.card(fin.card).name} (${content.region(id).name})` : content.region(id).name
  })
  return `${names.join(' ve ')} bayıltılınca açılır`
}

export function regionBookDone(p: Pick<Profile, 'hunts'>, regionId: string): boolean {
  return regionBookComplete(content.regionHunts(regionId), capturedSet(p))
}

/** Kitabı tamamlanan bölgelerin kalıcı buff'ları: dünyanın tüm avlarında geçerli. */
export function worldPassives(p: Pick<Profile, 'hunts'>): Modifier[] {
  const captured = capturedSet(p)
  return content.regions.filter((r) => regionBookComplete(content.regionHunts(r.id), captured)).flatMap((r) => r.buff.modifiers)
}

export type HuntAvailability =
  | { ok: true }
  | { ok: false; reason: 'locked' | 'regionLocked' | 'notToday' | 'noExpedition' | 'elsewhere'; text: string }

/** Avın bugün haritadan başlatılabilir olup olmadığı. */
export function huntAvailability(p: ProfileView, hunt: HuntDef): HuntAvailability {
  const hunts = content.regionHunts(hunt.region)
  const region = content.region(hunt.region)
  if (!regionOpen(p, region.id)) return { ok: false, reason: 'regionLocked', text: `${region.name}: ${regionUnlockText(region)}` }
  const trail = p.expedition?.region === hunt.region ? p.expedition.trail : 0
  if (!huntUnlocked(hunt, hunts, capturedSet(p), trail)) return { ok: false, reason: 'locked', text: unlockText(hunt) }
  if (p.expedition && p.expedition.region !== hunt.region)
    return { ok: false, reason: 'elsewhere', text: `Sefer ${content.region(p.expedition.region).name} bölgesinde: önce kampa dön` }
  const weather = todayWeather(p, hunt.region)
  if (hunt.appearsIn && !hunt.appearsIn.includes(weather) && !hunt.weather && !hunt.siege)
    return { ok: false, reason: 'notToday', text: `Yalnızca ${hunt.appearsIn.map((w) => content.weatherById.get(w)?.name ?? w).join(', ')} günlerde iz verir` }
  if (!p.expedition) return { ok: false, reason: 'noExpedition', text: 'Ava çıkmak için önce sefere çık' }
  return { ok: true }
}

export function unlockText(hunt: HuntDef): string {
  switch (hunt.unlock.kind) {
    case 'start':
      return 'Açık'
    case 'captures':
      return `Bölgede ${hunt.unlock.count} farklı yaratık bayıltınca açılır`
    case 'book':
      return `Bölge kitabı tamamlanınca ve aynı seferde ${hunt.unlock.trail} İz bulununca ortaya çıkar`
    case 'after':
      return `${content.card(content.hunt(hunt.unlock.hunt).card).name} bayıltılınca açılır`
  }
}

/** Seferde yaratığın başlayacağı can: yaralıysa kalan can, kuşatmadaysa dünkü can. */
export function huntStartHp(p: Pick<Profile, 'expedition'>, hunt: HuntDef): number {
  const max = content.huntHp(hunt.id)
  const siege = p.expedition?.siege
  if (siege?.hunt === hunt.id) return siege.preyHp
  return Math.min(max, p.expedition?.wounded[hunt.id] ?? max)
}
