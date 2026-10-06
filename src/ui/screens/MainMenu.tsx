import { useState } from 'react'
import { captureCount, regionOpen, useGame } from '../../state/game.ts'
import { useNav, type Screen } from '../../state/nav.ts'
import { GameIcon, type GameIconName } from '../components/GameIcon.tsx'
import { content } from '../content.ts'
import { HowToPlay } from '../components/HowToPlay.tsx'
import { startTutorial } from '../tutorial/flow.ts'
import './MainMenu.css'

const LINKS: { screen: Screen; title: string; icon: GameIconName; note: string }[] = [
  { screen: 'play', title: 'OYNA', icon: 'swords', note: 'Sefere çık, yaratıkları bayılt' },
  { screen: 'decks', title: 'DESTELER', icon: 'cards', note: 'Elementlerin gücünü birleştir' },
  { screen: 'collection', title: 'KOLEKSİYON', icon: 'book', note: 'Yakaladığın yaratıklar' },
  { screen: 'market', title: 'MARKET', icon: 'shop', note: 'Özünü pakete çevir' },
]

export function MainMenu() {
  const go = useNav((s) => s.go)
  const g = useGame()
  const [modal, setModal] = useState<'quests' | 'settings' | 'tutorial' | null>(null)
  const [guide, setGuide] = useState(false)
  const region = content.region(g.expedition?.region ?? g.regionId)
  const caught = content.hunts.filter((h) => (g.hunts[h.id]?.captures ?? 0) > 0).length
  const openRegions = content.regions.filter((r) => regionOpen(g, r.id)).length
  // İlk OYNA'da kısa eğitim önerilir; atlanırsa bir daha sorulmaz.
  const open = (screen: Screen) => (screen === 'play' && !g.tutorialDone ? setModal('tutorial') : go(screen))
  const exportLog = () => {
    const data = { exportedAt: new Date().toISOString(), seed: g.seed, day: g.day, hunts: g.hunts, logs: g.logs }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `canavar-deste-av-kayitlari-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="menu">
      <header className="menu__title panel">
        <GameIcon name="compass" size={88} />
        <h1><span>B</span>EAST <span>T</span>AMER</h1>
        <span className="ornament">✦</span>
      </header>
      <div className="menu__resource resource-badge panel" aria-label={`Öz bakiyesi: ${g.essence}`}>
        <GameIcon name="gem" size={50} /><div><small>ÖZ</small><b>{g.essence.toLocaleString('tr-TR')}</b></div>
      </div>
      <nav className="menu__nav panel" aria-label="Ana menü">
        {LINKS.map(({ screen, title, icon, note }, i) => (
          <button key={screen} className={`menu__btn ${i === 0 ? 'menu__btn--play' : ''}`} onClick={() => open(screen)}>
            <GameIcon name={icon} size={68} />
            <span>{title}<small>{screen === 'play' && g.expedition ? `Sefer sürüyor · Gün ${g.day + 1}` : note}</small></span>
            <span className="menu__arrow">›</span>
          </button>
        ))}
      </nav>
      <div className="menu__chapter"><span>{region.name.toLocaleUpperCase('tr-TR')} · GÜN {g.day + 1}</span><p>{content.hunts.length} yaratıktan {caught} tanesi kitabında · {content.regions.length} bölgeden {openRegions} açık</p></div>
      <footer className="menu__footer">
        <button className="btn" onClick={() => setModal('quests')}><GameIcon name="scroll" size={35} /> GÖREVLER</button>
        <button className="btn" onClick={() => go('collection')}><GameIcon name="book" size={35} /> KİTAP</button>
        <button className="btn" onClick={() => setGuide(true)}><GameIcon name="compass" size={35} /> NASIL OYNANIR</button>
        <div className="menu__tools"><button onClick={() => go('lab')}>Tur laboratuvarı</button><span>·</span><button onClick={() => go('art')}>Art Studio</button></div>
        <button className="btn menu__settings" aria-label="Ayarlar" onClick={() => setModal('settings')}><GameIcon name="settings" size={36} /></button>
      </footer>
      {modal === 'tutorial' && <div className="overlay" onClick={() => setModal(null)}><section role="dialog" aria-modal="true" aria-label="Eğitim" className="overlay__panel overlay__panel--text panel" onClick={(e) => e.stopPropagation()}>
        <header><h3>İLK KEZ Mİ OYNUYORSUN?</h3><button className="btn small" onClick={() => setModal(null)}>Kapat</button></header>
        <p>3 kısa turluk eğitim avında kartları nasıl dizeceğini, geçişleri, dayanıklılığı, yaratığın niyetini ve kart yeteneklerini adım adım öğrenirsin. Yaklaşık 3 dakika sürer.</p>
        <div className="chip-row menu__tutorial-actions">
          <button className="btn" onClick={() => { g.setTutorialDone(true); go('play') }}>Atla, doğrudan oyna</button>
          <button className="btn primary" onClick={startTutorial}>EĞİTİMİ BAŞLAT</button>
        </div>
      </section></div>}
      {guide && <HowToPlay onClose={() => setGuide(false)} onTutorial={startTutorial} />}
      {modal === 'quests' && <div className="overlay" onClick={() => setModal(null)}><section role="dialog" aria-modal="true" aria-label="Görevler" className="overlay__panel overlay__panel--text panel" onClick={(e) => e.stopPropagation()}>
        <header><h3>GÖREVLER</h3><button className="btn small" onClick={() => setModal(null)}>Kapat</button></header>
        <p>Şu anki bölgen: <b>{region.name}</b>. Bölgede yeterince yaratık bayıltınca Final açılır; Final yaratığı yolun devamındaki bölgeyi açar. Bölge kitabı tamamlanınca kalıcı bir bonus kazanır, gizli yaratıkların izine düşersin.</p>
        <p className="gold">{captureCount(g)} yaratık bayıltıldı · {content.cards.length} kart · {content.weather.length} hava durumu</p>
        <button className="btn primary" onClick={() => go('play')}>HARİTAYA GİT</button>
      </section></div>}
      {modal === 'settings' && <div className="overlay" onClick={() => setModal(null)}><section role="dialog" aria-modal="true" aria-label="Ayarlar" className="overlay__panel overlay__panel--text panel" onClick={(e) => e.stopPropagation()}>
        <header><h3>AYARLAR</h3><button className="btn small" onClick={() => setModal(null)}>Kapat</button></header>
        <p>Kart animasyonlarının oynatma hızı</p>
        <div className="chip-row">{([1, 2, 4] as const).map((s) => <button key={s} className={`btn ${g.speed === s ? 'active' : ''}`} onClick={() => g.setSpeed(s)}>×{s}</button>)}</div>
        <label className="menu__toggle"><input type="checkbox" checked={g.sandbox} onChange={(e) => g.setSandbox(e.target.checked)} /> Playtest: tüm kartlar ve Tamer'lar açık (koleksiyon kısıtı yok)</label>
        <div className="chip-row">
          <button className="btn small" onClick={exportLog} disabled={!g.logs.length}>Av kayıtlarını indir ({g.logs.length})</button>
          <button className="btn small" onClick={() => { if (confirm('Profil (koleksiyon, öz, sefer ve kayıtlar) sıfırlansın mı?')) g.reset() }}>Profili sıfırla</button>
        </div>
      </section></div>}
    </div>
  )
}
