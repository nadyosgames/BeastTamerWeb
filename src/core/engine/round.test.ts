import { describe, expect, it } from 'vitest'
import { content } from '../../content/index.ts'
import { createRng } from '../rng.ts'
import { planDay, playDay } from '../day.ts'
import type { CardDef, Effect, TamerDef, WeatherDef } from '../types.ts'
import type { RoundEvent } from './events.ts'
import { compileModifiers, EMPTY_MODIFIERS } from './modifiers.ts'
import { resolveRound } from './round.ts'
import type { RoundContext } from './state.ts'

const ctx = (over: Partial<RoundContext> = {}): RoundContext => ({
  mods: EMPTY_MODIFIERS,
  roundIndex: 1,
  roundCount: 6,
  triggerCap: 60,
  ...over,
})

/** Kart tanımı yazmadan test kartı. */
const mk = (over: Partial<CardDef> & { id: string }): CardDef => ({
  name: over.id,
  elements: ['fire'],
  type: 'beast',
  rarity: 'common',
  durability: 1,
  abilities: [{ on: 'harvest', effects: [{ op: 'gain', amount: 1 }] }],
  text: '',
  ...over,
})

// GDD'deki örnek kartlar: içerik dosyası değişse de motor bu tanımlarla doğrulanır.
const harvest = (...effects: Effect[]): CardDef['abilities'] => [{ on: 'harvest', effects }]
const GDD = {
  fox: mk({ id: 'fox', durability: 2, abilities: harvest({ op: 'gain', amount: 6 }) }),
  turtle: mk({
    id: 'turtle',
    elements: ['water'],
    abilities: harvest({ op: 'gain', amount: 4 }, { op: 'copyIncome', from: 'left', pct: 50 }),
  }),
  golem: mk({ id: 'golem', elements: ['earth'], type: 'golem', durability: 3, abilities: harvest({ op: 'gain', amount: 4 }) }),
  bat: mk({ id: 'bat', elements: ['electric'], polarity: { left: '+', right: '-' }, abilities: harvest({ op: 'gain', amount: 5 }) }),
  owl: mk({
    id: 'owl',
    elements: ['wind'],
    type: 'avian',
    durability: 2,
    abilities: harvest(
      { op: 'gain', amount: 5 },
      { op: 'mult', value: 2, if: { kind: 'count', count: { kind: 'distinctElements' }, cmp: '>=', value: 3 } },
    ),
  }),
  coil: mk({
    id: 'coil',
    elements: ['electric'],
    durability: 2,
    polarity: { left: '-', right: '+' },
    abilities: harvest({ op: 'gain', amount: 4 }, { op: 'gain', amount: 4, if: { kind: 'link', side: 'right', state: 'compatible' } }),
  }),
  snail: mk({
    id: 'snail',
    elements: ['electric'],
    durability: 2,
    polarity: { left: '-', right: '+' },
    abilities: harvest({ op: 'gain', amount: 5 }, { op: 'gain', amount: 3, if: { kind: 'link', side: 'left', state: 'compatible' } }),
  }),
  lizard: mk({
    id: 'lizard',
    elements: ['electric'],
    durability: 2,
    polarity: { left: '+', right: '-' },
    abilities: harvest({ op: 'gain', amount: 4 }, { op: 'mult', value: 2, if: { kind: 'link', side: 'left', state: 'clash' } }),
  }),
  water: mk({ id: 'water', elements: ['water'], durability: 3 }),
}

describe('GDD örnek tur', () => {
  it('Tilki, Kaplumbağa, Golem, Yarasa, Baykuş → 9 tetik, 56 kaynak', () => {
    const passIncome: number[] = []
    const r = resolveRound(
      [GDD.fox, GDD.turtle, GDD.golem, GDD.bat, GDD.owl],
      ctx(),
      (e) => {
        if (e.t === 'passStart') passIncome.push(0)
        if (e.t === 'ability') passIncome[passIncome.length - 1] += e.income
      },
    )
    expect(r.total).toBe(56)
    expect(r.triggers).toBe(9)
    expect(r.passes).toBe(3)
    expect(passIncome).toEqual([32, 20, 4])
    expect(r.slots.map((s) => s.triggers)).toEqual([2, 1, 3, 1, 2])
    // Kaplumbağa ilk geçişte 4 + %50 × 6 = 7
    expect(r.slots[1].income).toBe(7)
  })
})

