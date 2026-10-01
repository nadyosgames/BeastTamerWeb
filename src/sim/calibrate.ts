import type { ContentDB } from '../content/index.ts'
import { quotaForWeek, type CalibratedBalance } from '../core/economy.ts'
import { deriveSeed } from '../core/rng.ts'
import { PROFILES, runCampaign, type CampaignResult } from './campaign.ts'
import { median, summarize, type Summary } from './stats.ts'

/**
 * Kota eğrisi kalibrasyonu: elle sayı yazmak yerine kota, "iyi oyuncu" ajanlarının
 * simüle edilen haftalık gelirinden türetilir.
 *
 *   kota[h] = medyan(iyi oyuncu geliri[h]) / hedefOran      (hedefOran = 1.15 → kotanın %115'i)
 *
 * Döngüseldir: kota → paket → koleksiyon → gelir → kota. Bu yüzden birkaç iterasyonda
 * sabit noktaya yakınsatılır. Eğri yumuşatılır ve azalmaz yapılır (senaryolu kota).
 * Sonuç content/generated/balance.json'a yazılır; oyun ve sonraki simülasyonlar onu okur.
 */
export interface CalibrationOptions {
  seed: number
  weeks: number
  agents: number
  iterations: number
  ratio: number
  onProgress?: (msg: string) => void
}

export interface ProfileValidation {
  profile: string
  passRate: number
  /** gelir / kota (tüm haftalar, tüm ajanlar) */
  ratio: Summary
  hours: number
  finalCompletion: number
}

export interface CalibrationResult {
  balance: CalibratedBalance
  iterations: { iteration: number; meanChange: number }[]
  validation: ProfileValidation[]
}

export function calibrateQuota(db: ContentDB, opts: CalibrationOptions): CalibrationResult {
  const log = opts.onProgress ?? (() => {})
  let curve = Array.from({ length: opts.weeks }, (_, w) => quotaForWeek(w, db.economy, null))
  const iterations: CalibrationResult['iterations'] = []

  for (let it = 0; it < opts.iterations; it++) {
    const runs = runAgents(db, 'good', curve, opts, deriveSeed(opts.seed, it))
    const next = smoothCurve(
      curve.map((_, w) => median(runs.map((r) => r.weeks[w].income)) / opts.ratio),
    )
    const meanChange = next.reduce((a, q, w) => a + Math.abs(q - curve[w]) / Math.max(1, curve[w]), 0) / next.length
    iterations.push({ iteration: it + 1, meanChange })
    log(`iterasyon ${it + 1}/${opts.iterations}: ortalama değişim %${(meanChange * 100).toFixed(1)}`)
    curve = next
  }

  const validation = (['good', 'casual', 'mismatched'] as const).map((profile) => {
    const runs = runAgents(db, profile, curve, opts, deriveSeed(opts.seed, 999))
    return validate(profile, runs)
  })

  return {
    balance: {
      generatedAt: new Date().toISOString(),
      seed: opts.seed,
      agents: opts.agents,
      quotaByWeek: curve,
      notes: [
        `Hedef: iyi oyuncu medyan geliri = kota × ${opts.ratio}`,
        ...validation.map(
          (v) =>
            `${PROFILES[v.profile].label}: kota tutma %${(v.passRate * 100).toFixed(0)}, gelir/kota medyan ${v.ratio.p50.toFixed(2)}, ${v.hours.toFixed(0)} saat`,
        ),
      ],
    },
    iterations,
    validation,
  }
}

export function runAgents(
  db: ContentDB,
  profile: keyof typeof PROFILES,
  curve: number[] | undefined,
  opts: { weeks: number; agents: number },
  seed: number,
): CampaignResult[] {
  return Array.from({ length: opts.agents }, (_, a) =>
    runCampaign(db, { seed: deriveSeed(seed, a), weeks: opts.weeks, profile: PROFILES[profile], quotaCurve: curve }),
  )
}

export function validate(profile: string, runs: CampaignResult[]): ProfileValidation {
  const ratios = runs.flatMap((r) => r.weeks.map((w) => w.income / w.quota))
  return {
    profile,
    passRate: runs.reduce((a, r) => a + r.passRate, 0) / runs.length,
    ratio: summarize(ratios),
    hours: runs.reduce((a, r) => a + r.hours, 0) / runs.length,
    finalCompletion: runs.reduce((a, r) => a + r.finalCompletion, 0) / runs.length,
  }
}

/** 3 haftalık hareketli ortalama → azalmayan → okunaklı yuvarlama. */
export function smoothCurve(raw: number[]): number[] {
  const avg = raw.map((_, i) => {
    const win = raw.slice(Math.max(0, i - 1), i + 2)
    return win.reduce((a, b) => a + b, 0) / win.length
  })
  let max = 0
  return avg.map((v) => {
    max = Math.max(max, v)
    const step = max < 1000 ? 10 : max < 10000 ? 50 : 100
    return Math.round(max / step) * step
  })
}
