import type { CardDef, Element, Rarity, TamerDef } from './types.ts'
import { RARITIES } from './types.ts'

/**
 * Ekonomi kuralları. Sayıların kendisi content/economy.json'da (tasarımcı ayarları)
 * ve content/generated/balance.json'da (simülasyon kalibrasyonu çıktısı) durur.
 * Kural: oyun içinde elle yazılmış denge sayısı yok; kota eğrisi kalibrasyondan gelir.
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
  packPricePctOfQuota: number
  weeklyPack: string
  /** Kalibrasyon yokken kullanılan geçici kota formülü. */
  quotaFallback: { base: number; growthPerWeek: number }
  pity: { packsWithoutRarePlus: number }
  softFail: { missedWeeks: number; quotaReductionPct: number }
  timing: { planningSecPerRound: number; secPerStep: number }
}

/** Simülasyonla üretilen denge verisi (content/generated/balance.json). */
export interface CalibratedBalance {
  generatedAt: string
  seed: number
  agents: number
  quotaByWeek: number[]
  notes?: string[]
}

export function quotaForWeek(weekIndex: number, eco: EconomyConfig, calibrated?: CalibratedBalance | null): number {
  const curve = calibrated?.quotaByWeek
  if (curve && curve.length) return curve[Math.min(weekIndex, curve.length - 1)]
  const { base, growthPerWeek } = eco.quotaFallback
  return Math.round(base * Math.pow(1 + growthPerWeek, weekIndex))
}

export function packPrice(pack: PackDef, quota: number, eco: EconomyConfig): number {
  return Math.round(((quota * eco.packPricePctOfQuota) / 100) * pack.priceMult)
}

export function standardPackPrice(quota: number, eco: EconomyConfig): number {
  const std = eco.packs.find((p) => p.id === eco.weeklyPack) ?? eco.packs[0]
  return packPrice(std, quota, eco)
}

export function deckLimit(card: CardDef, eco: EconomyConfig): number {
  return eco.rarities[card.rarity].deckLimit
}

/** Destede kullanılabilecek sayıyı aşan kopyanın kaynak karşılığı. */
export function duplicateValue(card: CardDef, quota: number, eco: EconomyConfig): number {
  return Math.round((standardPackPrice(quota, eco) * eco.rarities[card.rarity].duplicatePct) / 100)
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
