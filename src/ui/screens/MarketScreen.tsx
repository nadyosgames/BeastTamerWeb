import { useState } from 'react'
import { packPrice, type PackDef } from '../../core/economy.ts'
import { ELEMENTS, RARITIES, type Element } from '../../core/types.ts'
import { useGame, type PackPurchase } from '../../state/game.ts'
import { useNav } from '../../state/nav.ts'
import { CardView } from '../components/CardView.tsx'
import { GameIcon } from '../components/GameIcon.tsx'
import { IllustratedHeader } from '../components/IllustratedHeader.tsx'
import { PackArt } from '../components/PackArt.tsx'
import { content } from '../content.ts'
import { ELEMENT_LABEL } from '../labels.ts'
import './MarketScreen.css'

/**
 * Market (GDD v0.8 "Ödül ve ekonomi"): paketler sabit öz fiyatıyla alınır. Kartlar koleksiyona girer;
 * destede kullanılabilecek sayıyı aşan kopyalar öze döner. Mythic ve Ancient paketten çıkmaz, yalnızca avla gelir.
 */
export function MarketScreen() {
  const go = useNav((s) => s.go)
  const g = useGame()
  const [element, setElement] = useState<Element>('water')
  const [odds, setOdds] = useState(false)
  const [opened, setOpened] = useState<{ pack: PackDef; result: PackPurchase } | null>(null)
  const buy = (pack: PackDef) => {
    const result = g.buyPack(pack.id, pack.element ? element : undefined)
    if (result) setOpened({ pack, result })
  }
  return (
    <div className="market">
      <IllustratedHeader title="MARKET" icon="shop" resource={g.essence}>
        <button className="btn" onClick={() => go('menu')}>⬅ GERİ</button>
      </IllustratedHeader>
      <div className="market__intro"><h3>KART PAKETLERİ</h3></div>
      <section className="market__grid">
        {content.economy.packs.map((pack) => {
          const price = packPrice(pack, content.economy)
          const afford = g.essence >= price
          return <article key={pack.id} className={`market__pack panel market__pack--${pack.id}`}>
            <h3>{pack.name.toLocaleUpperCase('tr-TR')}</h3>
            <div className="market__art"><PackArt id={pack.id} element={element} label={`${pack.name}${pack.element ? ` · ${ELEMENT_LABEL[element]}` : ''} kart paketi`} /></div>
            {pack.element && <select aria-label="Paket elementi" value={element} onChange={(e) => setElement(e.target.value as Element)}>{ELEMENTS.map((el) => <option key={el} value={el}>{ELEMENT_LABEL[el].toLocaleUpperCase('tr-TR')}</option>)}</select>}
            <div className="market__description"><b>{pack.cards} KART</b><span>{pack.element ? `${pack.cards} ${ELEMENT_LABEL[element]} kartı` : pack.guarantee ? `En az ${pack.guarantee.count} ${pack.guarantee.rarityAtLeast === 'epic' ? 'Epic' : 'Rare'}+` : 'Eksik kart önceliği'}</span></div>
            <div className="market__price"><GameIcon name="gem" size={37} /><b>{price.toLocaleString('tr-TR')}</b></div>
            <button className="btn primary" disabled={!afford} onClick={() => buy(pack)} title={afford ? undefined : 'Yeterli öz yok: avla ve kampa dön'}>{afford ? 'SATIN AL' : 'ÖZ YETMİYOR'}</button>
          </article>
        })}
      </section>
      <footer className="market__footer">
        <button onClick={() => setOdds(true)}><span>ⓘ</span> NADİRLİK ORANLARI</button>
        <span className="panel"><GameIcon name="cards" size={32} />Öz avlarda kazanılır; çantadaki öz kampa dönünce bakiyene geçer.</span>
      </footer>
      {opened && <div className="overlay" onClick={() => setOpened(null)}><section role="dialog" aria-modal="true" aria-label="Açılan paket" className="overlay__panel panel" onClick={(e) => e.stopPropagation()}>
        <header><h3>{opened.pack.name.toLocaleUpperCase('tr-TR')} PAKET</h3><button className="btn small" onClick={() => setOpened(null)}>Kapat</button></header>
        <div className="market__opened">{opened.result.cards.map((card, i) => {
          const isNew = opened.result.added.includes(card) && (g.collection[card.id] ?? 0) <= opened.result.added.filter((c) => c === card).length
          const dup = opened.result.duplicates.includes(card)
          return <div key={`${card.id}-${i}`} className="market__card"><CardView card={card} />{isNew ? <span className="market__tag market__tag--new">YENİ</span> : dup ? <span className="market__tag">KOPYA → ÖZ</span> : null}</div>
        })}</div>
        <p className="muted">−{opened.result.price} öz{opened.result.essence ? ` · kopya fazlası +${opened.result.essence} öz` : ''} · Bakiye: {g.essence.toLocaleString('tr-TR')}</p>
      </section></div>}
      {odds && <div className="overlay" onClick={() => setOdds(false)}><section role="dialog" aria-modal="true" aria-label="Nadirlik oranları" className="overlay__panel overlay__panel--text panel" onClick={(e) => e.stopPropagation()}><header><h3>NADİRLİK ORANLARI</h3><button className="btn small" onClick={() => setOdds(false)}>Kapat</button></header><table className="market__odds"><thead><tr><th>Nadirlik</th>{content.economy.packs.map((p) => <th key={p.id}>{p.name}</th>)}</tr></thead><tbody>{RARITIES.map((r) => <tr key={r}><td style={{ color: `var(--${r})` }}>{r.toUpperCase()}</td>{content.economy.packs.map((p) => <td key={p.id}>%{(p.odds[r] ?? 0).toLocaleString('tr-TR')}</td>)}</tr>)}</tbody></table><p className="muted">Şanslı paket en az bir Rare+, Mühürlü paket en az bir Epic+ kart içerir. Mythic ve Ancient yaratıklar paketten çıkmaz: yalnızca avla bulunur.</p></section></div>}
    </div>
  )
}
