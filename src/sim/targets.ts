import type { ContentDB } from '../content/index.ts'
import { deriveSeed } from '../core/rng.ts'
import { runAgents, validate } from './calibrate.ts'
import { arrangementExperiment, duplicateRatio, presetMatrix, weatherFitExperiment } from './experiments.ts'
import { inRange } from './stats.ts'

/**
 * GDD "Denge ve simülasyon / Hedefler" maddelerinin otomatik kontrolü.
 * Hedef aralıkları content/balance-targets.json'dadır. `npm run sim -- check`
 * her içerik değişikliğinden sonra çalıştırılır: yeni kart/mekanik eklemek = bu tabloyu
 * yeniden yeşile çekmek.
 */
export interface TargetCheck {
  id: string
  text: string
  value: number
  target: string
  pass: boolean
  detail?: string
}

export interface CheckOptions {
  seed: number
  days: number
  weeks: number
  agents: number
  onProgress?: (msg: string) => void
}

const fmtRange = (r: readonly [number, number], pct = false) =>
  pct ? `${(r[0] * 100).toFixed(0)}-${(r[1] * 100).toFixed(0)}%` : `${r[0]}-${r[1]}`

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
    target: `x${fmtRange(t.arrangementSkill.masterOverNovice)}`,
    pass: inRange(arr.masterOverNovice, t.arrangementSkill.masterOverNovice),
    detail: `usta ${arr.income.master.mean.toFixed(0)} · acemi ${arr.income.novice.mean.toFixed(0)} · rastgele ${arr.income.random.mean.toFixed(0)} (başlangıç destesi)`,
  })
  out.push({
    id: 'dayLength',
    text: t.dayLength.text,
    value: arr.dayMinutes.mean,
    target: `${fmtRange(t.dayLength.minutes)} dk`,
    pass: inRange(arr.dayMinutes.mean, t.dayLength.minutes),
    detail: `ort. ${arr.triggersPerDay.mean.toFixed(0)} tetik/gün, p10-p90 ${arr.dayMinutes.p10.toFixed(1)}-${arr.dayMinutes.p90.toFixed(1)} dk (başlangıç destesi)`,
  })

  log('hava uyumu ölçülüyor...')
  const fit = weatherFitExperiment(db, { seed: opts.seed, days: Math.max(10, Math.floor(opts.days / 4)) })
  const worstFit = fit.rows.reduce((a, b) => (b.ratio < a.ratio ? b : a))
  out.push({
    id: 'weatherFit',
    text: t.weatherFit.text,
    value: fit.meanRatio,
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
      target: 'baskın deste yok',
      pass: !m.dominant,
      detail: m.dominant
        ? `${m.dominant} her havada birinci`
        : `en az dizilim etkisi: ${weakest.name} x${weakest.masterOverRandom.toFixed(2)} (usta/rastgele)`,
    })
  }

  const dup = duplicateRatio(db)
  out.push({
    id: 'duplicates',
    text: t.duplicates.text,
    value: dup,
    target: `≤ ${(t.duplicates.maxRatio * 100).toFixed(0)}%`,
    pass: dup <= t.duplicates.maxRatio,
  })

  log('kampanya: iyi ve uyumsuz oyuncu ajanları...')
  const curve = db.balance.quotaByWeek.length ? db.balance.quotaByWeek : undefined
  const runOpts = { weeks: opts.weeks, agents: opts.agents }
  const good = validate('good', runAgents(db, 'good', curve, runOpts, deriveSeed(opts.seed, 1)))
  const mis = validate('mismatched', runAgents(db, 'mismatched', curve, runOpts, deriveSeed(opts.seed, 2)))
  const calibrated = curve ? '' : ' · KALİBRE EDİLMEMİŞ kota'
  out.push({
    id: 'quotaGood',
    text: 'İyi oyuncu kotanın %100-130\'unu yapmalı (medyan).',
    value: good.ratio.p50,
    target: fmtRange(t.quota.goodPlayerRatio, true),
    pass: inRange(good.ratio.p50, t.quota.goodPlayerRatio),
    detail: `kota tutma %${(good.passRate * 100).toFixed(0)}, ${opts.weeks} hafta${calibrated}`,
  })
  out.push({
    id: 'quotaMismatched',
    text: 'Uyumsuz destede oynayan kotanın %70-90\'ını yapmalı (medyan).',
    value: mis.ratio.p50,
    target: fmtRange(t.quota.mismatchedRatio, true),
    pass: inRange(mis.ratio.p50, t.quota.mismatchedRatio),
    detail: `kota tutma %${(mis.passRate * 100).toFixed(0)}${calibrated}`,
  })
  return out
}
