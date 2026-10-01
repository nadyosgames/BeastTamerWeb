import { useLayoutEffect, useState, type ReactNode } from 'react'
import { StageContext, stageSizeFor } from './stage-context.ts'

/**
 * Tasarım alanı: 1920×1080 referans, Unity Canvas Scaler "Expand" kuralıyla pencereyi doldurur.
 * Ekranlar kenarlara (left/right/top/bottom) çapalanarak yerleşir; ortalanması gereken öğeler
 * `useStage().width` ile hesaplanır. Sahne sol üstten ölçeklenir, böylece kayma olmaz.
 */
export function Stage({ children }: { children: ReactNode }) {
  const [size, setSize] = useState(() => stageSizeFor(window.innerWidth, window.innerHeight))
  useLayoutEffect(() => {
    const fit = () => setSize(stageSizeFor(window.innerWidth, window.innerHeight))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'var(--bg-0)' }}>
      <div
        className="game-stage"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: size.width,
          height: size.height,
          transform: `scale(${size.scale})`,
          transformOrigin: '0 0',
          overflow: 'hidden',
        }}
      >
        <StageContext.Provider value={size}>{children}</StageContext.Provider>
      </div>
    </div>
  )
}
