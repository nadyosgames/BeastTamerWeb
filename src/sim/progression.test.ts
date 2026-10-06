import { describe, expect, it } from 'vitest'
import { content } from '../content/index.ts'
import { medianCollection, regionOrder, simulateWorld } from './progression.ts'

describe('Dünya içeriği', () => {
  it('her bölgenin tek bir Finali var ve her bölgeye başlangıçtan yol var', () => {
    for (const r of content.regions) expect(content.regionHunts(r.id).filter((h) => h.tier === 'final')).toHaveLength(1)
    const reached = new Set(content.regions.filter((r) => r.unlock.kind === 'start').map((r) => r.id))
    for (let changed = true; changed; ) {
      changed = false
      for (const r of content.regions)
        if (!reached.has(r.id) && r.unlock.kind === 'finals' && r.unlock.regions.every((id) => reached.has(id))) {
          reached.add(r.id)
          changed = true
        }
    }
    expect(reached.size).toBe(content.regions.length)
  })

  it('gezme sırası seviyeye göredir', () => {
    const levels = regionOrder(content).map((r) => r.level)
    expect(levels).toEqual([...levels].sort((a, b) => a - b))
  })
})

describe('Dünya ilerleme simülasyonu', () => {
  it('tipik oyuncu başlangıç bölgesinde avlanır, öz kazanır ve süre ilerler', () => {
    const run = simulateWorld(content, { seed: 7, maxHours: 2 })
    expect(run.stopped).toBe('timeout')
    expect(run.hunts).toBeGreaterThan(5)
    expect(run.distinct).toBeGreaterThan(0)
    expect(run.milestones.entry[content.regions[0].id]).toBe(0)
    expect(run.minutes).toBeGreaterThanOrEqual(120)
  })

  it('istenen koleksiyon anında durur: başlangıç bölgesine girişte koleksiyon başlangıç destesidir', () => {
    const run = simulateWorld(content, { seed: 7, stopAfter: { region: content.regions[0].id, phase: 'entry' } })
    expect(run.stopped).toBe('snapshot')
    const starter: Record<string, number> = {}
    for (const c of content.starterDeck()) starter[c.id] = (starter[c.id] ?? 0) + 1
    expect(run.snapshots[0].collection).toEqual(starter)
  })

  it('medyan koleksiyon kart başına ortadaki kopya sayısıdır', () => {
    expect(medianCollection([{ a: 1, b: 3 }, { a: 2 }, { a: 3, b: 1 }])).toEqual({ a: 2, b: 1 })
  })
})
