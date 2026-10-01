import cardsJson from '../../content/cards.json' with { type: 'json' }
import tamersJson from '../../content/tamers.json' with { type: 'json' }
import weatherJson from '../../content/weather.json' with { type: 'json' }
import economyJson from '../../content/economy.json' with { type: 'json' }
import calendarJson from '../../content/calendar.json' with { type: 'json' }
import starterJson from '../../content/starter.json' with { type: 'json' }
import targetsJson from '../../content/balance-targets.json' with { type: 'json' }
import artJson from '../../content/art.json' with { type: 'json' }
import balanceJson from '../../content/generated/balance.json' with { type: 'json' }
import { buildContent } from './build.ts'

export * from './build.ts'
export * from './schema.ts'

/** Oyunun tüm içeriği, açılışta bir kez doğrulanmış halde. */
export const content = buildContent({
  cards: cardsJson,
  tamers: tamersJson,
  weather: weatherJson,
  economy: economyJson,
  calendar: calendarJson,
  starter: starterJson,
  targets: targetsJson,
  art: artJson,
  balance: balanceJson,
})
