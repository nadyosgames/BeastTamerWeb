import type { MapFeature } from '../../core/types.ts'
import { smoothPath, type DoodleKind } from './mapStyle.ts'

/**
 * Harita çizimleri: 1930'lar mürekkep-parşömen dilinde küçük arazi işaretleri (SVG).
 * Hepsi (0,0) merkezli çizilir; konum ve ölçek `transform` ile verilir. Renkler bilinçli
 * olarak az: parşömen tonları, sepya ve sıcak siyah mürekkep.
 */
export const INK = '#281c13'
export const SEPIA = '#7a5530'

type P = { x: number; y: number; s?: number }
const at = ({ x, y, s = 1 }: P) => `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(2)})`

export function Mountain(p: P) {
  return (
    <g transform={at(p)}>
      <path d="M-46 30 L-8 -34 L6 -14 L18 -30 L52 30 Z" fill="#cdb084" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M-8 -34 L-2 -10 L6 -14 M18 -30 L22 -12" fill="none" stroke={INK} strokeWidth="2" />
      <path d="M-30 22 l8 -12 m2 14 l8 -12 m18 12 l6 -9 m6 9 l5 -8" stroke={SEPIA} strokeWidth="1.6" />
      <path d="M-8 -34 L-16 -20 L-8 -22 L-2 -16 Z" fill="#f4e4c3" stroke={INK} strokeWidth="1.6" />
    </g>
  )
}

export function SnowPeak(p: P) {
  return (
    <g transform={at(p)}>
      <path d="M-58 36 L-10 -46 L8 -20 L24 -40 L62 36 Z" fill="#c9c1b0" stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
      <path d="M-10 -46 L-24 -22 L-14 -26 L-6 -16 L2 -28 L8 -20 Z M24 -40 L14 -24 L22 -26 L30 -20 Z" fill="#fbf6ea" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M-40 28 l10 -14 m6 16 l9 -13 m26 13 l7 -10" stroke={SEPIA} strokeWidth="1.6" />
    </g>
  )
}

export function Volcano(p: P) {
  return (
    <g transform={at(p)}>
      <path d="M-86 50 L-26 -48 L-10 -42 L6 -48 L84 50 Z" fill="#9c8462" stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
      <path d="M-26 -48 Q-10 -58 6 -48 Q-10 -36 -26 -48 Z" fill="#ba5138" stroke={INK} strokeWidth="2" />
      <path d="M-18 -42 L-30 -6 M0 -42 L14 -10" stroke="#ba5138" strokeWidth="3" />
      <path d="M-64 40 l12 -18 m14 18 l10 -16 m40 16 l-10 -16 m26 16 l-10 -16" stroke={SEPIA} strokeWidth="1.6" />
      <g fill="#d9c6a6" stroke={INK} strokeWidth="2">
        <circle cx="4" cy="-74" r="13" />
        <circle cx="24" cy="-92" r="16" />
        <circle cx="50" cy="-108" r="12" />
      </g>
    </g>
  )
}

export function Hill(p: P) {
  return (
    <g transform={at(p)}>
      <path d="M-90 20 C-60 -25 60 -25 90 20" fill="#e4c890" stroke={INK} strokeWidth="2.6" />
      <path d="M0 -12 v-8 M-20 -8 l-5 -6 M20 -8 l5 -6" stroke="#b58a3a" strokeWidth="2" />
    </g>
  )
}

export function Mesa(p: P) {
  return (
    <g transform={at(p)}>
      <path d="M-70 34 L-48 -18 L44 -18 L66 34 Z" fill="#cf8e5a" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M-48 -18 L44 -18 L40 -8 L-44 -8 Z" fill="#e7b07c" stroke={INK} strokeWidth="1.8" />
      <path d="M-40 6 h20 M-6 14 h26 M18 2 h18" stroke={SEPIA} strokeWidth="1.6" />
    </g>
  )
}

export function Crystal(p: P) {
  return (
    <g transform={at(p)}>
      <path d="M-26 30 L-30 -4 L-18 -30 L-8 -2 L-12 30 Z" fill="#b9a7cf" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M-8 30 L-10 -16 L4 -46 L18 -14 L12 30 Z" fill="#cfc0e2" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M12 30 L16 0 L28 -18 L34 4 L28 30 Z" fill="#a993c4" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M4 -46 L2 0 M-18 -30 L-16 0" stroke="#f4eefa" strokeWidth="2" />
      <path d="M-40 31 h82" stroke={INK} strokeWidth="2.4" />
    </g>
  )
}

