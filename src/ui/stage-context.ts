import { createContext, useContext } from 'react'

/** Tasarım referansı (Unity Canvas Scaler: Reference Resolution). */
export const REF_W = 1920
export const REF_H = 1080

export interface StageSize {
  /** Mantıksal sahne genişliği/yüksekliği (en az 1920×1080; pencere oranına göre biri uzar). */
  width: number
  height: number
  /** Mantıksal piksel → ekran pikseli. */
  scale: number
}

/**
 * Unity Canvas Scaler "Expand" ile aynı kural: referansın tamamı her zaman görünür,
 * pencere 16:9'dan genişse sahne yatayda, darsa dikeyde uzar. Siyah bant yok.
 */
export function stageSizeFor(vw: number, vh: number): StageSize {
  const scale = Math.min(vw / REF_W, vh / REF_H)
  return { scale, width: vw / scale, height: vh / scale }
}

export const StageContext = createContext<StageSize>({ width: REF_W, height: REF_H, scale: 1 })

export function useStage(): StageSize {
  return useContext(StageContext)
}
