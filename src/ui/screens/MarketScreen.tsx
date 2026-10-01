import { useState } from 'react'
import { packPrice, type PackDef } from '../../core/economy.ts'
import { openPack } from '../../core/packs.ts'
import { createRng } from '../../core/rng.ts'
import { ELEMENTS, RARITIES, type CardDef, type Element } from '../../core/types.ts'
import { currentWeek, useGame, weekQuota } from '../../state/game.ts'
import { useNav } from '../../state/nav.ts'
import { CardView } from '../components/CardView.tsx'
import { GameIcon } from '../components/GameIcon.tsx'
import { content } from '../content.ts'
import { ELEMENT_LABEL } from '../labels.ts'
import './MarketScreen.css'

export function MarketScreen() {
  const go = useNav((s) => s.go)
  const g = useGame()
  const [element, setElement] = useState<Element>('water')
  const [odds, setOdds] = useState(false)
  const [opened, setOpened] = useState<{ pack: PackDef; cards: CardDef[] } | null>(null)
  const quota = weekQuota(currentWeek(g.dayIndex), g.weeks)
  const sample = (pack: PackDef) => {
    const result = openPack(pack, content.cards, {}, content.economy, createRng(crypto.getRandomValues(new Uint32Array(1))[0]), { element, pity: 0 })
    setOpened({ pack, cards: result.cards })
  }
  return (
    <div className="market">
      <header className="screen-heading panel"><button className="btn small" onClick={() => go('menu')}>← GERİ</button><GameIcon name="compass" size={48} /><h2>MARKET</h2><span className="ornament">✧</span></header>
      <div className="market__resource resource-badge panel"><GameIcon name="gem" size={44} /><div><small>TOPLAM KAZANÇ</small><b>{g.lifetime.toLocaleString('tr-TR')}</b></div></div>
      <div className="market__intro"><span className="btn primary">KART PAKETLERİ</span><span className="muted">Playtest · paketleri ücretsiz dene. Örnek kartlar koleksiyona eklenmez.</span><div /></div>
      <section className="market__grid">
        {content.economy.packs.map((pack) => <article key={pack.id} className={`market__pack panel market__pack--${pack.id}`}>
          <h3><span>✧</span>{pack.name.toLocaleUpperCase('tr-TR')}<span>✧</span></h3>
          <div className="market__art"><img src={`/art/ui/pack_${pack.id}${pack.element && element !== 'water' ? `_${element}` : ''}.webp`} alt={`${pack.name}${pack.element ? ` · ${ELEMENT_LABEL[element]}` : ''} kart paketi`} /></div>
          {pack.element && <select aria-label="Paket elementi" value={element} onChange={(e) => setElement(e.target.value as Element)}>{ELEMENTS.map((el) => <option key={el} value={el}>{ELEMENT_LABEL[el].toLocaleUpperCase('tr-TR')}</option>)}</select>}
          <div className="market__description"><b>{pack.cards} KART</b><span>{pack.element ? `${pack.cards} ${ELEMENT_LABEL[element]} kartı` : pack.guarantee ? `En az ${pack.guarantee.count} ${pack.guarantee.rarityAtLeast === 'epic' ? 'Epic' : 'Rare'}+` : 'Eksik kart önceliği'}</span></div>
          <div className="market__price"><GameIcon name="gem" size={37} /><b>{packPrice(pack, quota, content.economy).toLocaleString('tr-TR')}</b></div>
          <button className="btn primary" onClick={() => sample(pack)}>PAKETİ DENE</button>
        </article>)}
      </section>
      <footer className="market__footer"><button onClick={() => setOdds(true)}><span>ⓘ</span> NADİRLİK ORANLARI</button><span>Paketler {content.economy.packs[0].cards} kart içerir.</span></footer>
      {opened && <div className="overlay" onClick={() => setOpened(null)}><section role="dialog" aria-modal="true" aria-label="Örnek paket" className="overlay__panel panel" onClick={(e) => e.stopPropagation()}><header><h3>{opened.pack.name} · ÖRNEK PAKET</h3><button className="btn small" onClick={() => setOpened(null)}>Kapat</button></header><div className="market__opened">{opened.cards.map((card, i) => <CardView key={`${card.id}-${i}`} card={card} />)}</div><p className="muted">Bu bir paket önizlemesidir. Bakiyen değişmedi.</p></section></div>}
      {odds && <div className="overlay" onClick={() => setOdds(false)}><section role="dialog" aria-modal="true" aria-label="Nadirlik oranları" className="overlay__panel overlay__panel--text panel" onClick={(e) => e.stopPropagation()}><header><h3>NADİRLİK ORANLARI</h3><button className="btn small" onClick={() => setOdds(false)}>Kapat</button></header><table className="market__odds"><thead><tr><th>Nadirlik</th>{content.economy.packs.map((p) => <th key={p.id}>{p.name}</th>)}</tr></thead><tbody>{RARITIES.map((r) => <tr key={r}><td style={{ color: `var(--${r})` }}>{r.toUpperCase()}</td>{content.economy.packs.map((p) => <td key={p.id}>%{(p.odds[r] ?? 0).toLocaleString('tr-TR')}</td>)}</tr>)}</tbody></table><p className="muted">Şanslı paket en az bir Rare+, Mühürlü paket en az bir Epic+ kart içerir.</p></section></div>}
    </div>
  )
}
