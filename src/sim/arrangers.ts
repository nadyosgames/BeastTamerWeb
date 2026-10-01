import type { Arranger } from '../core/day.ts'
import { resolveRound } from '../core/engine/round.ts'
import { shuffle, type Rng } from '../core/rng.ts'
import type { CardDef } from '../core/types.ts'

/**
 * Dizilim botları (GDD "Simülasyon tasarımı"):
 *  - random: kartları rastgele dizer (taban çizgi),
 *  - novice: tek geçişli açgözlü; soldan sağa her slota kısmi diziyi en çok artıran kartı koyar,
 *  - master: tüm farklı dizilimleri dener (5 slot: en fazla 120).
 * "Dizilimin gerçek bir etkisi var mı?" sorusu master / novice oranıyla ölçülür.
 */
export type ArrangerKind = 'random' | 'novice' | 'master'

export function makeArranger(kind: ArrangerKind, rng: Rng): Arranger {
  switch (kind) {
    case 'random':
      return (hand) => shuffle(hand, rng)
    case 'novice':
      return noviceArranger
    case 'master':
      return masterArranger
  }
}

export const noviceArranger: Arranger = (hand, ctx) => {
  const placed: CardDef[] = []
  const rest = hand.slice()
  while (rest.length) {
    let best = -1
    let bestIdx = 0
    const seen = new Set<CardDef>()
    for (let i = 0; i < rest.length; i++) {
      if (seen.has(rest[i])) continue
      seen.add(rest[i])
      placed.push(rest[i])
      const t = resolveRound(placed, ctx).total
      placed.pop()
      if (t > best) {
        best = t
        bestIdx = i
      }
    }
    placed.push(rest.splice(bestIdx, 1)[0])
  }
  return placed
}

export const masterArranger: Arranger = (hand, ctx) => {
  const n = hand.length
  let best = -1
  let bestArr = hand.slice()
  const cur: CardDef[] = []
  const used = new Array<boolean>(n).fill(false)
  const rec = () => {
    if (cur.length === n) {
      const t = resolveRound(cur, ctx).total
      if (t > best) {
        best = t
        bestArr = cur.slice()
      }
      return
    }
    const seen = new Set<CardDef>()
    for (let i = 0; i < n; i++) {
      if (used[i] || seen.has(hand[i])) continue
      seen.add(hand[i])
      used[i] = true
      cur.push(hand[i])
      rec()
      cur.pop()
      used[i] = false
    }
  }
  rec()
  return bestArr
}
