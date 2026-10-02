import { useCallback, useEffect, useRef, useState } from 'react'
import type { RoundEvent } from '../../core/engine/events.ts'
import type { CardDef } from '../../core/types.ts'
import { applyEvent, initialView, isBeat, type RoundView } from './roundView.ts'

/** GDD: tetik başına ~0,5 sn animasyon; x2, x4 ve "Atla" ilk günden tasarımın parçası. */
export const BEAT_MS = 500
export type Speed = 1 | 2 | 4

type Events = readonly RoundEvent[] | null

/**
 * Motorun önceden hesapladığı olay akışını zamanlayarak oynatır.
 * `events` null ise kartlar başlangıç durumunda bekler.
 */
export function useRoundPlayback(cards: readonly CardDef[], events: Events, speed: Speed) {
  // Durum hangi olay akışına aitse onunla birlikte tutulur; akış değişince türetilmiş başlangıç gösterilir.
  const [state, setState] = useState<{ events: Events; view: RoundView } | null>(null)
  const viewRef = useRef<RoundView | null>(null)
  const idx = useRef(0)
  const timer = useRef<number | null>(null)
  const speedRef = useRef(speed)

  useEffect(() => {
    speedRef.current = speed
  }, [speed])

  useEffect(() => {
    idx.current = 0
    viewRef.current = initialView(cards)
    if (!events) return
    const tick = () => {
      let next = viewRef.current ?? initialView(cards)
      while (idx.current < events.length) {
        const e = events[idx.current++]
        next = applyEvent(next, e)
        if (isBeat(e)) break
      }
      viewRef.current = next
      setState({ events, view: next })
      if (idx.current < events.length) timer.current = window.setTimeout(tick, BEAT_MS / speedRef.current)
    }
    timer.current = window.setTimeout(tick, 250)
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = null
    }
  }, [events, cards])

  const skip = useCallback(() => {
    if (!events) return
    if (timer.current !== null) window.clearTimeout(timer.current)
    let next = viewRef.current ?? initialView(cards)
    while (idx.current < events.length) next = applyEvent(next, events[idx.current++])
    viewRef.current = next
    setState({ events, view: next })
  }, [events, cards])

  const view = state && state.events === events ? state.view : initialView(cards)
  return { view, skip, playing: !!events && !view.done }
}
