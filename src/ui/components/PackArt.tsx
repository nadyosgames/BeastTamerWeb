import { useId } from 'react'
import type { Element } from '../../core/types.ts'
import { ElementGlyph } from './ElementIcon.tsx'

const COLORS: Record<Element, string> = { fire: '#ac513a', water: '#577f91', earth: '#748047', wind: '#8f729a', electric: '#b79a49' }

/** Matte paper props; one geometry for every pack, matching the approved UI. */
export function PackArt({ id, element, label }: { id: string; element: Element; label: string }) {
  const grain = useId().replace(/:/g, '')
  const sealed = id === 'sealed'
  const lucky = id === 'lucky'
  const themed = id === 'element'
  const color = sealed ? '#874337' : lucky ? '#816a91' : themed ? COLORS[element] : '#495253'
  return <svg viewBox="0 0 280 360" role="img" aria-label={label}>
    <defs><filter id={grain}><feTurbulence type="fractalNoise" baseFrequency=".55" numOctaves="3" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /><feComponentTransfer><feFuncA type="linear" slope=".09" /></feComponentTransfer><feBlend in="SourceGraphic" mode="multiply" /></filter></defs>
    <g stroke="#281c13" strokeWidth="3" strokeLinejoin="round">
      <g transform="translate(140 0) scale(1.28 1) translate(-140 0)">
      <g fill="#37434b"><rect x="28" y="57" width="175" height="242" rx="8" transform="rotate(-13 110 180)" /><rect x="77" y="57" width="175" height="242" rx="8" transform="rotate(13 160 180)" /></g>
      <g fill="none" stroke="#c8a36b" strokeWidth="2"><path d="m41 83 128-29 46 191-128 29Z" /><path d="m111 55 126 29-43 188-126-29Z" /></g>
      <g filter={`url(#${grain})`}><path fill={color} d="M47 26h184l-5 307H48Z" /><path fill={color} d="m44 15 9 6 9-6 9 6 9-6 9 6 9-6 9 6 9-6 9 6 9-6 9 6 9-6 9 6 9-6 9 6 9-6 9 6 9-6 9 6v22H44Zm2 298h182v29l-9-6-9 6-9-6-9 6-9-6-9 6-9-6-9 6-9-6-9 6-9-6-9 6-9-6-9 6-9-6-9 6-9-6-9 6-9-6-9 6Z" /></g>
      <path d="m49 43 16 15-10 248-8 21m181-283-15 17 5 239 9 27" fill="none" stroke="#281c13" strokeWidth="2" opacity=".6" />
      <path d="m64 54 9 24-8 206 10 28-20 6Z" fill="#fff0ca" stroke="none" opacity=".1" />
      <path d="m215 53-11 20 8 218-12 19 18 7Z" fill="#281c13" stroke="none" opacity=".2" />
      <path fill="none" stroke="#d8b983" strokeWidth="2" d="M61 52h154v242H61Z" />
      {!sealed && <g fill="none" stroke="#d8b983" strokeWidth="2.8"><path d="M75 103c-17-8-5-23 2-13 6 8-8 13-12 5m141 8c17-8 5-23-2-13-6 8 8 13 12 5M74 240c-14 4-11 19-3 15 8-5-1-15-8-11m144-4c14 4 11 19 3 15-8-5 1-15 8-11" /><path d="m73 107 3 10-6 4m137-14-3 10 6 4M76 262l-4 11m133-11 4 11" /></g>}
      {sealed ? <><path d="m49 54 91 76 85-76" fill="none" /><path d="M132 39v279m16-279v279M48 153l180 28M48 170l180 28" fill="none" stroke="#d7af69" strokeWidth="5" /></> : <g fill="#d9b678" stroke="none"><path d="m72 69 4-10 4 10 10 4-10 4-4 10-4-10-10-4Zm123 191 4-10 4 10 10 4-10 4-4 10-4-10-10-4Z" /><path d="m191 67 5-9 5 9 9 5-9 5-5 9-5-9-9-5Z" /></g>}
      </g>
      <circle cx="140" cy="168" r="68" fill={sealed ? '#a64a35' : '#dbc295'} /><circle cx="140" cy="168" r="59" fill="none" stroke={sealed ? '#612d20' : '#806540'} strokeWidth="2" />
      <g transform="translate(93 121) scale(3.92)" strokeWidth=".6">
        {themed ? <ElementGlyph element={element} color={color} highlight="#ddc797" /> : lucky ? <path d="m12 1 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Z" fill="#b49145" /> : sealed ? <path d="m4 20 3-5-2-4 3-3-1-5 5 3 5-4-1 5 5 4-2 3-5-1-1 3 3 2-2 4-4-3-3 3Z" fill="#281c13" /> : <g fill="#34383a"><ellipse cx="5" cy="7" rx="2.5" ry="4" /><ellipse cx="12" cy="5" rx="2.5" ry="4" /><ellipse cx="19" cy="7" rx="2.5" ry="4" /><path d="M4 19q0-5 5-6 3-4 6 0 5 1 5 6-2 5-8 2-6 3-8-2Z" /></g>}
      </g>
    </g>
  </svg>
}
