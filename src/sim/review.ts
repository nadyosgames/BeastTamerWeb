import type { ContentDB } from '../content/index.ts'
import { deckLimit } from '../core/economy.ts'
import type { RoundContext } from '../core/engine/state.ts'
import { createRng, deriveSeed, type Rng } from '../core/rng.ts'
import type { CardDef, CreatureType, Element, Rarity } from '../core/types.ts'
import { ELEMENTS, RARITIES } from '../core/types.ts'
import { bestTotal } from './arrangers.ts'
import { buildDeck, collectionToOwned } from './deckbuilder.ts'
import {
  arrangementExperiment,
  valuationContext,
  weatherFitExperiment,
  type ArrangementReport,
  type WeatherFitReport,
} from './experiments.ts'
import { summarize } from './stats.ts'

/**
 * Kart seti incelemesi (onaya sunmadan önce): her kartın gücü, sinerji ortakları,
 * nadirlik eğrisi, element destelerinde dizilimin etkisi ve hava uyumu.
 * Tüm ölçümler usta dizilimle yapılır (iyi oyuncunun kartı nasıl kullandığı).
 */
export interface Partner {
  id: string
  name: string
  gain: number
}

export interface CardReview {
  id: string
  name: string
  elements: Element[]
  type: CreatureType
  rarity: Rarity
  durability: number
  keywords: string[]
  text: string
  /** Tüm setten rastgele masada tur başına katkı. */
  valueMixed: number
  /** Kendi element(ler)inin kartlarıyla masada tur başına katkı. */
  valueElement: number
  value: number
  /** Nadirlik akranlarına göre z-skoru (value). */
  z: number
  partners: Partner[]
  antiPartners: Partner[]
}

export interface ElementDeckReview {
  element: Element
  deck: { id: string; name: string; count: number }[]
  arrangement: ArrangementReport
}

export interface SetReview {
  set: string
  cards: CardReview[]
  rarityCurve: { rarity: Rarity; mean: number; byElement: Partial<Record<Element, number>> }[]
  topPairs: { a: string; b: string; gain: number }[]
  lonely: string[]
  elementDecks: ElementDeckReview[]
  weatherFit: WeatherFitReport
  types: Record<Element, Partial<Record<CreatureType, number>>>
}

export interface ReviewOptions {
  set: string
  seed: number
  valueSamples: number
  pairSamples: number
  deckDays: number
  weatherDays: number
  onProgress?: (msg: string) => void
}

const NEUTRAL_ROUND = 1

function poolOf(cards: readonly CardDef[], db: ContentDB): CardDef[] {
  return cards.flatMap((c) => Array.from({ length: deckLimit(c, db.economy) }, () => c))
}

function draw(pool: readonly CardDef[], n: number, rng: Rng): CardDef[] {
  const out: CardDef[] = []
  for (let i = 0; i < n; i++) out.push(pool[rng.int(pool.length)])
  return out
}

/** Usta dizilimle marjinal katkı: (masa + kart) − masa, en iyi dizilimlerle. */
function marginalBest(card: CardDef, pool: readonly CardDef[], ctx: RoundContext, rng: Rng, samples: number, slots: number) {
  let sum = 0
  for (let k = 0; k < samples; k++) {
    const board = draw(pool, slots - 1, rng)
    sum += bestTotal([...board, card], ctx) - bestTotal(board, ctx)
  }
  return sum / samples
}

/**
 * İkili etkileşim: A ve B birlikte masadayken, ikisinin de rastgele kartla değiştirildiği
 * duruma göre fazladan gelir. Simetrik ikame tanımı (4 kartlık masa, usta dizilim):
 *   I = T(A,B,O) − T(A,Z,O) − T(Z',B,O) + T(Z',Z,O)
 */
function interaction(a: CardDef, b: CardDef, pool: readonly CardDef[], ctx: RoundContext, rng: Rng, samples: number) {
  let sum = 0
  for (let k = 0; k < samples; k++) {
    const o = draw(pool, 2, rng)
    const z = pool[rng.int(pool.length)]
    const z2 = pool[rng.int(pool.length)]
    sum += bestTotal([a, b, ...o], ctx) - bestTotal([a, z, ...o], ctx) - bestTotal([z2, b, ...o], ctx) + bestTotal([z2, z, ...o], ctx)
  }
  return sum / samples
}

