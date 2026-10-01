import { buildContent, content as baseContent, RAW_CONTENT, type ContentDB } from '../content/index.ts'

/**
 * Arayüzün kullandığı içerik. Varsayılan: content/*.json (oyunun onaylı içeriği).
 * `?set=v1` ile content/proposals/v1/ altındaki öneri seti yüklenir (kartlar ve varsa desteler):
 * onaydan önce yeni kartları Tur Laboratuvarı'nda denemek için.
 */
const proposalCards = import.meta.glob<unknown>('../../content/proposals/*/cards.json', { eager: true, import: 'default' })
const proposalDecks = import.meta.glob<unknown>('../../content/proposals/*/decks.json', { eager: true, import: 'default' })

export const contentSet = new URLSearchParams(window.location.search).get('set')
export const availableSets = Object.keys(proposalCards).map((p) => p.split('/').at(-2)!)

function load(): ContentDB {
  if (!contentSet) return baseContent
  const cards = proposalCards[`../../content/proposals/${contentSet}/cards.json`]
  if (!cards) {
    console.warn(`Öneri seti bulunamadı: ${contentSet}`)
    return baseContent
  }
  const decks = proposalDecks[`../../content/proposals/${contentSet}/decks.json`] ?? RAW_CONTENT.decks
  return buildContent({ ...RAW_CONTENT, cards, decks })
}

export const content = load()
