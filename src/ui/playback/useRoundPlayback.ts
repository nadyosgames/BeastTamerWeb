import { useCallback, useEffect, useRef, useState } from 'react'
import type { RoundEvent } from '../../core/engine/events.ts'
import type { HuntEvent, HuntState } from '../../core/hunt.ts'
import type { CardDef } from '../../core/types.ts'
import { applyEvent, applyHuntEvent, initialHuntView, initialView, isBeat, isHuntBeat, type HuntView, type RoundView } from './roundView.ts'

/** GDD: tetik başına ~0,5 sn animasyon; x2, x4 ve "Atla" ilk günden tasarımın parçası. */
export const BEAT_MS = 500
export type Speed = 1 | 2 | 4

/**
 * Motorun önceden hesapladığı olay akışını zamanlayarak oynatır (genel hâli).
 * `events` null ise görünüm başlangıç durumunda bekler.
 */
function usePlayback<E, V extends { done: boolean }>(
  events: readonly E[] | null,
  init: () => V,
  apply: (v: V, e: E) => V,
  beat: (e: E) => boolean,
  speed: Speed,
  deps: readonly unknown[],
) {
  // Durum hangi olay akışına aitse onunla birlikte tutulur; akış değişince türetilmiş başlangıç gösterilir.
  const [state, setState] = useState<{ events: readonly E[] | null; view: V } | null>(null)
  const viewRef = useRef<V | null>(null)
  const idx = useRef(0)
  const timer = useRef<number | null>(null)
  const speedRef = useRef(speed)
  const fns = useRef({ init, apply, beat })
  fns.current = { init, apply, beat }

  useEffect(() => {
    speedRef.current = speed
  }, [speed])

  useEffect(() => {
    idx.current = 0
    viewRef.current = fns.current.init()
    if (!events) return
    const tick = () => {
      let next = viewRef.current ?? fns.current.init()
      while (idx.current < events.length) {
        const e = events[idx.current++]
        next = fns.current.apply(next, e)
        if (fns.current.beat(e)) break
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, ...deps])

  const skip = useCallback(() => {
    if (!events) return
    if (timer.current !== null) window.clearTimeout(timer.current)
    let next = viewRef.current ?? fns.current.init()
    while (idx.current < events.length) next = fns.current.apply(next, events[idx.current++])
    viewRef.current = next
    setState({ events, view: next })
  }, [events])

  const view = state && state.events === events ? state.view : init()
  return { view, skip, playing: !!events && !view.done }
}

export function useRoundPlayback(cards: readonly CardDef[], events: readonly RoundEvent[] | null, speed: Speed) {
  return usePlayback<RoundEvent, RoundView>(events, () => initialView(cards), applyEvent, isBeat, speed, [cards])
}

/** Av turu: hasar, Koruma ve yaratığın hamlesi aynı akışta oynatılır. */
export function useHuntPlayback(cards: readonly CardDef[], before: HuntState | null, events: readonly HuntEvent[] | null, speed: Speed) {
  return usePlayback<HuntEvent, HuntView>(
    events,
    () => (before ? initialHuntView(cards, before) : ({ ...initialView(cards) } as HuntView)),
    applyHuntEvent,
    isHuntBeat,
    speed,
    [cards, before],
  )
}
