import type { ExpeditionConfig } from './expedition.ts'
import type { CardDef, Element, Rarity, TamerDef } from './types.ts'
import { RARITIES } from './types.ts'

/**
 * Ekonomi kuralları (GDD v0.8: öz yalnızca av ödülüdür, paketler sabit öz fiyatıyla alınır).
 * Sayıların kendisi content/economy.json'da (tasarımcı ayarları) ve
 * content/generated/hunts.json'da (simülasyonla kalibre edilen yaratık canları) durur.
 */
export interface PackDef {
  id: string
  name: string
  priceMult: number
  cards: number
  odds: Partial<Record<Rarity, number>>
  guarantee?: { rarityAtLeast: Rarity; count: number }
  /** Tek elementten kart (oyuncu elementi seçer). */
  element?: boolean
  /** Eksik kart önceliği. */
  smart?: boolean
}

export interface EconomyConfig {
  rarities: Record<Rarity, { deckLimit: number; duplicatePct: number }>
  packs: PackDef[]
  /** Standart paketin öz fiyatı; diğer paketler priceMult ile çarpılır. */
  packBasePrice: number
  /** Kopya → öz oranlarının ölçüldüğü paket. */
  basePack: string
  pity: { packsWithoutRarePlus: number }
  timing: { planningSecPerRound: number; secPerStep: number }
  expedition: ExpeditionConfig
}

/** Simülasyonla kalibre edilen yaratık canları (content/generated/hunts.json). */
export interface CalibratedHunts {
  generatedAt: string
  seed: number
  samples: number
  /** Av id → can. */
  hp: Record<string, number>
  /** Referans desteler (anahtar → kartlar): ilerleme simülasyonunda tipik oyuncunun o noktadaki koleksiyonundan kurulan deste. */
  refDecks?: Record<string, { card: string; count: number }[]>
  /** Av id → kalibrasyonda kullanılan referans deste anahtarı (hedef destesi "ref" olan avlar). */
  huntDecks?: Record<string, string>
  notes?: string[]
}

export function packPrice(pack: PackDef, eco: EconomyConfig): number {
  return Math.round(eco.packBasePrice * pack.priceMult)
}

export function standardPackPrice(eco: EconomyConfig): number {
  const std = eco.packs.find((p) => p.id === eco.basePack) ?? eco.packs[0]
  return packPrice(std, eco)
}

export function deckLimit(card: CardDef, eco: EconomyConfig): number {
  return eco.rarities[card.rarity].deckLimit
}

/** Destede kullanılabilecek sayıyı aşan kopyanın öz karşılığı. */
export function duplicateValue(card: CardDef, eco: EconomyConfig): number {
  return Math.round((standardPackPrice(eco) * eco.rarities[card.rarity].duplicatePct) / 100)
}

export type Collection = Record<string, number>

export interface DeckIssue {
  kind: 'size' | 'limit' | 'notOwned'
  cardId?: string
  detail: string
}

export function validateDeck(
  deck: readonly CardDef[],
  tamer: TamerDef,
  collection: Collection | null,
  eco: EconomyConfig,
): DeckIssue[] {
  const issues: DeckIssue[] = []
  if (deck.length !== tamer.deckSize)
    issues.push({ kind: 'size', detail: `Deste ${deck.length} kart, ${tamer.name} ${tamer.deckSize} ister` })
  const counts = new Map<CardDef, number>()
  for (const c of deck) counts.set(c, (counts.get(c) ?? 0) + 1)
  for (const [card, n] of counts) {
    if (n > deckLimit(card, eco))
      issues.push({ kind: 'limit', cardId: card.id, detail: `${card.name}: en fazla ${deckLimit(card, eco)}` })
    if (collection && n > (collection[card.id] ?? 0))
      issues.push({ kind: 'notOwned', cardId: card.id, detail: `${card.name}: ${collection[card.id] ?? 0} adet var` })
  }
  return issues
}

export function rarityAtLeast(r: Rarity, min: Rarity): boolean {
  return RARITIES.indexOf(r) >= RARITIES.indexOf(min)
}

export function cardsOfElement(cards: readonly CardDef[], el: Element): CardDef[] {
  return cards.filter((c) => c.elements.includes(el))
}