export function Ruin(p: P) {
  return (
    <g transform={at(p)}>
      <path d="M-44 30 h88" stroke={INK} strokeWidth="2.6" />
      <rect x="-36" y="-26" width="14" height="56" fill="#d8c8a6" stroke={INK} strokeWidth="2.2" />
      <path d="M-6 30 V-6 l6 -6 l8 4 V30 Z" fill="#d8c8a6" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      <rect x="22" y="2" width="14" height="28" fill="#d8c8a6" stroke={INK} strokeWidth="2.2" />
      <path d="M-40 -30 h22 M18 -2 h22" stroke={INK} strokeWidth="3" />
      <path d="M-30 -14 v30 M28 10 v16" stroke={SEPIA} strokeWidth="1.4" />
    </g>
  )
}

export function Lighthouse(p: P) {
  return (
    <g transform={at(p)}>
      <path d="M-14 40 L-9 -26 L9 -26 L14 40 Z" fill="#f2e6cb" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M-12 14 L12 14 L13 26 L-13 26 Z M-10 -8 L10 -8 L11 2 L-11 2 Z" fill="#a43c2c" stroke={INK} strokeWidth="1.8" />
      <rect x="-11" y="-40" width="22" height="14" fill="#ffd56a" stroke={INK} strokeWidth="2.2" />
      <path d="M-14 -40 L0 -52 L14 -40 Z" fill="#a43c2c" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M14 -33 L46 -44 M14 -33 L46 -22 M-14 -33 L-46 -44 M-14 -33 L-46 -22" stroke="#d9a63f" strokeWidth="2" strokeDasharray="4 5" />
      <path d="M-30 40 h60" stroke={INK} strokeWidth="2.6" />
    </g>
  )
}

export function Pine(p: P) {
  return (
    <g transform={at(p)}>
      <path d="M0 -26 L12 -6 L6 -6 L15 8 L-15 8 L-6 -6 L-12 -6 Z" fill="#77834b" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M0 8 v8" stroke={INK} strokeWidth="3" />
    </g>
  )
}

function Oak(p: P) {
  return (
    <g transform={at(p)}>
      <path d="M-3 18 L-2 2 M3 18 L2 2" stroke={INK} strokeWidth="3" />
      <path d="M-18 4 C-30 -2 -24 -22 -10 -20 C-8 -34 14 -32 14 -20 C28 -22 30 -2 18 4 C10 10 -10 10 -18 4 Z" fill="#8f9a55" stroke={INK} strokeWidth="2" />
      <path d="M-8 -10 q4 -4 8 0 M6 -2 q3 -3 6 0" fill="none" stroke="#5c6634" strokeWidth="1.6" />
    </g>
  )
}

function Mushroom(p: P) {
  return (
    <g transform={at(p)}>
      <path d="M-4 14 L-3 0 L3 0 L4 14 Z" fill="#f2e6cb" stroke={INK} strokeWidth="1.8" />
      <path d="M-14 1 C-14 -12 14 -12 14 1 Z" fill="#b5523b" stroke={INK} strokeWidth="2" />
      <circle cx="-5" cy="-5" r="2" fill="#f4e4c3" />
      <circle cx="5" cy="-3" r="1.6" fill="#f4e4c3" />
    </g>
  )
}

function Palm(p: P) {
  return (
    <g transform={at(p)}>
      <path d="M2 22 C0 6 4 -8 10 -18" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <path d="M10 -18 C0 -26 -14 -22 -18 -12 M10 -18 C18 -28 30 -24 32 -14 M10 -18 C8 -30 16 -36 22 -34 M10 -18 C4 -10 -6 -6 -8 2" fill="none" stroke="#5f7a3c" strokeWidth="4" strokeLinecap="round" />
      <path d="M-10 22 h26" stroke={INK} strokeWidth="2" />
    </g>
  )
}

function Rock(p: P) {
  return (
    <g transform={at(p)}>
      <path d="M-16 8 L-12 -6 L-2 -12 L10 -8 L16 6 Z" fill="#bfae8e" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M-4 -6 L0 4" stroke={SEPIA} strokeWidth="1.4" />
    </g>
  )
}

