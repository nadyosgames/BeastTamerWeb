import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef, useState } from 'react'
import type { CardDef } from '../../core/types.ts'
import { artUrl } from '../art.ts'
import { ElementIcon } from './ElementIcon.tsx'
import { GameIcon } from './GameIcon.tsx'
import { RarityBadge } from './RarityBadge.tsx'
import { CardText } from './CardText.tsx'
import { CardKeywordTooltip } from './CardKeywordTooltip.tsx'
import { cardKeywordInfo } from '../keywords.ts'
import './CardView.css'

/**
 * Kart yüzü. Görsel yalnızca yaratık illüstrasyonudur (art pipeline); çerçeve, isim,
 * dayanıklılık kalkanı, element taşı ve yetenek metni burada kurulur — Unity'de kart prefab'ı.
 */
export interface CardViewProps {
  card: CardDef
  durability?: number
  passive?: boolean
  active?: boolean
  /** Son tetik geliri (+N balonu). `pulse` değişince animasyon yeniden oynar. */
  income?: number | null
  pulse?: number
  ward?: boolean
  size?: 'md' | 'sm'
  onClick?: () => void
  actionLabel?: string
}

export function CardView({ card, durability, passive, active, income, pulse, ward, size = 'md', onClick, actionLabel }: CardViewProps) {
  const anchor = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const tooltipId = useId()
  const [showKeywords, setShowKeywords] = useState(false)
  const hasKeywords = cardKeywordInfo(card).length > 0
  const hideKeywords = () => { window.clearTimeout(timer.current); setShowKeywords(false) }
  const revealKeywords = () => {
    window.clearTimeout(timer.current)
    if (hasKeywords) timer.current = window.setTimeout(() => setShowKeywords(true), 250)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const img = artUrl('cards', card.id, size === 'sm')
  const el = card.elements[0]
  const dur = durability ?? card.durability
  return (
    <div
      ref={anchor}
      className={`card card--${size} rarity-${card.rarity} ${passive ? 'is-passive' : ''} ${active ? 'is-active' : ''} ${onClick ? 'is-clickable' : ''}`}
      style={{ ['--el' as string]: `var(--${el})`, ['--el2' as string]: `var(--${card.elements[1] ?? el})` }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick || hasKeywords ? 0 : undefined}
      aria-describedby={showKeywords ? tooltipId : undefined}
      aria-label={onClick ? (actionLabel ?? `${card.name} kartını incele`) : undefined}
      onKeyDown={(e) => { if (e.key === 'Escape') hideKeywords(); else if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); hideKeywords(); onClick() } else revealKeywords() }}
      onPointerEnter={(e) => { if (e.pointerType !== 'touch') revealKeywords() }}
      onPointerLeave={hideKeywords}
      onPointerDown={hideKeywords}
      onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) revealKeywords() }}
      onBlur={hideKeywords}
    >
      <div className="card__art">
        {img ? (
          <img src={img} alt={card.name} draggable={false} />
        ) : (
          <div className="card__placeholder">
            <ElementIcon element={el} size={size === 'sm' ? 48 : 88} />
            <span className="card__art-ornament">✦</span>
          </div>
        )}
        {passive && <div className="card__passive">PASİF</div>}
      </div>

      <div className="card__gems">
        {card.elements.map((e) => (
          <div key={e} className="card__gem" style={{ ['--el' as string]: `var(--${e})` }}>
            <ElementIcon element={e} size={size === 'sm' ? 18 : 24} />
          </div>
        ))}
      </div>
      <span className="card__rarity"><RarityBadge rarity={card.rarity} size={size === 'sm' ? 42 : 44} /></span>
      <div className={`card__shield ${ward ? 'has-ward' : ''}`} title="Dayanıklılık">
        {size === 'md' && <GameIcon name="shield" size={23} />}
        {durability !== undefined ? `${dur}/${card.durability}` : card.durability}
      </div>
      {card.polarity && (
        <>
          <div className="card__pole card__pole--l">{card.polarity.left === '+' ? '+' : '−'}</div>
          <div className="card__pole card__pole--r">{card.polarity.right === '+' ? '+' : '−'}</div>
        </>
      )}

      <div className="card__name">{card.name}</div>
      {size === 'md' && (
        <div className="card__text">
          <CardText text={card.text} />
        </div>
      )}

      <AnimatePresence>
        {income != null && (
          <motion.div
            key={pulse}
            className="card__income"
            initial={{ opacity: 0, y: 10, scale: 0.7 }}
            animate={{ opacity: 1, y: -18, scale: 1 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ duration: 0.25 }}
          >
            +{income}
          </motion.div>
        )}
      </AnimatePresence>
      {showKeywords && hasKeywords && <CardKeywordTooltip card={card} anchor={anchor} id={tooltipId} />}
    </div>
  )
}
