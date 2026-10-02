import { useEffect, useRef, type ReactNode } from 'react'
import type { CardDef } from '../../core/types.ts'
import type { LogEntry, RoundView } from '../playback/roundView.ts'
import './RoundLog.css'

/**
 * Turun okunur olay kaydı. Kronolojik akar, her geçiş kendi başlığı ve toplamıyla gruplanır,
 * son satıra kendiliğinden kayar. Kart adları element rengiyle, yetenekler anahtar kelime rengiyle yazılır.
 */
const ON_LABEL: Record<string, string> = {
  harvest: 'Harvest',
  howl: 'Howl',
  lastBreath: 'Last Breath',
  epilogue: 'Epilogue',
  haunt: 'Haunt',
  retrigger: 'Ek tetik',
  aura: 'Aura',
}

const fmt = (n: number) => String(+n.toFixed(2)).replace('.', ',')

export function RoundLog({ view, cards, empty }: { view: Pick<RoundView, 'log' | 'passTotals'>; cards: readonly CardDef[]; empty?: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = box.current
    if (el) el.scrollTop = el.scrollHeight
  }, [view.log.length])

  const card = (i: number | null) => {
    const c = i == null ? null : cards[i]
    if (!c) return <span className="rlog__card">#{(i ?? 0) + 1}</span>
    return <span className="rlog__card" style={{ ['--el' as string]: `var(--${c.elements[0]})` }}>{c.name}</span>
  }

  const row = (e: LogEntry, key: number): ReactNode => {
    switch (e.k) {
      case 'section':
        return (
          <div key={key} className="rlog__section">
            <span>{e.pass === 0 ? 'Tur başı' : `Geçiş ${e.pass}`}</span>
            {e.pass > 0 && view.passTotals[e.pass - 1] != null && <b>+{view.passTotals[e.pass - 1]}</b>}
          </div>
        )
      case 'ability': {
        const d = e.detail
        const hasIncome = e.income !== 0 || d.flat !== 0 || e.on === 'harvest'
        return (
          <div key={key} className="rlog__row">
            {card(e.slot)}
            <span className={`rlog__kw rlog__kw--${e.on}`}>{ON_LABEL[e.on]}</span>
            {hasIncome && <span className={`rlog__income ${e.income ? '' : 'is-zero'}`}>+{e.income}</span>}
            {hasIncome && (
              <span className="rlog__why">
                {fmt(d.flat)} taban
                {d.mult !== 1 && <> × <i className="rlog__mult">{fmt(d.mult)}</i></>}
                {d.copied !== 0 && <> + {fmt(d.copied)} kopya</>}
                {d.scale !== 1 && <> × {fmt(d.scale)} yetenek</>}
                {d.global !== 1 && <> × <i className={d.global < 1 ? 'rlog__neg' : 'rlog__pos'}>{fmt(d.global)}</i> hava/Tamer</>}
              </span>
            )}
            {e.cost && <span className="rlog__cost" title="Tetik dayanıklılık harcadı">🛡 {e.cost.from}→{e.cost.to}</span>}
          </div>
        )
      }
      case 'durability': {
        const gain = e.to > e.from
        return (
          <div key={key} className="rlog__row rlog__sub">
            <span className="rlog__arrow">↳</span>
            {card(e.slot)}
            <span className={gain ? 'rlog__dur-up' : 'rlog__dur-down'}>
              🛡 {e.from}→{e.to} ({gain ? '+' : '−'}{Math.abs(e.to - e.from)} dayanıklılık)
            </span>
            {e.by != null ? <span className="rlog__by">kaynak: {card(e.by)}</span> : e.source === 'start' && <span className="rlog__by">tur başı etkisi</span>}
          </div>
        )
      }
      case 'heat':
        return (
          <div key={key} className="rlog__row rlog__sub">
            <span className="rlog__arrow">↳</span>
            <span className="rlog__heat">🔥 masadaki Isı {e.value}</span>
            {e.by != null && <span className="rlog__by">kaynak: {card(e.by)}</span>}
          </div>
        )
      case 'status':
        return (
          <div key={key} className={`rlog__row rlog__status rlog__status--${e.what}`}>
            {card(e.slot)}
            <span>
              {e.what === 'exhausted' && 'pasife geçti (dayanıklılık bitti)'}
              {e.what === 'ward' && <><b className="rlog__kw">Ward</b> dayanıklılık kaybını engelledi</>}
              {e.what === 'rebirth' && <><b className="rlog__kw">Rebirth</b> ile 1 dayanıklılıkla döndü</>}
              {e.what === 'reactivated' && 'yeniden aktif'}
            </span>
          </div>
        )
      case 'cap':
        return <div key={key} className="rlog__row rlog__status rlog__status--exhausted">Tetik sınırı aşıldı, tur kapandı</div>
      case 'end':
        return (
          <div key={key} className="rlog__end">
            Tur bitti: <b>+{e.total}</b> kaynak · {e.triggers} tetik · {e.passes} geçiş
          </div>
        )
    }
  }

  return (
    <div ref={box} className="rlog scroll">
      {view.log.length ? view.log.map(row) : empty}
    </div>
  )
}
