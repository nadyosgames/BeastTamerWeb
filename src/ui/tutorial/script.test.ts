import { describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  const data = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
    clear: () => data.clear(),
  } })
})
vi.mock('../content.ts', async () => ({ content: (await import('../../content/index.ts')).content }))
import { DEFAULT_TRIGGER_CAP } from '../../core/day.ts'
import { compileModifiers } from '../../core/engine/modifiers.ts'
import { resolveRound } from '../../core/engine/round.ts'
import type { CardDef } from '../../core/types.ts'
import { useGame } from '../../state/game.ts'
import { useRun } from '../../state/run.ts'
import { content } from '../content.ts'
import { TUTORIAL } from './script.ts'

const ctx = (roundIndex: number) => ({ mods: compileModifiers({}), roundIndex, roundCount: TUTORIAL.length, triggerCap: DEFAULT_TRIGGER_CAP })

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs]
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((rest) => [x, ...rest]))
}

describe('eğitim senaryosu', () => {
  it('her turun hedef dizilimi o elin en iyi dizilimidir', () => {
    TUTORIAL.forEach((round, i) => {
      const hand = round.cards.map((id) => content.card(id))
      const all = permutations(hand).map((order) => ({ order, total: resolveRound(order, ctx(i)).total }))
      const best = Math.max(...all.map((x) => x.total))
      const goal = all.filter((x) => !round.goal || round.goal(x.order.map((c: CardDef) => c.id)))
      expect(goal.length, round.title).toBeGreaterThan(0)
      // Hedefi tutturan oyuncu "En iyi dizilimi buldun" görmeli.
      if (round.goal) for (const g of goal) expect(g.total, `${round.title}: ${g.order.map((c) => c.id).join(',')}`).toBe(best)
    })
  })

  it('eğitim günü profili ve haftalık kotayı değiştirmez', () => {
    const before = { ...useGame.getState() }
    const run = useRun.getState()
    run.startTutorial(TUTORIAL.map((r) => r.cards.map((id) => content.card(id))))
    for (let i = 0; i < TUTORIAL.length; i++) {
      useRun.getState().autoFill()
      useRun.getState().play()
      useRun.getState().playbackDone()
      useRun.getState().next()
    }
    expect(useRun.getState().status).toBe('dayDone')
    expect(useRun.getState().rounds).toHaveLength(TUTORIAL.length)
    const after = useGame.getState()
    expect(after.dayIndex).toBe(before.dayIndex)
    expect(after.weekIncome).toBe(before.weekIncome)
    expect(after.days).toHaveLength(before.days.length)
  })
})
