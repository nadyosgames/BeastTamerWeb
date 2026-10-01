import { useLayoutEffect, useState, type ReactNode } from 'react'

/**
 * Sabit 1920×1080 tasarım alanı, pencereye sığacak şekilde ölçeklenir (letterbox).
 * Unity'deki Canvas Scaler (Reference Resolution 1920×1080, Match 0.5) ile aynı koordinatlar:
 * web'de kurulan yerleşim Unity'ye piksel piksel taşınabilir.
 */
export const STAGE_W = 1920
export const STAGE_H = 1080

export function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: '#000' }}>
      <div
        style={{
          width: STAGE_W,
          height: STAGE_H,
          transform: `scale(${scale})`,
          flex: 'none',
          position: 'relative',
          overflow: 'hidden',
          background:
            'radial-gradient(ellipse at 50% 20%, #1d2742 0%, #0d1220 55%, #07090f 100%)',
        }}
      >
        {children}
      </div>
    </div>
  )
}
