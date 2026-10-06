import { describe, expect, it } from 'vitest'
import { content } from '../content/index.ts'
import { huntReward, huntStars, huntUnlocked, regionForecast, restHeal, woundedHp } from './expedition.ts'
import { resolveHuntRound, startHunt, type HuntEvent, type HuntState } from './hunt.ts'
import { createRng } from './rng.ts'
import type { CardDef, Effect, HuntDef, Intent, PreyTrait, TamerDef } from './types.ts'

const mk = (over: Partial<CardDef> & { id: string }): CardDef => ({
  name: over.id,
  elements: ['fire'],
  type: 'beast',
  rarity: 'common',
  durability: 2,
  abilities: [{ on: 'harvest', effects: [{ op: 'gain', amount: 1 }] }],
  text: '',
  ...over,
})
const strike = (...effects: Effect[]): CardDef['abilities'] => [{ on: 'harvest', effects }]

/** A: 2 tetik × 6 hasar. G: 2 tetik × (2 hasar + 3 Koruma). S: Swift, 2 × 1. */
const A = mk({ id: 'a', abilities: strike({ op: 'gain', amount: 6 }) })
const G = mk({ id: 'g', elements: ['earth'], abilities: strike({ op: 'gain', amount: 2 }, { op: 'guard', amount: 3 }) })
const S = mk({ id: 's', elements: ['wind'], keywords: ['swift'], abilities: strike({ op: 'gain', amount: 1 }) })
const W = mk({ id: 'w', elements: ['earth'], keywords: ['ward'], abilities: strike({ op: 'gain', amount: 1 }) })

const TAMER: TamerDef = { id: 't', name: 'T', deckSize: 2, slots: 2, hp: 60, modifiers: [], text: '', unlock: { kind: 'start' } }

const hunt = (over: Partial<HuntDef> = {}): HuntDef => ({
  id: 'prey',
  card: 'spark_fox',
  region: 'test',
  tier: 'ordinary',
  hp: 100,
  intents: [{ kind: 'claw', damage: 10 }],
  unlock: { kind: 'start' },
  pos: [0, 0],
  lore: '',
  ...over,
})

/** El sırası test tarafından verilir (karıştırma yok). */
function state(h: HuntDef, hands: CardDef[][], over: Partial<HuntState> = {}, hp = h.hp): HuntState {
  const s = startHunt({ hunt: h, hp, deck: hands.flat(), tamer: { ...TAMER, slots: hands[0].length }, tamerHp: 60 }, createRng(1))
  return { ...s, hands, ...over }
}

function play(s: HuntState, arrangement: CardDef[]) {
  const events: HuntEvent[] = []
  const r = resolveHuntRound(s, arrangement, (e) => events.push(e))
  return { ...r, events }
}

describe('Av turu: hasar, Koruma ve tur sonu saldırısı', () => {
  it('Strike geliri yaratığın canından düşer, Koruma Pençe\'yi emer', () => {
    const { result, state: next, events } = play(state(hunt(), [[A, G], [A, G]]), [A, G])
    expect(result.damage).toBe(16)
    expect(result.guard).toBe(6)
    expect(result.attack).toBe(10)
    expect(result.absorbed).toBe(6)
    expect(result.tamerDamage).toBe(4)
    expect(next.prey.hp).toBe(84)
    expect(next.tamerHp).toBe(56)
    expect(next.outcome).toBeNull()
    // Her vuruş, kendi ability olayının hemen ardından gelir.
    const i = events.findIndex((e) => e.t === 'hit')
    expect(events[i - 1].t).toBe('ability')
    expect(events.at(-1)).toMatchObject({ t: 'huntRoundEnd', damage: 16, outcome: null })
  })

  it('can 0 olunca yaratık o tetikte bayılır, tur kesilir ve niyetini uygulayamaz', () => {
    const { result, state: next, events } = play(state(hunt({ hp: 7 }), [[A, G], [A, G]]), [A, G])
    expect(result.captured).toBe(true)
    expect(result.damage).toBe(8)
    expect(next.outcome).toBe('captured')
    expect(next.capturedRound).toBe(0)
    expect(next.tamerHp).toBe(60)
    expect(events.some((e) => e.t === 'preyAction')).toBe(false)
    const down = events.findIndex((e) => e.t === 'preyDown')
    expect(events.slice(down + 1).map((e) => e.t)).toEqual(['huntRoundEnd'])
  })

  it('son turun sonunda ayakta kalan yaratık kaçar', () => {
    const { state: next } = play(state(hunt(), [[A, G]]), [A, G])
    expect(next.outcome).toBe('escaped')
  })

  it('Tamer\'ın canı biterse av kaybedilir', () => {
    const s = state(hunt({ intents: [{ kind: 'claw', damage: 30 }] }), [[A, A], [A, A]], { tamerHp: 5 })
    expect(play(s, [A, A]).state.outcome).toBe('tamerDown')
  })
})

