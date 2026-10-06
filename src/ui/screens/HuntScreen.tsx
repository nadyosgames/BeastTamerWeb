import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { preyIntent, preyTraits, resolveHuntRound, upcomingIntents, type HuntEvent } from '../../core/hunt.ts'
import type { Intent } from '../../core/types.ts'
import { playerDeck } from '../../state/decks.ts'
import { useGame } from '../../state/game.ts'
import { useHunt } from '../../state/hunt.ts'
import { useNav } from '../../state/nav.ts'
import { artUrl } from '../art.ts'
import { content } from '../content.ts'
import { HowToPlay } from '../components/HowToPlay.tsx'
import { HpBar, IntentBadge, IntentIcon, PreyMedallion, TierBadge } from '../components/HuntBits.tsx'
import { WeatherIcon } from '../components/WeatherIcon.tsx'
import { HuntResult } from '../expedition/HuntResult.tsx'
import { intentName, intentText, traitName, traitText } from '../hunt.ts'
import { useHuntPlayback, type Speed } from '../playback/useRoundPlayback.ts'
import { Board, type SlotMark } from '../run/Board.tsx'
import { RoundLog } from '../run/RoundLog.tsx'
import { useStage } from '../stage-context.ts'
import { TutorialCoach, TutorialDone } from '../tutorial/TutorialCoach.tsx'
import { coachStep } from '../tutorial/flow.ts'
import { TUTORIAL } from '../tutorial/script.ts'
import './RunScreen.css'
import './HuntScreen.css'

/** Niyetin dizimde hedeflediği slotlar (slotun üstünde ikonla gösterilir). */
function slotMarks(intent: Intent, slots: number): (SlotMark | null)[] {
  const marks: (SlotMark | null)[] = Array.from({ length: slots }, () => null)
  if (intent.kind === 'rend' && intent.slot <= slots) marks[intent.slot - 1] = { kind: 'rend', label: '−1 dayanıklılık' }
  if (intent.kind === 'roar' && intent.slot <= slots) marks[intent.slot - 1] = { kind: 'roar', label: '1. geçişte uyur' }
  if (intent.kind === 'tailSweep') for (let i = 0; i < Math.min(intent.count, slots); i++) marks[slots - 1 - i] = { kind: 'tailSweep', label: '−1 dayanıklılık' }
  return marks
}

function actionText(a: Extract<HuntEvent, { t: 'preyAction' }>): string {
  switch (a.intent.kind) {
    case 'claw':
      return a.absorbed > 0
        ? `${a.attack} saldırı: Koruma ${a.absorbed} emdi, Tamer −${a.tamerDamage}.`
        : `${a.attack} saldırı: Tamer −${a.tamerDamage}.`
    case 'charge':
      return 'Şarj oldu: sonraki Pençe iki katı vurur.'
    case 'recover':
      return a.recovered > 0 ? `+${a.recovered} can toparladı.` : 'Toparlanmaya çalıştı ama canı zaten dolu.'
    case 'flee':
      return a.fled ? 'Kaçtı! Yeterince hasar almadı.' : 'Kaçmaya çalıştı ama kaçamadı.'
    default:
      return a.tamerDamage > 0 ? `Diken: Tamer −${a.tamerDamage}.` : 'Niyeti tur başında işledi.'
  }
}

/**
 * Av ekranı (GDD v0.8 "Av kuralları"): üstte yaratık (can, özellik, niyet), ortada slotlar, altta el.
 * BAŞLAT → av katmanının olay akışı oynatılır: vuruşlar yaratığın canını düşürür, Koruma birikir,
 * tur sonunda yaratık niyetini uygular. Bayılınca av biter; son tur biterse yaratık kaçar.
 */
