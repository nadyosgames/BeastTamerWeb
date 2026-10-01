import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { CREATURE_TYPES, ELEMENTS, RARITIES, type CardDef, type Element } from '../../core/types.ts'
import { useGame } from '../../state/game.ts'
import { useNav } from '../../state/nav.ts'
import { playerDeck, playerDeckCards, playerDecks, playerDeckStatus } from '../../state/decks.ts'
import { CardView } from '../components/CardView.tsx'
import { CardText } from '../components/CardText.tsx'
import { ElementIcon } from '../components/ElementIcon.tsx'
import { GameIcon } from '../components/GameIcon.tsx'
import { RarityBadge } from '../components/RarityBadge.tsx'
import { content } from '../content.ts'
import { artUrl } from '../art.ts'
import { ELEMENT_LABEL } from '../labels.ts'
import { elementCounts } from '../weather.ts'
import { useStage } from '../stage-context.ts'
import './CollectionScreen.css'

const TYPE_LABEL: Record<string, string> = { beast: 'Canavar', ghost: 'Hayalet', golem: 'Golem', dragon: 'Ejder', flora: 'Bitki', swarm: 'Sürü', avian: 'Kuş', serpent: 'Yılan', neutral: 'Nötr' }
const FEATURED = ['spark_fox', 'coral_turtle', 'stone_golem', 'cloud_owl', 'charge_bat', 'drop_frog', 'rock_lizard', 'storm_eagle', 'flame_swarm', 'whirl_octopus', 'ancient_tree', 'mist_ghost', 'ember_hedgehog', 'coral_crab', 'root_keeper', 'gust_cat', 'static_rabbit', 'lava_salamander', 'pearl_seahorse', 'moss_giant', 'storm_moth', 'thunder_ram', 'sun_dragon', 'baby_dragon']

