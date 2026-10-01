import type { ArtConfig, ArtKind, ContentDB } from '../content/index.ts'
import type { CardDef, TamerDef, WeatherDef } from '../core/types.ts'

/**
 * ChatGPT görsel prompt'ları içerikten üretilir (GDD "Kart görseli prompt'u").
 * Görsel yalnızca yaratık illüstrasyonudur; çerçeve, isim, sayılar ve nadirlik
 * rozeti oyun arayüzünde (web: CardView, Unity: kart prefab'ı) kurulur.
 * Bu modül saf TS: hem CLI script'leri hem de tarayıcıdaki Art Studio kullanır.
 */
export interface ArtAssetRef {
  kind: ArtKind
  id: string
  /** "cards/spark_fox" — dosya yolu ve manifest anahtarı. */
  key: string
  name: string
  prompt: string
}

const ELEMENT_NAMES: Record<string, string> = {
  fire: 'fire',
  water: 'water',
  earth: 'earth',
  wind: 'wind',
  electric: 'electric',
}

export function cardPrompt(card: CardDef, art: ArtConfig): string {
  const lines = card.elements.map((e) => art.elements[e])
  const element =
    card.elements.length > 1
      ? `${card.elements.map((e) => ELEMENT_NAMES[e]).join(' and ')} combined, ${lines.map((l) => l.split(': ')[1]).join('; ')}`
      : lines[0]
  return fill(art.kinds.cards.template, {
    CREATURE: card.art?.creature ?? card.name,
    ELEMENT: element,
    POWER: art.power[card.rarity],
  })
}

export function tamerPrompt(tamer: TamerDef, art: ArtConfig): string {
  return fill(art.kinds.tamers.template, { SUBJECT: tamer.art?.subject ?? tamer.name })
}

export function weatherPrompt(weather: WeatherDef, art: ArtConfig): string {
  return fill(art.kinds.weather.template, { SUBJECT: weather.art?.subject ?? weather.name })
}

/**
 * ChatGPT'ye yapıştırılacak tam metin. Stil referansı ilk beğenilen görseldir
 * (art/style-ref/<kind>.png): aynı sohbette ya da yeniden yükleyerek kullanılır.
 */
export function fullPrompt(asset: ArtAssetRef, art: ArtConfig, withStyleAnchor: boolean): string {
  return [withStyleAnchor ? art.styleAnchor : null, asset.prompt, art.negative].filter(Boolean).join(' ')
}

export function listArtAssets(db: ContentDB): ArtAssetRef[] {
  const out: ArtAssetRef[] = []
  for (const c of db.cards) out.push({ kind: 'cards', id: c.id, key: `cards/${c.id}`, name: c.name, prompt: cardPrompt(c, db.art) })
  for (const t of db.tamers)
    out.push({ kind: 'tamers', id: t.id, key: `tamers/${t.id}`, name: t.name, prompt: tamerPrompt(t, db.art) })
  for (const w of db.weather)
    out.push({ kind: 'weather', id: w.id, key: `weather/${w.id}`, name: w.name, prompt: weatherPrompt(w, db.art) })
  return out
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([A-Z_ ]+)\}/g, (m, k: string) => vars[k] ?? m)
}