function Wave(p: P) {
  return (
    <g transform={at(p)} fill="none" stroke="#5f8a8e" strokeWidth="2.2" strokeLinecap="round">
      <path d="M-22 0 q6 -7 11 0 t11 0 t11 0 t11 0" />
      <path d="M-14 9 q5 -6 9 0 t9 0 t9 0" opacity=".6" />
    </g>
  )
}

function Cactus(p: P) {
  return (
    <g transform={at(p)}>
      <path d="M-4 18 V-16 Q0 -22 4 -16 V18 Z M-4 2 H-11 V-8 Q-14 -12 -11 -14 M4 -2 H11 V-12 Q14 -16 11 -18" fill="#7c8e4b" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M-10 18 h20" stroke={INK} strokeWidth="2" />
    </g>
  )
}

function Dune(p: P) {
  return (
    <g transform={at(p)} fill="none" stroke="#a8743f" strokeWidth="2" strokeLinecap="round">
      <path d="M-30 6 C-18 -8 -2 -8 8 4" />
      <path d="M-4 10 C8 0 22 0 32 10" opacity=".7" />
    </g>
  )
}

function Reed(p: P) {
  return (
    <g transform={at(p)} strokeLinecap="round">
      <path d="M-6 14 Q-8 0 -10 -14 M0 14 V-18 M6 14 Q8 0 12 -12" fill="none" stroke="#5c6634" strokeWidth="2" />
      <rect x="-2.5" y="-24" width="5" height="10" rx="2.5" fill="#7a5530" stroke={INK} strokeWidth="1.4" />
      <path d="M-14 14 h28" stroke="#5f8a8e" strokeWidth="2" />
    </g>
  )
}

function DeadTree(p: P) {
  return (
    <g transform={at(p)} fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round">
      <path d="M0 20 V-4 L-10 -16 M0 -4 L9 -18 M-6 -10 L-14 -10 M5 -12 L12 -10" />
      <path d="M-10 20 h20" strokeWidth="2" />
    </g>
  )
}

function Cloud(p: P) {
  return (
    <g transform={at(p)}>
      <path d="M-26 8 C-34 8 -34 -4 -24 -6 C-24 -16 -10 -18 -6 -10 C-2 -20 16 -20 16 -8 C26 -10 30 4 20 8 Z" fill="#f4ecd9" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
    </g>
  )
}

function Bolt(p: P) {
  return (
    <g transform={at(p)}>
      <path d="M2 -16 L-8 2 L0 2 L-4 16 L10 -4 L2 -4 Z" fill="#e2b33e" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
    </g>
  )
}

function Tuft(p: P) {
  return (
    <g transform={at(p)} fill="none" stroke={SEPIA} strokeWidth="1.8" strokeLinecap="round">
      <path d="M-6 6 L-9 -4 M0 6 V-7 M6 6 L9 -4" />
    </g>
  )
}

function Bones(p: P) {
  return (
    <g transform={at(p)} fill="#efe4cc" stroke={INK} strokeWidth="1.8">
      <path d="M-14 4 C-14 -8 6 -10 10 -2 C14 6 -2 12 -14 4 Z" />
      <circle cx="-6" cy="-1" r="2" fill={INK} />
      <path d="M8 6 l10 4 M10 2 l12 0" strokeLinecap="round" />
    </g>
  )
}


const DOODLE: Record<DoodleKind, (p: P) => React.JSX.Element> = {
  mountain: (p) => <Mountain {...p} s={(p.s ?? 1) * 0.62} />,
  snowpeak: (p) => <SnowPeak {...p} s={(p.s ?? 1) * 0.55} />,
  pine: Pine,
  oak: Oak,
  mushroom: Mushroom,
  palm: Palm,
  rock: Rock,
  wave: Wave,
  cactus: Cactus,
  dune: Dune,
  crystal: (p) => <Crystal {...p} s={(p.s ?? 1) * 0.6} />,
  reed: Reed,
  deadtree: DeadTree,
  cloud: Cloud,
  bolt: Bolt,
  tuft: Tuft,
  bones: Bones,
}

export function Doodle({ kind, x, y, s }: { kind: DoodleKind } & P) {
  const D = DOODLE[kind]
  return <D x={x} y={y} s={s} />
}



