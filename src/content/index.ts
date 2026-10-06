import cardsJson from '../../content/cards.json' with { type: 'json' }
import tamersJson from '../../content/tamers.json' with { type: 'json' }
import weatherJson from '../../content/weather.json' with { type: 'json' }
import decksJson from '../../content/decks.json' with { type: 'json' }
import economyJson from '../../content/economy.json' with { type: 'json' }
import huntsJson from '../../content/hunts.json' with { type: 'json' }
import regionsJson from '../../content/regions.json' with { type: 'json' }
import starterJson from '../../content/starter.json' with { type: 'json' }
import targetsJson from '../../content/balance-targets.json' with { type: 'json' }
import artJson from '../../content/art.json' with { type: 'json' }
import huntBalanceJson from '../../content/generated/hunts.json' with { type: 'json' }
import { buildContent } from './build.ts'

export * from './build.ts'
export * from './schema.ts'

/** Ham JSON (öneri setleri bunun üzerine kart/deste değiştirerek kurulur). */
export const RAW_CONTENT = {
  cards: cardsJson,
  tamers: tamersJson,
  weather: weatherJson,
  decks: decksJson,
  economy: economyJson,
  hunts: huntsJson,
  regions: regionsJson,
  starter: starterJson,
  targets: targetsJson,
  art: artJson,
  huntBalance: huntBalanceJson,
}

/** Oyunun tüm içeriği, açılışta bir kez doğrulanmış halde. */
export const content = buildContent(RAW_CONTENT)
