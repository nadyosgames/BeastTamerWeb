import type { Element } from '../../core/types.ts'
import { ELEMENT_LABEL } from '../labels.ts'

const PATHS: Record<Element, string> = {
  fire: 'M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-3 2-4 2-7 1 1 2 2 2 4 1-2 1-5 1-8z',
  water: 'M12 2s7 8 7 13a7 7 0 0 1-14 0c0-5 7-13 7-13z',
  earth: 'M2 20 9 7l4 6 3-4 6 11z',
  wind: 'M12 12c-3-4 3-7 6-3 5 7-5 15-11 9C-2 9 6 0 15 3c6 2 7 8 6 12',
  electric: 'M13 2 4 14h6l-1 8 9-12h-6z',
}

export function ElementIcon({ element, size = 28 }: { element: Element; size?: number }) {
  const stroke = element === 'wind'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label={ELEMENT_LABEL[element]}>
      <path
        d={PATHS[element]}
        fill={stroke ? 'none' : `var(--${element})`}
        stroke={stroke ? `var(--${element})` : 'rgba(0,0,0,0.35)'}
        strokeWidth={stroke ? 2.4 : 0.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
