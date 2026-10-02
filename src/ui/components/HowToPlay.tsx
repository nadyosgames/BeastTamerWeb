import { useState, type ReactNode } from 'react'
import { ELEMENTS } from '../../core/types.ts'
import { KEYWORD_INFO } from '../keywords.ts'
import { ELEMENT_LABEL } from '../labels.ts'
import { ElementIcon } from './ElementIcon.tsx'
import './HowToPlay.css'

/**
 * "Nasıl Oynanır" rehberi: kuralları sekmeler halinde özetler. Anahtar kelime açıklamaları
 * kart tooltip'leriyle aynı kaynaktan (KEYWORD_INFO) gelir; kural değişince rehber de değişir.
 */
const ELEMENT_RULE: Record<(typeof ELEMENTS)[number], string> = {
  fire: 'Ateş kartları masaya Isı ekler, "Isı kadar" bonus alan kartlar ondan beslenir. Ateş kartlarını peş peşe dizmeyi ödüllendirir.',
  water: 'Su kartları komşularının gelirini kopyalar ya da tek/çift geçişlerde güçlenir.',
  earth: 'Toprak kartları pasif kartları sayar; geç tetiklenen, uzun ömürlü kartlardır.',
  wind: 'Rüzgar kartları çoğunlukla Swift\'tir ve masadaki farklı elementleri sayar.',
  electric: 'Kartların iki yanında + ve − kutup basılıdır. Her kutuplu kart sağındaki ilk kutuplu karta bağlanır; karşılıklı kutuplar zıtsa bağlantı uyumlu, aynıysa çakışandır.',
}

const TRIGGERS = ['howl', 'harvest', 'lastBreath', 'aura', 'epilogue', 'haunt'] as const
const STATES = ['swift', 'heavy', 'ward', 'rebirth', 'overload', 'slumber'] as const