describe('Niyetler', () => {
  const withIntent = (intent: Intent, traits?: PreyTrait[]) => hunt({ intents: [intent, { kind: 'claw', damage: 10 }], traits })

  it('Savuşturma her geçişin ilk Strike\'ını boşa çıkarır; ucuz Swift kart yem olur', () => {
    const s1 = state(withIntent({ kind: 'evade' }), [[A, G], [A, G]])
    expect(play(s1, [A, G]).result.damage).toBe(4)
    const s2 = state(withIntent({ kind: 'evade' }), [[A, S], [A, S]])
    expect(play(s2, [A, S]).result.damage).toBe(12)
  })

  it('Yırtma 1. slottaki kartın dayanıklılığını düşürür, Ward engeller', () => {
    const s = state(withIntent({ kind: 'rend', slot: 1 }), [[A, G], [A, G]])
    expect(play(s, [A, G]).result.damage).toBe(10) // A tek tetik
    const w = state(withIntent({ kind: 'rend', slot: 1 }), [[W, A], [W, A]])
    expect(play(w, [W, A]).result.damage).toBe(14) // Ward korur: 2 + 12
  })

  it('Kuyruk Savurma en sağdaki kartları vurur', () => {
    const s = state(withIntent({ kind: 'tailSweep', count: 1 }), [[G, A], [G, A]])
    expect(play(s, [G, A]).result.damage).toBe(10) // G 2×2, A 1×6
  })

  it('Kükreme hedef slottaki kartı ilk geçişte uyutur', () => {
    const s = state(withIntent({ kind: 'roar', slot: 2 }), [[G, A], [G, A]])
    const { events, result } = play(s, [G, A])
    expect(events.some((e) => e.t === 'slumber' && e.slot === 1)).toBe(true)
    expect(result.damage).toBe(16) // geç başlar ama iki tetiğini yine kullanır
  })

  it('Şarj sonraki Pençe\'yi iki katına çıkarır', () => {
    let s = state(hunt({ intents: [{ kind: 'charge' }, { kind: 'claw', damage: 10 }] }), [[A, A], [A, A], [A, A]])
    const first = play(s, [A, A])
    expect(first.result.tamerDamage).toBe(0)
    s = first.state
    expect(play(s, [A, A]).result.tamerDamage).toBe(20)
  })

  it('Toparlanma tur sonunda can verir (çubuğu aşmaz)', () => {
    const s = state(hunt({ intents: [{ kind: 'recover', amount: 50 }] }), [[A, A], [A, A]])
    expect(play(s, [A, A]).state.prey.hp).toBe(100)
  })

  it('Kaçış Hazırlığı: can eşiğin altındayken yeterli hasar alamazsa kaçar', () => {
    const h = hunt({ intents: [{ kind: 'flee', damage: 30, belowPct: 30 }] })
    const s = state(h, [[A, G], [A, G]], { prey: { hp: 30, maxHp: 100, phase: 0, intentIndex: 0, charged: false, revived: false } })
    expect(play(s, [A, G]).state.outcome).toBe('fled')
  })
})

