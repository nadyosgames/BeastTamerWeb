import type { AbilityTrigger, CardDef, Keyword } from '../core/types.ts'

type RuleKeyword = Keyword | AbilityTrigger | 'slumber'
export const KEYWORD_INFO: Record<RuleKeyword, { label: string; description: string }> = {
  swift: { label: 'Swift', description: 'Her geçişte normal kartlardan önce tetiklenir. Birden fazla Swift kartı kendi arasında soldan sağa çalışır.' },
  heavy: { label: 'Heavy', description: 'Her geçişte normal kartlardan sonra tetiklenir. Birden fazla Heavy kartı kendi arasında soldan sağa çalışır.' },
  ward: { label: 'Ward', description: 'İlk dayanıklılık kaybını engeller; ardından koruma kalkar. Hava etkisinden gelen kaybı da engeller.' },
  rebirth: { label: 'Rebirth', description: 'Dayanıklılığı bitince bir kez 1 dayanıklılıkla geri döner. Varsa Last Breath geri dönmeden önce ve yalnızca ilk ölümünde çalışır.' },
  overload: { label: 'Overload', description: 'Her Harvest tetiğinde 1 yerine 2 dayanıklılık harcar.' },
  slumber: { label: 'Slumber', description: 'İlk N−1 geçişte uyur; N. geçişten itibaren tetiklenir. Uyurken Aura etkisi devam eder.' },
  howl: { label: 'Howl', description: 'Kartlar dizildikten sonra, tur başında ve ilk geçişten önce bir kez çalışır.' },
  harvest: { label: 'Harvest', description: 'Her geçişte aktif kartın sırası geldiğinde çalışır. Etkisi uygulandıktan sonra kart dayanıklılık harcar.' },
  lastBreath: { label: 'Last Breath', description: 'Dayanıklılığı 0’a düşen kartın son Harvest tetiğinden sonra bir kez çalışır.' },
  aura: { label: 'Aura', description: 'Kart masadayken sürekli etkilidir. Kart uyurken veya pasifken de devam eder; Harvest gelirini etkiler.' },
  epilogue: { label: 'Epilogue', description: 'Tüm kartların tetikleri bittikten sonra, tur kapanırken çalışır.' },
  haunt: { label: 'Haunt', description: 'Masadaki başka bir kart pasife geçtiğinde çalışır. Bu kart aktif veya pasif olabilir; Haunt dayanıklılık harcamaz.' },
}

const info = Object.entries(KEYWORD_INFO) as [RuleKeyword, typeof KEYWORD_INFO[RuleKeyword]][]
const tokenPattern = '\\b(Last Breath|Slumber(?:\\s+\\d+)?|Swift|Heavy|Ward|Rebirth|Overload|Howl|Harvest|Aura|Epilogue|Haunt)\\b'

export function keywordTextParts(text: string) {
  return text.split(new RegExp(tokenPattern, 'g')).filter(Boolean).map((value) => ({
    text: value,
    keyword: new RegExp(`^${tokenPattern}$`).test(value),
  }))
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
      ? `İlk ${card.slumber - 1} geçişte uyur; ${card.slumber}. geçişten itibaren tetiklenir. Uyurken Aura etkisi devam eder.`
      : KEYWORD_INFO[key].description,
  }))
}
