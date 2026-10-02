import { useEffect, useMemo } from 'react'
import { roundContext } from '../../core/day.ts'
import { resolveRound } from '../../core/engine/round.ts'
import { calendarLabel, useGame } from '../../state/game.ts'
import { playerDeck } from '../../state/decks.ts'
import { useNav } from '../../state/nav.ts'
import { remainingCards, useRun } from '../../state/run.ts'
import { content } from '../content.ts'
import { useRoundPlayback, type Speed } from '../playback/useRoundPlayback.ts'
import { Board } from '../run/Board.tsx'
import { RoundLog } from '../run/RoundLog.tsx'
import { useStage } from '../stage-context.ts'
import { WEATHER_ICON } from '../weather.ts'
import './RunScreen.css'

/**
 * Bir günün oynandığı ekran. Kartlar ele gelir → slotlara sürüklenir → BAŞLAT → motorun olay
 * akışı oynatılır → tur sonucu (en iyi dizilimle karşılaştırma) → sonraki tur. 6 tur sonunda gün özeti.
 */
export function RunScreen() {
  const go = useNav((s) => s.go)
  const run = useRun()
  const speed = useGame((s) => s.speed)
  const setSpeed = useGame((s) => s.setSpeed)
  const preview = useGame((s) => s.preview)
  const setPreview = useGame((s) => s.setPreview)
  const dayIndex = useGame((s) => s.dayIndex)
  const stage = useStage()

  useEffect(() => {
    if (run.status === 'idle') go('play')
  }, [run.status, go])

  const { view, skip } = useRoundPlayback(run.arrangement, run.events, speed)
  const { playbackDone } = run
  useEffect(() => {
    if (view.done) playbackDone()
  }, [view.done, playbackDone])

  const allPlaced = run.slots.length > 0 && run.slots.every((k) => k !== null)
  const previewTotal = useMemo(() => {
    if (!preview || !run.plan || run.status !== 'arrange' || !allPlaced) return null
    return resolveRound(
      run.slots.map((k) => run.hand[k!]),
      roundContext(run.plan, run.roundIndex),
    ).total
  }, [preview, run.plan, run.status, run.slots, run.hand, run.roundIndex, allPlaced])

  if (!run.plan) return null

  const arrange = run.status === 'arrange'
  const weather = content.weatherById.get(run.weatherId)
  const tamer = content.tamer(run.tamerId)
  const deck = playerDeck(useGame.getState(), run.deckId)
  const completed = run.rounds.slice(0, run.roundIndex).reduce((a, r) => a + r.total, 0)
  const dayTotal = completed + (arrange ? 0 : view.total)
  const record = run.rounds[run.roundIndex]
  const placed = run.slots.filter((k) => k !== null).length

  const leaveDay = () => {
    if (run.status === 'dayDone' || confirm('Gün yarıda bırakılsın mı? (Bu günün ilerlemesi kaydedilmez)')) {
      run.leave()
      go('play')
    }
  }

  return (
    <div className="run">
      <header className="run__top">
        <div className="run__day panel">
          <b>GÜN {dayIndex + (run.status === 'dayDone' ? 0 : 1)}</b>
          <span className="muted">{calendarLabel(run.dayIndex)}</span>
          <span>
            {weather ? WEATHER_ICON[weather.icon] : ''} {weather?.name} · <span className="muted">{weather?.text}</span>
          </span>
        </div>
        <div className="run__round panel">
          <small>TUR</small>
          <b>
            {run.roundIndex + 1}/{run.plan.hands.length}
          </b>
          <small>GEÇİŞ {view.pass || '–'}</small>
        </div>
        <div className="run__score panel">
          <small>BUGÜN</small>
          <b className="gold">+{dayTotal}</b>
          {view.heat > 0 && <small>Isı {view.heat}</small>}
        </div>
        <button className="btn small run__leave" onClick={leaveDay}>
          Günden çık
        </button>
      </header>

      <Board
        stageW={stage.width}
        stageH={stage.height}
        scale={stage.scale}
        round={run.roundIndex}
        status={run.status}
        hand={run.hand}
        slots={run.slots}
        view={view}
        onPlace={run.place}
        onUnplace={run.unplace}
      />

      {!arrange && (
        <section className="run__center">
          <div className="run__result panel">
            {run.status === 'roundDone' && record ? (
              <>
                <div className="run__resultline">
                  Bu tur <b className="gold">+{record.total}</b> · En iyi dizilim <b>+{record.best}</b>{' '}
                  <span className={record.total >= record.best ? 'good' : 'bad'}>
                    ({Math.round((record.total / Math.max(1, record.best)) * 100)}%)
                  </span>
                </div>
                {record.total < record.best ? (
                  <div className="run__best">
                    En iyisi: {record.bestArrangement.map((id) => content.card(id).name).join(' → ')}
                  </div>
                ) : (
                  <div className="run__best good">En iyi dizilimi buldun!</div>
                )}
                <div className="muted">Planlama süren: {record.planningSec} sn</div>
              </>
            ) : (
              <div className="run__resultline">Tur oynanıyor…</div>
            )}
          </div>
          <div className="run__log panel">
            <RoundLog view={view} cards={run.arrangement} />
          </div>
        </section>
      )}

      <aside className="run__who panel">
        <b>{tamer.name}</b>
        <span className="muted">{tamer.text}</span>
        <span>
          {deck?.name} · destede kalan <b>{remainingCards(run.plan, run.roundIndex)}</b> kart
        </span>
      </aside>

      <aside className="run__controls panel">
        {arrange && (
          <>
            <button className="btn primary run__action" disabled={!allPlaced} onClick={() => run.play()}>
              {allPlaced ? 'BAŞLAT' : `${placed}/${run.slots.length} YERLEŞTİR`}
            </button>
            <div className="chip-row">
              <button className="btn small" onClick={run.autoFill} disabled={allPlaced}>
                Otomatik diz
              </button>
              <button className="btn small" onClick={run.clearSlots} disabled={placed === 0}>
                Ele al
              </button>
            </div>
            <label className="run__toggle muted">
              <input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} />
              Gelir tahmini {previewTotal !== null && <b className="gold">+{previewTotal}</b>}
            </label>
          </>
        )}
        {run.status === 'playing' && (
          <button className="btn primary run__action" onClick={skip}>
            ATLA
          </button>
        )}
        {run.status === 'roundDone' && (
          <button className="btn primary run__action" onClick={() => run.next()}>
            {run.roundIndex + 1 < run.plan.hands.length ? 'DEVAM ET' : 'GÜNÜ BİTİR'}
          </button>
        )}
        <div className="chip-row run__speed">
          <span className="muted">Hız</span>
          {([1, 2, 4] as Speed[]).map((s) => (
            <button key={s} className={`btn small ${speed === s ? 'active' : ''}`} onClick={() => setSpeed(s)}>
              x{s}
            </button>
          ))}
        </div>
      </aside>

      {run.status === 'dayDone' && <DaySummary onNext={leaveDay} />}
    </div>
  )
}

