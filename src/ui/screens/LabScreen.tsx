import { useMemo, useState } from 'react'
import { content } from '../../content/index.ts'
import type { RoundEvent } from '../../core/engine/events.ts'
import { compileModifiers } from '../../core/engine/modifiers.ts'
import { resolveRound } from '../../core/engine/round.ts'
import type { RoundContext } from '../../core/engine/state.ts'
import { createRng, shuffle } from '../../core/rng.ts'
import type { CardDef } from '../../core/types.ts'
import { masterArranger } from '../../sim/arrangers.ts'
import { useNav } from '../../state/nav.ts'
import { CardView } from '../components/CardView.tsx'
import { useRoundPlayback, type Speed } from '../playback/useRoundPlayback.ts'
import './LabScreen.css'

/**
 * Tur Laboratuvarı: kartları diz, motoru çalıştır, olayları izle ve aynı eli usta botun
 * en iyi dizilimiyle karşılaştır. "Dizmek eğlenceli mi / bir karar mı?" sorusunun
 * en hızlı el testi. Tüm hesap core motorundan gelir; ekran yalnızca olayları oynatır.
 */
const GDD_EXAMPLE = ['spark_fox', 'coral_turtle', 'stone_golem', 'charge_bat', 'cloud_owl']
const ROUND_OPTIONS = [
  { label: 'İlk tur', index: 0 },
  { label: 'Ara tur', index: 2 },
  { label: 'Son tur', index: 5 },
]

