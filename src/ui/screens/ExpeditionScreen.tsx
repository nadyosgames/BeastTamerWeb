import { useEffect, useMemo, useState } from 'react'
import { huntWeather } from '../../core/expedition.ts'
import { ELEMENTS } from '../../core/types.ts'
import { playerDeck, playerDeckCards, playerDecks, playerDeckStatus } from '../../state/decks.ts'
import {
  capturedSet,
  forecast,
  huntAvailability,
  huntStartHp,
  regionBookDone,
  regionOpen,
  regionUnlockText,
  useGame,
  type HuntSummary,
} from '../../state/game.ts'
import { quickHunt, useHunt } from '../../state/hunt.ts'
import { useNav } from '../../state/nav.ts'
import { artUrl } from '../art.ts'
import { content } from '../content.ts'
import { ElementIcon } from '../components/ElementIcon.tsx'
import { GameIcon } from '../components/GameIcon.tsx'
import { HpBar, IntentBadge, PreyMedallion, TierBadge } from '../components/HuntBits.tsx'
import { HowToPlay } from '../components/HowToPlay.tsx'
import { IllustratedHeader } from '../components/IllustratedHeader.tsx'
import { WeatherIcon } from '../components/WeatherIcon.tsx'
import { HuntResult } from '../expedition/HuntResult.tsx'
import { RegionCard } from '../expedition/RegionCard.tsx'
import { WorldMap, type MapNodeState, type MapSelection, type RegionState } from '../expedition/WorldMap.tsx'
import { huntName, STARS, TIER_TEXT, traitName, traitText, weatherName } from '../hunt.ts'
import { ELEMENT_LABEL } from '../labels.ts'
import { useStage } from '../stage-context.ts'
import { deckWeatherPct, elementCounts } from '../weather.ts'
import './ExpeditionScreen.css'

const DAY_LABEL = ['BUGÜN', 'YARIN', '+2 GÜN', '+3 GÜN', '+4 GÜN']
const TYPE_NAME: Record<string, string> = { beast: 'Beast', ghost: 'Ghost', golem: 'Golem', dragon: 'Dragon', flora: 'Flora', swarm: 'Swarm', avian: 'Avian', serpent: 'Serpent', neutral: 'Nötr' }

/**
 * Sefer ve dünya haritası (GDD v0.9 "Dünya ve biyomlar"): kamptan odaktaki bölgeye sefere çıkılır,
 * seferde her gün bir yaratık avlanır, dinlenilir ya da kampa dönülür. Hava bölgeye özgüdür ve 5 gün
 * önceden görünür; Tamer'ın canı, Erzak, İz ve çanta seferin durumudur. Bölgeler Finalleriyle açılır.
 */
