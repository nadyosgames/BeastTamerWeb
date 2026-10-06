import type { Biome, HuntDef, RegionDef } from '../../core/types.ts'
import { content } from '../content.ts'

/** Harita stili ve geometri yardımcıları (bileşen dosyalarından ayrı: hızlı yenileme için). */

export type DoodleKind = 'mountain' | 'pine' | 'oak' | 'mushroom' | 'palm' | 'rock' | 'wave' | 'cactus' | 'dune' | 'crystal' | 'reed' | 'deadtree' | 'cloud' | 'bolt' | 'tuft' | 'snowpeak' | 'bones'

/** Biyomun görünüşü: parşömen tonu, kenar rengi ve serpiştirilen işaretler (ağırlıklı). */
export const BIOME_STYLE: Record<Biome, { label: string; fill: string; edge: string; doodles: [DoodleKind, number][] }> = {
  volcanic: { label: 'Volkanik vadi', fill: '#e6c79c', edge: '#9a6a3c', doodles: [['mountain', 2], ['pine', 3], ['rock', 2], ['tuft', 2]] },
  coast: { label: 'Kıyı', fill: '#ecdcb2', edge: '#5f8a8e', doodles: [['palm', 3], ['rock', 2], ['tuft', 2], ['wave', 1]] },
  forest: { label: 'Orman', fill: '#d3d6a2', edge: '#5c6634', doodles: [['pine', 4], ['oak', 4], ['mushroom', 2], ['tuft', 1]] },
  highlands: { label: 'Yayla', fill: '#ddd5bb', edge: '#6b6a58', doodles: [['mountain', 3], ['cloud', 2], ['tuft', 3], ['bolt', 1]] },
  desert: { label: 'Çöl', fill: '#efca92', edge: '#a8743f', doodles: [['dune', 4], ['cactus', 2], ['rock', 1], ['bones', 1]] },
  caves: { label: 'Mağara', fill: '#cfc4b1', edge: '#6e5a7e', doodles: [['crystal', 3], ['rock', 3], ['mountain', 1]] },
  marsh: { label: 'Bataklık', fill: '#c4cca6', edge: '#4f6656', doodles: [['reed', 4], ['deadtree', 2], ['tuft', 2], ['mushroom', 1]] },
  summit: { label: 'Zirve', fill: '#e6e2d6', edge: '#5a5f6e', doodles: [['snowpeak', 3], ['cloud', 2], ['rock', 2]] },
}

/** Catmull-Rom → kübik Bezier: noktalardan yumuşak eğri. */
export function smoothPath(points: readonly [number, number][], closed = false): string {
  const n = points.length
  if (n < 2) return ''
  const pt = (i: number) => points[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))]
  let d = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`
  const last = closed ? n : n - 1
  for (let i = 0; i < last; i++) {
    const p0 = pt(i - 1)
    const p1 = pt(i)
    const p2 = pt(i + 1)
    const p3 = pt(i + 2)
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return closed ? d + ' Z' : d
}

/** Bölge alanındaki 0..1 konumu dünya birimine çevirir. */
export const worldPos = (region: RegionDef, p: readonly [number, number]): [number, number] => [region.area[0] + p[0] * region.area[2], region.area[1] + p[1] * region.area[3]]

export function huntWorldPos(hunt: HuntDef): [number, number] {
  return worldPos(content.region(hunt.region), hunt.pos)
}
