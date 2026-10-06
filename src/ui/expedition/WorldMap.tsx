import { memo, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
import { hashId } from '../../core/expedition.ts'
import { createRng } from '../../core/rng.ts'
import type { HuntDef, RegionDef, WorldDef } from '../../core/types.ts'
import { GameIcon } from '../components/GameIcon.tsx'
import { PreyMedallion } from '../components/HuntBits.tsx'
import { WeatherIcon } from '../components/WeatherIcon.tsx'
import { content } from '../content.ts'
import { huntName, STARS } from '../hunt.ts'
import { Camp, Compass, Doodle, Feature, INK, SEPIA, SeaSerpent } from './mapArt.tsx'
import { BIOME_STYLE, huntWorldPos, smoothPath, worldPos, type DoodleKind } from './mapStyle.ts'
import './WorldMap.css'

/**
 * Dünya haritası (GDD v0.9 "Dünya ve biyomlar"): tüm bölgeler tek bir mürekkep-parşömen tuvalde.
 * Sürükle → kaydır, tekerlek/düğmeler → yakınlaş. Uzaktan bakınca bölge rozetleri (ad, ilerleme,
 * kilit), yakından yaratık düğümleri görünür. Arazi SVG (viewBox ile kaydırılır, çizim bir kez
 * kurulur); düğümler HTML (ekran ölçüsünde, görünür olanlar).
 */
export interface MapNodeState {
  hunt: HuntDef
  /** 'open': bugün avlanabilir · 'notToday': iz yok · 'locked': kilitli · 'camp': seferde değilsin · 'elsewhere': sefer başka bölgede */
  status: 'open' | 'notToday' | 'locked' | 'camp' | 'elsewhere'
  stars: number
  captured: boolean
  wounded: boolean
  siege: boolean
}

export interface RegionState {
  region: RegionDef
  unlocked: boolean
  captured: number
  total: number
  book: boolean
  final: boolean
  /** Sefer bu bölgede. */
  active: boolean
  unlockText: string
}

export type MapSelection = { kind: 'hunt'; id: string } | { kind: 'region'; id: string }

interface View {
  x: number
  y: number
  z: number
}

/** Bu yakınlığın altında yaratık düğümleri yerine bölge rozetleri görünür. */
const DETAIL_ZOOM = 0.4
const MAX_ZOOM = 1.5


function fitView(rect: readonly [number, number, number, number], w: number, h: number, pad: number): View {
  const [rx, ry, rw, rh] = rect
  const z = Math.min(w / (rw + pad * 2), h / (rh + pad * 2))
  return { x: rx + rw / 2 - w / (2 * z), y: ry + rh / 2 - h / (2 * z), z }
}

// ---------------------------------------------------------------------------
// Arazi (bir kez çizilir)
// ---------------------------------------------------------------------------

/** Dikdörtgen alanın çevresinde, tohumlu dalgalı bir kenar (bölge lekesi). */
function blobPoints(area: readonly [number, number, number, number], seed: number, wobble = 26, step = 120): [number, number][] {
  const rng = createRng(seed)
  const [x, y, w, h] = area
  const inset = 12
  const corners: [number, number][] = [
    [x + inset, y + inset],
    [x + w - inset, y + inset],
    [x + w - inset, y + h - inset],
    [x + inset, y + h - inset],
  ]
  const pts: [number, number][] = []
  for (let c = 0; c < 4; c++) {
    const a = corners[c]
    const b = corners[(c + 1) % 4]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const n = Math.max(2, Math.round(len / step))
    // Kenarın dışa dönük normali.
    const nx = (b[1] - a[1]) / len
    const ny = -(b[0] - a[0]) / len
    for (let i = 0; i < n; i++) {
      const t = i / n
      const off = (rng.next() - 0.5) * 2 * wobble
      // Köşeleri yuvarla: köşeye yakın noktaları içe çek.
      const corner = i === 0 ? -wobble * 0.9 : 0
      pts.push([a[0] + (b[0] - a[0]) * t + nx * (off + corner), a[1] + (b[1] - a[1]) * t + ny * (off + corner)])
    }
  }
  return pts
}

/** Kıtanın ana hatları (dünya birimi): batıda ve doğuda deniz. */
function continentPoints(world: WorldDef): [number, number][] {
  const [W, H] = world.size
  const rng = createRng(hashId(world.name))
  const raw: [number, number][] = [
    [150, 20], [900, 10], [1800, 20], [2700, 10], [3600, 18], [W - 60, 30],
    [W - 50, 420], [W - 70, 820], [3900, 840], [3810, 1100], [3830, 1500], [3790, 1900], [3820, 2300], [3700, H - 20],
    [2700, H - 10], [1800, H - 20], [900, H - 10], [180, H - 30],
    [110, 2200], [80, 1800], [60, 1400], [90, 1000], [70, 600], [110, 220],
  ]
  // Kıyıyı ara noktalarla dalgalandır.
  const out: [number, number][] = []
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i]
    const b = raw[(i + 1) % raw.length]
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 160))
    for (let k = 0; k < n; k++) {
      const t = k / n
      const j = k === 0 ? 0 : 18
      out.push([a[0] + (b[0] - a[0]) * t + (rng.next() - 0.5) * j * 2, a[1] + (b[1] - a[1]) * t + (rng.next() - 0.5) * j * 2])
    }
  }
  return out
}

