import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  const data = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
    clear: () => data.clear(),
  } })
})
vi.mock('../ui/content.ts', async () => ({ content: (await import('../content/index.ts')).content }))

import { content } from '../content/index.ts'
import { huntAvailability, regionOpen, todayWeather, useGame, worldPassives, type HuntReport } from './game.ts'
import { playerDeck, playerDeckCards, playerDeckStatus } from './decks.ts'
import { useHunt } from './hunt.ts'

const g = () => useGame.getState()

/** Avı bot gibi oynar: her turda eli sırayla dizer, sonuna kadar. */
function playOut() {
  const h = () => useHunt.getState()
  for (let i = 0; i < 12 && h().status !== 'huntDone'; i++) {
    h().autoFill()
    h().play()
    h().playbackDone()
    h().next()
  }
  return h()
}

/** Hava şartı olmayan, başlangıçtan açık bir av. */
const easyHunt = () => content.hunts.find((x) => x.unlock.kind === 'start' && !x.appearsIn)!.id

const report = (over: Partial<HuntReport>): HuntReport => ({
  hunt: easyHunt(),
  deck: 'karma',
  tamer: 'wanderer',
  weather: 'calm',
  outcome: 'captured',
  capturedRound: 3,
  rounds: 6,
  startHp: 240,
  preyHpEnd: 0,
  damage: 240,
  tamerDamage: 6,
  tamerHpEnd: 54,
  played: [],
  roundLogs: [],
  seconds: 1,
  ...over,
})

describe('Koleksiyon ve deste', () => {
  beforeEach(() => { localStorage.clear(); g().reset(); useHunt.getState().leave() })

  it('başlangıç koleksiyonu başlangıç destesidir; deste ava hazırdır', () => {
    expect(g().collection.spark_fox).toBe(3)
    expect(g().collection.torch_lizard ?? 0).toBe(0)
    expect(playerDeckStatus(g(), 'karma').ready).toBe(true)
  })

  it('sahip olunmayan kart desteye eklenemez; playtest modunda eklenir', () => {
    const id = g().createDeck('Deneme', 'wanderer')
    expect(g().addDeckCard(id, 'torch_lizard')).toBe(false)
    for (let i = 0; i < 3; i++) expect(g().addDeckCard(id, 'spark_fox')).toBe(true)
    expect(g().addDeckCard(id, 'spark_fox')).toBe(false)
    g().setSandbox(true)
    expect(g().addDeckCard(id, 'torch_lizard')).toBe(true)
  })

  it('koleksiyonda olmayan kopyalarla dolu preset deste avda seçilemez', () => {
    const st = playerDeckStatus(g(), 'alev')
    expect(st.ready).toBe(false)
    expect(st.missing).toBeGreaterThan(0)
    g().setDeck('alev')
    expect(g().deckId).toBe('karma')
    g().setSandbox(true)
    g().setDeck('alev')
    expect(g().deckId).toBe('alev')
  })

  it('kilitli Tamer seçilemez; yeterli yaratık bayıltınca açılır', () => {
    g().setDeckTamer('karma', 'blacksmith')
    expect(g().deckTamers.karma).toBe('wanderer')
    useGame.setState({ hunts: Object.fromEntries(content.hunts.slice(0, 3).map((h) => [h.id, { stars: 1, captures: 1, attempts: 1, bestRound: 5 }])) })
    g().setDeckTamer('karma', 'blacksmith')
    expect(g().tamerId).toBe('blacksmith')
  })

  it('deste değiştirirken o destenin Tamer seçimini geri yükler', () => {
    g().setSandbox(true)
    g().setDeck('alev')
    g().setTamer('blacksmith')
    g().setDeck('gelgit')
    expect(g().tamerId).toBe('wanderer')
    g().setDeck('alev')
    expect(g().tamerId).toBe('blacksmith')
  })

  it('Tamer üst kapasitesini kart eklerken uygular', () => {
    g().setSandbox(true)
    const id = g().createDeck('18 kart', 'sanctuary_keeper')
    for (const card of ['spark_fox', 'baby_dragon', 'ember_hedgehog', 'coral_turtle', 'drop_frog', 'coral_crab']) for (let i = 0; i < 3; i++) g().addDeckCard(id, card)
    expect(playerDeckCards(g(), id)).toHaveLength(18)
    expect(g().addDeckCard(id, 'stone_golem')).toBe(false)
  })

  it('özel deste, adı ve Tamer\'ı yeniden yüklemede korunur', async () => {
    g().setSandbox(true)
    const id = g().createDeck('Taslak', 'blacksmith')
    g().addDeckCard(id, 'spark_fox')
    g().renameDeck(id, 'Demircinin Dostları')
    await useGame.persist.rehydrate()
    expect(playerDeck(g(), id)?.name).toBe('Demircinin Dostları')
    expect(playerDeckCards(g(), id)).toHaveLength(1)
    expect(playerDeck(g(), id)?.tamer).toBe('blacksmith')
  })

  it('v0.6 profilinden deste düzenlemeleri taşınır, takvim taşınmaz', async () => {
    localStorage.clear()
    localStorage.setItem('canavar-deste-playtest-v1', JSON.stringify({ version: 1, state: { deckId: 'karma', dayIndex: 12, lifetime: 5432, customDecks: { deck_x: { id: 'deck_x', name: 'Eski', tamer: 'wanderer', text: '', cards: [] } }, deckTamers: { deck_x: 'wanderer' } } }))
    await useGame.persist.rehydrate()
    expect(playerDeck(g(), 'deck_x')?.name).toBe('Eski')
    expect(g().day).toBe(0)
    expect(g().essence).toBe(0)
  })

  it('paket öz ile alınır; kartlar koleksiyona girer', () => {
    useGame.setState({ essence: 1000 })
    const before = Object.values(g().collection).reduce((a, b) => a + b, 0)
    const r = g().buyPack('standard')!
    expect(r.cards).toHaveLength(5)
    expect(g().essence).toBe(1000 - r.price + r.essence)
    expect(Object.values(g().collection).reduce((a, b) => a + b, 0)).toBe(before + r.added.length)
    useGame.setState({ essence: 10 })
    expect(g().buyPack('standard')).toBeNull()
  })
})