export function HuntScreen() {
  const go = useNav((s) => s.go)
  const h = useHunt()
  const speed = useGame((s) => s.speed)
  const setSpeed = useGame((s) => s.setSpeed)
  const preview = useGame((s) => s.preview)
  const setPreview = useGame((s) => s.setPreview)
  const stage = useStage()
  const [guide, setGuide] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)

  useEffect(() => {
    if (h.status === 'idle') go(h.mode === 'tutorial' ? 'menu' : 'play')
  }, [h.status, h.mode, go])

  const { view, skip } = useHuntPlayback(h.arrangement, h.before, h.events, speed)
  const { playbackDone } = h
  useEffect(() => {
    if (view.done) playbackDone()
  }, [view.done, playbackDone])

  const allPlaced = h.slots.length > 0 && h.slots.every((k) => k !== null)
  const previewDamage = useMemo(() => {
    if (!preview || !h.before || h.status !== 'arrange' || !allPlaced) return null
    return resolveHuntRound(h.before, h.slots.map((k) => h.hand[k!])).result
  }, [preview, h.before, h.status, h.slots, h.hand, allPlaced])

  if (!h.before || !h.state) return null

  const before = h.before
  const arrange = h.status === 'arrange'
  const tutorial = h.mode === 'tutorial'
  const hunt = before.hunt
  const card = content.card(hunt.card)
  const intent = preyIntent(before)
  const charged = before.prey.charged
  const upcoming = upcomingIntents(before, 4).slice(1)
  const traits = preyTraits(hunt, before.prey.phase)
  const lesson = tutorial ? TUTORIAL[h.roundIndex] : undefined
  const slotIds = h.slots.map((k) => (k === null ? null : h.hand[k].id))
  const goalMet = !lesson || coachStep(lesson, slotIds).goalMet
  const focus = lesson?.focus ? h.hand.flatMap((c, k) => (lesson.focus!.includes(c.id) ? [k] : [])) : undefined
  const weather = content.weatherById.get(h.weatherId)
  const tamer = tutorial ? null : content.tamer(h.tamerId)
  const tamerMax = before.tamerMaxHp
  const deck = tutorial ? undefined : playerDeck(useGame.getState(), h.deckId)
  const record = h.rounds[h.roundIndex]
  const placed = h.slots.filter((k) => k !== null).length
  const preyHp = arrange ? before.prey.hp : view.preyHp
  const preyMax = arrange ? before.prey.maxHp : view.preyMax
  const tamerHp = arrange ? before.tamerHp : view.tamerHp
  const remaining = before.hands.slice(h.roundIndex + 1).reduce((a, x) => a + x.length, 0)
  const lastRound = h.roundIndex + 1 >= before.hands.length
  const ended = h.status === 'roundDone' && !!h.state.outcome

  const leave = () => {
    setConfirmLeave(false)
    if (tutorial) go('menu')
    h.abandon()
  }

  return (
    <div className={tutorial ? 'run hunt hunt--tutorial' : 'run hunt'}>
      <header className="run__top">
        <section className={`hunt__prey panel hunt__prey--${hunt.tier}`} aria-label="Av yaratığı">
          <motion.div key={view.preyPulse} className="hunt__medal" animate={view.preyPulse && !arrange ? { x: [0, -12, 9, -5, 0], rotate: [0, -4, 3, 0] } : {}} transition={{ duration: 0.35 }}>
            <PreyMedallion hunt={hunt} size={136} />
            {view.down && !arrange && (
              <motion.span className="hunt__stamp" initial={{ scale: 1.5, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 1, rotate: -14 }} transition={{ type: 'spring', stiffness: 300, damping: 15 }}>
                BAYILDI
              </motion.span>
            )}
          </motion.div>
          <div className="hunt__preybody">
            <div className="hunt__preyname">
              <h2>{card.name}</h2>
              <TierBadge tier={hunt.tier} />
            </div>
            <HpBar value={preyHp} max={preyMax} kind="prey" size="lg" ghost={arrange ? undefined : Math.max(before.prey.hp, preyHp)} label={`${card.name} canı`} />
            <div className="hunt__chips">
              {traits.map((t, i) => <span key={i} className="hunt__chip" title={traitText(t)}>{traitName(t)}</span>)}
              {before.prey.phase > 0 && <span className="hunt__chip hunt__chip--phase">Faz {before.prey.phase + 1}</span>}
              {(view.revived || before.prey.revived) && <span className="hunt__chip hunt__chip--phase">İkinci can</span>}
              {weather && (
                <span className="hunt__chip hunt__chip--weather" title={weather.text}>
                  <WeatherIcon icon={weather.icon} size={26} /> {weather.name}
                </span>
              )}
              {tutorial && <span className="hunt__chip">Eğitim · hava ve Tamer etkisi yok</span>}
            </div>
          </div>
          <AnimatePresence>
            {!arrange && view.preyPulse > 0 && (
              <motion.span key={view.preyPulse} className="hunt__dmg" initial={{ opacity: 0, y: 6, scale: 0.6 }} animate={{ opacity: 1, y: -26, scale: 1 }} exit={{ opacity: 0, y: -46 }} transition={{ duration: 0.3 }}>
                −{view.lastDamage}
              </motion.span>
            )}
          </AnimatePresence>
        </section>

        <div className="run__round panel">
          <small>TUR</small>
          <b>
            {h.roundIndex + 1}/{before.hands.length}
          </b>
          <small>GEÇİŞ {view.pass || '–'}</small>
        </div>

        <div className="hunt__score panel" aria-label="Bu tur">
          <small>BU TUR</small>
          <div>
            <span title="Yaratığa işleyen hasar">⚔ <b>{arrange ? (previewDamage?.damage ?? '–') : view.damage}</b></span>
            <span title="Koruma: tur sonundaki saldırıyı emer">🛡 <b>{arrange ? (previewDamage?.guard ?? '–') : view.guard}</b></span>
          </div>
          {view.heat > 0 && !arrange && <small>Isı {view.heat}</small>}
        </div>

        <section className={`hunt__intent panel ${!arrange && view.action ? 'is-acting' : ''}`} aria-label="Yaratığın niyeti">
          <small>{arrange || !view.action ? 'YARATIĞIN NİYETİ' : 'YARATIĞIN HAMLESİ'}</small>
          <div className="hunt__intenthead">
            <IntentIcon kind={intent.kind} size={72} />
            <b>{intent.kind === 'claw' && charged ? `Pençe ${intent.damage * 2}` : intentName(intent)}</b>
          </div>
          <p>{!arrange && view.action ? actionText(view.action) : view.down && !arrange ? 'Bayıldığı için niyetini uygulayamadı.' : intentText(intent, charged)}</p>
          {!lastRound && (
            <div className="hunt__next">
              <span>Sonra</span>
              {upcoming.map((it, i) => <IntentBadge key={i} intent={it} compact size={34} />)}
            </div>
          )}
        </section>

        <button className="btn small run__help" aria-label="Nasıl oynanır" title="Nasıl oynanır" onClick={() => setGuide(true)}>
          ?
        </button>
      </header>

      <Board
        stageW={stage.width}
        stageH={stage.height}
        scale={stage.scale}
        round={h.roundIndex}
        status={h.status}
        hand={h.hand}
        slots={h.slots}
        view={view}
        focus={focus}
        marks={slotMarks(intent, h.slots.length)}
        bubble={(v) => v.note ?? (v.income ? `⚔${v.income}` : null)}
        slotTotal={(v) => `⚔${v.dealt}`}
        onPlace={h.place}
        onUnplace={h.unplace}
      />

      <AnimatePresence>
        {!arrange && view.phaseText && (
          <motion.div className="hunt__banner" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <b>YENİ FAZ</b> {view.phaseText}
          </motion.div>
        )}
        {!arrange && view.revived && !before.prey.revived && (
          <motion.div className="hunt__banner hunt__banner--revive" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <b>KÜLLERİNDEN DOĞDU</b> İkinci can çubuğu: {view.preyMax}
          </motion.div>
        )}
      </AnimatePresence>

      {!arrange && (
        <section className="run__center">
          <div className="run__result panel">
            {h.status === 'roundDone' && record ? (
              <>
                <div className="run__resultline">
                  Bu tur <b className="gold">⚔{record.damage}</b> · En iyi dizilim <b>⚔{record.best}</b>{' '}
                  <span className={record.damage >= record.best ? 'good' : 'bad'}>({Math.round((record.damage / Math.max(1, record.best)) * 100)}%)</span>
                </div>
                {record.result.captured ? (
                  <div className="run__best good">Yaratık bayıldı! {lastRound ? '' : `${before.hands.length - h.roundIndex - 1} tur erken: hız bonusu.`}</div>
                ) : record.damage < record.best ? (
                  <div className="run__best">En iyisi: {record.bestArrangement.map((id) => content.card(id).name).join(' → ')}</div>
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
            <RoundLog view={view} cards={h.arrangement} />
          </div>
        </section>
      )}

      <motion.aside key={view.tamerPulse} className="run__who hunt__tamer panel" animate={view.tamerPulse && !arrange ? { x: [0, -10, 8, -4, 0] } : {}} transition={{ duration: 0.35 }}>
        {tamer && artUrl('tamers', tamer.id, true) && <img className="run__portrait" src={artUrl('tamers', tamer.id, true)!} alt={tamer.name} />}
        <b>{tamer?.name ?? 'Tamer'}</b>
        <HpBar value={tamerHp} max={tamerMax} kind="tamer" label="Tamer'ın canı" />
        <span className="hunt__tamerline">
          {!arrange && view.guard > 0 && <span className="hunt__guard">🛡 {view.guard} Koruma</span>}
          {deck ? <>{deck.name} · destede <b>{remaining}</b> kart</> : <>Eğitim eli</>}
        </span>
      </motion.aside>

      {tutorial && <TutorialCoach status={h.status} roundIndex={h.roundIndex} ids={slotIds} />}

      <aside className="run__controls panel">
        {arrange && (
          <>
            <button className="btn primary run__action" disabled={!allPlaced || !goalMet} onClick={() => h.play()}>
              {!allPlaced ? `${placed}/${h.slots.length} YERLEŞTİR` : goalMet ? 'BAŞLAT' : 'SIRAYI DÜZELT'}
            </button>
            <div className="chip-row">
              {!tutorial && (
                <button className="btn small" onClick={h.autoFill} disabled={allPlaced}>
                  Otomatik diz
                </button>
              )}
              <button className="btn small" onClick={h.clearSlots} disabled={placed === 0}>
                Ele al
              </button>
            </div>
            <label className="run__toggle muted">
              <input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} />
              Hasar tahmini {previewDamage && <b className="gold">⚔{previewDamage.damage}{previewDamage.captured ? ' · bayıltır' : ''}</b>}
            </label>
          </>
        )}
        {h.status === 'playing' && (
          <button className="btn primary run__action" onClick={skip}>
            ATLA
          </button>
        )}
        {h.status === 'roundDone' && (
          <button className="btn primary run__action" onClick={() => h.next()}>
            {ended ? (tutorial ? 'EĞİTİMİ BİTİR' : 'AVI BİTİR') : 'DEVAM ET'}
          </button>
        )}
        <div className="chip-row run__speed">
          <span className="muted">Hız</span>
          {([1, 2, 4] as Speed[]).map((s) => (
            <button key={s} className={`btn small ${speed === s ? 'active' : ''}`} onClick={() => setSpeed(s)}>
              x{s}
            </button>
          ))}
          <button className="btn small hunt__leave" onClick={() => setConfirmLeave(true)} disabled={h.status === 'playing' || h.status === 'huntDone'}>
            {tutorial ? 'Çık' : 'Çekil'}
          </button>
        </div>
      </aside>

      {confirmLeave && (
        <div className="overlay" onClick={() => setConfirmLeave(false)}>
          <section role="dialog" aria-modal="true" aria-label="Avdan çekil" className="overlay__panel overlay__panel--text panel" onClick={(e) => e.stopPropagation()}>
            <h3>{tutorial ? 'EĞİTİMDEN ÇIK' : 'AVDAN ÇEKİL'}</h3>
            <p>{tutorial ? 'Ana menüdeki "Nasıl oynanır" ile eğitimi yeniden başlatabilirsin.' : 'Çekilirsen yaratık kaçmış sayılır: verdiğin hasarın bir kısmı bu seferde kalır ama seri bozulur ve bir gün geçer.'}</p>
            <div className="chip-row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setConfirmLeave(false)}>VAZGEÇ</button>
              <button className="btn primary" onClick={leave}>{tutorial ? 'ÇIK' : 'ÇEKİL'}</button>
            </div>
          </section>
        </div>
      )}
      {h.status === 'huntDone' &&
        (tutorial ? (
          <TutorialDone onGuide={() => setGuide(true)} />
        ) : (
          h.summary && (
            <HuntResult
              summary={h.summary}
              damage={h.state.damageDealt}
              tamerHp={useGame.getState().expedition?.tamerHp ?? null}
              tamerMax={tamerMax}
              rounds={h.rounds.slice(0, h.state.round).map((r) => ({ intent: r.intent, damage: r.damage, best: r.best, guard: r.guard }))}
              onClose={() => {
                h.leave()
                go('play')
              }}
            />
          )
        ))}
      {guide && <HowToPlay onClose={() => setGuide(false)} />}
    </div>
  )
}