function DaySummary({ onNext }: { onNext: () => void }) {
  const go = useNav((s) => s.go)
  const run = useRun()
  const g = useGame()
  const day = g.days.at(-1)
  if (!day) return null
  const eff = day.total / Math.max(1, day.best)
  const avgPlan = day.rounds.reduce((a, r) => a + r.planningSec, 0) / day.rounds.length
  const w = run.weekResult
  return (
    <div className="overlay">
      <div className="overlay__panel overlay__panel--text panel run__summary">
        <h3>Gün bitti</h3>
        <div className="run__sumtotal">
          <b className="gold">+{day.total}</b>
          <span>
            Usta bot aynı ellerle: <b>+{day.best}</b> ·{' '}
            <span className={eff >= 0.95 ? 'good' : eff < 0.85 ? 'bad' : ''}>verim %{Math.round(eff * 100)}</span>
          </span>
        </div>
        <table className="run__table">
          <thead>
            <tr>
              <th>Tur</th>
              <th>Sen</th>
              <th>Usta</th>
              <th>%</th>
              <th>Planlama</th>
            </tr>
          </thead>
          <tbody>
            {day.rounds.map((r, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>+{r.total}</td>
                <td>+{r.best}</td>
                <td className={r.total >= r.best ? 'good' : ''}>{Math.round((r.total / Math.max(1, r.best)) * 100)}</td>
                <td>{r.planningSec} sn</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="muted">
          Gerçek süre: {Math.floor(day.seconds / 60)} dk {day.seconds % 60} sn · ortalama planlama {avgPlan.toFixed(1)} sn/tur
          (simülasyon varsayımı {content.economy.timing.planningSecPerRound} sn)
        </div>
        {w ? (
          <div className={`run__week ${w.passed ? 'good' : 'bad'}`}>
            Hafta {w.week + 1} bitti: {w.income.toLocaleString('tr-TR')} / {w.quota.toLocaleString('tr-TR')} —{' '}
            {w.passed ? 'Kota tuttu! Haftalık Standart paket kazanıldı.' : 'Kota tutmadı. Paket yok, kazanç bakiyede kalır.'}
          </div>
        ) : (
          <div>
            Haftalık kota ilerlemesi: <b>{g.weekIncome.toLocaleString('tr-TR')}</b>
          </div>
        )}
        <div className="chip-row" style={{ justifyContent: 'flex-end' }}>
          <button
            className="btn"
            onClick={() => {
              run.leave()
              go('menu')
            }}
          >
            Ana menü
          </button>
          <button className="btn primary" onClick={onNext}>
            SONRAKİ GÜN
          </button>
        </div>
      </div>
    </div>
  )
}
