import { content } from '../../content/index.ts'
import { useNav } from '../../state/nav.ts'
import { CardView } from '../components/CardView.tsx'
import './MainMenu.css'

export function MainMenu() {
  const go = useNav((s) => s.go)
  const calibrated = content.balance.quotaByWeek.length > 0
  const showcase = ['spark_fox', 'cloud_owl', 'stone_golem'].map((id) => content.card(id))
  return (
    <div className="menu">
      <div className="menu__title panel">
        <h1>CANAVAR DESTE</h1>
        <span className="muted">web prototipi · oynanabilirlik testi</span>
      </div>

      <div className="menu__showcase">
        {showcase.map((c, i) => (
          <div key={c.id} style={{ transform: `rotate(${(i - 1) * 7}deg) translateY(${Math.abs(i - 1) * 24}px)` }}>
            <CardView card={c} />
          </div>
        ))}
      </div>

      <nav className="menu__nav panel">
        <button className="btn primary menu__btn" disabled title="Sıradaki adım: gün/hafta döngüsü">
          OYNA <small>yakında</small>
        </button>
        <button className="btn menu__btn" onClick={() => go('lab')}>
          TUR LABORATUVARI
        </button>
        <button className="btn menu__btn" onClick={() => go('art')}>
          ART STUDIO
        </button>
        <button className="btn menu__btn" disabled>
          DESTELER · KOLEKSİYON · MARKET
        </button>
      </nav>

      <div className="menu__status panel">
        <div>
          İçerik: <b>{content.cards.length}</b> kart · <b>{content.tamers.length}</b> Tamer · <b>{content.weather.length}</b> hava
        </div>
        <div>
          Denge:{' '}
          {calibrated ? (
            <span style={{ color: 'var(--good)' }}>
              kota eğrisi simülasyonla kalibre ({new Date(content.balance.generatedAt).toLocaleString('tr-TR')})
            </span>
          ) : (
            <span style={{ color: 'var(--bad)' }}>kalibre edilmedi — npm run sim -- calibrate</span>
          )}
        </div>
      </div>
    </div>
  )
}
