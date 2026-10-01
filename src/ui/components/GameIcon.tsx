export type GameIconName = 'compass' | 'swords' | 'cards' | 'book' | 'shop' | 'scroll' | 'settings' | 'gem' | 'shield' | 'search' | 'star' | 'lock'

const paths: Record<GameIconName, string> = {
  compass: 'M12 1v3m0 16v3M1 12h3m16 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM15 9l-2 4-4 2 2-4 4-2Z',
  swords: 'm3 2 13 13-2 2L1 4l2-2Zm18 0L8 15l2 2L23 4l-2-2ZM12 17l5-5m-6 7 3-3m-7-4 5 5M3 21l5-5m13 5-5-5M1 19l4 4m14 0 4-4',
  cards: 'm4 6-2 14 10 2 2-14-10-2Zm4-3L6 6m2-3 10 2-1 12M12 1l10 4-4 13',
  book: 'M12 5C8 2 4 2 1 3v16c4-1 8 0 11 2m0-16c4-3 8-3 11-2v16c-4-1-8 0-11 2V5Zm-8 1v10m16-10v10',
  shop: 'M3 3h18l2 7H1l2-7Zm-2 7c0 4 5 4 6 0 0 4 5 4 5 0 0 4 5 4 5 0 1 4 6 4 6 0M3 14v8h18v-8M8 22v-6h8v6',
  scroll: 'M5 2h14c4 0 4 5 0 5h-1M5 2C1 2 1 7 5 7V2Zm0 5v12c0 4 5 4 5 0H5m13-12v12c0 4-8 4-8 0M8 9h7m-7 4h7',
  settings: 'm9 2 6 0 1 3 3 1 3-1 2 5-3 2v3l3 2-2 5-3-1-3 1-1 3H9l-1-3-3-1-3 1-2-5 3-2v-3l-3-2 2-5 3 1 3-1 1-3ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  gem: 'm12 1 8 9-3 10-5 3-5-3-3-10 8-9Zm0 0-3 9 3 13 3-13-3-9ZM4 10h16M7 20l5-4 5 4',
  shield: 'M12 2 3 5v7c0 5 5 9 9 11 4-2 9-6 9-11V5l-9-3Zm0 4-5 2v4c0 3 3 6 5 7 2-1 5-4 5-7V8l-5-2Z',
  search: 'M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm6 14 7 7',
  star: 'm12 1 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1 3-7Z',
  lock: 'M6 11V7a6 6 0 0 1 12 0v4M4 11h16v12H4V11Zm8 5v3',
}

export function GameIcon({ name, size = 32, className = '' }: { name: GameIconName; size?: number; className?: string }) {
  return <svg className={`game-icon ${className}`} width={size} height={size} viewBox="-2 -2 28 28" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