interface Obstacle {
  x: number
  y: number
  r: number
}

/** Bölgeye serpiştirilen işaretler: düğümlerden, kamptan, yer şekillerinden ve patikalardan uzak. */
function scatterDoodles(region: RegionDef, hunts: readonly HuntDef[]): { kind: DoodleKind; x: number; y: number; s: number }[] {
  const style = BIOME_STYLE[region.biome]
  const rng = createRng(hashId(`${region.id}:doodles`))
  const [ax, ay, aw, ah] = region.area
  const obstacles: Obstacle[] = [
    ...hunts.map((h) => {
      const [x, y] = worldPos(region, h.pos)
      return { x, y: y + 20, r: 110 }
    }),
    (() => {
      const [x, y] = worldPos(region, region.map.camp)
      return { x, y, r: 90 }
    })(),
    ...(region.map.features ?? []).flatMap((f) => {
      if (f.kind === 'river') return f.points.map((p) => ({ ...xy(worldPos(region, p)), r: 40 }))
      const [x, y] = worldPos(region, f.pos)
      return [{ x, y, r: f.kind === 'label' ? 95 : f.kind === 'lake' ? Math.max(f.size[0], 50) + 20 : 100 * (f.kind === 'landmark' ? (f.scale ?? 1) : 1) }]
    }),
  ]
  const segs = region.map.paths.map(([a, b]) => [a === 'camp' ? worldPos(region, region.map.camp) : worldPos(region, content.hunt(a).pos), b === 'camp' ? worldPos(region, region.map.camp) : worldPos(region, content.hunt(b).pos)] as const)
  const nearSeg = (x: number, y: number) =>
    segs.some(([p, q]) => {
      const dx = q[0] - p[0]
      const dy = q[1] - p[1]
      const t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (y - p[1]) * dy) / (dx * dx + dy * dy || 1)))
      return Math.hypot(p[0] + dx * t - x, p[1] + dy * t - y) < 34
    })
  const total = style.doodles.reduce((a, [, w]) => a + w, 0)
  const pick = () => {
    let r = rng.next() * total
    for (const [k, w] of style.doodles) if ((r -= w) <= 0) return k
    return style.doodles[0][0]
  }
  const target = Math.round((aw * ah) / 26000)
  const out: { kind: DoodleKind; x: number; y: number; s: number }[] = []
  for (let tries = 0; tries < target * 30 && out.length < target; tries++) {
    const x = ax + 50 + rng.next() * (aw - 100)
    const y = ay + 60 + rng.next() * (ah - 110)
    if (obstacles.some((o) => Math.hypot(o.x - x, o.y - y) < o.r)) continue
    if (out.some((d) => Math.hypot(d.x - x, d.y - y) < 62)) continue
    if (nearSeg(x, y)) continue
    out.push({ kind: pick(), x, y, s: 0.85 + rng.next() * 0.4 })
  }
  return out.sort((a, b) => a.y - b.y)
}

