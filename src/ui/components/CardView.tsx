import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef, useState } from 'react'
import type { CardDef } from '../../core/types.ts'
import { artUrl } from '../art.ts'
import { ElementIcon } from './ElementIcon.tsx'
import { GameIcon } from './GameIcon.tsx'
import { RarityBadge } from './RarityBadge.tsx'
import { CardText } from './CardText.tsx'
import { CardKeywordTooltip } from './CardKeywordTooltip.tsx'
import { cardKeywordInfo, cardTextParagraphs } from '../keywords.ts'
import './CardView.css'

/** Kart metinleri türleri İngilizce yazar ("Sağındaki kart Dragon ise"); etiket de aynı dili kullanır. */
const TYPE_NAME: Record<CardDef['type'], string> = { beast: 'Beast', ghost: 'Ghost', golem: 'Golem', dragon: 'Dragon', flora: 'Flora', swarm: 'Swarm', avian: 'Avian', serpent: 'Serpent', neutral: 'Neutral' }

/**
 * Kart yüzü. Görsel yalnızca yaratık illüstrasyonudur (art pipeline); çerçeve, isim,
 * dayanıklılık kalkanı, element taşı ve yetenek metni burada kurulur — Unity'de kart prefab'ı.
 */
export interface CardViewProps {
  card: CardDef
  durability?: number
  /** Tur içinde dayanıklılık kazanan kartın kalkan paydası (verilmezse basılı dayanıklılık). */
  maxDurability?: number
  passive?: boolean
  active?: boolean
  /** Son tetik geliri (+N balonu). `pulse` değişince animasyon yeniden oynar. */
  income?: number | null
  /** Balonun metni (av: "⚔6", "SAVUŞTU"). Verilirse income yerine gösterilir; null ise balon yok. */
  bubble?: string | null
  /** Uyuyor (Slumber ya da Kükreme): rozet gösterilir. */
  sleeping?: boolean
  pulse?: number
  ward?: boolean
  size?: 'md' | 'sm'
  onClick?: () => void
  actionLabel?: string
  /** Koleksiyonun küçük kartında tam kartı ve kuralları yan yana açar. */
  hoverPreview?: boolean
  keywordTooltip?: boolean
}

export function CardView({ card, durability, maxDurability, passive, active, income, bubble, sleeping, pulse, ward, size = 'md', onClick, actionLabel, hoverPreview = false, keywordTooltip = true }: CardViewProps) {
  const bubbleText = bubble !== undefined ? bubble : income != null ? `+${income}` : null
  const isNote = bubble != null && !/^[+⚔\d]/.test(bubble)
  const anchor = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const tooltipId = useId()
  const [showKeywords, setShowKeywords] = useState(false)
  const hasKeywords = keywordTooltip && cardKeywordInfo(card).length > 0
  const canPreview = keywordTooltip && (hoverPreview || hasKeywords)
  const hideKeywords = () => { window.clearTimeout(timer.current); setShowKeywords(false) }
  const revealKeywords = () => {
    window.clearTimeout(timer.current)
    if (canPreview) timer.current = window.setTimeout(() => setShowKeywords(true), 250)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const img = artUrl('cards', card.id, size === 'sm')
  const el = card.elements[0]
  const dur = durability ?? card.durability
  return (
    <div
      ref={anchor}
      className={`card card--${size} card--${el} ${card.elements.length > 1 ? 'card--dual' : ''} rarity-${card.rarity} ${cardTextParagraphs(card.text).length > 2 ? 'card--many-rules' : ''} ${passive ? 'is-passive' : ''} ${active ? 'is-active' : ''} ${onClick ? 'is-clickable' : ''}`}
      style={{ ['--el' as string]: `var(--${el})`, ['--el2' as string]: `var(--${card.elements[1] ?? el})` }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick || canPreview ? 0 : undefined}
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
        {card.type !== 'neutral' && <div className="card__type">{TYPE_NAME[card.type]}</div>}
        {passive && <div className="card__passive">PASİF</div>}
        {!passive && sleeping && <div className="card__passive card__sleep">UYUYOR</div>}
      </div>

      <div className="card__gems">
        {card.elements.map((e) => (
          <div key={e} className="card__gem" style={{ ['--el' as string]: `var(--${e})` }}>
            <ElementIcon element={e} size={size === 'sm' ? 52 : 58} />
          </div>
        ))}
      </div>
      <span className="card__rarity"><RarityBadge rarity={card.rarity} size={size === 'sm' ? 42 : 44} /></span>
      <div className={`card__shield ${ward ? 'has-ward' : ''}`} title="Dayanıklılık">
        {size === 'md' && <GameIcon name="shield" size={23} />}
        {durability !== undefined ? `${dur}/${maxDurability ?? card.durability}` : card.durability}
      </div>
      {card.polarity && (
        <>
          <div className="card__pole card__pole--l">{card.polarity.left === '+' ? '+' : '−'}</div>
          <div className="card__pole card__pole--r">{card.polarity.right === '+' ? '+' : '−'}</div>
        </>
      )}

      <div className={`card__name ${card.name.length > 18 ? 'card__name--long' : ''}`}>{card.name}</div>
      {size === 'md' && (
        <div className="card__text">
          <CardText text={card.text} paragraphs />
        </div>
      )}

      <AnimatePresence>
        {bubbleText != null && (
          <motion.div
            key={pulse}
            className={`card__income ${isNote ? 'card__income--note' : ''}`}
            initial={{ opacity: 0, y: 10, scale: 0.7 }}
            animate={{ opacity: 1, y: -18, scale: 1 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ duration: 0.25 }}
          >
            {bubbleText}
          </motion.div>
        )}
      </AnimatePresence>
      {showKeywords && canPreview && <CardKeywordTooltip card={card} anchor={anchor} id={tooltipId} preview={hoverPreview ? <CardView card={card} keywordTooltip={false} /> : undefined} />}
    </div>
  )
}