export function LabScreen() {
  const go = useNav((s) => s.go)
  const [tamerId, setTamerId] = useState(content.starter.tamer)
  const tamer = content.tamer(tamerId)
  const [weatherId, setWeatherId] = useState('calm')
  const [roundIndex, setRoundIndex] = useState(2)
  const [slots, setSlots] = useState<(CardDef | null)[]>(() => padTo(GDD_EXAMPLE.map((id) => content.card(id)), tamer.slots))
  const [selected, setSelected] = useState<number | null>(null)
  const [speed, setSpeed] = useState<Speed>(1)
  const [run, setRun] = useState<{ cards: CardDef[]; events: RoundEvent[] } | null>(null)

  const hand = useMemo(() => slots.filter((c): c is CardDef => c !== null), [slots])
  const ctx: RoundContext = useMemo(
    () => ({
      mods: compileModifiers({ weather: content.weatherById.get(weatherId), tamer }),
      roundIndex,
      roundCount: 6,
      triggerCap: 60,
    }),
    [weatherId, tamer, roundIndex],
  )
  const current = useMemo(() => (hand.length ? resolveRound(hand, ctx).total : 0), [hand, ctx])
  const best = useMemo(() => {
    if (!hand.length) return { total: 0, order: [] as CardDef[] }
    const order = masterArranger(hand, ctx)
    return { total: resolveRound(order, ctx).total, order }
  }, [hand, ctx])

  const shown = run?.cards ?? hand
  const { view, skip, playing } = useRoundPlayback(shown, run?.events ?? null, speed)

  const edit = (next: (CardDef | null)[]) => {
    setRun(null)
    setSelected(null)
    setSlots(next)
  }
  const changeTamer = (id: string) => {
    setTamerId(id)
    edit(padTo(hand, content.tamer(id).slots))
  }
  const start = () => {
    const events: RoundEvent[] = []
    resolveRound(hand, ctx, (e) => events.push(e))
    setRun({ cards: hand, events })
  }
  const clickSlot = (i: number) => {
    if (playing) return
    if (selected === null) return setSelected(slots[i] ? i : null)
    if (selected === i) return setSelected(null)
    const next = slots.slice()
    ;[next[selected], next[i]] = [next[i], next[selected]]
    edit(next)
  }
  const removeSlot = (i: number) => {
    const next = slots.slice()
    next[i] = null
    edit(next)
  }
  const addCard = (c: CardDef) => {
    const i = slots.indexOf(null)
    if (i < 0) return
    const next = slots.slice()
    next[i] = c
    edit(next)
  }
  const randomHand = () => {
    const rng = createRng(Date.now() >>> 0)
    edit(padTo(shuffle(content.cards, rng).slice(0, tamer.slots), tamer.slots))
  }

  const gap = best.total > 0 ? Math.round((1 - current / best.total) * 100) : 0
  const idle = !run

  return (
    <div className="lab">
      <header className="lab__top">
        <button className="btn small" onClick={() => go('menu')}>
          ← GERİ
        </button>
        <h2>TUR LABORATUVARI</h2>
        <div className="chip-row">
          {content.weather.map((w) => (
            <button
              key={w.id}
              className={`btn small ${w.id === weatherId ? 'active' : ''}`}
              title={w.text}
              onClick={() => {
                setWeatherId(w.id)
                setRun(null)
              }}
            >
              {w.name}
            </button>
          ))}
        </div>
      </header>

      <div className="lab__sub">
        <label>
          Tamer{' '}
          <select value={tamerId} onChange={(e) => changeTamer(e.target.value)}>
            {content.tamers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.slots} slot)
              </option>
            ))}
          </select>
        </label>
        <span className="muted">{tamer.text}</span>
        <div className="chip-row" style={{ marginLeft: 'auto' }}>
          {ROUND_OPTIONS.map((r) => (
            <button
              key={r.index}
              className={`btn small ${roundIndex === r.index ? 'active' : ''}`}
              onClick={() => {
                setRoundIndex(r.index)
                setRun(null)
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <section className="lab__board">
        <div className="lab__hud panel">
          <div>
            <small>GEÇİŞ</small>
            <b>{view.pass || '–'}</b>
          </div>
          <div>
            <small>TOPLAM</small>
            <b className="gold">{run ? view.total : current}</b>
          </div>
          <div>
            <small>ISI</small>
            <b>{view.heat}</b>
          </div>
        </div>
        <div className="lab__slots">
          {(run ? run.cards : slots).map((c, i) =>
            c ? (
              <div key={i} className={`lab__slot ${selected === i ? 'is-selected' : ''}`}>
                <div className="lab__slotnum">{i + 1}</div>
                <CardView
                  card={c}
                  durability={run ? view.slots[i]?.durability : undefined}
                  passive={run ? view.slots[i]?.passive : false}
                  ward={run ? view.slots[i]?.ward : undefined}
                  active={run ? view.active === i : selected === i}
                  income={run ? view.slots[i]?.income : null}
                  pulse={view.slots[i]?.pulse}
                  onClick={idle ? () => clickSlot(i) : undefined}
                />
                {idle && (
                  <button className="lab__remove" onClick={() => removeSlot(i)} title="Çıkar">
                    ×
                  </button>
                )}
                {run && <div className="lab__slottotal">{view.slots[i]?.total ?? 0}</div>}
              </div>
            ) : (
              <div key={i} className="lab__slot lab__slot--empty" onClick={() => clickSlot(i)}>
                <div className="lab__slotnum">{i + 1}</div>
                <span>boş slot</span>
              </div>
            ),
          )}
        </div>
      </section>

      <section className="lab__controls">
        <button className="btn primary" disabled={!hand.length || playing} onClick={start}>
          {run ? 'TEKRAR OYNAT' : 'BAŞLAT'}
        </button>
        <div className="chip-row">
          {([1, 2, 4] as Speed[]).map((s) => (
            <button key={s} className={`btn small ${speed === s ? 'active' : ''}`} onClick={() => setSpeed(s)}>
              x{s}
            </button>
          ))}
          <button className="btn small" disabled={!playing} onClick={skip}>
            ATLA
          </button>
        </div>
        <div className="lab__verdict">
          Bu dizilim <b>{current}</b> · En iyi dizilim <b className="gold">{best.total}</b>
          {gap > 0 ? <span className="bad"> (−%{gap})</span> : hand.length ? <span className="good"> ✓ en iyisi</span> : null}
        </div>
        <div className="chip-row">
          <button className="btn small" disabled={!hand.length || gap === 0} onClick={() => edit(padTo(best.order, tamer.slots))}>
            Usta diz
          </button>
          <button className="btn small" onClick={randomHand}>
            Rastgele el
          </button>
          <button className="btn small" onClick={() => edit(padTo(GDD_EXAMPLE.map((id) => content.card(id)), tamer.slots))}>
            GDD örneği
          </button>
          <button className="btn small" onClick={() => edit(padTo([], tamer.slots))}>
            Temizle
          </button>
        </div>
      </section>

      <section className="lab__pool panel scroll">
        {content.cards.map((c) => (
          <CardView key={c.id} card={c} size="sm" onClick={() => addCard(c)} />
        ))}
      </section>

      <aside className="lab__log panel scroll">
        {view.passTotals.length > 0 && (
          <div className="lab__passes">
            {view.passTotals.map((t, i) => (
              <span key={i}>
                G{i + 1}: <b>{t}</b>
              </span>
            ))}
          </div>
        )}
        {view.log.length ? (
          view.log.map((l, i) => <div key={i}>{l}</div>)
        ) : (
          <div className="muted">
            Havuzdan kart tıkla → slota eklenir. Slottaki iki kartı sırayla tıkla → yer değiştirir. Başlat ile motorun olay
            akışını izle; olay kaydı burada.
          </div>
        )}
      </aside>
    </div>
  )
}

function padTo(cards: readonly CardDef[], n: number): (CardDef | null)[] {
  const out: (CardDef | null)[] = cards.slice(0, n)
  while (out.length < n) out.push(null)
  return out
}
