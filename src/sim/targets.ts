import type { ContentDB } from '../content/index.ts'
import { arrangementExperiment, duplicateRatio, presetMatrix, weatherFitExperiment } from './experiments.ts'
import { expeditionExperiment, intentAwarenessGain, simulateHunt } from './hunt.ts'
import { inRange, summarize } from './stats.ts'

/**
 * GDD "Denge ve simülasyon / Hedefler" maddelerinin otomatik kontrolü (v0.8: av hedefleri dahil).
 * Hedef aralıkları content/balance-targets.json'dadır. `npm run sim -- check` her içerik
 * değişikliğinden sonra çalıştırılır: yeni kart/yaratık eklemek = bu tabloyu yeniden yeşile çekmek.
 */
export interface TargetCheck {
  id: string
  text: string
  value: number
  /** Değerin tablodaki gösterimi. */
  shown: string
  target: string
  pass: boolean
  detail?: string
}

export interface CheckOptions {
  seed: number
  days: number
  samples: number
  onProgress?: (msg: string) => void
}

const fmtRange = (r: readonly [number, number]) => `${r[0]}-${r[1]}`
const f2 = (n: number) => n.toFixed(2)
const pct = (n: number) => `%${(n * 100).toFixed(0)}`

export function checkBalance(db: ContentDB, opts: CheckOptions): TargetCheck[] {
  const t = db.targets.targets
  const log = opts.onProgress ?? (() => {})
  const out: TargetCheck[] = []

  log('dizilim becerisi ölçülüyor...')
  const arr = arrangementExperiment(db, { seed: opts.seed, days: opts.days })
  out.push({
    id: 'arrangementSkill',
    text: t.arrangementSkill.text,
    value: arr.masterOverNovice,
    shown: `x${f2(arr.masterOverNovice)}`,
    target: `x${fmtRange(t.arrangementSkill.masterOverNovice)}`,
    pass: inRange(arr.masterOverNovice, t.arrangementSkill.masterOverNovice),
    detail: `usta ${arr.income.master.mean.toFixed(0)} · acemi ${arr.income.novice.mean.toFixed(0)} · rastgele ${arr.income.random.mean.toFixed(0)} (başlangıç destesi)`,
  })

  log('hava uyumu ölçülüyor...')
  const fit = weatherFitExperiment(db, { seed: opts.seed, days: Math.max(10, Math.floor(opts.days / 4)) })
  const worstFit = fit.rows.reduce((a, b) => (b.ratio < a.ratio ? b : a))
  out.push({
    id: 'weatherFit',
    text: t.weatherFit.text,
    value: fit.meanRatio,
    shown: `x${f2(fit.meanRatio)}`,
    target: `x${fmtRange(t.weatherFit.matchedOverMismatched)}`,
    pass: inRange(fit.meanRatio, t.weatherFit.matchedOverMismatched),
    detail: `en zayıf: ${worstFit.weather} x${worstFit.ratio.toFixed(2)} (tam koleksiyon)`,
  })

  if (db.decks.length > 1) {
    log('preset desteler: dizilim etkisi ve hava matrisi...')
    const m = presetMatrix(db, { seed: opts.seed, days: Math.max(30, Math.floor(opts.days / 3)) })
    const weakest = m.rows.reduce((a, b) => (b.masterOverRandom < a.masterOverRandom ? b : a))
    out.push({
      id: 'presetDominance',
      text: 'Hiçbir deste bütün hava türlerinde üstte olmamalı (GDD).',
      value: m.dominant ? 0 : 1,
      shown: m.dominant ? 'var' : 'yok',
      target: 'baskın deste yok',
      pass: !m.dominant,
      detail: m.dominant ? `${m.dominant} her havada birinci` : `en az dizilim etkisi: ${weakest.name} x${weakest.masterOverRandom.toFixed(2)} (usta/rastgele)`,
    })
  }

  const dup = duplicateRatio(db)
  out.push({ id: 'duplicates', text: t.duplicates.text, value: dup, shown: pct(dup), target: `≤ ${pct(t.duplicates.maxRatio)}`, pass: dup <= t.duplicates.maxRatio })

  // --- Av hedefleri ---------------------------------------------------------------------------
  const samples = opts.samples
  log('av turları: hedef profillerde bayıltma turu...')
  const offTarget: string[] = []
  let worstGap = 0
  let huntMinutes: number[] = []
  for (const h of db.hunts) {
    if (!h.target) continue
    const r = simulateHunt(db, h.id, { deck: h.target.deck, weather: h.target.weather, bot: 'aware', immortalTamer: true }, { seed: opts.seed, samples })
    const gap = r.killRound.p50 - h.target.round
    if (Math.abs(gap) > Math.abs(worstGap)) worstGap = gap
    if (Math.abs(gap) > t.huntRound.tolerance) offTarget.push(`${db.card(h.card).name} ${r.killRound.p50.toFixed(1)}/${h.target.round}`)
    if (!h.siege) huntMinutes = huntMinutes.concat(r.minutes.p50)
  }
  out.push({
    id: 'huntRound',
    text: t.huntRound.text,
    value: worstGap,
    shown: `${worstGap >= 0 ? '+' : ''}${worstGap.toFixed(2)} tur`,
    target: `±${t.huntRound.tolerance}`,
    pass: offTarget.length === 0,
    detail: offTarget.length ? `hedef dışı: ${offTarget.join(', ')}` : 'tüm avlar hedefte (en büyük sapma gösterildi)',
  })
  const mins = summarize(huntMinutes)
  out.push({
    id: 'dayLength',
    text: t.dayLength.text,
    value: mins.mean,
    shown: `${mins.mean.toFixed(1)} dk`,
    target: `${fmtRange(t.dayLength.minutes)} dk`,
    pass: inRange(mins.mean, t.dayLength.minutes),
    detail: `av başına medyan süre, en kısa ${mins.min.toFixed(1)} · en uzun ${mins.max.toFixed(1)} dk (bayıltınca av biter)`,
  })

  log('Tamer güvenliği: ortalama oyuncu, tam can...')
  const safety = db.hunts
    .filter((h) => h.target && !h.siege)
    .map((h) => {
      const r = simulateHunt(db, h.id, { deck: h.target!.deck, weather: h.target!.weather, bot: 'casual' }, { seed: opts.seed, samples: Math.max(40, Math.floor(samples / 3)) })
      return { h, down: (r.outcomes.tamerDown ?? 0) / r.samples }
    })
  const worstSafety = safety.reduce((a, b) => (b.down > a.down ? b : a))
  const unsafe = safety.filter((s) => s.down > t.tamerSafety.maxDownRate)
  out.push({
    id: 'tamerSafety',
    text: t.tamerSafety.text,
    value: worstSafety.down,
    shown: pct(worstSafety.down),
    target: `≤ ${pct(t.tamerSafety.maxDownRate)}`,
    pass: unsafe.length === 0,
    detail: unsafe.length ? `tehlikeli: ${unsafe.map((s) => `${db.card(s.h.card).name} ${pct(s.down)}`).join(', ')}` : `en riskli: ${db.card(worstSafety.h.card).name} ${pct(worstSafety.down)}`,
  })

  log('başlangıç destesi Sıradan avlarda...')
  // Başlangıç destesi yalnızca başlangıç bölgesinin Sıradan avları için anlamlıdır.
  const startRegions = new Set(db.regions.filter((r) => r.unlock.kind === 'start').map((r) => r.id))
  const ordinary = db.hunts.filter((h) => h.tier === 'ordinary' && startRegions.has(h.region))
  const starterRates = ordinary.map((h) => ({ h, r: simulateHunt(db, h.id, { deck: db.starter.deck, weather: 'calm', bot: 'aware' }, { seed: opts.seed, samples }) }))
  const worstStarter = starterRates.reduce((a, b) => (b.r.captureRate < a.r.captureRate ? b : a))
  out.push({
    id: 'starterHunts',
    text: t.starterHunts.text,
    value: worstStarter.r.captureRate,
    shown: pct(worstStarter.r.captureRate),
    target: `≥ ${pct(t.starterHunts.captureRate)}`,
    pass: worstStarter.r.captureRate >= t.starterHunts.captureRate,
    detail: `en zor: ${db.card(worstStarter.h.card).name} (medyan ${worstStarter.r.killRound.p50.toFixed(1)}. tur, Tamer ${worstStarter.r.tamerDamage.p50.toFixed(0)} can kaybı)`,
  })

  log('niyet farkındalığı: aware / master...')
  const aware = db.hunts.filter((h) => h.tier === 'ordinary' || h.tier === 'hard').map((h) => ({ h, ...intentAwarenessGain(db, h.id, { seed: opts.seed, samples: Math.max(20, Math.floor(samples / 4)) }) })).filter((a) => a.rounds > 0)
  const gain = aware.reduce((a, b) => a + b.gain, 0) / Math.max(1, aware.length)
  out.push({
    id: 'intentAwareness',
    text: t.intentAwareness.text,
    value: gain,
    shown: `+${(gain * 100).toFixed(1)}%`,
    target: `≥ +${(t.intentAwareness.minGain * 100).toFixed(0)}%`,
    pass: gain >= t.intentAwareness.minGain,
    detail: aware.map((a) => `${db.card(a.h.card).name} +${(a.gain * 100).toFixed(1)}`).join(' · '),
  })

  log('hava etkisi: zırhı söndüren hava / Sakin gün...')
  // Hava şartlı özelliği olan avlar (Zırh belli havada söner): o hava bayıltmayı belirgin öne çekmeli.
  const weatherRows = db.hunts
    .filter((h) => h.target && h.target.weather !== 'calm' && (h.traits ?? []).some((t) => t.kind === 'armor' && t.offIn?.includes(h.target!.weather)))
    .map((h) => {
      const fit = simulateHunt(db, h.id, { deck: h.target!.deck, weather: h.target!.weather, bot: 'aware', immortalTamer: true }, { seed: opts.seed, samples })
      const calm = simulateHunt(db, h.id, { deck: h.target!.deck, weather: 'calm', bot: 'aware', immortalTamer: true }, { seed: opts.seed, samples })
      return { h, diff: calm.killRound.p50 - fit.killRound.p50 }
    })
  const worstWeather = weatherRows.reduce((a, b) => (b.diff < a.diff ? b : a), weatherRows[0])
  if (worstWeather)
    out.push({
      id: 'weatherHunt',
      text: t.weatherHunt.text,
      value: worstWeather.diff,
      shown: `${worstWeather.diff.toFixed(1)} tur`,
      target: `≥ ${t.weatherHunt.minRounds} tur`,
      pass: worstWeather.diff >= t.weatherHunt.minRounds,
      detail: weatherRows.map((r) => `${db.card(r.h.card).name} ${r.diff.toFixed(1)}`).join(' · '),
    })

  log('sefer: başlangıç destesiyle art arda Sıradan avlar...')
  const exp = expeditionExperiment(db, { seed: opts.seed, samples: Math.max(40, Math.floor(samples / 2)), hunts: t.expedition.hunts })
  const after = summarize(exp.map((e) => e.hpPctAfter[t.expedition.hunts - 1]))
  out.push({
    id: 'expedition',
    text: t.expedition.text,
    value: after.p50,
    shown: `%${after.p50.toFixed(0)}`,
    target: `%${t.expedition.hpPct[0]}-${t.expedition.hpPct[1]}`,
    pass: inRange(after.p50, t.expedition.hpPct),
    detail: `${t.expedition.hunts} avdan sonra Tamer canı p10 %${after.p10.toFixed(0)} · p90 %${after.p90.toFixed(0)} · ortalama yakalama ${(exp.reduce((a, e) => a + e.captures, 0) / exp.length).toFixed(1)}`,
  })
  return out
}