/** Bölge haritasına elle konmuş şekil (konum bölge alanında 0..1). */
export function Feature({ f, area }: { f: MapFeature; area: readonly [number, number, number, number] }) {
  const [ax, ay, aw, ah] = area
  const wx = (p: readonly [number, number]): [number, number] => [ax + p[0] * aw, ay + p[1] * ah]
  switch (f.kind) {
    case 'river': {
      const d = smoothPath(f.points.map(wx))
      return (
        <g>
          <path d={d} fill="none" stroke={INK} strokeWidth="22" strokeLinecap="round" opacity=".9" />
          <path d={d} fill="none" stroke="#86b3bf" strokeWidth="16" strokeLinecap="round" />
        </g>
      )
    }
    case 'lake': {
      const [x, y] = wx(f.pos)
      return (
        <g>
          <ellipse cx={x} cy={y} rx={f.size[0]} ry={f.size[1]} fill="#9cc4c6" stroke={INK} strokeWidth="2.4" />
          <path d={`M${x - f.size[0] * 0.4} ${y - 2} q6 -4 12 0 M${x + f.size[0] * 0.1} ${y + 3} q5 -3 10 0`} fill="none" stroke="#e6f1ee" strokeWidth="1.8" />
        </g>
      )
    }
    case 'landmark': {
      const [x, y] = wx(f.pos)
      const p = { x, y, s: f.scale ?? 1 }
      switch (f.style) {
        case 'mountain':
          return <Mountain {...p} />
        case 'volcano':
          return <Volcano {...p} />
        case 'hill':
          return <Hill {...p} />
        case 'mesa':
          return <Mesa {...p} />
        case 'crystal':
          return <Crystal {...p} />
        case 'snowpeak':
          return <SnowPeak {...p} />
        case 'ruin':
          return <Ruin {...p} />
        case 'lighthouse':
          return <Lighthouse {...p} />
      }
      return null
    }
    case 'label': {
      const [x, y] = wx(f.pos)
      return (
        <text x={x} y={y} textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontSize="19" fill={SEPIA} transform={f.rotate ? `rotate(${f.rotate} ${x} ${y})` : undefined}>
          {f.text}
        </text>
      )
    }
  }
}

export function Camp({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-34 22 L0 -30 L34 22 Z" fill="#c9734f" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M0 -30 L-10 22 M0 -30 L10 22" stroke={INK} strokeWidth="2" />
      <path d="M-6 22 L0 4 L6 22 Z" fill={INK} />
      <path d="M0 -30 v-14 l14 5 -14 5" fill="#a43c2c" stroke={INK} strokeWidth="2" />
      <path d="M-46 24 h92" stroke={INK} strokeWidth="2.4" />
    </g>
  )
}

export function Compass({ x, y, s = 1 }: P) {
  return (
    <g transform={at({ x, y, s })}>
      <circle r="38" fill="#f4e4c3" stroke={INK} strokeWidth="2.4" />
      <circle r="30" fill="none" stroke={SEPIA} strokeWidth="1.2" />
      <path d="M0 -34 L7 0 L0 34 L-7 0 Z" fill="#a43c2c" stroke={INK} strokeWidth="1.8" />
      <path d="M-34 0 L0 -6 L34 0 L0 6 Z" fill="#cdb084" stroke={INK} strokeWidth="1.6" />
      <text y="-44" textAnchor="middle" fontSize="15" fontWeight="900" fill={INK}>
        K
      </text>
    </g>
  )
}

export function SeaSerpent({ x, y, s = 1 }: P) {
  return (
    <g transform={at({ x, y, s })} stroke={INK} strokeWidth="2.4" strokeLinejoin="round">
      <path d="M-60 10 C-50 -14 -36 -14 -30 10 M-14 10 C-6 -16 10 -16 16 10" fill="none" />
      <path d="M30 10 C34 -22 56 -30 64 -16 C70 -6 60 2 52 -2 C48 -12 40 -4 42 10" fill="#7f9f8f" />
      <circle cx="58" cy="-17" r="2.2" fill={INK} />
      <path d="M-70 12 q8 -6 16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0" fill="none" stroke="#5f8a8e" strokeWidth="2" />
    </g>
  )
}
