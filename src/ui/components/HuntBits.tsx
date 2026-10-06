import { motion } from 'motion/react'
import type { CSSProperties } from 'react'
import type { HuntDef, HuntTier, Intent } from '../../core/types.ts'
import { artUrl } from '../art.ts'
import { content } from '../content.ts'
import { intentName, intentText, TIER_LABEL } from '../hunt.ts'
import { ElementIcon } from './ElementIcon.tsx'
import './HuntBits.css'

/**
 * Av arayüzünün küçük parçaları: niyet ikonu, can çubuğu, kademe rozeti, yaratık madalyonu.
 * Hepsi mürekkep-parşömen dilinde, SVG ve CSS ile çizilir (raster görsel gerektirmez).
 */

const INK = '#281c13'

/** Niyet ikonları: kalın mürekkep konturu, sade dolgular. */
export function IntentIcon({ kind, size = 44 }: { kind: Intent['kind']; size?: number }) {
  const common = { fill: 'none', stroke: INK, strokeWidth: 3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <svg className={`intent-icon intent-icon--${kind}`} width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="21" fill="#f3e1bb" stroke={INK} strokeWidth="2.5" />
      {kind === 'claw' && (
        <g {...common} strokeWidth={3.4}>
          <path d="M14 34 L22 12" stroke="#a43c2c" />
          <path d="M21 36 L29 13" stroke="#a43c2c" />
          <path d="M28 37 L35 16" stroke="#a43c2c" />
        </g>
      )}
      {kind === 'rend' && (
        <g {...common}>
          <rect x="15" y="12" width="18" height="24" rx="3" fill="#efd7a7" />
          <path d="M12 30 L36 18" stroke="#a43c2c" strokeWidth="3.4" />
          <text x="24" y="44" textAnchor="middle" fontSize="9" fontWeight="900" fill={INK} stroke="none">−1</text>
        </g>
      )}
      {kind === 'tailSweep' && (
        <g {...common}>
          <path d="M8 30 C16 40 30 40 38 26 C41 20 38 14 33 15" fill="none" stroke="#7c874a" strokeWidth="4" />
          <path d="M33 15 l4 -4 m-4 4 l5 2" />
        </g>
      )}
      {kind === 'roar' && (
        <g {...common}>
          <path d="M12 20 q6 -8 12 0 q6 8 12 0" />
          <path d="M14 28 q5 -6 10 0 q5 6 10 0" />
          <text x="24" y="43" textAnchor="middle" fontSize="10" fontWeight="900" fill={INK} stroke="none">Zz</text>
        </g>
      )}
      {kind === 'evade' && (
        <g {...common}>
          <path d="M10 30 C18 14 30 14 38 22" />
          <path d="M33 16 l5 6 -7 1" />
          <path d="M14 36 h6 m4 0 h6" strokeDasharray="1 4" />
        </g>
      )}
      {kind === 'recover' && (
        <g {...common}>
          <path d="M24 36 C12 28 10 18 17 14 C21 12 24 15 24 18 C24 15 27 12 31 14 C38 18 36 28 24 36 Z" fill="#b95238" />
          <path d="M24 20 v10 m-5 -5 h10" stroke="#f6e8cb" strokeWidth="3" />
        </g>
      )}
      {kind === 'charge' && (
        <g {...common}>
          <path d="M27 8 L15 26 h9 L20 40 L34 20 h-9 Z" fill="#d0a03c" />
        </g>
      )}
      {kind === 'flee' && (
        <g {...common}>
          <path d="M10 30 h18" />
          <path d="M22 22 l9 8 -9 8" />
          <path d="M34 14 c3 3 3 7 0 10 M38 12 c4 5 4 9 0 14" strokeWidth="2.4" />
        </g>
      )}
      {kind === 'scorch' && (
        <g {...common}>
          <path d="M14 36 C10 28 16 22 15 14 C20 18 22 22 21 28 C24 22 26 18 25 10 C32 16 36 24 32 32 C30 36 26 38 24 38 C20 38 16 38 14 36 Z" fill="#ba5138" />
        </g>
      )}
    </svg>
  )
}

export function IntentBadge({ intent, charged = false, size = 44, compact = false }: { intent: Intent; charged?: boolean; size?: number; compact?: boolean }) {
  const label = intent.kind === 'claw' && charged ? `Pençe ${intent.damage * 2}` : intentName(intent)
  const value = intent.kind === 'claw' ? intent.damage * (charged ? 2 : 1) : intent.kind === 'recover' ? intent.amount : null
  return (
    <span className={`intent-badge ${compact ? 'intent-badge--compact' : ''}`} title={`${label}: ${intentText(intent, charged)}`}>
      <IntentIcon kind={intent.kind} size={size} />
      {compact && value !== null && <i className="intent-badge__value">{value}</i>}
      {!compact && <b>{label}</b>}
    </span>
  )
}

/** Can çubuğu: yaratık kırmızı, Tamer yeşil. `ghost` turun başındaki can (yeni alınan hasar soluk görünür). */
export function HpBar({ value, max, kind, ghost, label, size = 'md' }: { value: number; max: number; kind: 'prey' | 'tamer'; ghost?: number; label?: string; size?: 'md' | 'sm' | 'lg' }) {
  const pct = Math.max(0, Math.min(1, value / Math.max(1, max)))
  const ghostPct = ghost === undefined ? pct : Math.max(pct, Math.min(1, ghost / Math.max(1, max)))
  return (
    <div className={`hp-bar hp-bar--${kind} hp-bar--${size}`} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label ?? (kind === 'prey' ? 'Yaratığın canı' : "Tamer'ın canı")}>
      <span className="hp-bar__ghost" style={{ width: `${ghostPct * 100}%` }} />
      <motion.span className="hp-bar__fill" animate={{ width: `${pct * 100}%` }} transition={{ type: 'spring', stiffness: 260, damping: 30 }} />
      <span className="hp-bar__text">
        {Math.max(0, Math.round(value))} / {max}
      </span>
    </div>
  )
}

export function TierBadge({ tier }: { tier: HuntTier }) {
  return <span className={`tier-badge tier-badge--${tier}`}>{TIER_LABEL[tier]}</span>
}

/** Yaratığın yuvarlak madalyonu: kart görseli ya da element ikonu. Kademe halkanın rengini belirler. */
export function PreyMedallion({ hunt, size = 120, dim = false, secret = false, style }: { hunt: HuntDef; size?: number; dim?: boolean; secret?: boolean; style?: CSSProperties }) {
  const card = content.card(hunt.card)
  const img = artUrl('cards', card.id, size <= 140)
  return (
    <span className={`prey-medallion prey-medallion--${hunt.tier} ${dim ? 'is-dim' : ''} ${secret ? 'is-secret' : ''}`} style={{ width: size, height: size, ['--el' as string]: `var(--${card.elements[0]})`, ...style }}>
      {secret ? <b className="prey-medallion__secret" style={{ fontSize: size * 0.6 }}>?</b> : img ? <img src={img} alt="" draggable={false} /> : <ElementIcon element={card.elements[0]} size={size * 0.55} />}
    </span>
  )
}