describe('Sefer ve av', () => {
  beforeEach(() => { localStorage.clear(); g().reset(); useHunt.getState().leave() })

  it('seferde olmadan ava çıkılamaz; sefere çıkınca açık av başlar', () => {
    const id = easyHunt()
    expect(useHunt.getState().startHunt(id)).not.toBeNull()
    expect(g().startExpedition()).toBe(true)
    expect(huntAvailability(g(), content.hunt(id)).ok).toBe(true)
    expect(useHunt.getState().startHunt(id)).toBeNull()
    expect(useHunt.getState().status).toBe('arrange')
    expect(useHunt.getState().hand).toHaveLength(5)
    expect(useHunt.getState().weatherId).toBe(todayWeather(g(), content.hunt(id).region))
  })

  it('av sonuna kadar oynanır; sonuç profile yazılır ve bir gün geçer', () => {
    g().startExpedition()
    const day = g().day
    useHunt.getState().startHunt(easyHunt())
    const h = playOut()
    expect(h.status).toBe('huntDone')
    expect(h.summary).not.toBeNull()
    expect(g().day).toBe(day + 1)
    expect(g().logs).toHaveLength(1)
    expect(g().hunts[easyHunt()].attempts).toBe(1)
    if (h.summary!.outcome === 'captured') {
      expect(g().collection[content.hunt(easyHunt()).card]).toBe(1)
      expect(g().expedition!.bag).toBeGreaterThan(0)
      expect(g().expedition!.trail).toBe(1)
    }
  })

  it('kazanılan av çantaya öz, yaratığı koleksiyona ekler; kampa dönünce öz bakiyeye geçer', () => {
    g().startExpedition()
    const s = g().finishHunt(report({}))
    expect(s.outcome).toBe('captured')
    expect(s.reward!.essence).toBe(Math.round(40 * 1.2))
    expect(g().expedition!.bag).toBe(48)
    expect(g().expedition!.tamerHp).toBe(54)
    expect(g().returnToCamp()).toBe(48)
    expect(g().essence).toBe(48)
    expect(g().expedition).toBeNull()
  })

  it('kaçan yaratık seferde yaralı kalır, seri bozulur', () => {
    g().startExpedition()
    g().finishHunt(report({}))
    const s = g().finishHunt(report({ outcome: 'escaped', capturedRound: null, damage: 200, startHp: 240 }))
    expect(s.woundedHp).toBe(190)
    expect(g().expedition!.wounded[easyHunt()]).toBe(190)
    expect(g().expedition!.streak).toBe(0)
  })

  it('Tamer düşerse çantanın yarısı kaybolur ve sefer biter', () => {
    g().startExpedition()
    useGame.setState({ expedition: { ...g().expedition!, bag: 100 } })
    const s = g().finishHunt(report({ outcome: 'tamerDown', capturedRound: null, tamerHpEnd: 0 }))
    expect(s.bagLost).toBe(50)
    expect(g().essence).toBe(50)
    expect(g().expedition).toBeNull()
  })

  it('dinlenme Erzak harcar ve Tamer\'ı iyileştirir', () => {
    g().startExpedition()
    useGame.setState({ expedition: { ...g().expedition!, tamerHp: 20 } })
    expect(g().rest()).toBe(true)
    expect(g().expedition!.tamerHp).toBe(41)
    expect(g().expedition!.rations).toBe(content.economy.expedition.rations - 1)
    g().rest()
    expect(g().rest()).toBe(false)
  })

  it('seferin Tamer\'ı değişmez: başka Tamer\'ın destesiyle ava çıkılamaz', () => {
    g().startExpedition()
    g().setSandbox(true)
    g().setDeckTamer('gelgit', 'vanguard')
    g().setDeck('gelgit')
    expect(useHunt.getState().startHunt(easyHunt())).toMatch(/Gezgin/)
  })

  it('avdan çekilmek kaçış sayılır', () => {
    g().startExpedition()
    useHunt.getState().startHunt(easyHunt())
    useHunt.getState().abandon()
    expect(useHunt.getState().summary?.outcome).toBe('escaped')
    expect(g().expedition!.streak).toBe(0)
  })
})

