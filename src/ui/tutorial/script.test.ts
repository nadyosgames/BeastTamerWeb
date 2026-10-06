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
import { useHunt } from '../../state/hunt.ts'
import { content } from '../content.ts'
import { TUTORIAL, TUTORIAL_HUNT } from './script.ts'

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

  it('hedef dizilimlerle yaratık 3. turda bayılır, daha önce değil', () => {
    const totals = TUTORIAL.map((round, i) => {
      const hand = round.cards.map((id) => content.card(id))
      const goal = permutations(hand).filter((o) => !round.goal || round.goal(o.map((c) => c.id)))
      return Math.min(...goal.map((o) => resolveRound(o, ctx(i)).total))
    })
    expect(totals[0] + totals[1]).toBeLessThan(TUTORIAL_HUNT.hp)
    expect(totals[0] + totals[1] + totals[2]).toBeGreaterThanOrEqual(TUTORIAL_HUNT.hp)
  })

  it('eğitim avı profili, koleksiyonu ve günü değiştirmez', () => {
    const before = { ...useGame.getState() }
    useHunt.getState().startTutorial(TUTORIAL_HUNT, TUTORIAL.map((r) => r.cards.map((id) => content.card(id))))
    for (let i = 0; i < TUTORIAL.length; i++) {
      const h = useHunt.getState()
      // Hedefli turlarda en iyi dizilimi dene (eğitim BAŞLAT'ı hedef dışı dizilimde kilitler).
      const round = TUTORIAL[i]
      const order = permutations(h.hand.map((_, k) => k)).find((o) => !round.goal || round.goal(o.map((k) => h.hand[k].id)))!
      order.forEach((k, slot) => useHunt.getState().place(k, slot))
      useHunt.getState().play()
      useHunt.getState().playbackDone()
      useHunt.getState().next()
    }
    expect(useHunt.getState().status).toBe('huntDone')
    expect(useHunt.getState().state?.outcome).toBe('captured')
    const after = useGame.getState()
    expect(after.day).toBe(before.day)
    expect(after.collection).toEqual(before.collection)
    expect(after.logs).toHaveLength(before.logs.length)
  })
})
