import { motion } from 'motion/react'
import { useRef, useState, type PointerEvent } from 'react'
import { polarityLinks } from '../../core/engine/round.ts'
import type { CardDef } from '../../core/types.ts'
import type { RunStatus } from '../../state/run.ts'
import { CardView } from '../components/CardView.tsx'
import type { RoundView } from '../playback/roundView.ts'
import './Board.css'

/**
 * Oyun tahtası: üstte slotlar, altta el. Kartlar elden slota sürüklenir, slotlar arasında
 * yer değiştirir ya da ele geri sürüklenir. Tıklama kısayolu: elden → ilk boş slot, slottan → ele.
 * Konumlar sahne koordinatında hesaplanır (Stage ölçeği ne olursa olsun doğru), geçişleri motion çizer.
 */
export const CARD_W = 320
export const CARD_H = 475
const GAP = 24
const SLOT_TOP = 250
const HAND_SCALE = 0.75
const HAND_SPACING = 190
const DRAG_THRESHOLD = 6

interface BoardProps {
  stageW: number
  stageH: number
  scale: number
  round: number
  status: RunStatus
  hand: CardDef[]
  slots: (number | null)[]
  view: RoundView
  /** Vurgulanan el kartları (eğitim); dizim aşamasında parlar. */
  focus?: readonly number[]
  onPlace(k: number, slot: number): void
  onUnplace(k: number): void
}

interface Drag {
  k: number
  dx: number
  dy: number
  x: number
  y: number
  sx: number
  sy: number
  moved: boolean
}

