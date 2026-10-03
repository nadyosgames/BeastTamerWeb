import type { Element } from '../../core/types.ts'
import { ELEMENT_LABEL } from '../labels.ts'

const PALETTE: Record<Element, [string, string, string]> = {
  fire: ['#762b20', '#ee973d', '#ffce6a'],
  water: ['#204b61', '#65b6d5', '#b5e8ec'],
  earth: ['#51422b', '#bf8b47', '#e0b775'],
  wind: ['#50325e', '#e8d3ed', '#fff0df'],
  electric: ['#554020', '#f2bc3b', '#ffe793'],
}

/** Shared ink silhouette, including the symbols printed on pack wrappers. */
export function ElementGlyph({ element, color, highlight }: { element: Element; color: string; highlight?: string }) {
  switch (element) {
    case 'fire': return <><path fill={color} d="M12.8 1.5c1.8 4.7-2 6.9-.9 10.1 2-1.2 3.2-3.3 3.1-5.5 4 3.5 6.4 7.3 4.7 11.6-1.4 3.7-5.1 5.2-8.7 4.7C4.6 21.6 2.4 16 5.7 10.4c.1 2.1.8 3.2 1.9 3.9C6.8 8.6 12.4 7 12.8 1.5Z" /><path fill={highlight ?? color} d="M12.7 13c.6 2.5-2.6 3.6-1.6 6 .8-.1 1.6-1.4 1.8-2.5 2.8 2.8 1.1 5.1-1.2 5-3.7-.2-4.2-4.1 1-8.5Z" /></>
    case 'water': return <><path fill={color} d="M12 1.5C9.8 6 4.4 11.2 4.4 15.5a7.6 7.6 0 0 0 15.2 0C19.6 11.2 14.2 6 12 1.5Z" /><path fill={highlight ?? color} d="M7.2 13.3c-1.1 4.6 1.1 6.4 3.7 6.6-2.7-1.9-2.9-3.7-3.7-6.6Z" /></>
    case 'earth': return <><path fill={color} d="m1.2 20.6 7.2-15 5.5 10.1 3.5-6.5 5.4 11.4Z" /><path fill={highlight ?? color} d="m8.4 5.6-3.2 6.8 3.1-1.7 2 3.4 1.2-2.5Zm9 3.6-2.7 5 2.4-.6 1.8 2.2Z" /></>
    case 'wind': return <path fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" d="M4.3 7.7C7.2 1.7 17.5 1.7 21 8.5c4.4 8.4-5 16.3-12.5 11.4C1.7 15.4 5 7.1 11 7c5.8-.1 8 6.8 3.3 9.1-3.7 1.8-6.6-2.5-3.4-4.1 1.3-.7 2.2.2 2 1.1" />
    case 'electric': return <path fill={color} d="m14.3 1.1-11 12.6h7L8.4 23l12.4-14h-7.5Z" />
  }
}

/** Parchment-rimmed element medallion, legible at card and filter sizes. */
export function ElementIcon({ element, size = 28 }: { element: Element; size?: number }) {
  const [ground, color, highlight] = PALETTE[element]
  return <svg className={`element-icon element-icon--${element}`} width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={ELEMENT_LABEL[element]}>
    <circle cx="32" cy="32" r="30" fill="#f1d39a" stroke="#281c13" strokeWidth="2.5" />
    <circle cx="32" cy="32" r="26.5" fill={ground} stroke="#946439" strokeWidth="1" />
    <path d="M12 37A23 23 0 0 1 37 10" fill="none" stroke="#fff0c1" strokeWidth="1" opacity=".45" />
    <g transform="translate(10 9) scale(1.82)"><ElementGlyph element={element} color={color} highlight={highlight} /></g>
  </svg>
}
