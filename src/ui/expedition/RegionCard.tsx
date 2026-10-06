import type { RegionDef } from '../../core/types.ts'
import { ElementIcon } from '../components/ElementIcon.tsx'
import { GameIcon } from '../components/GameIcon.tsx'
import { PreyMedallion, TierBadge } from '../components/HuntBits.tsx'
import { WeatherIcon } from '../components/WeatherIcon.tsx'
import { content } from '../content.ts'
import { huntName } from '../hunt.ts'
import { ELEMENT_LABEL } from '../labels.ts'
import { BIOME_STYLE } from './mapStyle.ts'
import type { RegionState } from './WorldMap.tsx'
import './RegionCard.css'

/**
 * Bölge kartı (dünya haritasında bölge seçilince): biyom, zorluk basamağı, iklim, kitap ödülü,
 * ilerleme ve kilit şartı. Bölgedeki dikkat çeken yaratıklar (Final, Efsanevi, Kadim) önizlenir.
 */
export function RegionCard({ state, captured, children }: { state: RegionState; captured: ReadonlySet<string>; children?: React.ReactNode }) {
  const r: RegionDef = state.region
  const style = BIOME_STYLE[r.biome]
  const hunts = content.regionHunts(r.id)
  const climate = Object.entries(r.climate).sort((a, b) => b[1] - a[1])
  const total = climate.reduce((a, [, w]) => a + w, 0)
  const bosses = hunts.filter((h) => h.tier === 'final' || h.tier === 'legendary' || h.tier === 'ancient')
  const tiers = { ordinary: 0, hard: 0 }
  for (const h of hunts) if (h.tier === 'ordinary' || h.tier === 'hard') tiers[h.tier]++
  return (
    <div className="region-card">
      <header className="region-card__head" style={{ ['--biome' as string]: style.fill, ['--edge' as string]: style.edge }}>
        <div className="region-card__seal">
          <b>{r.level}</b>
          <small>BÖLGE</small>
        </div>
        <div>
          <span className="region-card__biome">{style.label}</span>
          <h2>{r.name}</h2>
          <p className="region-card__elements">
            {r.elements.map((el) => (
              <span key={el} title={ELEMENT_LABEL[el]}>
                <ElementIcon element={el} size={28} />
              </span>
            ))}
          </p>
        </div>
      </header>
      <p className="region-card__text">{r.text}</p>

      {state.unlocked ? (
        <div className="region-card__progress">
          <div className="region-card__bar">
            <i style={{ width: `${(state.captured / Math.max(1, state.total)) * 100}%` }} />
            <em>{state.captured}/{state.total} yaratık bayıltıldı</em>
          </div>
          <span className={state.final ? 'is-done' : ''}>{state.final ? '✓ Final' : 'Final bekliyor'}</span>
          <span className={state.book ? 'is-done' : ''}>{state.book ? '✓ Kitap' : `${tiers.ordinary} Sıradan · ${tiers.hard} Zorlu`}</span>
        </div>
      ) : (
        <p className="region-card__lock">
          <GameIcon name="lock" size={28} /> {state.unlockText}
        </p>
      )}

      <div className="region-card__block">
        <h4>İKLİM</h4>
        <div className="region-card__climate">
          {climate.slice(0, 5).map(([id, w]) => {
            const wd = content.weatherById.get(id)
            return (
              <span key={id} title={`${wd?.name ?? id}: günlerin ~%${Math.round((w / total) * 100)}'i`}>
                <WeatherIcon icon={wd?.icon ?? 'calm'} size={40} />
                <small>%{Math.round((w / total) * 100)}</small>
              </span>
            )
          })}
        </div>
      </div>

      <div className="region-card__block">
        <h4>BÖLGENİN DEVLERİ</h4>
        <div className="region-card__bosses">
          {bosses.map((h) => {
            const known = captured.has(h.id) || h.tier === 'final'
            return (
              <span key={h.id} className="region-card__boss" title={known ? huntName(h) : 'Gizli yaratık'}>
                <PreyMedallion hunt={h} size={58} secret={!known} />
                <TierBadge tier={h.tier} />
              </span>
            )
          })}
        </div>
      </div>

      <p className={`region-card__buff ${state.book ? 'is-done' : ''}`}>
        <b>Kitap ödülü{state.book ? ' (kazanıldı)' : ''}:</b> {r.buff.text} <span className="muted">Tüm avlarda geçerli.</span>
      </p>
      {children}
    </div>
  )
}
