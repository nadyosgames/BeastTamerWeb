import type { ContentDB } from '../../src/content/index.ts'
import type { Element, Rarity } from '../../src/core/types.ts'
import { ELEMENTS } from '../../src/core/types.ts'
import type { SetReview } from '../../src/sim/review.ts'

/** Kart seti incelemesini onay için okunur bir Markdown belgesine çevirir. */
const EL: Record<Element, string> = { fire: 'Ateş', water: 'Su', earth: 'Toprak', wind: 'Rüzgar', electric: 'Elektrik' }
const RAR: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic',
  ancient: 'Ancient',
}
const IDENTITY: Record<Element, string> = {
  fire: 'Isı (üret ve harca), Ateş zinciri (komşu Ateş), saf deste, Patlama (son tetik), Ejder ve Sürü',
  water: 'Gelgit (tek/çift geçiş), Kopya (komşunun geliri), dayanıklılık desteği, Rebirth / Last Breath, Ghost',
  earth: 'Humus (pasif kart sayısı), Heavy, "solundaki pasifse", kök desteği (Howl), Büyüme, Golem ve Flora',
  wind: 'Karışım (farklı element), Swift, konum (ilk/son slot), Avian ve Sürü',
  electric: 'Kutuplaşma (uyumlu/çakışan bağlantı), Overload, Ward, Elektrik sayımı',
}

const f1 = (n: number) => n.toFixed(1)
const x2 = (n: number) => `x${n.toFixed(2)}`
const esc = (s: string) => s.replace(/\|/g, '\\|')

