import type { ReactNode } from 'react'
import { GameIcon, type GameIconName } from './GameIcon.tsx'

export function IllustratedHeader({ title, icon, resource, resourceLabel = 'Öz bakiyesi', children }: { title: string; icon?: GameIconName; resource: number; resourceLabel?: string; children?: ReactNode }) {
  return <header className={`illustrated-header illustrated-header--${title === 'MARKET' ? 'market' : title === 'DESTELER' ? 'decks' : 'standard'}`}>
    <div className="illustrated-header__back">{children}</div>
    <div className="illustrated-header__title">
      <span className="illustrated-header__spark illustrated-header__spark--left" aria-hidden="true">✦</span>
      {icon && <GameIcon name={icon} size={86} />}
      <h2><span>{title.slice(0, 1)}</span>{title.slice(1)}</h2>
      <span className="illustrated-header__spark illustrated-header__spark--right" aria-hidden="true">✦</span>
    </div>
    <div className="illustrated-header__resource panel" aria-label={`${resourceLabel}: ${resource.toLocaleString('tr-TR')}`}>
      <GameIcon name="gem" size={62} /><b>{resource.toLocaleString('tr-TR')}</b>
    </div>
  </header>
}
