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

import { useGame } from './game.ts'
import { playerDeck, playerDeckCards, playerDeckStatus } from './decks.ts'
import { useRun } from './run.ts'

describe('Deste ve Tamer bağlantısı', () => {
  beforeEach(() => { localStorage.clear(); useGame.getState().reset(); useRun.getState().leave() })

  it('deste değiştirirken o destenin Tamer seçimini geri yükler', () => {
    useGame.getState().setDeck('alev')
    useGame.getState().setTamer('blacksmith')
    useGame.getState().setDeck('gelgit')
    expect(useGame.getState().tamerId).toBe('wanderer')
    useGame.getState().setDeck('alev')
    expect(useGame.getState().tamerId).toBe('blacksmith')
  })

  it('başka destenin Tamer düzenlemesini aktif desteden bağımsız kaydeder', () => {
    const current = useGame.getState().deckId
    useGame.getState().setDeckTamer('gelgit', 'vanguard')
    expect(useGame.getState().deckId).toBe(current)
    expect(useGame.getState().tamerId).toBe('wanderer')
    const saved = JSON.parse(localStorage.getItem('canavar-deste-playtest-v1')!)
    expect(saved.state.deckTamers.gelgit).toBe('vanguard')
    useGame.getState().setDeck('gelgit')
    expect(useGame.getState().tamerId).toBe('vanguard')
  })

  it('Tamer kart üst limitini korur ve daha büyük kapasiteyi kabul eder', () => {
    useGame.getState().setDeckTamer('karma', 'sanctuary_keeper')
    expect(useGame.getState().deckTamers.karma).toBe('wanderer')
    useGame.getState().setDeckTamer('karma', 'crowd_commander')
    expect(useGame.getState().tamerId).toBe('crowd_commander')
  })

  it('eski profildeki ilerlemeyi ve aktif Tamer seçimini korur', async () => {
    localStorage.setItem('canavar-deste-playtest-v1', JSON.stringify({ version: 1, state: {
      deckId: 'alev', tamerId: 'blacksmith', dayIndex: 12, lifetime: 5432,
    } }))
    await useGame.persist.rehydrate()
    expect(useGame.getState().dayIndex).toBe(12)
    expect(useGame.getState().lifetime).toBe(5432)
    expect(useGame.getState().deckTamers.alev).toBe('blacksmith')
    expect(useGame.getState().deckTamers.gelgit).toBe('wanderer')
    useGame.getState().setDeck('gelgit')
    useGame.getState().setDeck('alev')
    expect(useGame.getState().tamerId).toBe('blacksmith')
  })

  it('yeni boş desteyi Tamer ile oluşturur; boş deste oynanamaz', () => {
    const active = useGame.getState().deckId
    const id = useGame.getState().createDeck('Küçük Sığınak', 'sanctuary_keeper')
    expect(playerDeck(useGame.getState(), id)?.tamer).toBe('sanctuary_keeper')
    expect(playerDeckCards(useGame.getState(), id)).toHaveLength(0)
    useGame.getState().setDeck(id)
    expect(useGame.getState().deckId).toBe(active)
  })

  it('ekleme ve çıkarma, kartın rarity kopya limitini uygular', () => {
    const id = useGame.getState().createDeck('Deneme', 'wanderer')
    for (let i = 0; i < 3; i++) expect(useGame.getState().addDeckCard(id, 'spark_fox')).toBe(true)
    expect(useGame.getState().addDeckCard(id, 'spark_fox')).toBe(false)
    useGame.getState().removeDeckCard(id, 'spark_fox')
    expect(playerDeckCards(useGame.getState(), id)).toHaveLength(2)
    expect(useGame.getState().addDeckCard(id, 'spark_fox')).toBe(true)
    expect(useGame.getState().addDeckCard(id, 'eternal_flame')).toBe(true)
    expect(useGame.getState().addDeckCard(id, 'eternal_flame')).toBe(false)
  })

  it('Tamer üst kapasitesini kart eklerken uygular', () => {
    const id = useGame.getState().createDeck('18 kart', 'sanctuary_keeper')
    for (const card of ['spark_fox', 'baby_dragon', 'ember_hedgehog', 'coral_turtle', 'drop_frog', 'coral_crab']) {
      for (let i = 0; i < 3; i++) expect(useGame.getState().addDeckCard(id, card)).toBe(true)
    }
    expect(playerDeckCards(useGame.getState(), id)).toHaveLength(18)
    expect(useGame.getState().addDeckCard(id, 'stone_golem')).toBe(false)
  })

  it('özel deste ve adı yeniden yüklemede korunur', async () => {
    const id = useGame.getState().createDeck('Taslak', 'blacksmith')
    useGame.getState().addDeckCard(id, 'spark_fox')
    useGame.getState().renameDeck(id, 'Demircinin Dostları')
    useGame.getState().setDeck(id)
    await useGame.persist.rehydrate()
    expect(playerDeck(useGame.getState(), id)?.name).toBe('Demircinin Dostları')
    expect(playerDeckCards(useGame.getState(), id)).toHaveLength(1)
    expect(playerDeck(useGame.getState(), id)?.tamer).toBe('blacksmith')
    expect(useGame.getState().deckId).toBe('karma')
  })

  it('oyun, özel destenin kartları ve bağlı Tamer slotlarıyla başlar', () => {
    const id = useGame.getState().createDeck('Sığınak', 'sanctuary_keeper')
    const cardIds = ['spark_fox', 'baby_dragon', 'ember_hedgehog', 'coral_turtle', 'drop_frog', 'coral_crab']
    for (const card of cardIds) for (let i = 0; i < 3; i++) useGame.getState().addDeckCard(id, card)
    useGame.getState().setDeck(id)
    useRun.getState().startDay()
    expect(useRun.getState().tamerId).toBe('sanctuary_keeper')
    expect(useRun.getState().plan?.slots).toBe(3)
    expect(useRun.getState().plan?.hands.flat()).toHaveLength(18)
    expect(useRun.getState().plan?.hands.flat().every((c) => cardIds.includes(c.id))).toBe(true)
    expect(useRun.getState().slots).toHaveLength(3)
    useRun.getState().leave()
  })

  it('eksik deste seçilemez; aktif deste sonradan eksilirse oyun başlayamaz', () => {
    const g = useGame.getState()
    g.removeDeckCard('gelgit', 'coral_turtle')
    expect(playerDeckStatus(useGame.getState(), 'gelgit').ready).toBe(false)
    g.setDeck('gelgit')
    expect(useGame.getState().deckId).toBe('karma')
    g.removeDeckCard('karma', 'spark_fox')
    useRun.getState().startDay()
    expect(useRun.getState().status).toBe('idle')
    expect(useRun.getState().plan).toBeNull()
    g.addDeckCard('karma', 'spark_fox')
    expect(playerDeckStatus(useGame.getState(), 'karma').ready).toBe(true)
    useRun.getState().startDay()
    expect(useRun.getState().status).toBe('arrange')
  })

  it('tam sayılı ama rarity sınırını aşan deste de seçilemez', () => {
    const id = useGame.getState().createDeck('Geçersiz kayıt', 'wanderer')
    const deck = playerDeck(useGame.getState(), id)!
    useGame.setState({ customDecks: { [id]: { ...deck, cards: [{ card: 'spark_fox', count: 30 }] } } })
    expect(playerDeckStatus(useGame.getState(), id).ready).toBe(false)
    useGame.getState().setDeck(id)
    expect(useGame.getState().deckId).toBe('karma')
  })

  it('preset sıfırlama kart, ad ve bağlı Tamer ile kalıcı kaydı geri yükler', async () => {
    const g = useGame.getState()
    g.setDeckTamer('karma', 'crowd_commander')
    g.renameDeck('karma', 'Düzenlenmiş')
    g.removeDeckCard('karma', 'spark_fox')
    g.renameDeck('gelgit', 'Saklanacak')
    const progress = useGame.getState().seed
    expect(g.resetPresetDeck('karma')).toBe(true)
    await useGame.persist.rehydrate()
    expect(playerDeck(useGame.getState(), 'karma')).toEqual((await import('../content/index.ts')).content.deckById.get('karma'))
    expect(useGame.getState().tamerId).toBe('wanderer')
    expect(playerDeckStatus(useGame.getState(), 'karma').ready).toBe(true)
    expect(playerDeck(useGame.getState(), 'gelgit')?.name).toBe('Saklanacak')
    expect(useGame.getState().seed).toBe(progress)
    const custom = g.createDeck('Özel', 'blacksmith')
    expect(g.resetPresetDeck(custom)).toBe(false)
    expect(playerDeck(useGame.getState(), custom)?.name).toBe('Özel')
  })
})
