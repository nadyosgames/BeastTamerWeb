import { compare } from '../math.ts'
import type { CardFilter, Cond, Count, Rarity, Side } from '../types.ts'
import { RARITIES } from '../types.ts'
import type { RoundState, SlotState } from './state.ts'

const RARITY_INDEX: Record<Rarity, number> = Object.fromEntries(RARITIES.map((r, i) => [r, i])) as Record<
  Rarity,
  number
>

export function rarityIndex(r: Rarity): number {
  return RARITY_INDEX[r]
}

export function matchFilter(slot: SlotState, f: CardFilter | undefined): boolean {
  if (!f) return true
  const card = slot.card
  if (f.element && !card.elements.includes(f.element)) return false
  if (f.type && card.type !== f.type) return false
  if (f.keyword && !(card.keywords ?? []).includes(f.keyword)) return false
  if (f.rarityAtLeast && RARITY_INDEX[card.rarity] < RARITY_INDEX[f.rarityAtLeast]) return false
  if (f.state === 'active' && slot.durability <= 0) return false
  if (f.state === 'passive' && slot.durability > 0) return false
  if (f.baseDurability && !compare(card.durability, f.baseDurability.cmp, f.baseDurability.value)) return false
  if (f.anyOf && !f.anyOf.some((sub) => matchFilter(slot, sub))) return false
  return true
}

export function neighbor(rs: RoundState, self: SlotState, side: Side): SlotState | undefined {
  return rs.slots[self.index + (side === 'left' ? -1 : 1)]
}

export function evalCount(rs: RoundState, self: SlotState, count: Count): number {
  switch (count.kind) {
    case 'cards': {
      let n = 0
      for (const s of rs.slots) {
        if (count.side === 'left' ? s.index >= self.index : count.side === 'right' ? s.index <= self.index : false) continue
        if (count.excludeSelf && s === self) continue
        if (matchFilter(s, count.filter)) n++
      }
      return n
    }
    case 'chain': {
      const step = count.side === 'left' ? -1 : 1
      let n = 0
      for (let i = self.index + step; i >= 0 && i < rs.slots.length; i += step) {
        if (!matchFilter(rs.slots[i], count.filter)) break
        n++
      }
      return n
    }
    case 'distinctElements':
      return rs.distinctElements
    case 'heat':
      return rs.heat
    case 'selfTriggers':
      return self.triggers
    case 'pass':
      return rs.pass
  }
}

export interface CondEnv {
  /** Bu tetik kartın dayanıklılığını 0'a düşürecek mi (Patlama gibi "son tetik" koşulları). */
  isLastTrigger: boolean
}

export function evalCond(rs: RoundState, self: SlotState, cond: Cond | undefined, env: CondEnv): boolean {
  if (!cond) return true
  switch (cond.kind) {
    case 'count':
      return compare(evalCount(rs, self, cond.count), cond.cmp, cond.value)
    case 'allCards':
      return rs.slots.every((s) => matchFilter(s, cond.filter))
    case 'slot':
      return self.index === cond.index - 1
    case 'position':
      return cond.where === 'first' ? self.index === 0 : self.index === rs.slots.length - 1
    case 'neighbor': {
      const n = neighbor(rs, self, cond.side)
      return n !== undefined && matchFilter(n, cond.filter)
    }
    case 'passParity':
      return rs.pass > 0 && (rs.pass % 2 === 1) === (cond.parity === 'odd')
    case 'lastTrigger':
      return env.isLastTrigger
    case 'link':
      return (cond.side === 'left' ? self.leftLink : self.rightLink) === cond.state
    case 'round':
      return cond.which === 'first' ? rs.ctx.roundIndex === 0 : rs.ctx.roundIndex === rs.ctx.roundCount - 1
    case 'self':
      return matchFilter(self, cond.filter)
    case 'not':
      return !evalCond(rs, self, cond.cond, env)
    case 'all':
      return cond.conds.every((c) => evalCond(rs, self, c, env))
    case 'any':
      return cond.conds.some((c) => evalCond(rs, self, c, env))
  }
}
