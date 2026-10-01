import { deckLimit, type Collection, type EconomyConfig } from '../core/economy.ts'
import type { ModifierSet } from '../core/engine/modifiers.ts'
import { resolveRound } from '../core/engine/round.ts'
import type { RoundContext } from '../core/engine/state.ts'
import { shuffle, type Rng } from '../core/rng.ts'
import type { CardDef } from '../core/types.ts'

/**
 * Kart değeri = marjinal katkı: rastgele (slot-1) kartlık bir masaya kartı rastgele
 * bir konuma eklemenin tur gelirine kattığı fark, K örnek ortalaması. Sinerjileri
 * (Sayım, aura, kopya, saf deste...) iki yönlü yakalar ve dizilim botundan ~100x ucuzdur.
 * Deste kurucu bunu deste havuzuyla iteratif kullanır: deste → değerler → yeni deste.
 */
export interface ValuationContext {
  mods: ModifierSet
  slots: number
  roundCount: number
  triggerCap: number
}

export function marginalValue(
  card: CardDef,
  pool: readonly CardDef[],
  vc: ValuationContext,
  rng: Rng,
  samples: number,
): number {
  const ctx: RoundContext = { mods: vc.mods, roundIndex: 1, roundCount: vc.roundCount, triggerCap: vc.triggerCap }
  let sum = 0
  const others = vc.slots - 1
  for (let k = 0; k < samples; k++) {
    const board: CardDef[] = []
    for (let i = 0; i < others && pool.length; i++) board.push(pool[rng.int(pool.length)])
    const without = resolveRound(board, ctx).total
    board.splice(rng.int(board.length + 1), 0, card)
    sum += resolveRound(board, ctx).total - without
  }
  return sum / samples
}

export interface BuildDeckOptions {
  deckSize: number
  samples?: number
  iterations?: number
}

/** Koleksiyondan verilen bağlam (hava + Tamer + pasifler) için en iyi tahmini desteyi kurar. */
export function buildDeck(
  owned: readonly { card: CardDef; count: number }[],
  vc: ValuationContext,
  eco: EconomyConfig,
  rng: Rng,
  opts: BuildDeckOptions,
): CardDef[] {
  const samples = opts.samples ?? 24
  const candidates = owned
    .map(({ card, count }) => ({ card, max: Math.min(count, deckLimit(card, eco)) }))
    .filter((c) => c.max > 0)

  const fill = (scores: Map<CardDef, number>) => {
    const sorted = [...candidates].sort((a, b) => (scores.get(b.card) ?? 0) - (scores.get(a.card) ?? 0))
    const deck: CardDef[] = []
    for (const c of sorted) for (let i = 0; i < c.max && deck.length < opts.deckSize; i++) deck.push(c.card)
    return deck
  }
  const score = (pool: readonly CardDef[]) =>
    new Map(candidates.map((c) => [c.card, marginalValue(c.card, pool, vc, rng, samples)]))

  // İlk havuz: tüm koleksiyon. Sonra deste kendi havuzu olur (sinerji yakınsar).
  const all = candidates.flatMap((c) => Array.from({ length: c.max }, () => c.card))
  let deck = fill(score(shuffle(all, rng)))
  for (let i = 0; i < (opts.iterations ?? 2); i++) deck = fill(score(deck))
  return deck
}

export function collectionToOwned(collection: Collection, byId: Map<string, CardDef>) {
  const out: { card: CardDef; count: number }[] = []
  for (const [id, count] of Object.entries(collection)) {
    const card = byId.get(id)
    if (card && count > 0) out.push({ card, count })
  }
  return out.sort((a, b) => (a.card.id < b.card.id ? -1 : 1))
}

export function fullCollection(cards: readonly CardDef[], eco: EconomyConfig): Collection {
  return Object.fromEntries(cards.map((c) => [c.id, deckLimit(c, eco)]))
}
