/**
 * Görsel çözümleme: src/generated/art/ (art pipeline'ının web çıktısı) derleme zamanında taranır.
 * Yeni görsel eklendiğinde Vite HMR bu modülü günceller; görseli olmayan varlık için
 * null döner ve UI element renkli yer tutucu gösterir.
 */
const files = import.meta.glob<string>('../generated/art/**/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
})

const byKey = new Map<string, string>()
for (const [p, url] of Object.entries(files)) {
  const m = p.match(/generated\/art\/(.+)\.webp$/)
  if (m) byKey.set(m[1], url)
}

/** artUrl('cards', 'spark_fox') ya da artUrl('cards', 'spark_fox', true) → küçük sürüm */
export function artUrl(kind: 'cards' | 'tamers' | 'weather', id: string, thumb = false): string | null {
  return byKey.get(`${kind}/${id}${thumb ? '@thumb' : ''}`) ?? byKey.get(`${kind}/${id}`) ?? null
}
