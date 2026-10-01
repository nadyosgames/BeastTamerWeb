import { describe, expect, it } from 'vitest'
import { content } from '../../content/index.ts'
import { createRng } from '../rng.ts'
import { planDay, playDay } from '../day.ts'
import type { CardDef } from '../types.ts'
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
const cards = (...ids: string[]) => ids.map((id) => content.card(id))

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

describe('GDD örnek tur', () => {
  it('Tilki, Kaplumbağa, Golem, Yarasa, Baykuş → 9 tetik, 56 kaynak', () => {
    const passIncome: number[] = []
    const r = resolveRound(
      cards('spark_fox', 'coral_turtle', 'stone_golem', 'charge_bat', 'cloud_owl'),
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
    resolveRound(cards('spark_coil', 'drop_frog', 'storm_snail', 'tension_lizard'), ctx(), (e) => {
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
    const r = resolveRound(cards('pearl_seahorse'), ctx())
    // 4 (tetik) + 6 (Last Breath) + 4 (yeniden doğduktan sonra tetik)
    expect(r.total).toBe(14)
    expect(r.triggers).toBe(2)
  })

  it('Slumber 2: ilk geçişte uyur, Büyüme önceki tetikleri sayar', () => {
    const r = resolveRound(cards('root_keeper'), ctx())
    expect(r.passes).toBe(4)
    expect(r.total).toBe(4 + 6 + 8)
  })

  it('Haunt: başka kart pasife geçtikçe çalışır', () => {
    const r = resolveRound([mk({ id: 'x', durability: 1 }), content.card('mist_ghost')], ctx())
    // x:1, hayalet 3+3, x pasife geçince haunt +3
    expect(r.total).toBe(1 + 3 + 3 + 3)
  })

  it('Patlama: son tetikte x6, öncekilerde x0,5', () => {
    const r = resolveRound(cards('lava_salamander'), ctx())
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

describe('Global etkiler', () => {
  it('Hibrit kart iki elementin hava yüzdesini toplar (Güneşli: Ateş+Su = +%20)', () => {
    const sunny = content.weatherById.get('sunny')!
    const steam: CardDef = mk({ id: 's', elements: ['fire', 'water'], abilities: [{ on: 'harvest', effects: [{ op: 'gain', amount: 10 }] }] })
    const r = resolveRound([steam], ctx({ mods: compileModifiers({ weather: sunny }) }))
    expect(r.total).toBe(12)
  })

  it('Kuraklık Su kartlarını en az 1 olacak şekilde düşürür', () => {
    const drought = content.weatherById.get('drought')!
    const r = resolveRound(cards('drop_frog'), ctx({ mods: compileModifiers({ weather: drought }) }))
    expect(r.triggers).toBe(2)
  })

  it('Gezgin ilk turda +%10', () => {
    const mods = compileModifiers({ tamer: content.tamer('wanderer') })
    const first = resolveRound(cards('spark_fox'), ctx({ mods, roundIndex: 0 }))
    const later = resolveRound(cards('spark_fox'), ctx({ mods, roundIndex: 1 }))
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
