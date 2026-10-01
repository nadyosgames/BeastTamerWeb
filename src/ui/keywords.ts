import type { AbilityTrigger, CardDef, Keyword } from '../core/types.ts'

type RuleKeyword = Keyword | AbilityTrigger | 'slumber'
export const KEYWORD_INFO: Record<RuleKeyword, { label: string; description: string }> = {
  swift: { label: 'Swift', description: 'Her geçişte diğer kartlardan önce tetiklenir.' },
  heavy: { label: 'Heavy', description: 'Her geçişte diğer kartlardan sonra tetiklenir.' },
  ward: { label: 'Ward', description: 'İlk dayanıklılık kaybını engeller.' },
  rebirth: { label: 'Rebirth', description: 'Dayanıklılığı bitince bir kez 1 dayanıklılıkla geri döner.' },
  overload: { label: 'Overload', description: 'Her tetikte 2 dayanıklılık harcar.' },
  slumber: { label: 'Slumber', description: 'N. geçişe kadar uyur; sonra tetiklenmeye başlar.' },
  howl: { label: 'Howl', description: 'Tur başında bir kez tetiklenir.' },
  harvest: { label: 'Harvest', description: 'Sırası geldiğinde tetiklenir.' },
  lastBreath: { label: 'Last Breath', description: 'Dayanıklılığı bitince bir kez tetiklenir.' },
  aura: { label: 'Aura', description: 'Masadayken sürekli etkilidir. Pasifken de devam eder.' },
  epilogue: { label: 'Epilogue', description: 'Tur sonunda tetiklenir.' },
  haunt: { label: 'Haunt', description: 'Başka bir kart pasife geçince tetiklenir.' },
}

const info = Object.entries(KEYWORD_INFO) as [RuleKeyword, typeof KEYWORD_INFO[RuleKeyword]][]
const tokenPattern = '\\b(Last Breath|Slumber(?:\\s+\\d+)?|Swift|Heavy|Ward|Rebirth|Overload|Howl|Harvest|Aura|Epilogue|Haunt)\\b'

export function keywordTextParts(text: string) {
  return text.split(new RegExp(tokenPattern, 'g')).filter(Boolean).map((value) => ({
    text: value,
    keyword: new RegExp(`^${tokenPattern}$`).test(value),
  }))
}

/** Yalnızca kural başlıklarından böler; cümle içindeki Harvest'te gibi kullanımları korur. */
export function cardTextParagraphs(text: string): string[] {
  const starts = [...text.matchAll(/\b(?:Last Breath|Slumber\s+\d+|Swift|Heavy|Ward|Rebirth|Overload|Howl|Harvest|Aura|Epilogue|Haunt)(?=\s*[:.])/g)].map((match) => match.index)
  const boundaries = [...new Set([0, ...starts, text.length])]
  return boundaries.slice(0, -1).map((start, i) => text.slice(start, boundaries[i + 1]).trim()).filter(Boolean)
}

export function cardKeywordInfo(card: CardDef) {
  const used = new Set<RuleKeyword>(card.keywords ?? [])
  if (card.slumber) used.add('slumber')
  for (const ability of card.abilities) used.add(ability.on)
  for (const [key, entry] of info) if (new RegExp(`\\b${entry.label}\\b`).test(card.text)) used.add(key)
  return [...used].map((key) => ({
    ...KEYWORD_INFO[key],
    label: key === 'slumber' && card.slumber ? `Slumber ${card.slumber}` : KEYWORD_INFO[key].label,
    description: key === 'slumber' && card.slumber
      ? `${card.slumber}. geçişte tetiklenmeye başlar.`
      : KEYWORD_INFO[key].description,
  }))
}
