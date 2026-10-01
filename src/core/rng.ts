/**
 * Deterministik, tohumlanabilir RNG (mulberry32).
 * Aynı tohum = aynı karışım = aynı simülasyon sonucu. C# portu: tüm işlemler uint32
 * üzerinde (Math.imul → unchecked çarpma, >>> → uint sağa kaydırma).
 * Durum tek bir sayı olduğu için kayıt dosyasına yazılabilir.
 */
export interface Rng {
  /** [0, 1) */
  next(): number
  /** [0, max) tamsayı */
  int(max: number): number
  /** Serileştirilebilir iç durum. */
  state(): number
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (max) => Math.floor(next() * max),
    state: () => s,
  }
}

/** Fisher-Yates, yeni dizi döner. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    const tmp = a[i]
    a[i] = a[j]
    a[j] = tmp
  }
  return a
}

/** Ağırlıklı seçim. Ağırlıklar toplamı 0 ise ilk eleman. */
export function weightedPick<T>(items: readonly T[], weight: (item: T) => number, rng: Rng): T {
  let total = 0
  for (const it of items) total += weight(it)
  let r = rng.next() * total
  for (const it of items) {
    r -= weight(it)
    if (r < 0) return it
  }
  return items[0]
}

/** Alt tohum türetme: bir simülasyonun her ajanı/haftası bağımsız ama tekrarlanabilir olsun. */
export function deriveSeed(seed: number, ...parts: number[]): number {
  let h = seed >>> 0
  for (const p of parts) {
    h = Math.imul(h ^ (p >>> 0), 0x9e3779b1) >>> 0
    h ^= h >>> 16
  }
  return h >>> 0
}
