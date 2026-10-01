import type { ContentDB } from '../content/index.ts'
import { dateOf, generateWeekWeather, weeksPerYear } from '../core/calendar.ts'
import { playDay } from '../core/day.ts'
import { deckLimit, packPrice, quotaForWeek, type Collection, type PackDef } from '../core/economy.ts'
import { addToCollection, openPack } from '../core/packs.ts'
import { createRng, deriveSeed, type Rng } from '../core/rng.ts'
import type { CardDef, Modifier, TamerDef } from '../core/types.ts'
import { makeArranger, type ArrangerKind } from './arrangers.ts'
import { buildDeck, collectionToOwned } from './deckbuilder.ts'
import { dayMinutes, valuationContext } from './experiments.ts'

/**
 * Kampanya simülasyonu: bir oyuncu ajanı haftalar boyunca oynar.
 * Takvim + hava + deste kurma + dizilim + kota + haftalık paket + paket satın alma +
 * kopya → kaynak + Tamer açılışları + albüm pasifleri. Ekonominin ve oyun süresinin
 * (saat) asıl ölçümü buradan gelir; kalibrasyon bu döngüyü tekrar tekrar çalıştırır.
 */

export interface AgentProfile {
  id: string
  label: string
  arranger: ArrangerKind
  /**
   * matched: her hava için o havaya kurulmuş deste,
   * generic: tek genel deste ("Sakin" için kurulur),
   * mismatched: bilerek uyumsuz deste (bugünün cezalı elementine bonus veren havanın destesi).
   */
  deckPolicy: 'matched' | 'generic' | 'mismatched'
  /** Desteleri kaç haftada bir yeniden kurar. */
  rebuildEveryWeeks: number
  /** Bakiye ile Standart paket alır mı. */
  buyPacks: boolean
  /** Yıl sonunda burç albümünü tamamlama olasılığı. */
  albumCompletion: number
}

export const PROFILES: Record<string, AgentProfile> = {
  good: {
    id: 'good',
    label: 'İyi oyuncu',
    arranger: 'master',
    deckPolicy: 'matched',
    rebuildEveryWeeks: 4,
    buyPacks: true,
    albumCompletion: 1,
  },
  casual: {
    id: 'casual',
    label: 'Gündelik oyuncu',
    arranger: 'novice',
    deckPolicy: 'generic',
    rebuildEveryWeeks: 12,
    buyPacks: true,
    albumCompletion: 0.5,
  },
  mismatched: {
    id: 'mismatched',
    label: 'Uyumsuz desteli oyuncu',
    arranger: 'master',
    deckPolicy: 'mismatched',
    rebuildEveryWeeks: 4,
    buyPacks: true,
    albumCompletion: 1,
  },
}

export interface CampaignOptions {
  seed: number
  weeks: number
  profile: AgentProfile
  /** Verilirse içerikteki kalibre eğri yerine bu kota eğrisi kullanılır. */
  quotaCurve?: number[]
  deckSamples?: number
}

export interface WeekRecord {
  week: number
  year: number
  zodiac: string
  quota: number
  income: number
  passed: boolean
  balance: number
  packsOpened: number
  newCards: number
  duplicateResource: number
  /** Koleksiyon tamamlanma (deste sınırına göre, açılmış havuz değil tüm havuz). */
  completion: number
  minutes: number
  tamer: string
}

export interface CampaignResult {
  profile: string
  weeks: WeekRecord[]
  passRate: number
  hours: number
  finalCompletion: number
  tamersUsed: Record<string, number>
}

