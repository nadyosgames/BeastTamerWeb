export interface Summary {
  n: number
  mean: number
  stdev: number
  min: number
  p10: number
  p50: number
  p90: number
  max: number
}

export function summarize(values: readonly number[]): Summary {
  const n = values.length
  if (!n) return { n: 0, mean: 0, stdev: 0, min: 0, p10: 0, p50: 0, p90: 0, max: 0 }
  const sorted = [...values].sort((a, b) => a - b)
  const mean = sorted.reduce((a, b) => a + b, 0) / n
  const variance = sorted.reduce((a, b) => a + (b - mean) ** 2, 0) / n
  const q = (p: number) => sorted[Math.min(n - 1, Math.max(0, Math.round(p * (n - 1))))]
  return { n, mean, stdev: Math.sqrt(variance), min: sorted[0], p10: q(0.1), p50: q(0.5), p90: q(0.9), max: sorted[n - 1] }
}

export function median(values: readonly number[]): number {
  return summarize(values).p50
}

export function inRange(v: number, [lo, hi]: readonly [number, number]): boolean {
  return v >= lo && v <= hi
}