const PAGES: { id: string; title: string; body: () => ReactNode }[] = [
  {
    id: 'goal',
    title: 'Amaç',
    body: () => (
      <>
        <p>
          Yaratık kartlarından bir deste kurar, her gün kartlarını en verimli sırayla dizerek <b>kaynak</b> toplarsın.
        </p>
        <ul>
          <li>Hafta 5 gündür. Haftanın toplam kazancı <b>haftalık kotayı</b> tutarsa paket kazanırsın.</li>
          <li>Paketlerden yeni kartlar çıkar; koleksiyonun büyüdükçe desteni güçlendirirsin.</li>
          <li>Kart oyunlarındaki gibi rakip yoktur: senin kararın, kartların <b>sırasıdır</b>.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'round',
    title: 'Gün ve tur',
    body: () => (
      <>
        <ul>
          <li>Her gün desten karılır. Deste 30 kart, Tamer'ın 5 slotu varsa gün <b>6 tur</b> sürer.</li>
          <li>Her turda slot sayısı kadar kart ele gelir ve <b>hepsini</b> slotlara dizmen gerekir.</li>
          <li>Kartı sürükleyip slota bırak; tıklarsan ilk boş slota gider. Slottaki kartları sürükleyerek yer değiştir.</li>
          <li>BAŞLAT'a basınca tur kendi kendine çözülür; tur sonunda dizilimin, aynı elle mümkün olan en iyi dizilimle karşılaştırılır.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'pass',
    title: 'Geçiş ve dayanıklılık',
    body: () => (
      <>
        <ul>
          <li>
            Tur başında <b>Howl</b> yetenekleri bir kez çalışır.
          </li>
          <li>
            Sonra <b>geçişler</b> başlar: aktif kartlar soldan sağa sırayla tetiklenir (<b>Swift</b> kartlar önce, <b>Heavy</b> kartlar sonra).
          </li>
          <li>
            Her tetik kartın <b>Harvest</b> yeteneğini çalıştırır ve 1 <b>dayanıklılık</b> (🛡, kartın sağ üstü) harcar.
          </li>
          <li>Dayanıklılığı 0 olan kart <b>pasife</b> geçer. Tüm kartlar pasif olunca tur biter.</li>
          <li>Yani bir kartın dayanıklılığı, o turda kaç kez gelir getireceğidir.</li>
        </ul>
        <p className="muted">Gelir hesabı: (taban gelir) × (kart çarpanları) × (hava, Tamer). Tur kaydında her tetiğin hesabı yazar.</p>
      </>
    ),
  },
  {
    id: 'keywords',
    title: 'Yetenekler',
    body: () => (
      <div className="howto__kwgrid">
        <section>
          <h4>Ne zaman çalışır</h4>
          {TRIGGERS.map((k) => (
            <p key={k}>
              <b className="card__keyword">{KEYWORD_INFO[k].label}</b> {KEYWORD_INFO[k].description}
            </p>
          ))}
        </section>
        <section>
          <h4>Kart durumları</h4>
          {STATES.map((k) => (
            <p key={k}>
              <b className="card__keyword">{KEYWORD_INFO[k].label}</b> {KEYWORD_INFO[k].description}
            </p>
          ))}
        </section>
      </div>
    ),
  },
  {
    id: 'elements',
    title: 'Element ve tür',
    body: () => (
      <>
        <div className="howto__elements">
          {ELEMENTS.map((el) => (
            <div key={el} className="howto__element" style={{ ['--el' as string]: `var(--${el})` }}>
              <ElementIcon element={el} size={34} />
              <p>
                <b>{ELEMENT_LABEL[el]}</b> {ELEMENT_RULE[el]}
              </p>
            </div>
          ))}
        </div>
        <p>
          Her kartın bir <b>türü</b> vardır (Beast, Dragon, Golem, Avian, Swarm, Flora, Ghost, Serpent); görselin sağ altında
          yazar. "Sağındaki kart Dragon ise" gibi koşullar türe bakar.
        </p>
      </>
    ),
  },
  {
    id: 'meta',
    title: 'Hava ve Tamer',
    body: () => (
      <ul>
        <li>
          Her günün bir <b>havası</b> vardır: bazı elementleri güçlendirir (ör. Güneşli: Ateş +%40), bazılarını zayıflatır. Haftanın
          havasını önceden görür, desteni ona göre seçersin.
        </li>
        <li>
          Her deste bir <b>Tamer</b> ile oynanır. Tamer'ın pasifi destedeki tüm kartları etkiler; birkaç Tamer slot sayısını ya da
          deste boyutunu da değiştirir.
        </li>
        <li>Desteler ekranında kendi desteni kurabilir, hazır destelerden birini seçebilirsin.</li>
      </ul>
    ),
  },
]

export function HowToPlay({ onClose, onTutorial }: { onClose: () => void; onTutorial?: () => void }) {
  const [page, setPage] = useState(0)
  const current = PAGES[page]
  return (
    <div className="overlay" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-label="Nasıl oynanır" className="overlay__panel panel howto" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>NASIL OYNANIR</h3>
          <button className="btn small" onClick={onClose}>
            Kapat
          </button>
        </header>
        <div className="howto__body">
          <nav className="howto__tabs" aria-label="Rehber bölümleri">
            {PAGES.map((p, i) => (
              <button key={p.id} className={`howto__tab ${i === page ? 'is-active' : ''}`} aria-current={i === page} onClick={() => setPage(i)}>
                <span>{i + 1}</span>
                {p.title}
              </button>
            ))}
          </nav>
          <article className="howto__page">
            <h4 className="howto__title">{current.title}</h4>
            {current.body()}
          </article>
        </div>
        <footer className="howto__footer">
          {onTutorial && (
            <button className="btn" onClick={onTutorial}>
              Eğitimi oyna
            </button>
          )}
          <span className="howto__spacer" />
          <button className="btn" disabled={page === 0} onClick={() => setPage(page - 1)}>
            ‹ Önceki
          </button>
          {page < PAGES.length - 1 ? (
            <button className="btn primary" onClick={() => setPage(page + 1)}>
              Sonraki ›
            </button>
          ) : (
            <button className="btn primary" onClick={onClose}>
              Anladım
            </button>
          )}
        </footer>
      </section>
    </div>
  )
}