export function reviewSet(db: ContentDB, opts: ReviewOptions): SetReview {
  const log = opts.onProgress ?? (() => {})
  const tamer = db.tamer(db.starter.tamer)
  const vc = valuationContext(tamer, null)
  const ctx: RoundContext = { mods: vc.mods, roundIndex: NEUTRAL_ROUND, roundCount: vc.roundCount, triggerCap: vc.triggerCap }
  const cards = db.cards
  const mixedPool = poolOf(cards, db)

  log(`kart gücü: ${cards.length} kart × 2 bağlam`)
  const reviews: CardReview[] = cards.map((c, i) => {
    const elementPool = poolOf(
      cards.filter((o) => o.elements.some((e) => c.elements.includes(e))),
      db,
    )
    const valueMixed = marginalBest(c, mixedPool, ctx, createRng(deriveSeed(opts.seed, i, 1)), opts.valueSamples, tamer.slots)
    const valueElement = marginalBest(c, elementPool, ctx, createRng(deriveSeed(opts.seed, i, 2)), opts.valueSamples, tamer.slots)
    return {
      id: c.id,
      name: c.name,
      elements: c.elements,
      type: c.type,
      rarity: c.rarity,
      durability: c.durability,
      keywords: [...(c.keywords ?? []), ...(c.slumber ? [`slumber ${c.slumber}`] : [])],
      text: c.text,
      valueMixed,
      valueElement,
      value: Math.max(valueMixed, valueElement),
      z: 0,
      partners: [],
      antiPartners: [],
    }
  })
  for (const r of RARITIES) {
    const peers = reviews.filter((x) => x.rarity === r)
    const s = summarize(peers.map((p) => p.value))
    for (const p of peers) p.z = s.stdev > 0 ? (p.value - s.mean) / s.stdev : 0
  }

  log(`sinerji: ${(cards.length * (cards.length + 1)) / 2} kart çifti`)
  const inter = new Map<string, Partner[]>(cards.map((c) => [c.id, []]))
  const topPairs: SetReview['topPairs'] = []
  for (let i = 0; i < cards.length; i++) {
    if (i % 25 === 0 && i) log(`  ${i}/${cards.length}`)
    for (let j = i; j < cards.length; j++) {
      const g = interaction(cards[i], cards[j], mixedPool, ctx, createRng(deriveSeed(opts.seed, i, j, 3)), opts.pairSamples)
      inter.get(cards[i].id)!.push({ id: cards[j].id, name: cards[j].name, gain: g })
      if (i !== j) inter.get(cards[j].id)!.push({ id: cards[i].id, name: cards[i].name, gain: g })
      topPairs.push({ a: cards[i].id, b: cards[j].id, gain: g })
    }
  }
  for (const r of reviews) {
    const list = inter.get(r.id)!.slice().sort((a, b) => b.gain - a.gain)
    r.partners = list.filter((p) => p.gain >= 2).slice(0, 4)
    r.antiPartners = list
      .filter((p) => p.gain <= -2)
      .sort((a, b) => a.gain - b.gain)
      .slice(0, 2)
  }
  topPairs.sort((a, b) => b.gain - a.gain)

  const rarityCurve = RARITIES.filter((r) => reviews.some((x) => x.rarity === r)).map((r) => {
    const peers = reviews.filter((x) => x.rarity === r)
    const byElement: Partial<Record<Element, number>> = {}
    for (const e of ELEMENTS) {
      const ofEl = peers.filter((p) => p.elements[0] === e)
      if (ofEl.length) byElement[e] = ofEl.reduce((a, p) => a + p.value, 0) / ofEl.length
    }
    return { rarity: r, mean: peers.reduce((a, p) => a + p.value, 0) / peers.length, byElement }
  })

  log('element desteleri: kurulum ve dizilim etkisi')
  const elementDecks: ElementDeckReview[] = ELEMENTS.map((el, i) => {
    const owned = collectionToOwned(
      Object.fromEntries(cards.filter((c) => c.elements.includes(el)).map((c) => [c.id, deckLimit(c, db.economy)])),
      db.cardById,
    )
    const deck = buildDeck(owned, vc, db.economy, createRng(deriveSeed(opts.seed, 500 + i)), { deckSize: tamer.deckSize })
    const counts = new Map<CardDef, number>()
    for (const c of deck) counts.set(c, (counts.get(c) ?? 0) + 1)
    return {
      element: el,
      deck: [...counts].map(([c, n]) => ({ id: c.id, name: c.name, count: n })).sort((a, b) => b.count - a.count),
      arrangement: arrangementExperiment(db, { seed: opts.seed, days: opts.deckDays, deck, tamer, deckName: el }),
    }
  })

  log('hava uyumu (tam koleksiyon)')
  const weatherFit = weatherFitExperiment(db, { seed: opts.seed, days: opts.weatherDays })

  const types = Object.fromEntries(ELEMENTS.map((e) => [e, {}])) as SetReview['types']
  for (const c of cards) {
    const t = types[c.elements[0]]
    t[c.type] = (t[c.type] ?? 0) + 1
  }

  const lonely = reviews.filter((r) => r.partners.length === 0).map((r) => r.id)
  return { set: opts.set, cards: reviews, rarityCurve, topPairs: topPairs.slice(0, 25), lonely, elementDecks, weatherFit, types }
}
