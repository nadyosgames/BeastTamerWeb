import { deckLimit, duplicateValue, rarityAtLeast, type Collection, type EconomyConfig, type PackDef } from './economy.ts'
import type { Rng } from './rng.ts'
import { weightedPick } from './rng.ts'
import type { CardDef, Element, Rarity } from './types.ts'
import { RARITIES } from './types.ts'

export interface PackOpenOptions {
  element?: Element
  /** Rare+ çıkmadan açılan paket sayısı (kötü şans koruması). */
  pity: number
}

export interface PackOpenResult {
  cards: CardDef[]
  pity: number
}

/**
 * Paket açma (GDD "Paketler ve kopyalar"):
 *  - her kart için nadirlik oranlardan çekilir, havuzda o nadirlik yoksa bir alta düşer,
 *  - garanti (Şanslı: 1 Rare+, Mühürlü: 1 Epic+) sağlanmazsa son kart yeniden çekilir,
 *  - kötü şans koruması: N pakettir Rare+ yoksa garanti Rare+,
 *  - akıllı paket: eksik kart varsa en az 1 tanesi pakette olur.
 */
export function openPack(
  pack: PackDef,
  pool: readonly CardDef[],
  collection: Collection,
  eco: EconomyConfig,
  rng: Rng,
  opts: PackOpenOptions,
): PackOpenResult {
  const usable = pack.element && opts.element ? pool.filter((c) => c.elements.includes(opts.element!)) : pool
  const byRarity = new Map<Rarity, CardDef[]>()
  for (const c of usable) {
    const list = byRarity.get(c.rarity) ?? []
    list.push(c)
    byRarity.set(c.rarity, list)
  }

  const rollRarity = (min?: Rarity): Rarity => {
    const options = RARITIES.filter((r) => (pack.odds[r] ?? 0) > 0 && (!min || rarityAtLeast(r, min)))
    if (!options.length) return min ?? 'common'
    return weightedPick(options, (r) => pack.odds[r] ?? 0, rng)
  }
  const pickCard = (r: Rarity): CardDef => {
    for (let i = RARITIES.indexOf(r); i >= 0; i--) {
      const list = byRarity.get(RARITIES[i])
      if (list?.length) return list[rng.int(list.length)]
    }
    return usable[rng.int(usable.length)]
  }

  const cards: CardDef[] = []
  for (let i = 0; i < pack.cards; i++) cards.push(pickCard(rollRarity()))

  const ensure = (min: Rarity, count: number) => {
    let have = cards.filter((c) => rarityAtLeast(c.rarity, min)).length
    for (let i = cards.length - 1; i >= 0 && have < count; i--) {
      if (rarityAtLeast(cards[i].rarity, min)) continue
      cards[i] = pickCard(rollRarity(min))
      have++
    }
  }
  if (pack.guarantee) ensure(pack.guarantee.rarityAtLeast, pack.guarantee.count)
  if (opts.pity + 1 >= eco.pity.packsWithoutRarePlus) ensure('rare', 1)

  if (pack.smart) {
    const missing = usable.filter((c) => (collection[c.id] ?? 0) < deckLimit(c, eco))
    const hasMissing = cards.some((c) => (collection[c.id] ?? 0) < deckLimit(c, eco))
    if (missing.length && !hasMissing) {
      const r = rollRarity()
      const sameTier = missing.filter((c) => c.rarity === r)
      const choice = sameTier.length ? sameTier : missing.filter((c) => !rarityAtLeast(c.rarity, 'rare'))
      const list = choice.length ? choice : missing
      cards[rng.int(cards.length)] = list[rng.int(list.length)]
    }
  }

  const gotRarePlus = cards.some((c) => rarityAtLeast(c.rarity, 'rare'))
  return { cards, pity: gotRarePlus ? 0 : opts.pity + 1 }
}

export interface AddCardsResult {
  added: CardDef[]
  duplicates: CardDef[]
  resource: number
}

/** Kartları koleksiyona ekler; deste sınırını aşan kopyalar kaynağa dönüşür. */
export function addToCollection(
  collection: Collection,
  cards: readonly CardDef[],
  quota: number,
  eco: EconomyConfig,
): AddCardsResult {
  const res: AddCardsResult = { added: [], duplicates: [], resource: 0 }
  for (const c of cards) {
    const have = collection[c.id] ?? 0
    if (have < deckLimit(c, eco)) {
      collection[c.id] = have + 1
      res.added.push(c)
    } else {
      res.duplicates.push(c)
      res.resource += duplicateValue(c, quota, eco)
    }
  }
  return res
}