export function CollectionScreen({ decks = false }: { decks?: boolean }) {
  const stage = useStage()
  const tall = stage.height / stage.width > 0.75
  const go = useNav((s) => s.go)
  const game = useGame()
  const allDecks = playerDecks(game)
  const [previewDeck, setPreviewDeck] = useState(game.deckId)
  const [query, setQuery] = useState('')
  const [element, setElement] = useState<Element | null>(null)
  const [rarity, setRarity] = useState('')
  const [type, setType] = useState('')
  const [sort, setSort] = useState('default')
  const [page, setPage] = useState(0)
  const [detail, setDetail] = useState<CardDef | null>(null)
  const [rarityGuide, setRarityGuide] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('Yeni Deste')
  const [newTamer, setNewTamer] = useState(content.starter.tamer)
  const [editingName, setEditingName] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [dragging, setDragging] = useState(false)
  const [dropTarget, setDropTarget] = useState<'catalog' | 'deck' | null>(null)
  const [dragPreview, setDragPreview] = useState<{ id: string; x: number; y: number } | null>(null)
  const drag = useRef<{ id: string; from: 'catalog' | 'deck'; x: number; y: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const deck = playerDeck(game, previewDeck) ?? allDecks[0]
  const tamer = content.tamer(deck.tamer)
  const cardCount = deck.cards.reduce((n, c) => n + c.count, 0)
  const deckStatus = playerDeckStatus(game, deck.id)
  const isPreset = content.deckById.has(deck.id)
  const tamerArt = artUrl('tamers', tamer.id, true)
  const counts = elementCounts(playerDeckCards(game, deck.id))
  const pageSize = decks ? (tall ? 20 : 18) : 24
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR')
    const cards = content.cards.filter((c) => (!q || c.name.toLocaleLowerCase('tr-TR').includes(q)) && (!element || c.elements.includes(element)) && (!rarity || c.rarity === rarity) && (!type || c.type === type))
    if (sort === 'default') cards.sort((a, b) => (FEATURED.indexOf(a.id) < 0 ? FEATURED.length : FEATURED.indexOf(a.id)) - (FEATURED.indexOf(b.id) < 0 ? FEATURED.length : FEATURED.indexOf(b.id)))
    if (sort === 'name') cards.sort((a, b) => a.name.localeCompare(b.name, 'tr'))
    if (sort === 'rarity') cards.sort((a, b) => RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity))
    return cards
  }, [query, element, rarity, type, sort])
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pages - 1)
  const resetPage = () => setPage(0)
  useEffect(() => {
    if (!feedback) return
    const timeout = window.setTimeout(() => setFeedback(''), 3500)
    return () => window.clearTimeout(timeout)
  }, [feedback])
  const addCard = (id: string) => {
    const card = content.card(id)
    const count = deck.cards.find((c) => c.card === id)?.count ?? 0
    if (game.addDeckCard(deck.id, id)) { setFeedback(`${card.name} desteye eklendi`) }
    else setFeedback(count >= content.economy.rarities[card.rarity].deckLimit ? `${card.name}: aynı karttan en fazla ${content.economy.rarities[card.rarity].deckLimit} adet` : `${tamer.name} için ${tamer.deckSize} kart sınırına ulaşıldı`)
  }
  const removeCard = (id: string) => { game.removeDeckCard(deck.id, id); setFeedback(`${content.card(id).name} desteden çıkarıldı`) }
  const dragZone = (e: PointerEvent) => {
    const under = document.elementFromPoint(e.clientX, e.clientY)
    return under?.closest('.collection__deck') ? 'deck' : under?.closest('.collection__catalog') ? 'catalog' : null
  }
  const pointerDrag = (id: string, from: 'catalog' | 'deck') => ({
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest('.collection__inspect, .collection__remove')) return
      drag.current = { id, from, x: e.clientX, y: e.clientY, moved: false }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      const current = drag.current
      if (!current) return
      if (!current.moved && Math.hypot(e.clientX - current.x, e.clientY - current.y) < 6) return
      current.moved = true
      e.preventDefault()
      setDragPreview({ id: current.id, x: e.clientX, y: e.clientY })
      setDragging(true); setDropTarget(dragZone(e))
    },
    onPointerUp: (e: PointerEvent<HTMLDivElement>) => {
      const current = drag.current
      drag.current = null; setDragging(false); setDropTarget(null); setDragPreview(null)
      if (!current) return
      suppressClick.current = true
      if (!current.moved) {
        if (current.from === 'catalog') addCard(current.id)
        else setDetail(content.card(current.id))
      } else {
        const target = dragZone(e)
        if (current.from === 'catalog' && target === 'deck') addCard(current.id)
        if (current.from === 'deck' && target === 'catalog') removeCard(current.id)
      }
      window.setTimeout(() => { suppressClick.current = false }, 0)
    },
    onPointerCancel: () => { drag.current = null; setDragging(false); setDropTarget(null); setDragPreview(null) },
    onClickCapture: (e: React.MouseEvent) => { if (suppressClick.current) { e.preventDefault(); e.stopPropagation() } },
  })
  return (
    <div className={`collection ${decks ? 'collection--decks' : ''} ${tall ? 'collection--tall' : ''}`}>
      <header className="screen-heading panel">
        <button className="btn small" onClick={() => go('menu')}>← GERİ</button><h2>{decks ? 'DESTELER' : 'KOLEKSİYON'}</h2><span className="ornament">✧</span>
        <GameIcon name="cards" size={28} /><span>{content.cards.length} kart</span>{decks && <button className="btn small" onClick={() => setCreateOpen(true)}>＋ YENİ DESTE</button>}<span className="screen-heading__meta">Playtest · tüm kartlar açık</span>
      </header>
      <section className={`collection__catalog panel ${dropTarget === 'catalog' ? 'is-drop-target' : ''}`}>
        <div className="collection__filters">
          <label className="collection__search"><GameIcon name="search" size={30} /><input aria-label="Kart ara" placeholder="Kart ara…" value={query} onChange={(e) => { setQuery(e.target.value); resetPage() }} /></label>
          <div className="collection__elements">{ELEMENTS.map((el) => <button key={el} title={ELEMENT_LABEL[el]} aria-label={ELEMENT_LABEL[el]} aria-pressed={element === el} className={`element-filter ${element === el ? 'is-selected' : ''}`} style={{ '--element-color': `var(--${el})` } as CSSProperties} onClick={() => { setElement(element === el ? null : el); resetPage() }}><ElementIcon element={el} size={34} /></button>)}</div>
          <select aria-label="Nadirlik" value={rarity} onChange={(e) => { setRarity(e.target.value); resetPage() }}><option value="">NADİRLİK</option>{RARITIES.map((r) => <option key={r} value={r}>{r.toUpperCase()}</option>)}</select>
          <select aria-label="Kart türü" value={type} onChange={(e) => { setType(e.target.value); resetPage() }}><option value="">TÜR</option>{CREATURE_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select>
          {!decks && <select aria-label="Sıralama" value={sort} onChange={(e) => { setSort(e.target.value); resetPage() }}><option value="default">ÖNE ÇIKANLAR</option><option value="name">A–Z</option><option value="rarity">NADİRLİK ↓</option></select>}
        </div>
        <div className="collection__grid">
          {filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((card) => <div key={card.id} className="collection__cell" draggable={false} {...(decks ? pointerDrag(card.id, 'catalog') : {})}><CardView card={card} size="sm" actionLabel={decks ? `${card.name} desteye ekle` : undefined} onClick={() => decks ? addCard(card.id) : setDetail(card)} /><span className="collection__count"><RarityBadge rarity={card.rarity} label size={20} />{decks && <><b>×{deck.cards.find((c) => c.card === card.id)?.count ?? 0}</b><button className="collection__inspect" aria-label={`${card.name} kartını incele`} onClick={() => setDetail(card)}>ⓘ</button></>}</span></div>)}
          {!filtered.length && <div className="collection__empty"><GameIcon name="search" size={56} /><h3>Kart bulunamadı</h3><p>Farklı bir isim ya da element dene.</p><button className="btn" onClick={() => { setQuery(''); setElement(null); setRarity(''); setType('') }}>Filtreleri temizle</button></div>}
        </div>
        <footer className="collection__pagination"><span>{filtered.length} kart · {pageSize} / sayfa</span><div><button className="btn small" aria-label="Önceki sayfa" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>‹</button><span>{currentPage + 1} / {pages}</span><button className="btn small" aria-label="Sonraki sayfa" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>›</button></div>{!decks && <button className="btn small" onClick={() => go('decks')}>DESTELERİM →</button>}</footer>
      </section>
      {decks && <aside className={`collection__deck panel ${!deckStatus.ready ? 'is-incomplete' : ''} ${dropTarget === 'deck' ? 'is-drop-target' : ''}`} aria-label="Desteye kart bırak">
        <header>{editingName ? <input autoFocus aria-label="Deste adı" maxLength={40} defaultValue={deck.name} onBlur={(e) => { game.renameDeck(deck.id, e.target.value); setEditingName(false) }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} /> : <select aria-label="Deste seç" value={previewDeck} onChange={(e) => setPreviewDeck(e.target.value)}>{allDecks.map((d) => <option key={d.id} value={d.id}>{d.name.toUpperCase()} · {content.tamer(d.tamer).name}{!playerDeckStatus(game, d.id).ready && d.id !== deck.id ? ' · EKSİK' : ''}</option>)}</select>}<button className="btn small collection__rename" title="Deste adını değiştir" aria-label="Deste adını değiştir" onClick={() => setEditingName(true)}>✎</button><b className="collection__decksize" aria-label={`${cardCount} / ${tamer.deckSize} kart`}>{cardCount} / {tamer.deckSize}</b></header>
        <p className={`collection__deckstatus ${deckStatus.ready ? 'is-ready' : ''}`} role="status">{deckStatus.ready ? '✓' : '!'} {deckStatus.reason}</p>
        <section className="collection__tamer">
          {tamerArt && <img src={tamerArt} alt={tamer.name} />}
          <div className="collection__tamerbody">
            <label htmlFor="deck-tamer">DESTENİN TAMER'I</label>
            <select id="deck-tamer" aria-label="Destenin Tamer'ı" value={tamer.id} onChange={(e) => game.setDeckTamer(deck.id, e.target.value)}>{content.tamers.map((t) => <option key={t.id} value={t.id} disabled={cardCount > t.deckSize}>{t.name} · {t.slots} slot / {t.deckSize} kart{cardCount > t.deckSize ? ' — kapasite yetersiz' : ''}</option>)}</select>
            <div className="collection__tamerstats"><span><GameIcon name="shield" size={23} /><b>{tamer.slots}</b> SLOT</span><span><GameIcon name="cards" size={23} /><b>{tamer.deckSize}</b> KART LİMİTİ</span></div>
          </div>
          <p>{tamer.text}</p><small>Bu Tamer desteyle birlikte kaydedilir. Slot ve deste limiti ona bağlıdır.</small>
        </section>
        <p className="collection__draghelp">Kartı tıkla veya buraya sürükle. Çıkarmak için koleksiyona geri sürükle.</p>
        <div className="collection__decklist scroll">{deck.cards.map(({ card: id, count }) => { const card = content.card(id); const thumb = artUrl('cards', id, true); return <div className="collection__deckrow" key={id} draggable={false} {...pointerDrag(id, 'deck')}><button className="collection__deckcard" onClick={() => setDetail(card)}><ElementIcon element={card.elements[0]} size={25} />{thumb && <img className="collection__deckthumb" src={thumb} alt="" draggable={false} />}<span>{card.name}</span><b>×{count}</b></button><button className="collection__remove" aria-label={`${card.name} desteden çıkar`} onClick={() => removeCard(id)}>−</button></div> })}{!cardCount && <div className="collection__dropempty"><GameIcon name="cards" size={52} /><b>DESTENİ OLUŞTUR</b><span>Soldan bir kartı buraya sürükle</span></div>}</div>
        <p className="collection__decktext">{deck.text}</p>
        <div className="collection__distribution">{ELEMENTS.map((e) => <span key={e}><ElementIcon element={e} size={29} />{counts[e] ?? 0}</span>)}</div>
        <small className="collection__autosave">✓ Değişiklikler otomatik kaydedilir</small>
        {isPreset && <button className="btn small collection__reset" title="Preset destenin kartlarını, adını ve Tamer'ını varsayılana döndür" onClick={() => { game.resetPresetDeck(deck.id); setEditingName(false); setFeedback('Preset deste varsayılana döndürüldü') }}>↺ VARSAYILANA DÖNDÜR</button>}
        <button className="btn small" onClick={() => go('play')}>GÜNÜ PLANLA →</button>
      </aside>}
      {dragging && <div className="collection__dragbanner">Desteye bırak: ekle · Koleksiyona bırak: çıkar</div>}
      {dragPreview && createPortal(<div className="collection__dragpreview" style={{ left: Math.min(dragPreview.x + 16, window.innerWidth - 136), top: Math.min(dragPreview.y + 16, window.innerHeight - 150) }}><img src={artUrl('cards', dragPreview.id, true) ?? ''} alt="" draggable={false} /><span>{content.card(dragPreview.id).name}</span></div>, document.body)}
      {feedback && <div className="collection__feedback" role="status" aria-live="polite">{feedback}</div>}
      {createOpen && <div className="overlay" onClick={() => setCreateOpen(false)}><section className="panel collection__create" role="dialog" aria-modal="true" aria-label="Yeni deste oluştur" onClick={(e) => e.stopPropagation()}><h2>YENİ DESTE OLUŞTUR</h2><p>Önce Tamer'ını seç. Slot sayısı ve deste kart limiti ona bağlıdır.</p><label className="collection__newname">DESTE ADI<input aria-label="Yeni deste adı" value={newName} maxLength={40} onChange={(e) => setNewName(e.target.value)} /></label><div className="collection__tamergallery">{content.tamers.map((t) => <button key={t.id} className={newTamer === t.id ? 'is-selected' : ''} aria-pressed={newTamer === t.id} aria-label={`${t.name} ile deste oluştur`} onClick={() => setNewTamer(t.id)}><img src={artUrl('tamers', t.id, true) ?? ''} alt={t.name} /><b>{t.name}</b><span>{t.slots} slot · {t.deckSize} kart</span></button>)}</div><p className="collection__newpassive">{content.tamer(newTamer).text}</p><div className="collection__createactions"><button className="btn" onClick={() => setCreateOpen(false)}>VAZGEÇ</button><button className="btn primary" onClick={() => { const id = game.createDeck(newName, newTamer); if (!id) return; setPreviewDeck(id); setCreateOpen(false); setPage(0); setQuery(''); setElement(null); setRarity(''); setType(''); setFeedback('Yeni deste oluşturuldu. Kartları tıkla veya sürükle.') }}>DESTEYİ OLUŞTUR</button></div></section></div>}
      <button className="btn small collection__rarityhelp" onClick={() => setRarityGuide(true)}>ⓘ NADİRLİK ROZETLERİ</button>
      {rarityGuide && <div className="overlay" onClick={() => setRarityGuide(false)}><section className="panel collection__rarityguide" role="dialog" aria-modal="true" aria-label="Nadirlik rozetleri" onClick={(e) => e.stopPropagation()}><h2>NADİRLİK ROZETLERİ</h2><p>Nadirliği taşın rengi, kesimi ve metal çerçevesi gösterir.</p><div>{RARITIES.map((r) => <article key={r}><RarityBadge rarity={r} label size={58} /><span>Aynı karttan en fazla <b>{content.economy.rarities[r].deckLimit}</b> adet / deste</span></article>)}</div><button className="btn" onClick={() => setRarityGuide(false)}>KAPAT</button></section></div>}
      {detail && <div className="overlay" onClick={() => setDetail(null)}><section role="dialog" aria-modal="true" aria-label={detail.name} className="panel collection__detail" onClick={(e) => e.stopPropagation()}><CardView card={detail} /><div><RarityBadge rarity={detail.rarity} label size={48} /><small className="muted"> · {TYPE_LABEL[detail.type]}</small><h2>{detail.name}</h2><p><CardText text={detail.text} /></p><div className="chip-row">{detail.elements.map((e) => <span key={e} className="collection__detail-element"><ElementIcon element={e} size={32} />{ELEMENT_LABEL[e]}</span>)}</div><p className="muted">Dayanıklılık: {detail.durability}</p><button className="btn" onClick={() => setDetail(null)}>KAPAT</button></div></section></div>}
    </div>
  )
}