export function ExpeditionScreen() {
  const stage = useStage()
  const go = useNav((s) => s.go)
  const g = useGame()
  const startHunt = useHunt((s) => s.startHunt)
  const exp = g.expedition
  const region = content.region(exp?.region ?? g.regionId)
  const hunts = content.regionHunts(region.id)
  const days = forecast(g, region.id, 5)
  const today = days[0]
  const captured = capturedSet(g)
  const isLocked = (h: (typeof hunts)[number]) => {
    const a = huntAvailability(g, h)
    return !a.ok && (a.reason === 'locked' || a.reason === 'regionLocked')
  }
  const [selection, setSelection] = useState<MapSelection | null>(null)
  // Haritanın kaydığı bölge: seferin bölgesi; kamptayken son bakılan yer (düğüme tıklamak haritayı kaydırmaz).
  const [anchor, setAnchor] = useState(region.id)
  const expRegion = exp?.region
  useEffect(() => {
    if (expRegion) setAnchor(expRegion)
  }, [expRegion])
  const [feedback, setFeedback] = useState('')
  const [quick, setQuick] = useState<{ summary: HuntSummary; damage: number } | null>(null)
  const [confirm, setConfirm] = useState<'rest' | 'camp' | null>(null)
  const [guide, setGuide] = useState(false)

  const nodes: MapNodeState[] = content.hunts.map((hunt) => {
    const avail = huntAvailability(g, hunt)
    const status: MapNodeState['status'] = avail.ok
      ? 'open'
      : avail.reason === 'locked' || avail.reason === 'regionLocked'
        ? 'locked'
        : avail.reason === 'notToday'
          ? 'notToday'
          : avail.reason === 'elsewhere'
            ? 'elsewhere'
            : 'camp'
    const rec = g.hunts[hunt.id]
    return {
      hunt,
      status,
      stars: rec?.stars ?? 0,
      captured: captured.has(hunt.id),
      wounded: exp?.wounded[hunt.id] !== undefined,
      siege: exp?.siege?.hunt === hunt.id,
    }
  })
  const unlockSig = content.regions.map((r) => (regionOpen(g, r.id) ? '1' : '0')).join('')
  const regionStates: RegionState[] = useMemo(
    () =>
      content.regions.map((r) => {
        const rh = content.regionHunts(r.id)
        const fin = content.regionFinal(r.id)
        return {
          region: r,
          unlocked: regionOpen(g, r.id),
          captured: rh.filter((h) => captured.has(h.id)).length,
          total: rh.length,
          book: regionBookDone(g, r.id),
          final: !!fin && captured.has(fin.id),
          active: exp?.region === r.id,
          unlockText: regionUnlockText(r),
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [unlockSig, captured.size, exp?.region, g.sandbox],
  )
  const regionNodes = nodes.filter((n) => n.hunt.region === region.id)
  const fallback = regionNodes.find((n) => n.status === 'open' && !n.captured) ?? regionNodes.find((n) => n.status === 'open') ?? regionNodes.find((n) => n.status !== 'locked') ?? regionNodes[0]
  const showRegion = selection?.kind === 'region' || (!selection && !regionOpen(g, region.id))
  const shownRegion = regionStates.find((r) => r.region.id === (selection?.kind === 'region' ? selection.id : region.id))!
  const current = nodes.find((n) => selection?.kind === 'hunt' && n.hunt.id === selection.id) ?? fallback
  const select = (sel: MapSelection) => {
    setSelection(sel)
    if (!exp) g.setRegion(sel.kind === 'hunt' ? content.hunt(sel.id).region : sel.id)
  }
  const hunt = current.hunt
  const card = content.card(hunt.card)
  // Toparlanma ve Kaçış eşiği kalibre cana göre gösterilir (oyunda oynanan değerler).
  const shown = content.scaledHunt(hunt.id)
  const avail = huntAvailability(g, hunt)
  const sefTamer = content.tamer(exp?.tamer ?? g.tamerId)
  const usableDecks = playerDecks(g).filter((d) => d.tamer === sefTamer.id)
  const activeDeck = playerDeck(g, g.deckId)
  const deckOk = playerDeckStatus(g, g.deckId)
  const siege = exp?.siege?.hunt === hunt.id ? exp.siege : null
  const huntDay = huntWeather(hunt, today, siege?.day ?? 0)
  const weather = content.weatherById.get(huntDay)
  const startHp = huntStartHp(g, hunt)
  const maxHp = content.huntHp(hunt.id)
  const record = g.hunts[hunt.id]
  const secret = current.status === 'locked' && (hunt.tier === 'legendary' || hunt.tier === 'ancient')
  const fit = deckWeatherPct(playerDeckCards(g, g.deckId), weather)
  const deckBlocked = !!(hunt.siege && siege?.decks.includes(g.deckId))
  const wrongTamer = !!exp && activeDeck?.tamer !== exp.tamer

  const mapW = stage.width - 450 - 600 - 12
  const mapH = stage.height - 356 - 40 - 12
  const regionReady = regionOpen(g, region.id)

  const flash = (msg: string) => {
    setFeedback(msg)
    window.setTimeout(() => setFeedback((f) => (f === msg ? '' : f)), 3200)
  }
  const begin = () => {
    const err = startHunt(hunt.id)
    if (err) flash(err)
    else go('run')
  }
  const doQuick = () => {
    const r = quickHunt(hunt.id)
    if (typeof r === 'string') flash(r)
    else setQuick({ summary: r, damage: useGame.getState().logs.at(-1)?.damage ?? 0 })
  }
  const doRest = () => {
    setConfirm(null)
    const before = useGame.getState().expedition?.tamerHp ?? 0
    if (!useGame.getState().rest()) return
    const healed = (useGame.getState().expedition?.tamerHp ?? 0) - before
    flash(`Dinlendin: Tamer +${healed} can kazandı, bir gün geçti.`)
  }
  const startTrip = () => {
    if (!useGame.getState().startExpedition()) return
    setSelection(null)
    flash(`${sefTamer.name} ${region.name} seferine çıktı. ${content.economy.expedition.rations} Erzak yanında.`)
  }
  const doCamp = () => {
    setConfirm(null)
    const banked = useGame.getState().returnToCamp()
    flash(`Kampa döndün. Çantadaki ${banked} öz bakiyene geçti.`)
  }

  return (
    <div className="exp">
      <IllustratedHeader title={region.name.toLocaleUpperCase('tr-TR')} resource={g.essence} resourceLabel="Öz bakiyesi">
        <button className="btn" onClick={() => go('menu')}>⬅ GERİ</button>
      </IllustratedHeader>
      <div className="exp__day">
        <b>GÜN {g.day + 1}</b>
        <span>{exp ? `Seferin ${g.day - exp.startedDay + 1}. günü` : 'Kamptasın'}</span>
      </div>

      <section className="exp__forecast" aria-label="5 günlük hava tahmini">
        {days.map((id, i) => {
          const w = content.weatherById.get(id)
          const appearing = hunts.filter((h) => h.appearsIn?.includes(id) && !isLocked(h))
          return (
            <div key={i} className={`exp__fday panel ${i === 0 ? 'is-today' : ''}`}>
              <small>{DAY_LABEL[i]}</small>
              <div className="exp__fbody">
                {w && <WeatherIcon icon={w.icon} size={76} />}
                <div>
                  <b>{w?.name ?? id}</b>
                  <span>{w?.text}</span>
                </div>
              </div>
              {appearing.length > 0 && (
                <div className="exp__fprey" title={`${appearing.map(huntName).join(', ')} iz verir`}>
                  {appearing.map((h) => <PreyMedallion key={h.id} hunt={h} size={40} />)}
                </div>
              )}
            </div>
          )
        })}
      </section>

      <aside className={`exp__tamer panel ${exp ? '' : 'is-camp'}`}>
        <h3>{exp ? 'SEFER' : 'KAMP'}</h3>
        <div className="exp__portrait">
          {artUrl('tamers', sefTamer.id) ? <img src={artUrl('tamers', sefTamer.id)!} alt={sefTamer.name} /> : <GameIcon name="shield" size={120} />}
        </div>
        <div className="exp__tamername">{sefTamer.name}</div>
        <HpBar value={exp?.tamerHp ?? sefTamer.hp} max={sefTamer.hp} kind="tamer" size="lg" label={`${sefTamer.name} canı`} />
        {exp ? (
          <dl className="exp__stats">
            <div><dt>Erzak</dt><dd>{'◆'.repeat(exp.rations)}<span className="muted">{'◇'.repeat(Math.max(0, content.economy.expedition.rations - exp.rations))}</span></dd></div>
            <div title="Bu seferde kazanılan av. Bölge kitabı tamamsa 3 İz gizli yaratığı ortaya çıkarır."><dt>İz</dt><dd>{'●'.repeat(Math.min(exp.trail, 3))}<span className="muted">{'○'.repeat(Math.max(0, 3 - exp.trail))}</span>{exp.trail > 3 && ` +${exp.trail - 3}`}</dd></div>
            <div title="Kampa dönünce bakiyene geçer. Tamer düşerse yarısı kaybolur."><dt>Çanta</dt><dd><GameIcon name="gem" size={24} /> {exp.bag}</dd></div>
            <div title="Ardışık başarılı av: her biri ödülü %10 artırır."><dt>Seri</dt><dd>×{exp.streak}</dd></div>
          </dl>
        ) : (
          <p className="exp__camptext">Kampta Tamer'ın canı dolar, çantadaki öz bakiyene geçer. Seferde can kendiliğinden dolmaz: dinlenmek Erzak ister.</p>
        )}
        <p className="exp__deckline">
          <span>Deste</span>
          <b>{activeDeck?.name ?? '—'}</b>
          <button className="btn small" onClick={() => go('decks')}>DESTELER</button>
        </p>
        {exp ? (
          <div className="exp__actions">
            <button className="btn" disabled={exp.rations <= 0} onClick={() => (exp.siege ? setConfirm('rest') : doRest())} title="1 Erzak: Tamer'ın canının %35'i dolar, hava bir gün ilerler">
              DİNLEN
            </button>
            <button className="btn" onClick={() => (exp.siege ? setConfirm('camp') : doCamp())} title="Çanta bakiyeye geçer, İz sıfırlanır">
              KAMPA DÖN
            </button>
          </div>
        ) : (
          <>
            <p className="exp__target">Hedef: <b>{region.name}</b> <span className="muted">· Bölge {region.level}</span></p>
            <button className="btn primary exp__go" disabled={!deckOk.ready || !regionReady} onClick={startTrip}>
              SEFERE ÇIK
            </button>
          </>
        )}
        {!exp && !deckOk.ready && <p className="exp__warn">{deckOk.reason}</p>}
        {!exp && deckOk.ready && !regionReady && <p className="exp__warn">{regionUnlockText(region)}</p>}
      </aside>

      <section className="exp__map panel" aria-label="Dünya haritası">
        <WorldMap
          world={content.world}
          regions={regionStates}
          nodes={nodes}
          selected={showRegion ? { kind: 'region', id: shownRegion.region.id } : { kind: 'hunt', id: current.hunt.id }}
          focus={anchor}
          home={region.id}
          onSelect={select}
          width={mapW}
          height={mapH}
        />
        <button className="btn small exp__help" onClick={() => setGuide(true)} aria-label="Nasıl oynanır">?</button>
      </section>

      {showRegion ? (
        <aside className="exp__detail panel exp__detail--region" aria-label="Bölge kartı">
          <RegionCard state={shownRegion} captured={captured}>
            {!exp && shownRegion.unlocked && (
              <button className="btn primary exp__region-go" disabled={!deckOk.ready} onClick={startTrip}>
                SEFERE ÇIK
              </button>
            )}
            {exp && exp.region !== shownRegion.region.id && shownRegion.unlocked && <p className="exp__warn">Sefer {content.region(exp.region).name} bölgesinde: buraya gitmek için önce kampa dön.</p>}
          </RegionCard>
        </aside>
      ) : (
      <aside className={`exp__detail panel exp__detail--${hunt.tier}`} aria-label="Av kartı">
        <header className="exp__dhead">
          <PreyMedallion hunt={hunt} size={[128, 104, 84][Math.min(2, hunt.phases?.length ?? 0)]} secret={secret} />
          <div>
            <TierBadge tier={hunt.tier} />
            <h2>{secret ? '???' : card.name}</h2>
            <p className="muted">
              {card.elements.map((e) => ELEMENT_LABEL[e]).join(' + ')} · {TYPE_NAME[card.type]} · {card.rarity}
            </p>
          </div>
        </header>
        {secret ? (
          <p className="exp__lore">{TIER_TEXT[hunt.tier]}</p>
        ) : (
          <>
            <HpBar value={startHp} max={maxHp} kind="prey" label={`${card.name} canı`} />
            {hunt.revive && <p className="exp__small">Canı bitince <b>{content.huntRevive(hunt.id)}</b> canla bir kez daha doğar.</p>}
            <div className="exp__block">
              <h4>NİYETLER</h4>
              <div className="exp__intents">
                {shown.intents.map((it, i) => (
                  <span key={i} className="exp__intent">
                    {i > 0 && <i>›</i>}
                    <IntentBadge intent={it} compact size={46} />
                  </span>
                ))}
                <i className="exp__loop" title="Döngü başa döner">↺</i>
              </div>
              {shown.phases?.map((p, k) => (
                <div key={k} className="exp__phase">
                  <small>Can %{p.belowPct} altında:</small>
                  <div className="exp__intents">
                    {p.intents.map((it, i) => (
                      <span key={i} className="exp__intent">
                        {i > 0 && <i>›</i>}
                        <IntentBadge intent={it} compact size={(shown.phases?.length ?? 0) > 1 ? 32 : 38} />
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="exp__block">
              <h4>ÖZELLİKLER</h4>
              <div className="exp__traits">
                {[...(hunt.traits ?? []), ...(hunt.phases ?? []).flatMap((p) => p.traits ?? [])].map((t, i) => (
                  <span key={i} className="exp__trait" title={traitText(t)}>{traitName(t)}</span>
                ))}
                {!hunt.traits?.length && !hunt.phases?.some((p) => p.traits?.length) && <span className="muted">Özellik yok</span>}
                {hunt.weather && <span className="exp__trait exp__trait--weather" title="Av günü havayı yaratık belirler">{weatherName(hunt.weather)}: kendi havası</span>}
                {hunt.siege && <span className="exp__trait exp__trait--weather" title="Her gün başka deste; can günler arasında kalıcı">{hunt.siege.weathers.length} günlük kuşatma: {hunt.siege.weathers.map(weatherName).join(' › ')}</span>}
                {hunt.appearsIn && <span className="exp__trait exp__trait--weather">Yalnızca: {hunt.appearsIn.map(weatherName).join(', ')}</span>}
              </div>
            </div>
            <p className="exp__lore">{hunt.lore}</p>
          </>
        )}
        <div className="exp__reward">
          <span><GameIcon name="gem" size={26} /> ~{content.economy.expedition.essenceByRarity[card.rarity]} öz + kart</span>
          {record?.captures ? <span className="exp__record">{STARS(record.stars)} · en hızlı {record.bestRound}. tur</span> : <span className="muted">Henüz yakalanmadı</span>}
        </div>
        <div className="exp__deck">
          <label>
            <span>DESTE {exp ? `(${sefTamer.name})` : ''}</span>
            <select aria-label="Av destesi" value={g.deckId} onChange={(e) => g.setDeck(e.target.value)}>
              {(exp ? usableDecks : playerDecks(g)).map((d) => {
                const st = playerDeckStatus(g, d.id)
                return <option key={d.id} value={d.id} disabled={!st.ready}>{d.name}{st.ready ? '' : ' · eksik'}</option>
              })}
            </select>
          </label>
          <div className="exp__fit">
            {ELEMENTS.filter((el) => elementCounts(playerDeckCards(g, g.deckId))[el]).map((el) => <ElementIcon key={el} element={el} size={30} />)}
            <span className={fit > 2 ? 'good' : fit < -2 ? 'bad' : 'muted'}>{weather?.name ?? '—'} {fit >= 0 ? '+' : ''}{fit.toFixed(0)}%</span>
          </div>
        </div>
        <div className="exp__go-row">
          {record?.stars === 3 && (
            <button className="btn" disabled={!avail.ok || wrongTamer || deckBlocked} onClick={doQuick} title="Usta bot senin destenle aynı kurallarla oynar">HIZLI AV</button>
          )}
          <button className="btn primary" disabled={!avail.ok || !deckOk.ready || wrongTamer || deckBlocked} onClick={begin}>
            {siege ? `KUŞATMA · ${siege.day + 1}. GÜN` : 'AVA ÇIK'}
          </button>
        </div>
        {!avail.ok ? <p className="exp__warn">{avail.text}</p> : wrongTamer ? <p className="exp__warn">Bu sefer {sefTamer.name} ile: onun destelerinden birini seç.</p> : deckBlocked ? <p className="exp__warn">Kuşatmanın her günü farklı bir deste ister.</p> : !deckOk.ready ? <p className="exp__warn">{deckOk.reason}</p> : null}
      </aside>
      )}

      {feedback && <div className="exp__feedback" role="status" aria-live="polite">{feedback}</div>}
      {confirm && (
        <div className="overlay" onClick={() => setConfirm(null)}>
          <section role="dialog" aria-modal="true" aria-label="Kuşatmayı bırak" className="overlay__panel overlay__panel--text panel" onClick={(e) => e.stopPropagation()}>
            <h3>KUŞATMA BİTER</h3>
            <p>{huntName(content.hunt(exp!.siege!.hunt))} kuşatması sürüyor. {confirm === 'rest' ? 'Dinlenirsen' : 'Kampa dönersen'} yaratık çekilir ve kuşatma baştan başlar.</p>
            <div className="chip-row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setConfirm(null)}>VAZGEÇ</button>
              <button className="btn primary" onClick={confirm === 'rest' ? doRest : doCamp}>{confirm === 'rest' ? 'DİNLEN' : 'KAMPA DÖN'}</button>
            </div>
          </section>
        </div>
      )}
      {quick && (
        <HuntResult
          summary={quick.summary}
          damage={quick.damage}
          quick
          tamerHp={useGame.getState().expedition?.tamerHp ?? null}
          tamerMax={sefTamer.hp}
          onClose={() => setQuick(null)}
        />
      )}
      {guide && <HowToPlay onClose={() => setGuide(false)} />}
    </div>
  )
}