export function reviewToMarkdown(r: SetReview, db: ContentDB, meta: { seed: number; seconds: number }): string {
  const name = (id: string) => db.cardById.get(id)?.name ?? id
  const L: string[] = []
  const elOf = (id: string) => db.cardById.get(id)!.elements.map((e) => EL[e]).join('+')

  L.push(`# Kart Seti ${r.set} — İnceleme (onay bekliyor)`, '')
  L.push(
    `Üretildi: ${new Date().toLocaleString('tr-TR')} · \`npm run sim -- review --set ${r.set}\` · tohum ${meta.seed} · ${Math.round(meta.seconds)} sn`,
    '',
  )
  L.push(`Kaynak dosya: \`content/proposals/${r.set}/cards.json\`. Oyuna eklenmedi; onaydan sonra \`content/cards.json\`'a taşınır.`, '')
  L.push(`Tarayıcıda dene: \`npm run dev\` → \`http://localhost:5173/?set=${r.set}#lab\` (Tur Laboratuvarı bu setle açılır).`, '')

  L.push('## Nasıl okunur', '')
  L.push('- **Değer**: kartın tur başına ortalama gelir katkısı. Rastgele 4 kartlık masaya eklenir, iki masa da **usta dizilimle** oynanır, fark alınır.')
  L.push('  - *Karışık*: masadaki diğer kartlar tüm setten. *Element*: yalnızca kartın kendi element(ler)inden (o elementin destesinde nasıl çalıştığı).')
  L.push('- **z**: aynı nadirlikteki kartlara göre sapma. ▲ (> 1,5) fazla güçlü, ▼ (< −1,5) zayıf olabilir.')
  L.push('- **Sinerji ortakları**: iki kart birlikteyken, her biri rastgele bir kartla değiştirildiği duruma göre fazladan kazanılan gelir (tur başına). Aynı kartın iki kopyası da sayılır (Sürü, Ejder gibi).')
  L.push('')

  // Özet tablo
  L.push('## Özet', '')
  const rarities = [...new Set(r.cards.map((c) => c.rarity))]
  L.push(`| Element | ${rarities.map((x) => RAR[x]).join(' | ')} | Toplam | Tipler |`)
  L.push(`|---|${rarities.map(() => '---:').join('|')}|---:|---|`)
  for (const e of ELEMENTS) {
    const cs = r.cards.filter((c) => c.elements[0] === e)
    const types = Object.entries(r.types[e])
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      .map(([t, n]) => `${t} ${n}`)
      .join(', ')
    L.push(`| ${EL[e]} | ${rarities.map((x) => cs.filter((c) => c.rarity === x).length).join(' | ')} | ${cs.length} | ${types} |`)
  }
  const hybrids = r.cards.filter((c) => c.elements.length > 1)
  L.push('', `Hibritler (${hybrids.length}, her element çifti için bir tane): ${hybrids.map((h) => `${h.name} (${h.elements.map((e) => EL[e]).join('+')})`).join(', ')}.`, '')

  // Simülasyon kontrolleri
  L.push('## Simülasyon kontrolleri', '')
  L.push('### Nadirlik eğrisi (ortalama değer, tur başına)', '')
  L.push(`| Nadirlik | Ortalama | ${ELEMENTS.map((e) => EL[e]).join(' | ')} |`)
  L.push(`|---|---:|${ELEMENTS.map(() => '---:').join('|')}|`)
  for (const row of r.rarityCurve)
    L.push(`| ${RAR[row.rarity]} | **${f1(row.mean)}** | ${ELEMENTS.map((e) => (row.byElement[e] !== undefined ? f1(row.byElement[e]!) : '–')).join(' | ')} |`)
  const means = r.rarityCurve.map((x) => x.mean)
  const monotonic = means.every((m, i) => i === 0 || m >= means[i - 1])
  L.push('', monotonic ? '✓ Nadirlik arttıkça güç artıyor.' : '✗ Nadirlik eğrisi düzgün artmıyor: bazı üst nadirlikler alttakilerden zayıf.', '')

  L.push('### Element destelerinde dizilimin etkisi', '')
  L.push('Her element için yalnızca o elementin kartlarından deste kuran bot (havasız, Gezgin), sonra o desteyle günler oynanır. GDD hedefi: usta/acemi **x1,25–1,50**.', '')
  L.push('| Deste | Usta/Acemi | Usta/Rastgele | Gün geliri (usta) | Gün süresi | Destenin çekirdeği |')
  L.push('|---|---:|---:|---:|---:|---|')
  for (const d of r.elementDecks) {
    const a = d.arrangement
    const ok = a.masterOverNovice >= 1.25 ? '✓' : '✗'
    L.push(
      `| ${EL[d.element]} | ${ok} ${x2(a.masterOverNovice)} | ${x2(a.masterOverRandom)} | ${Math.round(a.income.master.mean)} | ${f1(a.dayMinutes.mean)} dk | ${d.deck
        .slice(0, 6)
        .map((c) => `${c.name} ×${c.count}`)
        .join(', ')} |`,
    )
  }
  L.push('')

  L.push('### Hava uyumu (tüm set koleksiyonuyla)', '')
  L.push('Her hava için o havaya kurulmuş deste ile en uygunsuz deste karşılaştırılır. GDD hedefi: **x1,30–1,50**.', '')
  L.push('| Hava | Uygun deste | En uygunsuz deste | Oran |')
  L.push('|---|---:|---:|---:|')
  for (const w of r.weatherFit.rows) L.push(`| ${w.weather} | ${f1(w.matched)} | ${f1(w.mismatched)} (${w.mismatchedDeckFor} destesi) | ${x2(w.ratio)} |`)
  const fitOk = r.weatherFit.meanRatio >= 1.3 && r.weatherFit.meanRatio <= 1.5
  L.push('', `${fitOk ? '✓' : '✗'} Ortalama ${x2(r.weatherFit.meanRatio)}`, '')

  L.push('### En güçlü 20 sinerji', '')
  L.push('| Çift | Elementler | Fazladan gelir / tur |')
  L.push('|---|---|---:|')
  for (const p of r.topPairs.slice(0, 20))
    L.push(`| ${name(p.a)}${p.a === p.b ? ' ×2' : ` + ${name(p.b)}`} | ${elOf(p.a)}${p.a === p.b ? '' : ` / ${elOf(p.b)}`} | +${f1(p.gain)} |`)
  L.push('')

  const outliers = r.cards.filter((c) => Math.abs(c.z) > 1.5).sort((a, b) => b.z - a.z)
  L.push('### Dikkat edilecekler', '')
  if (outliers.length) {
    L.push('**Nadirliğine göre aykırı güç:**', '')
    for (const c of outliers)
      L.push(`- ${c.z > 0 ? '▲' : '▼'} **${c.name}** (${RAR[c.rarity]}, ${elOf(c.id)}) — değer ${f1(c.value)}, z ${c.z.toFixed(2)}`)
    L.push('')
  }
  if (r.lonely.length) {
    L.push('**Belirgin sinerji ortağı olmayan kartlar** (tek başına çalışan, "dolgu" kartlar — bazıları bilerek sade):', '')
    L.push(r.lonely.map((id) => name(id)).join(', '), '')
  }

  // Kart tabloları
  L.push('## Kartlar', '')
  for (const e of ELEMENTS) {
    const cs = r.cards.filter((c) => c.elements[0] === e)
    L.push(`### ${EL[e]} (${cs.length})`, '', `Kimlik: ${IDENTITY[e]}.`, '')
    L.push('| Kart | Nadirlik | Tip | Dyn | Yetenek | Karışık | Element | z | Sinerji ortakları |')
    L.push('|---|---|---|---:|---|---:|---:|---:|---|')
    for (const c of cs) {
      const nm = `**${c.name}**${c.elements.length > 1 ? ` (${c.elements.map((x) => EL[x]).join('+')})` : ''}`
      const z = (c.z > 1.5 ? '▲ ' : c.z < -1.5 ? '▼ ' : '') + c.z.toFixed(1)
      const partners =
        c.partners.map((p) => `${p.name} +${f1(p.gain)}`).join(', ') +
        (c.antiPartners.length ? ` · ✗ ${c.antiPartners.map((p) => `${p.name} ${f1(p.gain)}`).join(', ')}` : '')
      L.push(
        `| ${nm} | ${RAR[c.rarity]} | ${c.type} | ${c.durability} | ${esc(c.text)} | ${f1(c.valueMixed)} | ${f1(c.valueElement)} | ${z} | ${partners || '–'} |`,
      )
    }
    L.push('')
  }

  L.push('## Onay', '')
  L.push('Seçenekler: tümünü onayla · şu kartlar hariç onayla · şu kartları değiştir (sayı / yetenek / nadirlik / isim).')
  L.push('Onaylanan kartlar `content/cards.json`\'a taşınır, ardından preset desteler kurulur ve kota yeniden kalibre edilir.')
  return L.join('\n') + '\n'
}