describe('Özellikler, fazlar ve ikinci can', () => {
  it('Zırh her vuruştan düşer', () => {
    const s = state(hunt({ traits: [{ kind: 'armor', amount: 2 }] }), [[A, G], [A, G]])
    const { result, events } = play(s, [A, G])
    expect(result.damage).toBe(8)
    expect(events.some((e) => e.t === 'hit' && e.blocked === 'armor')).toBe(true)
  })

  it('Zırh belirtilen havada söner', () => {
    const rainy = content.weatherById.get('rainy')!
    const s = state(hunt({ traits: [{ kind: 'armor', amount: 2, offIn: ['rainy'] }] }), [[G, G], [G, G]], { weather: rainy })
    expect(play(s, [G, G]).result.damage).toBe(8)
  })

  it('Diken, turda vuruş yapan her kart için bir kez yansır (tetik sayısından bağımsız)', () => {
    // A ve G ikişer kez vurur; Diken 3 → 2 kart × 3 = 6 yansıma + Pençe 10, Koruma 6 emer.
    const s = state(hunt({ traits: [{ kind: 'thorns', amount: 3 }] }), [[A, G], [A, G]])
    const { result } = play(s, [A, G])
    expect(result.attack).toBe(16)
    expect(result.tamerDamage).toBe(10)
  })

  it('Direnç elementin vuruşlarını azaltır', () => {
    const s = state(hunt({ traits: [{ kind: 'resist', element: 'fire', pct: 50 }] }), [[A, G], [A, G]])
    expect(play(s, [A, G]).result.damage).toBe(10) // A 3+3, G 2+2
  })

  it('Faz eşiği geçilince niyet döngüsü değişir', () => {
    const h = hunt({ phases: [{ belowPct: 90, intents: [{ kind: 'claw', damage: 99 }], text: 'öfke' }] })
    const { state: next, events } = play(state(h, [[A, G], [A, G]]), [A, G])
    expect(next.prey.phase).toBe(1)
    expect(events.some((e) => e.t === 'phase')).toBe(true)
    expect(play(next, [A, G]).result.attack).toBe(99)
  })

  it('İkinci can çubuğu bir kez döner', () => {
    const { result, events } = play(state(hunt({ hp: 5, revive: 10 }), [[A, G], [A, G]]), [A, G])
    expect(events.some((e) => e.t === 'revive')).toBe(true)
    expect(result.captured).toBe(true)
  })

  it('Kuşatmada son tur bitince yaratık ertesi güne kalır', () => {
    const s = startHunt({ hunt: hunt(), hp: 100, deck: [A, G], tamer: TAMER, tamerHp: 60, siegeContinues: true }, createRng(1))
    expect(play(s, s.hands[0]).state.outcome).toBe('nightfall')
  })

  it('Kuşatmada dünkü kartlar −1 dayanıklılıkla başlar', () => {
    const s = startHunt({ hunt: hunt(), hp: 100, deck: [A, G], tamer: TAMER, tamerHp: 60, fatigued: new Set(['a']) }, createRng(1))
    const a = s.hands[0].find((c) => c.id === 'a')!
    expect(a.durability).toBe(1)
  })
})

describe('Sefer kuralları', () => {
  const cfg = content.economy.expedition

  it('öz ödülü hız ve seri bonusuyla büyür', () => {
    expect(huntReward('common', 5, 6, 0, cfg).essence).toBe(40)
    expect(huntReward('common', 3, 6, 2, cfg).essence).toBe(Math.round(40 * 1.2 * 1.2))
  })

  it('yıldızlar: hız ve az yara', () => {
    expect(huntStars('captured', 3, 4, 60)).toBe(3)
    expect(huntStars('captured', 3, 20, 60)).toBe(2)
    expect(huntStars('captured', 5, 0, 60)).toBe(1)
    expect(huntStars('escaped', null, 0, 60)).toBe(0)
  })

  it('dinlenme ve yaralı yaratık', () => {
    expect(restHeal(20, 60, cfg)).toBe(41)
    expect(woundedHp(300, 200, cfg)).toBe(250)
  })

  it('kilitler: Final yakalama sayısıyla, Efsanevi kitap + İz ile, Kadim sonra açılır', () => {
    const hunts = content.regionHunts('ash_valley')
    const final = hunts.find((h) => h.tier === 'final')!
    const legend = hunts.find((h) => h.tier === 'legendary')!
    const ancient = hunts.find((h) => h.tier === 'ancient')!
    const ordinary = hunts.filter((h) => h.tier === 'ordinary').map((h) => h.id)
    expect(huntUnlocked(final, hunts, new Set(ordinary.slice(0, 4)), 0)).toBe(false)
    expect(huntUnlocked(final, hunts, new Set(ordinary.slice(0, 5)), 0)).toBe(true)
    const book = new Set(hunts.filter((h) => ['ordinary', 'hard', 'final'].includes(h.tier)).map((h) => h.id))
    expect(huntUnlocked(legend, hunts, book, 2)).toBe(false)
    expect(huntUnlocked(legend, hunts, book, 3)).toBe(true)
    expect(huntUnlocked(ancient, hunts, book, 3)).toBe(false)
    expect(huntUnlocked(ancient, hunts, new Set([...book, legend.id]), 0)).toBe(true)
  })

  it('hava tahmini kararlıdır ve aynı hava en fazla 2 gün üst üste gelir', () => {
    const region = content.region('ash_valley')
    const a = regionForecast(content.weather, region.climate, 42, region.id, 0, 200)
    expect(regionForecast(content.weather, region.climate, 42, region.id, 10, 5)).toEqual(a.slice(10, 15))
    for (let i = 2; i < a.length; i++) expect(a[i] === a[i - 1] && a[i] === a[i - 2]).toBe(false)
    expect(new Set(a).size).toBeGreaterThan(4)
  })
})
