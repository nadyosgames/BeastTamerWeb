import type { CardDef } from '../core/types.ts'
import { validateDeck, type Collection } from '../core/economy.ts'
import { content } from '../ui/content.ts'

export interface PlayerDeck {
  id: string
  name: string
  tamer: string
  text: string
  cards: { card: string; count: number }[]
}

export interface DeckProfile {
  customDecks: Record<string, PlayerDeck>
  deckTamers: Record<string, string>
  /** Verilirse deste yalnızca sahip olunan kopyalarla oynanabilir (sandbox açıksa kısıt yok). */
  collection?: Collection
  sandbox?: boolean
}

export function playerDecks(profile: DeckProfile): PlayerDeck[] {
  const presets = content.decks.map((d) => profile.customDecks[d.id] ?? d)
  const created = Object.values(profile.customDecks).filter((d) => !content.deckById.has(d.id))
  return [...presets, ...created].map((d) => ({ ...d, tamer: profile.deckTamers[d.id] ?? d.tamer }))
}

export function playerDeck(profile: DeckProfile, id: string): PlayerDeck | undefined {
  const deck = profile.customDecks[id] ?? content.deckById.get(id)
  return deck ? { ...deck, tamer: profile.deckTamers[id] ?? deck.tamer } : undefined
}

export function playerDeckCards(profile: DeckProfile, id: string): CardDef[] {
  return playerDeck(profile, id)?.cards.flatMap(({ card, count }) => Array.from({ length: count }, () => content.card(card))) ?? []
}

/** Destede olup koleksiyonda olmayan kopya sayısı (sandbox'ta 0). */
export function missingCopies(profile: DeckProfile, id: string): number {
  if (profile.sandbox || !profile.collection) return 0
  return (playerDeck(profile, id)?.cards ?? []).reduce((n, { card, count }) => n + Math.max(0, count - (profile.collection![card] ?? 0)), 0)
}

export function playerDeckStatus(profile: DeckProfile, id: string) {
  const deck = playerDeck(profile, id)
  const tamer = deck && content.tamerById.get(deck.tamer)
  const cards = playerDeckCards(profile, id)
  if (!tamer) return { ready: false, count: cards.length, required: 0, missing: 0, reason: 'Deste bulunamadı' }
  const owned = profile.sandbox ? null : (profile.collection ?? null)
  const issues = validateDeck(cards, tamer, owned, content.economy)
  const missing = missingCopies(profile, id)
  const reason = cards.length < tamer.deckSize ? `${tamer.deckSize - cards.length} kart eksik · Avda seçilemez`
    : cards.length > tamer.deckSize ? `${cards.length - tamer.deckSize} kart fazla · Avda seçilemez`
    : missing ? `${missing} kart koleksiyonunda yok · Avla ya da paketle tamamla`
    : issues.length ? `${issues[0].detail} · Avda seçilemez`
    : 'Deste tamamlandı · Ava hazır'
  return { ready: issues.length === 0, count: cards.length, required: tamer.deckSize, missing, reason }
}
