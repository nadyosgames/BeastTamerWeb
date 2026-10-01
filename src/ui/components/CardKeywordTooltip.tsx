import { useLayoutEffect, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { CardDef } from '../../core/types.ts'
import { cardKeywordInfo } from '../keywords.ts'
import './CardKeywordTooltip.css'

export function CardKeywordTooltip({ card, anchor, id }: { card: CardDef; anchor: RefObject<HTMLDivElement | null>; id: string }) {
  const [position, setPosition] = useState<{ left: number; top: number; width: number } | null>(null)
  const [panel, setPanel] = useState<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    let frame = 0
    const place = () => {
      const rect = anchor.current?.getBoundingClientRect()
      if (rect) {
        const gap = 12
        const width = Math.min(280, window.innerWidth - gap * 2)
        const right = rect.right + gap
        const left = right + width <= window.innerWidth - gap ? right : Math.max(gap, rect.left - width - gap)
        const top = Math.max(gap, Math.min(rect.top, window.innerHeight - (panel?.offsetHeight ?? 0) - gap))
        setPosition((prev) => prev && Math.abs(prev.left - left) < .5 && Math.abs(prev.top - top) < .5 && prev.width === width ? prev : { left, top, width })
      }
      frame = requestAnimationFrame(place)
    }
    place()
    return () => cancelAnimationFrame(frame)
  }, [anchor, panel])

  return createPortal(<div ref={setPanel} id={id} role="tooltip" className="card-keywords" aria-label={`${card.name} anahtar kelimeleri`} style={{ ...position, visibility: position ? 'visible' : 'hidden' }}>
    {cardKeywordInfo(card).map((entry) => <section key={entry.label}><strong>{entry.label}</strong><p>{entry.description}</p></section>)}
  </div>, document.body)
}
