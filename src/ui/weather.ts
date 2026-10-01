import type { CardDef, CardFilter, Element, WeatherDef } from '../core/types.ts'
import { RARITIES } from '../core/types.ts'

export const WEATHER_ICON: Record<string, string> = {
  sun: '☀️',
  rain: '🌧️',
  storm: '⛈️',
  wind: '🌬️',
  quake: '⛰️',
  fog: '🌫️',
  drought: '🏜️',
  calm: '🍃',
}

/** Kartın kendi özelliklerine bakan filtre (masa durumu gerektiren alanlar yok sayılır). */
function matchesStatic(card: CardDef, f: CardFilter | undefined): boolean {
  if (!f) return true
  if (f.element && !card.elements.includes(f.element)) return false
  if (f.type && card.type !== f.type) return false
  if (f.keyword && !(card.keywords ?? []).includes(f.keyword)) return false
  if (f.rarityAtLeast && RARITIES.indexOf(card.rarity) < RARITIES.indexOf(f.rarityAtLeast)) return false
  if (f.anyOf && !f.anyOf.some((sub) => matchesStatic(card, sub))) return false
  return true
}

/** Destenin bu havadaki ortalama gelir etkisi (%), kart başına hava yüzdeleri toplanarak. */
export function deckWeatherPct(cards: readonly CardDef[], weather: WeatherDef | undefined): number {
  if (!weather || !cards.length) return 0
  let sum = 0
  for (const c of cards)
    for (const m of weather.modifiers) if (m.kind === 'incomePct' && matchesStatic(c, m.filter)) sum += m.pct
  return sum / cards.length
}

export function elementCounts(cards: readonly CardDef[]): Partial<Record<Element, number>> {
  const out: Partial<Record<Element, number>> = {}
  for (const c of cards) for (const e of c.elements) out[e] = (out[e] ?? 0) + 1
  return out
}