describe('Kutuplaşma (GDD tablosu)', () => {
  it('Bobin(−|+) · Su · Salyangoz(−|+) · Kertenkele(+|−) → her biri 8', () => {
    const links: RoundEvent[] = []
    const first: number[] = []
    resolveRound([GDD.coil, GDD.water, GDD.snail, GDD.lizard], ctx(), (e) => {
      if (e.t === 'links') links.push(e)
      if (e.t === 'ability' && e.pass === 1) first.push(e.income)
    })
    expect(links[0]).toEqual({
      t: 'links',
      links: [
        { left: 0, right: 2, state: 'compatible' },
        { left: 2, right: 3, state: 'clash' },
      ],
    })
    expect([first[0], first[2], first[3]]).toEqual([8, 8, 8])
  })
})

describe('Anahtar kelimeler', () => {
  it('Swift önce, Heavy en son tetiklenir', () => {
    const order: number[] = []
    resolveRound(
      [mk({ id: 'a', keywords: ['heavy'] }), mk({ id: 'b' }), mk({ id: 'c', keywords: ['swift'] })],
      ctx(),
      (e) => e.t === 'ability' && order.push(e.slot),
    )
    expect(order).toEqual([2, 1, 0])
  })

  it('Ward ilk dayanıklılık kaybını engeller, Overload 2 düşürür', () => {
    const r = resolveRound([mk({ id: 'w', durability: 1, keywords: ['ward'] }), mk({ id: 'o', durability: 4, keywords: ['overload'] })], ctx())
    expect(r.slots[0].triggers).toBe(2)
    expect(r.slots[1].triggers).toBe(2)
  })

  it('Rebirth: Last Breath bir kez çalışır, kart 1 dayanıklılıkla döner', () => {
    const r = resolveRound(
      [
        mk({
          id: 'seahorse',
          keywords: ['rebirth'],
          abilities: [
            { on: 'harvest', effects: [{ op: 'gain', amount: 4 }] },
            { on: 'lastBreath', effects: [{ op: 'gain', amount: 6 }] },
          ],
        }),
      ],
      ctx(),
    )
    // 4 (tetik) + 6 (Last Breath) + 4 (yeniden doğduktan sonra tetik)
    expect(r.total).toBe(14)
    expect(r.triggers).toBe(2)
  })

  it('Slumber 2: ilk geçişte uyur, Büyüme önceki tetikleri sayar', () => {
    const r = resolveRound(
      [
        mk({
          id: 'keeper',
          durability: 3,
          slumber: 2,
          abilities: harvest({ op: 'gain', amount: 4 }, { op: 'gainPer', amount: 2, per: { kind: 'selfTriggers' } }),
        }),
      ],
      ctx(),
    )
    expect(r.passes).toBe(4)
    expect(r.total).toBe(4 + 6 + 8)
  })

  it('Haunt: başka kart pasife geçtikçe çalışır', () => {
    const r = resolveRound([
        mk({ id: 'x', durability: 1 }),
        mk({
          id: 'ghost',
          durability: 2,
          abilities: [
            { on: 'harvest', effects: [{ op: 'gain', amount: 3 }] },
            { on: 'haunt', effects: [{ op: 'gain', amount: 3 }] },
          ],
        }),
      ], ctx())
    // x:1, hayalet 3+3, x pasife geçince haunt +3
    expect(r.total).toBe(1 + 3 + 3 + 3)
  })

  it('Patlama: son tetikte x6, öncekilerde x0,5', () => {
    const r = resolveRound(
      [
        mk({
          id: 'salamander',
          durability: 3,
          abilities: harvest(
            { op: 'gain', amount: 3 },
            { op: 'mult', value: 6, if: { kind: 'lastTrigger' } },
            { op: 'mult', value: 0.5, if: { kind: 'not', cond: { kind: 'lastTrigger' } } },
          ),
        }),
      ],
      ctx(),
    )
    expect(r.total).toBe(2 + 2 + 18) // 1.5→2, 1.5→2, 18
  })

  it('Tetik sınırı sonsuz döngüyü keser', () => {
    const loop = mk({
      id: 'loop',
      durability: 1,
      abilities: [
        { on: 'harvest', effects: [{ op: 'gain', amount: 1 }] },
        { on: 'lastBreath', effects: [{ op: 'addDurability', target: 'self', amount: 1 }] },
        { on: 'haunt', effects: [{ op: 'addDurability', target: 'left', amount: 1 }] },
      ],
    })
    const r = resolveRound([loop, { ...loop, id: 'loop2' }], ctx({ triggerCap: 20 }))
    expect(r.capped).toBe(true)
    expect(r.steps).toBe(20)
  })
})

