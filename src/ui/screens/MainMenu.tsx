import { useState } from 'react'
import { calendarLabel, useGame } from '../../state/game.ts'
import { useNav, type Screen } from '../../state/nav.ts'
import { GameIcon, type GameIconName } from '../components/GameIcon.tsx'
import { content } from '../content.ts'
import './MainMenu.css'

const LINKS: { screen: Screen; title: string; icon: GameIconName; note: string }[] = [
  { screen: 'play', title: 'OYNA', icon: 'swords', note: 'Yeni bir gün, yeni bir macera' },
  { screen: 'decks', title: 'DESTELER', icon: 'cards', note: 'Elementlerin gücünü birleştir' },
  { screen: 'collection', title: 'KOLEKSİYON', icon: 'book', note: 'Yaratıklarını keşfet' },
  { screen: 'market', title: 'MARKET', icon: 'shop', note: 'Yeni dostlar seni bekliyor' },
]

export function MainMenu() {
  const go = useNav((s) => s.go)
  const dayIndex = useGame((s) => s.dayIndex)
  const lifetime = useGame((s) => s.lifetime)
  const speed = useGame((s) => s.speed)
  const setSpeed = useGame((s) => s.setSpeed)
  const [modal, setModal] = useState<'quests' | 'settings' | null>(null)
  return (
    <div className="menu">
      <header className="menu__title panel">
        <GameIcon name="compass" size={88} />
        <h1>CANAVAR DESTE</h1>
        <span className="ornament">✦</span>
      </header>
      <div className="menu__resource resource-badge panel">
        <GameIcon name="gem" size={50} /><div><small>TOPLAM KAZANÇ</small><b>{lifetime.toLocaleString('tr-TR')}</b></div>
      </div>
      <nav className="menu__nav panel" aria-label="Ana menü">
        {LINKS.map(({ screen, title, icon, note }, i) => (
          <button key={screen} className={`menu__btn ${i === 0 ? 'menu__btn--play' : ''}`} onClick={() => go(screen)}>
            <GameIcon name={icon} size={68} />
            <span>{title}<small>{screen === 'play' && dayIndex ? `Gün ${dayIndex + 1} · Devam et` : note}</small></span>
            <span className="menu__arrow">›</span>
          </button>
        ))}
      </nav>
      <div className="menu__chapter"><span>YOLCULUĞUN BAŞLIYOR</span><p>{calendarLabel(dayIndex)}</p></div>
      <footer className="menu__footer">
        <button className="btn" onClick={() => setModal('quests')}><GameIcon name="scroll" size={35} /> GÖREVLER</button>
        <button className="btn" onClick={() => go('collection')}><GameIcon name="book" size={35} /> ALBÜM</button>
        <div className="menu__tools"><button onClick={() => go('lab')}>Tur laboratuvarı</button><span>·</span><button onClick={() => go('art')}>Art Studio</button></div>
        <button className="btn menu__settings" aria-label="Ayarlar" onClick={() => setModal('settings')}><GameIcon name="settings" size={36} /></button>
      </footer>
      {modal && <div className="overlay" onClick={() => setModal(null)}><section role="dialog" aria-modal="true" aria-label={modal === 'quests' ? 'Görevler' : 'Ayarlar'} className="overlay__panel overlay__panel--text panel" onClick={(e) => e.stopPropagation()}>
        <header><h3>{modal === 'quests' ? 'GÖREVLER' : 'AYARLAR'}</h3><button className="btn small" onClick={() => setModal(null)}>Kapat</button></header>
        {modal === 'quests' ? <><p>Her gün altı tur tamamla. Havaya uygun desteyi seç ve beş günün sonunda haftalık kotanı doldur.</p><p className="gold">{content.cards.length} yaratık · {content.decks.length} hazır deste · {content.weather.length} hava durumu</p><button className="btn primary" onClick={() => go('play')}>MACERAYA BAŞLA</button></> : <><p>Kart animasyonlarının oynatma hızı</p><div className="chip-row">{([1, 2, 4] as const).map((s) => <button key={s} className={`btn ${speed === s ? 'active' : ''}`} onClick={() => setSpeed(s)}>×{s}</button>)}</div></>}
      </section></div>}
    </div>
  )
}
