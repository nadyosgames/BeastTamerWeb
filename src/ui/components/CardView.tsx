import { AnimatePresence, motion } from 'motion/react'
import type { CardDef } from '../../core/types.ts'
import { artUrl } from '../art.ts'
import { ElementIcon } from './ElementIcon.tsx'
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
}

const KEYWORD_LABEL: Record<string, string> = {
  swift: 'Swift',
  heavy: 'Heavy',
  ward: 'Ward',
  rebirth: 'Rebirth',
  overload: 'Overload',
}

export function CardView({ card, durability, passive, active, income, pulse, ward, size = 'md', onClick }: CardViewProps) {
  const img = artUrl('cards', card.id, size === 'sm')
  const el = card.elements[0]
  const dur = durability ?? card.durability
  const keywords = [...(card.keywords ?? []).map((k) => KEYWORD_LABEL[k]), ...(card.slumber ? [`Slumber ${card.slumber}`] : [])]
  return (
    <div
      className={`card card--${size} rarity-${card.rarity} ${passive ? 'is-passive' : ''} ${active ? 'is-active' : ''} ${onClick ? 'is-clickable' : ''}`}
      style={{ ['--el' as string]: `var(--${el})`, ['--el2' as string]: `var(--${card.elements[1] ?? el})` }}
      onClick={onClick}
    >
      <div className="card__art">
        {img ? (
          <img src={img} alt={card.name} draggable={false} />
        ) : (
          <div className="card__placeholder">
            <ElementIcon element={el} size={size === 'sm' ? 48 : 88} />
            <span>{card.id}</span>
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
      <div className={`card__shield ${ward ? 'has-ward' : ''}`} title="Dayanıklılık">
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
          {keywords.length > 0 && <div className="card__kw">{keywords.join(' · ')}</div>}
          {card.text.replace(/^(Swift|Heavy|Ward|Rebirth|Overload|Slumber \d)\.\s*/g, '')}
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
    </div>
  )
}
