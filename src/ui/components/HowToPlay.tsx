import { useState, type ReactNode } from 'react'
import { ELEMENTS, type Intent } from '../../core/types.ts'
import { intentName, intentText } from '../hunt.ts'
import { IntentIcon } from './HuntBits.tsx'
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
const STATES = ['swift', 'heavy', 'ward', 'rebirth', 'overload', 'slumber', 'guard'] as const
const INTENTS: Intent[] = [
  { kind: 'claw', damage: 8 },
  { kind: 'rend', slot: 1 },
  { kind: 'tailSweep', count: 2 },
  { kind: 'roar', slot: 3 },
  { kind: 'evade' },
  { kind: 'charge' },
  { kind: 'recover', amount: 20 },
  { kind: 'flee', damage: 80, belowPct: 30 },
]

const PAGES: { id: string; title: string; body: () => ReactNode }[] = [
  {
    id: 'goal',
    title: 'Amaç',
    body: () => (
      <>
        <p>
          Yaratık kartlarından bir deste kurar, sefere çıkar ve vahşi yaratıkları <b>bayıltırsın</b>. Bayılan yaratık
          koleksiyonuna katılır ve desteni güçlendirir.
        </p>
        <ul>
          <li>Kartlarının Strike'ı yaratığa <b>hasar</b> verir. Can 0'a inince yaratık bayılır; 6 tur biterse kaçar.</li>
          <li>Yaratık da karşılık verir: her turun sonunda niyetini uygular, <b>Tamer'ın canı</b> düşer.</li>
          <li>Kart oyunlarındaki gibi elinden kart seçmezsin: senin kararın, kartların <b>sırasıdır</b>.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'round',
    title: 'Av ve tur',
    body: () => (
      <>
        <ul>
          <li>Av başında desten karılır. Deste 30 kart, Tamer'ın 5 slotu varsa av en fazla <b>6 tur</b> sürer.</li>
          <li>Her turda slot sayısı kadar kart ele gelir ve <b>hepsini</b> slotlara dizmen gerekir.</li>
          <li>Kartı sürükleyip slota bırak; tıklarsan ilk boş slota gider. Slottaki kartları sürükleyerek yer değiştir.</li>
          <li>BAŞLAT'a basınca tur kendi kendine çözülür. Yaratık o tur bayılırsa niyetini uygulayamaz; hızlı bayıltmak hem Tamer'ı korur hem ödülü artırır.</li>
        </ul>
        <p className="muted">Tur sonunda dizilimin, aynı elle mümkün olan en iyi dizilimle (yaratığı hesaba katan) karşılaştırılır.</p>
      </>
    ),
  },
  {
    id: 'pass',
    title: 'Geçiş ve dayanıklılık',
    body: () => (
      <>
        <ul>
          <li>Tur başında <b>Howl</b> yetenekleri bir kez çalışır.</li>
          <li>Sonra <b>geçişler</b> başlar: aktif kartlar soldan sağa sırayla tetiklenir (<b>Swift</b> kartlar önce, <b>Heavy</b> kartlar sonra).</li>
          <li>Her tetik kartın <b>Strike</b> yeteneğini çalıştırır, yaratığa hasar verir ve 1 <b>dayanıklılık</b> (🛡) harcar.</li>
          <li>Dayanıklılığı 0 olan kart <b>pasife</b> geçer. Tüm kartlar pasif olunca tur biter.</li>
          <li>Bazı kartlar hasarın yanında <b>Koruma</b> üretir: tur sonundaki saldırıyı emer, sonra sıfırlanır.</li>
        </ul>
        <p className="muted">Hasar hesabı: (taban) × (kart çarpanları) × (hava, Tamer), sonra yaratığın özellikleri (Zırh, Çevik...). Tur kaydında her vuruş yazar.</p>
      </>
    ),
  },
  {
    id: 'prey',
    title: 'Yaratığın niyeti',
    body: () => (
      <>
        <p>Her turdan önce yaratığın <b>niyeti</b> sağ üstte görünür. Kartlara dokunan niyetler dizimde hedef slotun üstünde işaretlenir.</p>
        <div className="howto__intents">
          {INTENTS.map((it) => (
            <p key={it.kind}>
              <IntentIcon kind={it.kind} size={40} />
              <span><b>{intentName(it).replace(/ \d+$/, '')}</b> {intentText(it)}</span>
            </p>
          ))}
        </div>
        <p className="muted">Zorlu ve üstü yaratıkların <b>özellikleri</b> de vardır (Zırh, Çevik, Direnç...). Final yaratıkları iki fazlıdır; Efsanevi yaratıklar kendi havasını getirir, Kadim yaratıklar günlerce süren kuşatma ister.</p>
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
    id: 'world',
    title: 'Dünya ve biyomlar',
    body: () => (
      <ul>
        <li>
          <b>Bilinen Topraklar</b> sekiz bölgeden oluşur: Kül Vadisi'nden Ejder Zirvesi'ne her biyomun kendi iklimi, yaratıkları ve Final avı vardır. Haritayı sürükle, tekerlekle ya da düğmelerle yakınlaş; uzaktan bölge rozetlerini, yakından yaratıkları görürsün.
        </li>
        <li>
          Bir bölgenin <b>Final</b> yaratığını bayıltınca yolun devamındaki bölge açılır. Kül Vadisi'nden sonra yol ikiye ayrılır (Kıyı → Yayla → Bataklık ve Orman → Çöl → Mağaralar) ve Ejder Zirvesi'nde birleşir.
        </li>
        <li>
          Bölgenin bütün Sıradan, Zorlu ve Final yaratıklarını bayıltınca <b>bölge kitabı</b> tamamlanır: kalıcı bonusu dünyadaki tüm avlarda geçerlidir ve gizli Efsanevi yaratık iz bırakmaya başlar.
        </li>
        <li>
          Sefere çıkacağın bölgeyi haritadan seç. Seferdeyken yalnızca o bölgede avlanırsın; başka bölgeye gitmek için kampa dön.
        </li>
      </ul>
    ),
  },
  {
    id: 'meta',
    title: 'Sefer ve hava',
    body: () => (
      <ul>
        <li>
          Kamptan <b>sefere</b> çıkarsın. Seferde her gün bir av, bir dinlenme (1 <b>Erzak</b>) ya da kampa dönüş seçersin; her biri bir gün geçirir.
        </li>
        <li>
          Her günün bir <b>havası</b> vardır ve 5 gün önceden görünür: bazı elementleri güçlendirir (Güneşli: Ateş +%40), bazılarını zayıflatır. Bazı yaratıklar yalnızca belirli havalarda iz verir.
        </li>
        <li>
          <b>Tamer'ın canı</b> sefer boyunca taşınır; kampta dolar. Tamer düşerse <b>çantadaki</b> özün yarısı kaybolur, bayılttığın yaratıklar asla kaybolmaz.
        </li>
        <li>
          Kazanılan her av bir <b>İz</b> verir. Bölge kitabı tamamsa aynı seferde 3 İz, gizli Efsanevi yaratığı ortaya çıkarır.
        </li>
        <li><b>Öz</b> ile Market'ten paket alırsın. ★★★ ile bayılttığın yaratıklar Hızlı Av ile tek tıkla yeniden avlanabilir.</li>
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
