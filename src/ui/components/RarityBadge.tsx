import { useId, type CSSProperties } from 'react'
import type { Rarity } from '../../core/types.ts'
import './RarityBadge.css'

const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic',
  legendary: 'Legendary', mythic: 'Mythic', ancient: 'Ancient',
}

type Point = readonly [number, number]
const GEM_CUT: Record<Exclude<Rarity, 'common'>, readonly Point[]> = {
  uncommon: [[13, 9], [35, 9], [39, 13], [39, 35], [35, 39], [13, 39], [9, 35], [9, 13]],
  rare: [[24, 4], [40, 24], [24, 44], [8, 24]],
  epic: [[15, 6], [33, 6], [42, 24], [33, 42], [15, 42], [6, 24]],
  legendary: [[14, 10], [34, 10], [43, 20], [38, 33], [24, 40], [10, 33], [5, 20]],
  mythic: [[24, 5], [35, 13], [35, 35], [24, 43], [13, 35], [13, 13]],
  ancient: [[16, 7], [32, 7], [41, 16], [41, 32], [32, 41], [16, 41], [7, 32], [7, 16]],
}
const points = (vertices: readonly Point[]) => vertices.map(([x, y]) => `${x},${y}`).join(' ')
const inset = ([x, y]: Point): Point => [24 + (x - 24) * .55, 24 + (y - 24) * .55]

/** Nadirlik, element sembollerinden bağımsız taş kesimi ve metal yuva ile okunur. */
export function RarityBadge({ rarity, label = false, size = 40 }: { rarity: Rarity; label?: boolean; size?: number }) {
  const id = useId()
  const gemId = `${id}-gem`
  const metalId = `${id}-metal`
  const vertices = rarity === 'common' ? null : GEM_CUT[rarity]
  const table = vertices?.map(inset)

  return <span className={`rarity-badge rarity-badge--${rarity}`} style={{ '--rarity-color': `var(--${rarity})`, '--badge-size': `${size}px` } as CSSProperties} title={`Nadirlik: ${RARITY_LABEL[rarity]}`}>
    <svg viewBox="0 0 48 48" role="img" aria-label={`${RARITY_LABEL[rarity]} nadirlik rozeti`}>
      <defs>
        <linearGradient id={gemId} x1="0" y1="0" x2=".8" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset=".22" stopColor="var(--rarity-color)" />
          <stop offset=".65" stopColor="var(--rarity-color)" />
          <stop offset="1" stopColor="#07141d" />
        </linearGradient>
        <linearGradient id={metalId} x1="0" y1="0" x2=".6" y2="1">
          <stop offset="0" stopColor="var(--setting-light)" />
          <stop offset=".38" stopColor="var(--setting-mid)" />
          <stop offset=".65" stopColor="var(--setting-dark)" />
          <stop offset="1" stopColor="var(--setting-light)" />
        </linearGradient>
      </defs>
      <g fill={`url(#${metalId})`} stroke="#080e14" strokeWidth="1.1" strokeLinejoin="round">
        {rarity === 'legendary' && <path d="M19 9L24 2L29 9M18 39L24 46L30 39" />}
        {rarity === 'mythic' && <><path d="M13 11L5 17L7 33L13 38L10 25Z" /><path d="M35 11L43 17L41 33L35 38L38 25Z" /></>}
        {rarity === 'ancient' && <><path d="M14 8L17 2L24 5L31 2L34 8M14 40L17 46L24 43L31 46L34 40" /><path d="M8 14L2 17L5 24L2 31L8 34M40 14L46 17L43 24L46 31L40 34" /></>}
      </g>
      {vertices && table ? <>
        <polygon points={points(vertices)} fill={`url(#${metalId})`} stroke="#060c12" strokeWidth="5" strokeLinejoin="round" />
        <polygon points={points(vertices)} fill={`url(#${gemId})`} stroke={`url(#${metalId})`} strokeWidth="2.8" strokeLinejoin="round" />
        {vertices.map((vertex, i) => {
          const next = (i + 1) % vertices.length
          const light = i === 0 || i >= vertices.length - 2
          return <polygon key={i} points={points([vertex, vertices[next], table[next], table[i]])} fill={light ? '#fff' : '#03101c'} opacity={light ? .35 : .38} />
        })}
        <polygon points={points(table)} fill={`url(#${gemId})`} stroke="#fff" strokeOpacity=".22" strokeWidth=".7" />
        <path d={`M${points([table[table.length - 1]])}L${points([table[0]])}L${points([table[1]])}`} fill="none" stroke="#fff" strokeOpacity=".8" strokeWidth="1.3" strokeLinecap="round" />
        <polygon points={points(vertices)} fill="none" stroke={`url(#${metalId})`} strokeWidth="2.3" strokeLinejoin="round" />
      </> : <>
        <ellipse cx="24" cy="24" rx="15" ry="17" fill={`url(#${metalId})`} stroke="#060c12" strokeWidth="4" />
        <ellipse cx="24" cy="24" rx="12.5" ry="14.5" fill={`url(#${gemId})`} stroke={`url(#${metalId})`} strokeWidth="1.5" />
        <path d="M15 25C14 18 18 13 24 13" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="2" strokeLinecap="round" />
        <path d="M21 35C27 37 32 31 32 26" fill="none" stroke="#08131d" strokeOpacity=".5" strokeWidth="2" strokeLinecap="round" />
      </>}
    </svg>
    {label && <span>{RARITY_LABEL[rarity]}</span>}
  </span>
}