const xy = (p: readonly [number, number]) => ({ x: p[0], y: p[1] })

const WorldArt = memo(function WorldArt({ world, regions }: { world: WorldDef; regions: readonly RegionState[] }) {
  const [W, H] = world.size
  const continent = useMemo(() => smoothPath(continentPoints(world), true), [world])
  const blobs = useMemo(() => new Map(regions.map((r) => [r.region.id, smoothPath(blobPoints(r.region.area, hashId(r.region.id)), true)])), [regions])
  const doodles = useMemo(() => new Map(regions.map((r) => [r.region.id, scatterDoodles(r.region, content.regionHunts(r.region.id))])), [regions])
  const seaWaves = useMemo(() => {
    const rng = createRng(77)
    const out: [number, number][] = []
    for (let i = 0; i < 40; i++) {
      const west = i % 2 === 0
      out.push(west ? [10 + rng.next() * 60, 80 + rng.next() * (H - 160)] : [3880 + rng.next() * (W - 3920), 900 + rng.next() * (H - 980)])
    }
    return out
  }, [W, H])

  // Bölgeler arası yollar: kilit grafiği (kamptan kampa).
  const roads = regions.flatMap((r) =>
    r.region.unlock.kind === 'finals'
      ? r.region.unlock.regions.map((from) => {
          const a = content.region(from)
          return { key: `${from}-${r.region.id}`, from: worldPos(a, a.map.camp), to: worldPos(r.region, r.region.map.camp), open: r.unlocked }
        })
      : [],
  )

  return (
    <g aria-hidden="true">
      <defs>
        <pattern id="wm-fog" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <rect width="22" height="22" fill="#d8c4a0" />
          <path d="M0 0 V22" stroke="#9c7f58" strokeWidth="3" opacity=".55" />
        </pattern>
        <pattern id="wm-sea" width="60" height="30" patternUnits="userSpaceOnUse">
          <rect width="60" height="30" fill="#b8cfc4" />
          <path d="M4 18 q7 -6 14 0 t14 0" fill="none" stroke="#8fb0a8" strokeWidth="1.6" />
        </pattern>
      </defs>
      {/* Deniz ve kıta */}
      <rect x={-2000} y={-2000} width={W + 4000} height={H + 4000} fill="url(#wm-sea)" />
      <path d={continent} fill="#dfc79c" stroke={INK} strokeWidth="5" />
      <path d={continent} fill="none" stroke="#9c7a4a" strokeWidth="2" strokeDasharray="2 14" transform="translate(0 0)" opacity=".7" />
      {seaWaves.map(([x, y], i) => (
        <path key={i} d={`M${x} ${y} q8 -7 16 0 t16 0`} fill="none" stroke="#5f8a8e" strokeWidth="2.4" strokeLinecap="round" />
      ))}
      <SeaSerpent x={50} y={1950} s={0.9} />
      <SeaSerpent x={4120} y={1700} s={1.1} />
      <g fontFamily="Georgia, serif" fontStyle="italic" fontSize="34" fill="#4f6f72" textAnchor="middle">
        <text x={62} y={1250} transform="rotate(-90 62 1250)">Batı Denizi</text>
        <text x={4110} y={1320}>Doğu Denizi</text>
      </g>

      {/* Bölgeler arası yollar (bölgelerin altında: aradaki topraklarda görünür) */}
      <g fill="none" strokeLinecap="round">
        {roads.map((rd) => {
          const [x1, y1] = rd.from
          const [x2, y2] = rd.to
          const mx = (x1 + x2) / 2 + (y2 - y1) * 0.1
          const my = (y1 + y2) / 2 - (x2 - x1) * 0.1
          return (
            <g key={rd.key}>
              <path d={`M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`} stroke="#f1e2c0" strokeWidth="16" opacity=".8" />
              <path d={`M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`} stroke={rd.open ? '#6b4a2a' : '#a88a62'} strokeWidth={rd.open ? 6 : 4} strokeDasharray={rd.open ? '14 12' : '3 14'} />
            </g>
          )
        })}
      </g>

      {/* Bölgeler: leke, kenar, işaretler */}
      {regions.map((r) => {
        const style = BIOME_STYLE[r.region.biome]
        const blob = blobs.get(r.region.id)!
        return (
          <g key={r.region.id}>
            <path d={blob} fill={style.fill} stroke={INK} strokeWidth="4" />
            <path d={blob} fill="none" stroke={style.edge} strokeWidth="10" opacity=".22" />
            {(r.region.map.features ?? []).filter((f) => f.kind === 'river' || f.kind === 'lake').map((f, i) => (
              <Feature key={`w${i}`} f={f} area={r.region.area} />
            ))}
            {doodles.get(r.region.id)!.map((d, i) => (
              <Doodle key={i} kind={d.kind} x={d.x} y={d.y} s={d.s} />
            ))}
            {(r.region.map.features ?? []).filter((f) => f.kind === 'landmark' || f.kind === 'label').map((f, i) => (
              <Feature key={`f${i}`} f={f} area={r.region.area} />
            ))}
          </g>
        )
      })}

      {/* Bölge içi patikalar ve kamplar */}
      {regions.map((r) => (
        <g key={`p-${r.region.id}`} fill="none" strokeLinecap="round">
          {r.region.map.paths.map(([a, b]) => {
            const pa = a === 'camp' ? worldPos(r.region, r.region.map.camp) : worldPos(r.region, content.hunt(a).pos)
            const pb = b === 'camp' ? worldPos(r.region, r.region.map.camp) : worldPos(r.region, content.hunt(b).pos)
            const mx = (pa[0] + pb[0]) / 2 + (pb[1] - pa[1]) * 0.12
            const my = (pa[1] + pb[1]) / 2 - (pb[0] - pa[0]) * 0.12
            return <path key={`${a}-${b}`} d={`M${pa[0]} ${pa[1]} Q${mx} ${my} ${pb[0]} ${pb[1]}`} stroke={r.unlocked ? '#5a3e24' : '#a88a62'} strokeWidth={r.unlocked ? 4.2 : 3} strokeDasharray={r.unlocked ? '2 12' : '1 12'} />
          })}
          {r.unlocked && (
            <g>
              <Camp {...xy(worldPos(r.region, r.region.map.camp))} />
              <text x={worldPos(r.region, r.region.map.camp)[0]} y={worldPos(r.region, r.region.map.camp)[1] + 50} textAnchor="middle" fontFamily="Georgia, serif" fontWeight="900" fontSize="20" fill={INK}>
                KAMP
              </text>
            </g>
          )}
        </g>
      ))}

      {/* Kilitli bölgeler: tarama + sis */}
      {regions.filter((r) => !r.unlocked).map((r) => (
        <path key={`fog-${r.region.id}`} d={blobs.get(r.region.id)!} fill="url(#wm-fog)" opacity=".72" stroke={INK} strokeWidth="4" />
      ))}

      {/* Bölge adları (yakından okunur, uzaktan rozet var) */}
      <g fontFamily="var(--font-display), Georgia, serif" fontWeight="900" textAnchor="middle" fill={SEPIA} opacity=".55">
        {regions.map((r) => (
          <text key={`n-${r.region.id}`} x={r.region.area[0] + r.region.area[2] / 2} y={r.region.area[1] + 50} fontSize="46" letterSpacing="4">
            {r.region.name.toLocaleUpperCase('tr-TR')}
          </text>
        ))}
      </g>

      {/* Başlık kartuşu ve pusula */}
      <g transform="translate(640 2330)">
        <path d="M-330 -48 H330 L360 0 L330 48 H-330 L-360 0 Z" fill="#f2e2bf" stroke={INK} strokeWidth="4" />
        <path d="M-310 -36 H310 L334 0 L310 36 H-310 L-334 0 Z" fill="none" stroke={SEPIA} strokeWidth="1.6" />
        <text y="14" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="900" fontSize="40" fill={INK} letterSpacing="6">
          {world.name.toLocaleUpperCase('tr-TR')}
        </text>
      </g>
      <Compass x={W - 260} y={H - 200} s={2.2} />
    </g>
  )
})

