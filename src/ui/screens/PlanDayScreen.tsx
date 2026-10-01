import { useEffect, useMemo, useState } from 'react'
import { calendarLabel, currentWeek, useGame, weekQuota } from '../../state/game.ts'
import { useNav } from '../../state/nav.ts'
import { useRun } from '../../state/run.ts'
import { playerDeck, playerDeckCards, playerDecks, playerDeckStatus } from '../../state/decks.ts'
import { CardView } from '../components/CardView.tsx'
import { ElementIcon } from '../components/ElementIcon.tsx'
import { GameIcon } from '../components/GameIcon.tsx'
import { WeatherIcon } from '../components/WeatherIcon.tsx'
import { artUrl } from '../art.ts'
import { useStage } from '../stage-context.ts'
import { content } from '../content.ts'
import { deckWeatherPct, elementCounts } from '../weather.ts'
import { ELEMENTS } from '../../core/types.ts'
import './PlanDayScreen.css'

export function PlanDayScreen() {
  const stage = useStage()
  const tall = stage.height / stage.width > 0.75
  const go = useNav((s) => s.go)
  const g = useGame()
  const ensureWeek = useGame((s) => s.ensureWeek)
  const startDay = useRun((s) => s.startDay)
  const [viewDeck, setViewDeck] = useState<string | null>(null)
  const [help, setHelp] = useState(false)

  useEffect(() => {
    ensureWeek()
  }, [ensureWeek])

  const week = currentWeek(g.dayIndex)
  const dayInWeek = g.dayIndex % content.calendar.daysPerWeek
  const weatherId = g.weekWeather[dayInWeek]
  const weather = content.weatherById.get(weatherId)
  const quota = weekQuota(week, g.weeks)
  const deckSize = playerDeckCards(g, g.deckId).length
  const activeDeckStatus = playerDeckStatus(g, g.deckId)
  const tamer = content.tamer(g.tamerId)
  const weekDays = g.days.filter((d) => d.week === week)
  const decks = useMemo(() => playerDecks(g).map((d) => {
    const cards = playerDeckCards(g, d.id)
    const unique = cards.filter((c, i, all) => all.findIndex((x) => x.id === c.id) === i)
    const representatives = unique.filter((c, i, all) => all.findIndex((x) => x.elements[0] === c.elements[0]) === i)
    const showcase = [...representatives, ...unique.filter((c) => !representatives.includes(c))].slice(0, 3)
    return { d, cards, showcase }
  }), [g])
  const pct = Math.min(1, g.weekIncome / quota)
  const daysLeft = content.calendar.daysPerWeek - dayInWeek

  const begin = () => {
    if (!activeDeckStatus.ready) return
    startDay()
    go('run')
  }

  const exportLog = () => {
    const data = { exportedAt: new Date().toISOString(), seed: g.seed, days: g.days, weeks: g.weeks }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `canavar-deste-playtest-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={`plan${tall ? ' plan--tall' : ''}`}>
      <header className="plan__top panel">
        <button className="btn small" onClick={() => go('menu')}>
          ← GERİ
        </button>
        <GameIcon name="compass" size={44} /><h2>GÜNÜ PLANLA</h2>
        <span className="muted">{calendarLabel(g.dayIndex)}</span>
        <span className="plan__lifetime">
          Toplam kazanç <b>{g.lifetime.toLocaleString('tr-TR')}</b>
        </span>
      </header>

      <section className="plan__week">
        {Array.from({ length: content.calendar.daysPerWeek }, (_, i) => {
          const w = content.weatherById.get(g.weekWeather[i])
          const played = weekDays.find((d) => d.dayIndex % content.calendar.daysPerWeek === i)
          return (
            <div key={i} className={`plan__day panel weather-scene weather-scene--${w?.icon ?? 'calm'} ${i === dayInWeek ? 'is-today' : ''} ${played ? 'is-played' : ''}`} style={w && artUrl('weather', w.id) ? { backgroundImage: `linear-gradient(180deg, #08121a15, #05101bed), url("${artUrl('weather', w.id)}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
              <small>GÜN {i + 1}</small>
              <div className="plan__wicon">{w && <WeatherIcon icon={w.icon} size={62} />}</div>
              <b>{w?.name ?? '—'}</b>
              <span className="plan__weffect">{w?.text}</span>
              {played && <span className="plan__earned">+{played.total}</span>}
            </div>
          )
        })}
      </section>

      <section className="plan__tamer panel">
          <h3><span className="ornament">✧</span> DESTENİN TAMER'I</h3>
        <div className="plan__portrait">
          {artUrl('tamers', tamer.id) ? <img src={artUrl('tamers', tamer.id)!} alt={tamer.name} /> : <><GameIcon name="shield" size={120} /><span>{tamer.name}</span></>}
        </div>
        <div className="plan__tamerrow">
          <div className="plan__tamername">{tamer.name}</div>
        </div>
        <div className={activeDeckStatus.ready ? 'muted' : 'plan__invalidcount'}>
          {deckSize} / {tamer.deckSize} KART · {tamer.slots} SLOT
        </div>
        <p className="plan__passive">{tamer.text}</p>
        <button className="btn small" onClick={() => go('decks')}>DESTEYİ DÜZENLE →</button>
      </section>

      <section className="plan__decks panel">
        <h3><GameIcon name="cards" size={30} /> DESTE SEÇ <span className="plan__deckhint">Havaya uygun desteni seç</span></h3>
        <div className="plan__deckgrid">
          {decks.map(({ d, cards, showcase }) => {
            const deckTamer = content.tamer(d.tamer)
            const fit = deckWeatherPct(cards, weather)
            const counts = elementCounts(cards)
            const status = playerDeckStatus(g, d.id)
            return (
              <div
                key={d.id}
                className={`plan__deck ${g.deckId === d.id && status.ready ? 'is-selected' : ''} ${!status.ready ? 'is-incomplete' : ''}`}
                role="button"
                tabIndex={0}
                aria-pressed={g.deckId === d.id && status.ready}
                aria-disabled={!status.ready}
                aria-label={`${d.name} destesini seç${!status.ready ? ` · ${status.reason}` : ''}`}
                onClick={() => { if (status.ready) g.setDeck(d.id) }}
                onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); if (status.ready) g.setDeck(d.id) } }}
              >
                <div className="plan__deckart">
                  {showcase.map((c, i) => <div key={c.id} style={{ transform: `rotate(${(i - 1) * 12}deg) translateY(${Math.abs(i - 1) * 12}px)` }}><CardView card={c} size="sm" /></div>)}
                  {g.deckId === d.id && status.ready && <span className="plan__check">✓</span>}
                </div>
                <div className="plan__deckhead">
                  <b>{d.name}</b>
                  <span className={fit > 2 ? 'good' : fit < -2 ? 'bad' : 'muted'}>
                    Bugün {fit >= 0 ? '+' : ''}
                    {fit.toFixed(0)}%
                  </span>
                </div>
                <div className="plan__decktamer"><GameIcon name="shield" size={18} />{deckTamer.name} · {deckTamer.slots} slot</div>
                <div className="plan__elements">
                  {ELEMENTS.filter((e) => counts[e]).map((e) => (
                    <span key={e}>
                      <ElementIcon element={e} size={22} /> {counts[e]}
                    </span>
                  ))}
                </div>
                <p>{cards.length} / {deckTamer.deckSize} KART{!status.ready && <span className="plan__deckerror">{status.reason}</span>}</p>
                <button
                  className="btn small"
                  aria-disabled={false}
                  onClick={(e) => {
                    e.stopPropagation()
                    setViewDeck(d.id)
                  }}
                >
                  DESTEYİ İNCELE
                </button>
              </div>
            )
          })}
        </div>
      </section>

      <section className="plan__quota panel">
        <div className="plan__quotahead">
          <GameIcon name="star" size={42} /><b>HAFTALIK KOTA</b>
          <span>
            {g.weekIncome.toLocaleString('tr-TR')} / {quota.toLocaleString('tr-TR')}
          </span>
          <span className="muted">{daysLeft} gün kaldı</span>
        </div>
        <div className="plan__bar">
          <div style={{ width: `${pct * 100}%` }} />
        </div>
        <div className="plan__weeks">
          {g.weeks.slice(-6).map((w) => (
            <span key={w.week} className={w.passed ? 'good' : 'bad'} title={`${w.income} / ${w.quota}`}>
              H{w.week + 1} {w.passed ? '✓' : '✗'}
            </span>
          ))}
        </div>
      </section>

      <section className="plan__actions">
        {!activeDeckStatus.ready && <p className="plan__starterror" role="status">{activeDeckStatus.reason}. Tam bir deste seç.</p>}
        <button className="btn primary plan__start" onClick={begin} disabled={!weather || !activeDeckStatus.ready}>
          <GameIcon name="compass" size={52} /> GÜNÜ BAŞLAT
        </button>
        <div className="chip-row">
          <button className="btn small" onClick={() => setHelp(true)}>
            Nasıl oynanır
          </button>
          <button className="btn small" onClick={exportLog} disabled={!g.days.length}>
            Kayıtları indir ({g.days.length} gün)
          </button>
          <button
            className="btn small"
            onClick={() => {
              if (confirm('Playtest ilerlemesi ve kayıtlar silinsin mi?')) g.reset()
            }}
          >
            Sıfırla
          </button>
        </div>
      </section>

      {viewDeck && (
        <div className="overlay" onClick={() => setViewDeck(null)}>
          <div className="overlay__panel panel" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3>{playerDeck(g, viewDeck)?.name}</h3>
              <button className="btn small" onClick={() => setViewDeck(null)}>
                Kapat
              </button>
            </header>
            <div className="plan__cards scroll">
              {playerDeck(g, viewDeck)!.cards.map(({ card, count }) => (
                <div key={card} className="plan__cardcell">
                  <CardView card={content.card(card)} />
                  <span>×{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {help && (
        <div className="overlay" onClick={() => setHelp(false)}>
          <div className="overlay__panel overlay__panel--text panel" onClick={(e) => e.stopPropagation()}>
            <h3>Nasıl oynanır</h3>
            <ol>
              <li>Her gün bir maçtır. Haftanın havasına bak, güne uygun desteyi ve Tamer'ı seç.</li>
              <li>
                Deste karılır, her turda 5 kart eline gelir. Kartları yukarıdaki slotlara sürükle; dolu slota bırakırsan
                yer değiştirirler, ele geri de sürükleyebilirsin. Kısayol: eldeki karta tıkla → ilk boş slota, slottakine
                tıkla → ele döner.
              </li>
              <li>BAŞLAT: kartlar soldan sağa tetiklenir (Swift önce, Heavy en son), her tetikte 1 dayanıklılık harcar. Hepsi bitene kadar geçişler sürer.</li>
              <li>Komşu, konum, kopya ve kutup bağlantıları dizilime bağlıdır. Tur sonunda en iyi dizilimle karşılaştırmayı görürsün.</li>
              <li>6 tur = 1 gün. 5 gün = 1 hafta; haftalık kotayı tutturmaya çalış.</li>
            </ol>
            <p className="muted">
              Playtest notu: süren ve dizilim kararların kaydedilir. "Kayıtları indir" ile JSON'u paylaş; simülasyon
              varsayımlarıyla karşılaştıracağız.
            </p>
            <button className="btn primary" onClick={() => setHelp(false)}>
              Anladım
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
