import type { ContentDB } from '../content/index.ts'
import { playDay, type DaySetup } from '../core/day.ts'
import { compileModifiers } from '../core/engine/modifiers.ts'
import { createRng, deriveSeed, weightedPick } from '../core/rng.ts'
import type { CardDef, Rarity, TamerDef, WeatherDef } from '../core/types.ts'
import { RARITIES } from '../core/types.ts'
import { makeArranger, type ArrangerKind } from './arrangers.ts'
import { buildDeck, collectionToOwned, fullCollection, marginalValue, type ValuationContext } from './deckbuilder.ts'
import { summarize, type Summary } from './stats.ts'

/**
 * Tekil denge deneyleri. Her biri GDD'deki bir hedef sorusunu ölçer ve
 * saf veri döner (CLI tablo basar / JSON yazar, ileride tarayıcıdaki denge paneli de kullanır).
 */

export function dayMinutes(db: ContentDB, rounds: number, steps: number): number {
  const t = db.economy.timing
  return (rounds * t.planningSecPerRound + steps * t.secPerStep) / 60
}

export function valuationContext(tamer: TamerDef, weather: WeatherDef | null): ValuationContext {
  return {
    mods: compileModifiers({ weather, tamer }),
    slots: tamer.slots,
    roundCount: Math.ceil(tamer.deckSize / tamer.slots),
    triggerCap: 60,
  }
}

// ---------------------------------------------------------------------------
// 1. Dizilim becerisi: usta / acemi / rastgele
// ---------------------------------------------------------------------------

export interface ArrangementReport {
  deck: string
  tamer: string
  days: number
  income: Record<ArrangerKind, Summary>
  masterOverNovice: number
  masterOverRandom: number
  dayMinutes: Summary
  triggersPerDay: Summary
}

export function arrangementExperiment(
  db: ContentDB,
  opts: { seed: number; days: number; deck?: CardDef[]; tamer?: TamerDef; deckName?: string },
): ArrangementReport {
  const tamer = opts.tamer ?? db.tamer(db.starter.tamer)
  const deck = opts.deck ?? db.starterDeck()
  const kinds: ArrangerKind[] = ['random', 'novice', 'master']
  const incomes: Record<ArrangerKind, number[]> = { random: [], novice: [], master: [] }
  const minutes: number[] = []
  const triggers: number[] = []

  for (let d = 0; d < opts.days; d++) {
    const weather = weightedPick(db.weather, (w) => w.weight, createRng(deriveSeed(opts.seed, d, 1)))
    const setup: DaySetup = { deck, tamer, weather }
    for (const k of kinds) {
      // Aynı gün tohumu → üç bot da aynı karışımı oynar, yalnızca dizilim farklı.
      const r = playDay(setup, createRng(deriveSeed(opts.seed, d)), makeArranger(k, createRng(deriveSeed(opts.seed, d, 2))))
      incomes[k].push(r.total)
      if (k === 'master') {
        minutes.push(dayMinutes(db, r.rounds.length, r.steps))
        triggers.push(r.triggers)
      }
    }
  }
  const income = {
    random: summarize(incomes.random),
    novice: summarize(incomes.novice),
    master: summarize(incomes.master),
  }
  return {
    deck: opts.deckName ?? db.deckById.get(db.starter.deck)!.name,
    tamer: tamer.name,
    days: opts.days,
    income,
    masterOverNovice: income.master.mean / income.novice.mean,
    masterOverRandom: income.master.mean / income.random.mean,
    dayMinutes: summarize(minutes),
    triggersPerDay: summarize(triggers),
  }
}

// ---------------------------------------------------------------------------
// 2. Hava uyumu: havaya göre kurulmuş deste vs en uygunsuz deste
// ---------------------------------------------------------------------------

export interface WeatherFitRow {
  weather: string
  matched: number
  mismatched: number
  mismatchedDeckFor: string
  ratio: number
}

export interface WeatherFitReport {
  collection: string
  rows: WeatherFitRow[]
  meanRatio: number
}

export function weatherFitExperiment(
  db: ContentDB,
  opts: { seed: number; days: number; collection?: 'full' | 'starter'; tamer?: TamerDef },
): WeatherFitReport {
  const tamer = opts.tamer ?? db.tamer(db.starter.tamer)
  const coll =
    opts.collection === 'starter'
      ? Object.fromEntries(db.deckById.get(db.starter.deck)!.cards.map((d) => [d.card, d.count]))
      : fullCollection(db.packPool, db.economy)
  const owned = collectionToOwned(coll, db.cardById)
  const weathers = db.weather.filter((w) => w.modifiers.length > 0)

  const decks = new Map<string, CardDef[]>()
  weathers.forEach((w, i) =>
    decks.set(
      w.id,
      buildDeck(owned, valuationContext(tamer, w), db.economy, createRng(deriveSeed(opts.seed, 100 + i)), {
        deckSize: tamer.deckSize,
      }),
    ),
  )

  const play = (deck: CardDef[], weather: WeatherDef, days: number) => {
    let sum = 0
    for (let d = 0; d < days; d++)
      sum += playDay({ deck, tamer, weather }, createRng(deriveSeed(opts.seed, d)), makeArranger('master', createRng(d))).total
    return sum / days
  }

  const rows: WeatherFitRow[] = weathers.map((w) => {
    const matched = play(decks.get(w.id)!, w, opts.days)
    // En kötü diğer deste: önce kısa ölçümle seç, sonra tam ölç.
    let worst = { id: '', v: Infinity }
    for (const o of weathers) {
      if (o.id === w.id) continue
      const v = play(decks.get(o.id)!, w, Math.max(5, Math.floor(opts.days / 5)))
      if (v < worst.v) worst = { id: o.id, v }
    }
    const mismatched = play(decks.get(worst.id)!, w, opts.days)
    return { weather: w.name, matched, mismatched, mismatchedDeckFor: db.weatherById.get(worst.id)!.name, ratio: matched / mismatched }
  })
  return {
    collection: opts.collection ?? 'full',
    rows,
    meanRatio: rows.reduce((a, r) => a + r.ratio, 0) / rows.length,
  }
}