export function runCampaign(db: ContentDB, opts: CampaignOptions): CampaignResult {
  const p = opts.profile
  const cal = db.calendar
  const eco = db.economy
  const wpy = weeksPerYear(cal)
  const rng = createRng(opts.seed)
  const sub = (...parts: number[]): Rng => createRng(deriveSeed(opts.seed, ...parts))
  const arrange = makeArranger(p.arranger, sub(9))

  const collection: Collection = {}
  for (const { card, count } of db.starter.deck) collection[card] = (collection[card] ?? 0) + count
  let balance = db.starter.resource
  let lifetime = 0
  let pity = 0
  let missedStreak = 0
  let tamer = db.tamer(db.starter.tamer)
  const passives: Modifier[] = []
  let dupBonusPct = 0
  const albums = new Set<string>()
  const decks = new Map<string, CardDef[]>()
  let lastBuild = -Infinity
  let lastWeather: string | undefined
  const weeks: WeekRecord[] = []
  const tamersUsed: Record<string, number> = {}
  const std = eco.packs.find((x) => x.id === eco.weeklyPack)!
  const totalSlots = db.packPool.reduce((a, c) => a + deckLimit(c, eco), 0)

  const deckFor = (weatherId: string, t: TamerDef): CardDef[] => {
    const key = p.deckPolicy === 'matched' ? weatherId : p.deckPolicy === 'generic' ? 'calm' : oppositeWeather(db, weatherId)
    let deck = decks.get(key)
    if (!deck) {
      const w = db.weatherById.get(key) ?? null
      deck = buildDeck(collectionToOwned(collection, db.cardById), valuationContext(t, w), eco, sub(weeks.length, 7), {
        deckSize: t.deckSize,
        samples: opts.deckSamples,
      })
      decks.set(key, deck)
    }
    return deck
  }

  for (let w = 0; w < opts.weeks; w++) {
    const date = dateOf(w * cal.daysPerWeek, cal)
    const absYear = Math.floor(w / wpy) + 1
    const pool = db.packPool.filter((c) => (c.unlockYear ?? 1) <= absYear)

    if (w - lastBuild >= p.rebuildEveryWeeks) {
      decks.clear()
      tamer = chooseTamer(db, unlockedTamers(db, absYear, lifetime), collection, sub(w, 3))
      lastBuild = w
    }
    tamersUsed[tamer.id] = (tamersUsed[tamer.id] ?? 0) + 1

    const weather = generateWeekWeather(db.weather, cal, rng, lastWeather)
    lastWeather = weather[weather.length - 1]
    let quota = opts.quotaCurve ? opts.quotaCurve[Math.min(w, opts.quotaCurve.length - 1)] : quotaForWeek(w, eco, db.balance)
    if (missedStreak >= eco.softFail.missedWeeks) quota = Math.round(quota * (1 - eco.softFail.quotaReductionPct / 100))

    let income = 0
    let minutes = 0
    weather.forEach((wid, d) => {
      const r = playDay(
        { deck: deckFor(wid, tamer), tamer, weather: db.weatherById.get(wid), passives },
        sub(w, d, 1),
        arrange,
      )
      income += r.total
      minutes += dayMinutes(db, r.rounds.length, r.steps)
    })

    const passed = income >= quota
    missedStreak = passed ? 0 : missedStreak + 1
    balance += income
    lifetime += income

    let packsOpened = 0
    let newCards = 0
    let dupRes = 0
    const open = (pack: PackDef) => {
      const res = openPack(pack, pool, collection, eco, rng, { pity })
      pity = res.pity
      const added = addToCollection(collection, res.cards, quota, eco)
      newCards += added.added.length
      const bonus = Math.round(added.resource * (1 + dupBonusPct / 100))
      dupRes += bonus
      balance += bonus
      packsOpened++
    }
    if (passed) open(std)
    if (p.buyPacks) {
      const price = packPrice(std, quota, eco)
      for (let i = 0; i < 20 && balance >= price; i++) {
        balance -= price
        open(std)
      }
    }

    // Yıl sonu: albüm tamamlanırsa burcun pasifi kalıcı açılır.
    if (w % wpy === wpy - 1 && !albums.has(date.zodiacId) && rng.next() < p.albumCompletion) {
      albums.add(date.zodiacId)
      const z = cal.zodiac.find((x) => x.id === date.zodiacId)!
      passives.push(...z.albumPassive.modifiers)
      dupBonusPct += z.albumPassive.duplicateBonusPct ?? 0
    }

    let filled = 0
    for (const c of db.packPool) filled += Math.min(collection[c.id] ?? 0, deckLimit(c, eco))
    weeks.push({
      week: w + 1,
      year: absYear,
      zodiac: date.zodiacId,
      quota,
      income,
      passed,
      balance,
      packsOpened,
      newCards,
      duplicateResource: dupRes,
      completion: filled / totalSlots,
      minutes,
      tamer: tamer.id,
    })
  }

  return {
    profile: p.id,
    weeks,
    passRate: weeks.filter((x) => x.passed).length / Math.max(1, weeks.length),
    hours: weeks.reduce((a, x) => a + x.minutes, 0) / 60,
    finalCompletion: weeks.at(-1)?.completion ?? 0,
    tamersUsed,
  }
}

export function unlockedTamers(db: ContentDB, absYear: number, lifetime: number): TamerDef[] {
  return db.tamers.filter((t) => {
    switch (t.unlock.kind) {
      case 'start':
        return true
      case 'year':
        return absYear >= t.unlock.year
      case 'lifetime':
        return lifetime >= t.unlock.amount
      case 'quest':
        return false // Quest kitabı henüz simüle edilmiyor.
    }
  })
}

/** Açık Tamer'lar arasından genel deste ile kısa ölçümde en çok kazandıranı seçer. */
function chooseTamer(db: ContentDB, tamers: TamerDef[], collection: Collection, rng: Rng): TamerDef {
  if (tamers.length === 1) return tamers[0]
  let best = { t: tamers[0], v: -Infinity }
  const owned = collectionToOwned(collection, db.cardById)
  for (const t of tamers) {
    const deck = buildDeck(owned, valuationContext(t, null), db.economy, rng, { deckSize: t.deckSize, samples: 12, iterations: 1 })
    if (deck.length < t.deckSize) continue
    let v = 0
    for (let d = 0; d < 3; d++) v += playDay({ deck, tamer: t }, createRng(deriveSeed(7, d)), makeArranger('novice', rng)).total
    if (v > best.v) best = { t, v }
  }
  return best.t
}

/** Bugünün cezalı elementine bonus veren hava (Güneşli → Yağmurlu). Yoksa sıradaki etkili hava. */
export function oppositeWeather(db: ContentDB, weatherId: string): string {
  const w = db.weatherById.get(weatherId)
  const penalty = w?.modifiers.find((m) => m.kind === 'incomePct' && m.pct < 0)
  const penalized = penalty && penalty.kind === 'incomePct' ? penalty.filter?.element : undefined
  if (penalized) {
    const opp = db.weather.find((o) =>
      o.modifiers.some((m) => m.kind === 'incomePct' && m.pct > 0 && m.filter?.element === penalized),
    )
    if (opp) return opp.id
  }
  const effective = db.weather.filter((o) => o.modifiers.length > 0 && o.id !== weatherId)
  return effective[(db.weather.findIndex((o) => o.id === weatherId) + 1) % effective.length].id
}