// ---------------------------------------------------------------------------
// Harita
// ---------------------------------------------------------------------------

export function WorldMap({
  world,
  regions,
  nodes,
  selected,
  focus,
  home,
  onSelect,
  width,
  height,
}: {
  world: WorldDef
  regions: RegionState[]
  nodes: MapNodeState[]
  selected: MapSelection | null
  /** Görünüşün odaklandığı bölge (değişince oraya kayar). */
  focus: string
  /** "BÖLGE" düğmesinin götürdüğü bölge (odaktaki bölge). */
  home: string
  onSelect: (s: MapSelection) => void
  width: number
  height: number
}) {
  const [W, H] = world.size
  const minZoom = Math.min(width / W, height / H) * 0.98
  const regionRect = (id: string) => content.region(id).area
  const [view, setView] = useState<View>(() => fitView(regionRect(focus), width, height, 30))
  const viewRef = useRef(view)
  viewRef.current = view
  const anim = useRef<number | null>(null)
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean; id: number } | null>(null)

  const clamp = (v: View): View => {
    const z = Math.max(minZoom, Math.min(MAX_ZOOM, v.z))
    const vw = width / z
    const vh = height / z
    const mx = Math.max(0, (vw - W) / 2)
    const my = Math.max(0, (vh - H) / 2)
    return { z, x: Math.max(-mx - 200, Math.min(W - vw + mx + 200, v.x)), y: Math.max(-my - 200, Math.min(H - vh + my + 200, v.y)) }
  }

  const animateTo = (target: View, ms = 420) => {
    if (anim.current) cancelAnimationFrame(anim.current)
    const from = viewRef.current
    const to = clamp(target)
    const t0 = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms)
      const e = 1 - (1 - t) ** 3
      setView({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, z: from.z * (to.z / from.z) ** e })
      anim.current = t < 1 ? requestAnimationFrame(step) : null
    }
    anim.current = requestAnimationFrame(step)
  }

  // Odak bölgesi değişince (ör. başka bölgede sefere çıkıldı) oraya kay.
  const lastFocus = useRef(focus)
  useEffect(() => {
    if (lastFocus.current === focus) return
    lastFocus.current = focus
    animateTo(fitView(regionRect(focus), width, height, 30))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus])
  useEffect(() => () => {
    if (anim.current) cancelAnimationFrame(anim.current)
  }, [])

  const toWorld = (sx: number, sy: number) => ({ x: view.x + sx / view.z, y: view.y + sy / view.z })
  const local = (e: { clientX: number; clientY: number; currentTarget: Element }) => {
    const r = e.currentTarget.getBoundingClientRect()
    // Stage ölçeklenmiş olabilir: ekran pikselini harita pikseline çevir.
    return { sx: ((e.clientX - r.left) * width) / r.width, sy: ((e.clientY - r.top) * height) / r.height, k: width / r.width }
  }

  const zoomAt = (sx: number, sy: number, factor: number, animate = false) => {
    const v = viewRef.current
    const z = Math.max(minZoom, Math.min(MAX_ZOOM, v.z * factor))
    const wx = v.x + sx / v.z
    const wy = v.y + sy / v.z
    const next = clamp({ z, x: wx - sx / z, y: wy - sy / z })
    if (animate) animateTo(next, 260)
    else setView(next)
  }

  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    const { sx, sy } = local(e)
    zoomAt(sx, sy, Math.exp(-e.deltaY * 0.0016))
  }

  const regionAt = (wx: number, wy: number) => regions.find((r) => {
    const [x, y, w, h] = r.region.area
    return wx >= x && wx <= x + w && wy >= y && wy <= y + h
  })

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    if (anim.current) cancelAnimationFrame(anim.current)
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false, id: e.pointerId }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    const { k } = local(e)
    const dx = (e.clientX - d.x) * k
    const dy = (e.clientY - d.y) * k
    if (!d.moved && Math.hypot(dx, dy) < 5) return
    d.moved = true
    setView(clamp({ z: view.z, x: d.vx - dx / view.z, y: d.vy - dy / view.z }))
  }
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    drag.current = null
    if (!d || d.moved) return
    const { sx, sy } = local(e)
    const w = toWorld(sx, sy)
    const r = regionAt(w.x, w.y)
    if (!r) return
    onSelect({ kind: 'region', id: r.region.id })
    if (view.z < DETAIL_ZOOM) animateTo(fitView(r.region.area, width, height, 30))
  }

  // Arazi yalnızca bölge kilitleri değişince yeniden çizilir (kaydırma yalnızca viewBox'ı değiştirir).
  const artSig = regions.map((r) => (r.unlocked ? '1' : '0')).join('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const artRegions = useMemo(() => regions, [artSig])
  const detail = view.z >= DETAIL_ZOOM
  const nodeScale = Math.max(0.55, Math.min(1.12, view.z / 0.8))
  const byRegion = new Map(regions.map((r) => [r.region.id, r]))
  const inView = (x: number, y: number, m: number) => x > view.x - m && x < view.x + width / view.z + m && y > view.y - m && y < view.y + height / view.z + m
  const focusRegion = byRegion.get(focus)

  return (
    <div
      className={`world-map ${detail ? 'is-detail' : 'is-overview'}`}
      style={{ width, height }}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (drag.current = null)}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return
        const { sx, sy } = local(e)
        zoomAt(sx, sy, 1.8, true)
      }}
    >
      <svg className="world-map__art" width={width} height={height} viewBox={`${view.x} ${view.y} ${width / view.z} ${height / view.z}`} role="img" aria-label={`${world.name} haritası`}>
        <WorldArt world={world} regions={artRegions} />
      </svg>

      {detail &&
        nodes.map((n) => {
          const r = byRegion.get(n.hunt.region)
          if (!r?.unlocked) return null
          const [wx, wy] = huntWorldPos(n.hunt)
          if (!inView(wx, wy, 160)) return null
          const big = ['final', 'legendary', 'mythic', 'ancient'].includes(n.hunt.tier)
          const secret = n.status === 'locked' && (n.hunt.tier === 'legendary' || n.hunt.tier === 'ancient')
          const appears = n.hunt.appearsIn?.[0]
          const isSel = selected?.kind === 'hunt' && selected.id === n.hunt.id
          return (
            <button
              key={n.hunt.id}
              className={`map-node map-node--${n.status} map-node--${n.hunt.tier} ${isSel ? 'is-selected' : ''} ${secret ? 'is-secret' : ''}`}
              style={{ left: (wx - view.x) * view.z, top: (wy - view.y) * view.z, scale: nodeScale }}
              onClick={() => onSelect({ kind: 'hunt', id: n.hunt.id })}
              aria-pressed={isSel}
              aria-label={`${secret ? 'Gizli yaratık' : huntName(n.hunt)}${n.captured ? `, ${n.stars} yıldız` : ''}${n.status === 'locked' ? ', kilitli' : n.status === 'notToday' ? ', bugün iz yok' : ''}`}
            >
              <PreyMedallion hunt={n.hunt} size={big ? 104 : 88} secret={secret} dim={!secret && (n.status === 'locked' || n.status === 'notToday' || n.status === 'elsewhere')} />
              {n.status === 'locked' && <span className="map-node__lock"><GameIcon name="lock" size={26} /></span>}
              {n.status === 'notToday' && appears && <span className="map-node__weather" title="Bugün iz yok"><WeatherIcon icon={content.weatherById.get(appears)?.icon ?? 'calm'} size={36} /></span>}
              {n.wounded && <span className="map-node__wound" title="Yaralı: bu seferde kalan canıyla gelir">✚</span>}
              {n.siege && <span className="map-node__wound map-node__wound--siege" title="Kuşatma sürüyor">⚑</span>}
              <span className="map-node__name">{secret ? '???' : huntName(n.hunt)}</span>
              {n.captured && <span className="map-node__stars">{STARS(n.stars)}</span>}
            </button>
          )
        })}

      {/* Kilitli bölge levhası (yakından) ve bölge rozetleri (uzaktan) */}
      {regions.map((r) => {
        const [x, y, w, h] = r.region.area
        const cx = x + w / 2
        const cy = y + h / 2
        if (!inView(cx, cy, Math.max(w, h))) return null
        const left = (cx - view.x) * view.z
        const top = (cy - view.y) * view.z
        const isSel = selected?.kind === 'region' && selected.id === r.region.id
        if (detail && r.unlocked) return null
        return (
          <button
            key={`b-${r.region.id}`}
            className={`world-badge ${r.unlocked ? '' : 'is-locked'} ${r.active ? 'is-active' : ''} ${isSel || (!selected && focusRegion === r) ? 'is-selected' : ''} ${detail ? 'is-plaque' : ''}`}
            style={{ left, top, scale: detail ? 1 : Math.max(0.62, Math.min(1, view.z / 0.32)) }}
            onClick={() => {
              onSelect({ kind: 'region', id: r.region.id })
              if (!detail) animateTo(fitView(r.region.area, width, height, 30))
            }}
          >
            <small>BÖLGE {r.region.level} · {BIOME_STYLE[r.region.biome].label.toLocaleUpperCase('tr-TR')}</small>
            <b>{r.region.name}</b>
            {r.unlocked ? (
              <span className="world-badge__progress">
                <i style={{ width: `${(r.captured / Math.max(1, r.total)) * 100}%` }} />
                <em>{r.captured}/{r.total}{r.book ? ' · kitap ✓' : ''}</em>
              </span>
            ) : detail ? (
              <span className="world-badge__lock"><GameIcon name="lock" size={22} /> {r.unlockText}</span>
            ) : (
              <span className="world-badge__lock"><GameIcon name="lock" size={22} /> Kilitli</span>
            )}
            {r.active && <span className="world-badge__flag">SEFER</span>}
          </button>
        )
      })}

      <div className="world-map__controls" onPointerDown={(e) => e.stopPropagation()}>
        <button className="btn small" aria-label="Yakınlaş" onClick={() => zoomAt(width / 2, height / 2, 1.5, true)}>＋</button>
        <button className="btn small" aria-label="Uzaklaş" onClick={() => zoomAt(width / 2, height / 2, 1 / 1.5, true)}>－</button>
        <button className="btn small" title="Odaktaki bölgeye dön" onClick={() => animateTo(fitView(regionRect(home), width, height, 30))}>BÖLGE</button>
        <button className="btn small" title="Tüm dünyayı gör" onClick={() => animateTo(fitView([0, 0, W, H], width, height, 0))}>DÜNYA</button>
      </div>
    </div>
  )
}
