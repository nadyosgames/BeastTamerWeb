import type { AbilityTrigger, CardDef, Keyword } from '../core/types.ts'

/** `heat`: Ateş'in element mekaniği; anahtar kelime değil ama kart metninde aynı şekilde açıklanır. */
type RuleKeyword = Keyword | AbilityTrigger | 'slumber' | 'heat' | 'guard'
export const KEYWORD_INFO: Record<RuleKeyword, { label: string; description: string }> = {
  swift: { label: 'Swift', description: 'Her geçişte diğer kartlardan önce tetiklenir.' },
  heavy: { label: 'Heavy', description: 'Her geçişte diğer kartlardan sonra tetiklenir.' },
  ward: { label: 'Ward', description: 'İlk dayanıklılık kaybını engeller.' },
  rebirth: { label: 'Rebirth', description: 'Dayanıklılığı bitince bir kez 1 dayanıklılıkla geri döner.' },
  overload: { label: 'Overload', description: 'Her tetikte 2 dayanıklılık harcar.' },
  slumber: { label: 'Slumber', description: 'N. geçişe kadar uyur; sonra tetiklenmeye başlar.' },
  howl: { label: 'Howl', description: 'Tur başında bir kez tetiklenir.' },
  harvest: { label: 'Strike', description: 'Sırası geldiğinde tetiklenir; geliri av yaratığına hasar olarak işler.' },
  lastBreath: { label: 'Last Breath', description: 'Dayanıklılığı bitince bir kez tetiklenir.' },
  aura: { label: 'Aura', description: 'Masadayken sürekli etkilidir. Pasifken de devam eder.' },
  epilogue: { label: 'Epilogue', description: 'Tur sonunda tetiklenir.' },
  haunt: { label: 'Haunt', description: 'Başka bir kart pasife geçince tetiklenir.' },
  guard: { label: 'Koruma', description: 'Tur sonunda av yaratığının saldırısını emer. Tur bitince sıfırlanır.' },
  heat: { label: 'Isı', description: 'Masada biriken ortak sayaç. Isı ekleyen kartlar artırır, "Isı kadar" bonus alan kartlar ondan beslenir. Her tur 0 ile başlar.' },
}

const info = Object.entries(KEYWORD_INFO) as [RuleKeyword, typeof KEYWORD_INFO[RuleKeyword]][]
// \b Türkçe harflerde (Isı) çalışmaz; kelime sınırı Unicode harf lookaround'u ile kurulur.
const wordRe = (word: string, flags = '') => new RegExp(`(?<!\\p{L})${word}(?!\\p{L})`, `u${flags}`)
const tokenPattern = '(Last Breath|Slumber(?:\\s+\\d+)?|Swift|Heavy|Ward|Rebirth|Overload|Howl|Strike|Aura|Epilogue|Haunt|Koruma|Isı)'

export function keywordTextParts(text: string) {
  return text.split(wordRe(tokenPattern, 'g')).filter(Boolean).map((value) => ({
    text: value,
    keyword: wordRe(`^${tokenPattern}$`).test(value),
  }))
}

/** Yalnızca kural başlıklarından böler; cümle içindeki Strike'ta gibi kullanımları korur. */
export function cardTextParagraphs(text: string): string[] {
  const starts = [...text.matchAll(/\b(?:Last Breath|Slumber\s+\d+|Swift|Heavy|Ward|Rebirth|Overload|Howl|Strike|Aura|Epilogue|Haunt)(?=\s*[:.])/g)].map((match) => match.index)
  const boundaries = [...new Set([0, ...starts, text.length])]
  return boundaries.slice(0, -1).map((start, i) => text.slice(start, boundaries[i + 1]).trim()).filter(Boolean)
}

export function cardKeywordInfo(card: CardDef) {
  const used = new Set<RuleKeyword>(card.keywords ?? [])
  if (card.slumber) used.add('slumber')
  for (const ability of card.abilities) used.add(ability.on)
  for (const [key, entry] of info) if (wordRe(entry.label).test(card.text)) used.add(key)
  return [...used].map((key) => ({
    ...KEYWORD_INFO[key],
    label: key === 'slumber' && card.slumber ? `Slumber ${card.slumber}` : KEYWORD_INFO[key].label,
    description: key === 'slumber' && card.slumber
      ? `${card.slumber}. geçişte tetiklenmeye başlar.`
      : KEYWORD_INFO[key].description,
  }))
}
