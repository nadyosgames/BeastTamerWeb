import type { Cmp } from './types.ts'

/**
 * Tetik gelirinin yuvarlanması. Motorlar arası eşlik için sabit kural:
 * yarım yukarı (x.5 → x+1). C#'ta Math.Round varsayılanı banker's rounding'dir,
 * bu yüzden orada da Math.Floor(x + 0.5) kullanılmalı. 1e-9 kayan nokta hatasını
 * (6.9999999 gibi) yutar.
 */
export function roundIncome(x: number): number {
  if (x <= 0) return 0
  return Math.floor(x + 0.5 + 1e-9)
}

export function compare(a: number, cmp: Cmp, b: number): boolean {
  switch (cmp) {
    case '>=':
      return a >= b
    case '<=':
      return a <= b
    case '==':
      return a === b
    case '>':
      return a > b
    case '<':
      return a < b
  }
}
