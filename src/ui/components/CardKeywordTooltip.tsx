import { useLayoutEffect, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { CardDef } from '../../core/types.ts'
import { cardKeywordInfo } from '../keywords.ts'
import './CardKeywordTooltip.css'

export function CardKeywordTooltip({ card, anchor, id, preview }: { card: CardDef; anchor: RefObject<HTMLDivElement | null>; id: string; preview?: ReactNode }) {
  const hasPreview = preview != null
  const keywords = cardKeywordInfo(card)
  const [position, setPosition] = useState<{ left: number; top: number; width: number } | null>(null)
  const [panel, setPanel] = useState<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    let frame = 0
    const place = () => {
      const rect = anchor.current?.getBoundingClientRect()
      if (rect) {
        const gap = 12
        const width = Math.min(hasPreview ? (window.innerWidth <= 620 ? 320 : 592) : 280, window.innerWidth - gap * 2)
        const right = rect.right + gap
        const left = right + width <= window.innerWidth - gap ? right : Math.max(gap, Math.min(rect.left - width - gap, window.innerWidth - width - gap))
        const top = Math.max(gap, Math.min(rect.top, window.innerHeight - (panel?.offsetHeight ?? 0) - gap))
        setPosition((prev) => prev && Math.abs(prev.left - left) < .5 && Math.abs(prev.top - top) < .5 && prev.width === width ? prev : { left, top, width })
      }
      frame = requestAnimationFrame(place)
    }
    place()
    return () => cancelAnimationFrame(frame)
  }, [anchor, panel, hasPreview])

  return createPortal(<div ref={setPanel} id={id} role="tooltip" className={`card-hover-layer ${preview ? 'card-hover-layer--preview' : ''}`} aria-label={`${card.name} ${preview ? 'kart önizlemesi ve ' : ''}anahtar kelimeleri`} style={{ ...position, visibility: position ? 'visible' : 'hidden' }}>
    {preview && <div className="card-hover-preview">{preview}</div>}
    {keywords.length > 0 && <aside className="card-keywords">{keywords.map((entry) => <section key={entry.label}><strong>{entry.label}</strong><p>{entry.description}</p></section>)}</aside>}
  </div>, document.body)
}