export function Board(p: BoardProps) {
  // Sürükleme durumu ref'te (olay işleyicileri her zaman güncelini görür) + state'te (yeniden çizim için).
  const dragRef = useRef<Drag | null>(null)
  const [drag, setDragState] = useState<Drag | null>(null)
  const setDrag = (d: Drag | null) => {
    dragRef.current = d
    setDragState(d)
  }
  const [hoverHand, setHoverHand] = useState<number | null>(null)
  const arrange = p.status === 'arrange'
  const n = p.slots.length
  // Six-slot Tamers must still fit the row inside the stage.
  const cardW = Math.min(CARD_W, (p.stageW - 100 - (n - 1) * GAP) / n)
  const cardH = cardW * CARD_H / CARD_W

  const rowW = n * cardW + (n - 1) * GAP
  const slotCenter = (i: number) => ({ x: (p.stageW - rowW) / 2 + i * (cardW + GAP) + cardW / 2, y: SLOT_TOP + cardH / 2 })
  const handIdx = p.hand.map((_, k) => k).filter((k) => !p.slots.includes(k))
  const handPos = (j: number, m: number) => {
    const o = j - (m - 1) / 2
    return { x: p.stageW / 2 + o * HAND_SPACING, y: p.stageH - 200 + o * o * 7, rotate: o * 3.5 }
  }
  const handZoneY = SLOT_TOP + cardH + 40

  const toStage = (e: PointerEvent) => ({ x: e.clientX / p.scale, y: e.clientY / p.scale })
  const slotAt = (x: number, y: number) => {
    for (let i = 0; i < n; i++) {
      const c = slotCenter(i)
      if (Math.abs(x - c.x) <= cardW / 2 + GAP / 2 && Math.abs(y - c.y) <= cardH / 2 + 40) return i
    }
    return -1
  }

  const restingPos = (k: number) => {
    const s = p.slots.indexOf(k)
    if (s >= 0) return { ...slotCenter(s), rotate: 0, scale: 1 }
    const j = handIdx.indexOf(k)
    const h = handPos(j, handIdx.length)
    const lifted = hoverHand === k && !drag
    return { x: h.x, y: h.y - (lifted ? 70 : 0), rotate: lifted ? 0 : h.rotate, scale: lifted ? 1 : HAND_SCALE }
  }

  const onDown = (k: number) => (e: PointerEvent<HTMLDivElement>) => {
    if (!arrange || e.button !== 0) return
    const pt = toStage(e)
    const r = restingPos(k)
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // İşaretçi yakalanamazsa (ör. sentetik olay) sürükleme yine çalışır, yalnızca kart dışına çıkınca kopar.
    }
    setDrag({ k, dx: pt.x - r.x, dy: pt.y - r.y, x: pt.x, y: pt.y, sx: pt.x, sy: pt.y, moved: false })
  }
  const onMove = (k: number) => (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.k !== k) return
    const pt = toStage(e)
    const moved = drag.moved || Math.hypot(pt.x - drag.sx, pt.y - drag.sy) > DRAG_THRESHOLD
    setDrag({ ...drag, x: pt.x, y: pt.y, moved })
  }
  const onUp = (k: number) => () => {
    const drag = dragRef.current
    if (!drag || drag.k !== k) return
    const inSlot = p.slots.indexOf(k)
    if (!drag.moved) {
      // Tıklama: elden ilk boş slota, slottan ele.
      if (inSlot >= 0) p.onUnplace(k)
      else {
        const empty = p.slots.indexOf(null)
        if (empty >= 0) p.onPlace(k, empty)
      }
    } else {
      const target = slotAt(drag.x, drag.y)
      if (target >= 0) p.onPlace(k, target)
      else if (drag.y > handZoneY && inSlot >= 0) p.onUnplace(k)
    }
    setDrag(null)
  }

  const hoverSlot = drag?.moved ? slotAt(drag.x, drag.y) : -1
  const placed = p.slots.flatMap((k, i) => (k === null ? [] : [{ i, card: p.hand[k] }]))
  const links = polarityLinks(placed.map((x) => x.card)).map((l) => ({ ...l, left: placed[l.left].i, right: placed[l.right].i }))
  const placedCount = placed.length

  return (
    <div className="board">
      {p.slots.map((k, i) => {
        const c = slotCenter(i)
        return (
          <div
            key={i}
            className={`board__slot ${k !== null ? 'is-filled' : ''} ${hoverSlot === i ? 'is-hover' : ''} ${i < n - 1 ? 'has-next' : ''}`}
            style={{ left: c.x - cardW / 2, top: c.y - cardH / 2, width: cardW, height: cardH }}
          >
            <div className="board__slotnum">{i + 1}</div>
            {k === null && <span>Kartı buraya sürükle</span>}
          </div>
        )
      })}

      {links.map((l) => {
        const a = slotCenter(l.left).x
        const b = slotCenter(l.right).x
        return (
          <div
            key={`${l.left}-${l.right}`}
            className={`board__link board__link--${l.state}`}
            style={{ left: a, width: b - a, top: SLOT_TOP + cardH + 6 }}
          >
            <span>{l.state === 'compatible' ? '⚡ uyumlu' : '✕ çakışan'}</span>
          </div>
        )
      })}

      {!arrange &&
        p.slots.map((_, i) => (
          <div key={`t${i}`} className="board__slottotal" style={{ left: slotCenter(i).x, top: SLOT_TOP + cardH + 34 }}>
            +{p.view.slots[i]?.total ?? 0}
          </div>
        ))}

      {arrange && handIdx.length > 0 && (
        <div className="board__handhint" style={{ top: p.stageH - 410 }}>
          Elindeki kartları yukarıdaki slotlara sürükle · tıklarsan ilk boş slota gider ({placedCount}/{n})
        </div>
      )}

      {p.hand.map((card, k) => {
        const dragging = drag?.k === k
        const slot = p.slots.indexOf(k)
        const r = dragging ? { x: drag.x - drag.dx, y: drag.y - drag.dy, rotate: 0, scale: 1.04 } : restingPos(k)
        const v = !arrange && slot >= 0 ? p.view.slots[slot] : undefined
        return (
          <motion.div
            key={`${p.round}-${k}`}
            className={`board__card ${arrange ? 'is-draggable' : ''} ${dragging ? 'is-dragging' : ''} ${arrange && p.focus?.includes(k) ? 'is-focus' : ''}`}
            data-x={Math.round(r.x)}
            data-y={Math.round(r.y)}
            data-slot={slot}
            style={{ width: cardW, height: cardH, zIndex: dragging ? 1000 : hoverHand === k ? 60 : slot >= 0 ? 10 : 20 + k }}
            initial={{ x: 60, y: p.stageH - cardH, scale: 0.4, rotate: -12, opacity: 0 }}
            animate={{ x: r.x - cardW / 2, y: r.y - cardH / 2, rotate: r.rotate, scale: r.scale, opacity: 1 }}
            transition={dragging ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 38, delay: 0 }}
            onPointerDown={onDown(k)}
            onPointerMove={onMove(k)}
            onPointerUp={onUp(k)}
            onPointerCancel={() => setDrag(null)}
            onPointerEnter={() => slot < 0 && setHoverHand(k)}
            onPointerLeave={() => setHoverHand((h) => (h === k ? null : h))}
          >
            <CardView
              card={card}
              durability={v?.durability}
              maxDurability={v?.maxDurability}
              passive={v?.passive}
              ward={v?.ward}
              active={!arrange && p.view.active === slot}
              income={v ? v.income : null}
              pulse={v?.pulse}
            />
          </motion.div>
        )
      })}
    </div>
  )
}
