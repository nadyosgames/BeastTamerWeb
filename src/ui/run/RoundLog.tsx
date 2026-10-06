import { useEffect, useRef, type ReactNode } from 'react'
import type { CardDef } from '../../core/types.ts'
import { intentName } from '../hunt.ts'
import { BLOCK_LABEL, type LogEntry, type RoundView } from '../playback/roundView.ts'
import './RoundLog.css'

/**
 * Turun okunur olay kaydı. Kronolojik akar, her geçiş kendi başlığı ve toplamıyla gruplanır,
 * son satıra kendiliğinden kayar. Kart adları element rengiyle, yetenekler anahtar kelime rengiyle yazılır.
 */
const ON_LABEL: Record<string, string> = {
  harvest: 'Strike',
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
            {e.hit && (
              <span className={`rlog__hit ${e.hit.damage ? '' : 'is-zero'}`} title="Yaratığa işleyen hasar">
                ⚔ {e.hit.damage}
                {e.hit.blocked && <i> ({BLOCK_LABEL[e.hit.blocked].toLocaleLowerCase('tr-TR')})</i>}
              </span>
            )}
            {e.guard ? <span className="rlog__guard" title="Koruma: tur sonundaki saldırıyı emer">+{e.guard} Koruma</span> : null}
            {e.cost && <span className="rlog__cost" title="Tetik dayanıklılık harcadı">🛡 {e.cost.from}→{e.cost.to}</span>}
          </div>
        )
      }
      case 'action':
        return (
          <div key={key} className="rlog__action">
            <b>Yaratık: {intentName(e.intent)}</b>
            {e.attack > 0 && <span> · saldırı {e.attack}{e.absorbed ? `, Koruma ${e.absorbed} emdi` : ''} → <b className="rlog__neg">Tamer −{e.tamerDamage}</b></span>}
            {e.recovered > 0 && <span> · <b className="rlog__neg">+{e.recovered} can</b></span>}
            {e.intent.kind === 'charge' && <span> · sonraki Pençe iki katı</span>}
            {e.fled && <span> · <b className="rlog__neg">kaçtı!</b></span>}
          </div>
        )
      case 'prey':
        return (
          <div key={key} className={`rlog__action rlog__action--${e.what}`}>
            {e.what === 'down' && <b>Yaratık bayıldı! Tur burada biter.</b>}
            {e.what === 'revive' && <b>Yaratık küllerinden doğdu: {e.hp} can.</b>}
            {e.what === 'phase' && <><b>Yeni faz:</b> {e.text}</>}
          </div>
        )
      case 'huntEnd':
        return (
          <div key={key} className="rlog__end">
            Tur bitti: <b>⚔ {e.damage}</b> hasar{e.guard ? ` · 🛡 ${e.guard} Koruma` : ''}
          </div>
        )
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
              {e.what === 'slumber' && 'Kükreme ile uyudu (ilk geçişte vurmaz)'}
            </span>
          </div>
        )
      case 'cap':
        return <div key={key} className="rlog__row rlog__status rlog__status--exhausted">Tetik sınırı aşıldı, tur kapandı</div>
      case 'end':
        return (
          <div key={key} className="rlog__end">
            Tur bitti: <b>+{e.total}</b> hasar · {e.triggers} tetik · {e.passes} geçiş
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