describe('Dünya ve bölgeler', () => {
  beforeEach(() => { localStorage.clear(); g().reset(); useHunt.getState().leave() })

  const capture = (id: string) => useGame.setState((s) => ({ hunts: { ...s.hunts, [id]: { stars: 2, captures: 1, attempts: 1, bestRound: 5 } } }))
  const start = () => content.regions.find((r) => r.unlock.kind === 'start')!

  it('yalnızca başlangıç bölgesi açıktır; kilitli bölgeye sefere çıkılamaz', () => {
    const locked = content.regions.find((r) => r.unlock.kind === 'finals')!
    expect(regionOpen(g(), start().id)).toBe(true)
    expect(regionOpen(g(), locked.id)).toBe(false)
    g().setRegion(locked.id)
    expect(g().startExpedition()).toBe(false)
    expect(huntAvailability(g(), content.regionHunts(locked.id)[0])).toMatchObject({ ok: false, reason: 'regionLocked' })
  })

  it('Final bayıltılınca bağlı bölgeler açılır ve sonuçta bildirilir', () => {
    const home = start()
    for (const h of content.regionHunts(home.id)) if (h.tier === 'ordinary' || h.tier === 'hard') capture(h.id)
    g().setRegion(home.id)
    expect(g().startExpedition()).toBe(true)
    const summary = g().finishHunt(report({ hunt: content.regionFinal(home.id)!.id }))
    const next = content.regions.filter((r) => r.unlock.kind === 'finals' && r.unlock.regions.every((id) => id === home.id)).map((r) => r.id)
    expect(next.length).toBeGreaterThan(0)
    expect([...summary.newRegions].sort()).toEqual([...next].sort())
    for (const id of next) expect(regionOpen(g(), id)).toBe(true)
  })

  it('seferdeyken başka bölgede avlanılamaz ve odak değişmez', () => {
    const home = start()
    capture(content.regionFinal(home.id)!.id)
    g().setRegion(home.id)
    g().startExpedition()
    const other = content.regions.find((r) => r.id !== home.id && regionOpen(g(), r.id))!
    expect(huntAvailability(g(), content.regionHunts(other.id)[0])).toMatchObject({ ok: false, reason: 'elsewhere' })
    g().setRegion(other.id)
    expect(g().regionId).toBe(home.id)
    g().returnToCamp()
    g().setRegion(other.id)
    expect(g().startExpedition()).toBe(true)
    expect(g().expedition!.region).toBe(other.id)
  })

  it('kitabı biten bölgenin bonusu dünyadaki tüm avlarda geçerlidir', () => {
    const home = start()
    expect(worldPassives(g())).toEqual([])
    for (const h of content.regionHunts(home.id)) if (h.tier === 'ordinary' || h.tier === 'hard' || h.tier === 'final') capture(h.id)
    expect(worldPassives(g())).toEqual(home.buff.modifiers)
  })
})