// ---------------------------------------------------------------------------
// 3. Kart gücü: marjinal değer, nadirlik içinde z-skoru
// ---------------------------------------------------------------------------

export interface CardPowerRow {
  id: string
  name: string
  rarity: Rarity
  durability: number
  /** Havasız, tüm koleksiyon havuzunda tur başına marjinal katkı. */
  value: number
  /** En iyi havadaki değer. */
  bestWeatherValue: number
  bestWeather: string
  /** Nadirlik akranlarına göre z-skoru (|z| > 1.5 → incele). */
  z: number
}

export function cardPowerReport(db: ContentDB, opts: { seed: number; samples: number; tamer?: TamerDef }): CardPowerRow[] {
  const tamer = opts.tamer ?? db.tamer(db.starter.tamer)
  const pool = collectionToOwned(fullCollection(db.packPool, db.economy), db.cardById).flatMap((o) =>
    Array.from({ length: o.count }, () => o.card),
  )
  const neutral = valuationContext(tamer, null)
  const rows = db.cards.map((card, i) => {
    const value = marginalValue(card, pool, neutral, createRng(deriveSeed(opts.seed, i)), opts.samples)
    let best = { name: '-', v: value }
    for (const w of db.weather) {
      const v = marginalValue(card, pool, valuationContext(tamer, w), createRng(deriveSeed(opts.seed, i)), opts.samples)
      if (v > best.v) best = { name: w.name, v }
    }
    return {
      id: card.id,
      name: card.name,
      rarity: card.rarity,
      durability: card.durability,
      value,
      bestWeatherValue: best.v,
      bestWeather: best.name,
      z: 0,
    }
  })
  for (const r of RARITIES) {
    const peers = rows.filter((x) => x.rarity === r)
    const s = summarize(peers.map((p) => p.value))
    for (const p of peers) p.z = s.stdev > 0 ? (p.value - s.mean) / s.stdev : 0
  }
  return rows.sort((a, b) => RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity) || b.value - a.value)
}

// ---------------------------------------------------------------------------
// 4. Kopya → kaynak oranı (analitik)
// ---------------------------------------------------------------------------

/** Tamamı kopya bir Standart paketin fiyatına oranla verdiği kaynak. */
export function duplicateRatio(db: ContentDB): number {
  const std = db.economy.packs.find((p) => p.id === db.economy.basePack)!
  const totalOdds = Object.values(std.odds).reduce((a, b) => a + (b ?? 0), 0)
  let perCard = 0
  for (const r of RARITIES) perCard += ((std.odds[r] ?? 0) / totalOdds) * (db.economy.rarities[r].duplicatePct / 100)
  return (perCard * std.cards) / std.priceMult
}

// ---------------------------------------------------------------------------
// 5. Preset desteler: dizilim etkisi ve hava matrisi
// ---------------------------------------------------------------------------

export interface PresetRow {
  id: string
  name: string
  masterOverNovice: number
  masterOverRandom: number
  dayMinutes: number
  /** Hava id → usta botla ortalama gün geliri. */
  byWeather: Record<string, number>
}

export interface PresetMatrix {
  rows: PresetRow[]
  /** Hava id → o havada en çok kazandıran preset. */
  bestIn: Record<string, string>
  /** Tüm etkili havalarda birinci olan preset (GDD: olmamalı). */
  dominant: string | null
}

export function presetMatrix(db: ContentDB, opts: { seed: number; days: number }): PresetMatrix {
  const rows: PresetRow[] = db.decks.map((d) => {
    const tamer = db.tamer(d.tamer)
    const deck = db.deckCards(d.id)
    const arr = arrangementExperiment(db, { seed: opts.seed, days: opts.days, deck, tamer, deckName: d.name })
    const byWeather: Record<string, number> = {}
    for (const w of db.weather) {
      let sum = 0
      const n = Math.max(10, Math.floor(opts.days / 3))
      for (let i = 0; i < n; i++)
        sum += playDay({ deck, tamer, weather: w }, createRng(deriveSeed(opts.seed, i, 11)), makeArranger('master', createRng(i))).total
      byWeather[w.id] = sum / n
    }
    return {
      id: d.id,
      name: d.name,
      masterOverNovice: arr.masterOverNovice,
      masterOverRandom: arr.masterOverRandom,
      dayMinutes: arr.dayMinutes.mean,
      byWeather,
    }
  })
  const bestIn: Record<string, string> = {}
  for (const w of db.weather) bestIn[w.id] = rows.reduce((a, b) => (b.byWeather[w.id] > a.byWeather[w.id] ? b : a)).id
  const effective = db.weather.filter((w) => w.modifiers.length > 0).map((w) => w.id)
  const first = bestIn[effective[0]]
  const dominant = effective.every((w) => bestIn[w] === first) ? first : null
  return { rows, bestIn, dominant }
}