describe('Yön sayımı ve Alev Zinciri', () => {
  const chainCard = mk({
    id: 'chain',
    abilities: harvest({ op: 'gainPer', amount: 2, per: { kind: 'chain', side: 'left', filter: { element: 'fire' } } }),
  })
  const rightCounter = mk({
    id: 'counter',
    abilities: harvest({ op: 'gainPer', amount: 1, per: { kind: 'cards', side: 'right', filter: { element: 'fire' } } }),
  })
  const fire = mk({ id: 'f', abilities: [] })
  const water = mk({ id: 'w', elements: ['water'], abilities: [] })

  it('zincir yalnızca kesintisiz komşuları sayar', () => {
    expect(resolveRound([fire, fire, chainCard], ctx()).total).toBe(4)
    expect(resolveRound([fire, water, fire, chainCard], ctx()).total).toBe(2)
    expect(resolveRound([chainCard, fire, fire], ctx()).total).toBe(0)
  })

  it('yönlü sayım o taraftaki tüm eşleşenleri sayar (kesintili de olsa)', () => {
    expect(resolveRound([rightCounter, fire, water, fire], ctx()).total).toBe(2)
    expect(resolveRound([fire, rightCounter], ctx()).total).toBe(0)
  })
})

describe('Global etkiler', () => {
  it('Hibrit kart iki elementin hava yüzdesini toplar (Güneşli: Ateş+Su = +%20)', () => {
    const sunny: WeatherDef = {
      id: 'sunny',
      name: 'Güneşli',
      icon: 'sun',
      weight: 1,
      text: '',
      modifiers: [
        { kind: 'incomePct', pct: 40, filter: { element: 'fire' } },
        { kind: 'incomePct', pct: -20, filter: { element: 'water' } },
      ],
    }
    const steam: CardDef = mk({ id: 's', elements: ['fire', 'water'], abilities: [{ on: 'harvest', effects: [{ op: 'gain', amount: 10 }] }] })
    const r = resolveRound([steam], ctx({ mods: compileModifiers({ weather: sunny }) }))
    expect(r.total).toBe(12)
  })

  it('Kuraklık Su kartlarını en az 1 olacak şekilde düşürür', () => {
    const drought: WeatherDef = {
      id: 'drought',
      name: 'Kuraklık',
      icon: 'drought',
      weight: 1,
      text: '',
      modifiers: [{ kind: 'durabilityAtStart', amount: -1, min: 1, filter: { anyOf: [{ element: 'water' }, { type: 'flora' }] } }],
    }
    const r = resolveRound([GDD.water], ctx({ mods: compileModifiers({ weather: drought }) }))
    expect(r.triggers).toBe(2)
  })

  it('Gezgin ilk turda +%10', () => {
    const wanderer: TamerDef = {
      id: 'wanderer',
      name: 'Gezgin',
      deckSize: 30,
      slots: 5,
      text: '',
      unlock: { kind: 'start' },
      modifiers: [{ kind: 'incomePct', pct: 10, if: { kind: 'round', which: 'first' } }],
    }
    const mods = compileModifiers({ tamer: wanderer })
    const first = resolveRound([GDD.fox], ctx({ mods, roundIndex: 0 }))
    const later = resolveRound([GDD.fox], ctx({ mods, roundIndex: 1 }))
    expect(first.total).toBe(14) // 6.6 → 7, iki tetik
    expect(later.total).toBe(12)
  })
})

describe('Determinizm', () => {
  it('aynı tohum aynı günü üretir', () => {
    const setup = { deck: content.starterDeck(), tamer: content.tamer('wanderer') }
    const a = playDay(setup, createRng(42), (h) => [...h])
    const b = playDay(setup, createRng(42), (h) => [...h])
    expect(a.total).toBe(b.total)
    expect(planDay(setup, createRng(7)).hands).toHaveLength(6)
  })
})
