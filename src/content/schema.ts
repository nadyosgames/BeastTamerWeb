import { z } from 'zod'
import type { CalendarConfig } from '../core/calendar.ts'
import type { EconomyConfig } from '../core/economy.ts'
import type {
  Ability,
  CardDef,
  CardFilter,
  Cond,
  Count,
  Effect,
  Modifier,
  TamerDef,
  WeatherDef,
} from '../core/types.ts'
import { ABILITY_TRIGGERS, CREATURE_TYPES, ELEMENTS, KEYWORDS, RARITIES } from '../core/types.ts'

/**
 * content/*.json şemaları. core/types.ts'teki tiplerle derleme zamanında eşleşir
 * (z.ZodType<T> açıklamaları). `npm run content:schema` bunlardan JSON Schema üretir:
 * VS Code'da JSON düzenlerken otomatik tamamlama + Unity tarafı için referans.
 */

const element = z.enum(ELEMENTS)
const rarity = z.enum(RARITIES)
const cmp = z.enum(['>=', '<=', '==', '>', '<'])
const side = z.enum(['left', 'right'])
const trigger = z.enum(ABILITY_TRIGGERS)

export const CardFilterSchema: z.ZodType<CardFilter> = z.lazy(() =>
  z.strictObject({
    element: element.optional(),
    type: z.enum(CREATURE_TYPES).optional(),
    keyword: z.enum(KEYWORDS).optional(),
    rarityAtLeast: rarity.optional(),
    state: z.enum(['active', 'passive']).optional(),
    baseDurability: z.strictObject({ cmp, value: z.number() }).optional(),
    anyOf: z.array(CardFilterSchema).optional(),
  }),
)

export const CountSchema: z.ZodType<Count> = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('cards'),
    filter: CardFilterSchema.optional(),
    excludeSelf: z.boolean().optional(),
    side: side.optional(),
  }),
  z.strictObject({ kind: z.literal('chain'), side, filter: CardFilterSchema.optional() }),
  z.strictObject({ kind: z.literal('distinctElements') }),
  z.strictObject({ kind: z.literal('heat') }),
  z.strictObject({ kind: z.literal('selfTriggers') }),
  z.strictObject({ kind: z.literal('pass') }),
])

export const CondSchema: z.ZodType<Cond> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('count'), count: CountSchema, cmp, value: z.number() }),
    z.strictObject({ kind: z.literal('allCards'), filter: CardFilterSchema }),
    z.strictObject({ kind: z.literal('slot'), index: z.int().min(1) }),
    z.strictObject({ kind: z.literal('position'), where: z.enum(['first', 'last']) }),
    z.strictObject({ kind: z.literal('neighbor'), side, filter: CardFilterSchema }),
    z.strictObject({ kind: z.literal('passParity'), parity: z.enum(['odd', 'even']) }),
    z.strictObject({ kind: z.literal('lastTrigger') }),
    z.strictObject({ kind: z.literal('link'), side, state: z.enum(['compatible', 'clash']) }),
    z.strictObject({ kind: z.literal('round'), which: z.enum(['first', 'last']) }),
    z.strictObject({ kind: z.literal('self'), filter: CardFilterSchema }),
    z.strictObject({ kind: z.literal('not'), cond: CondSchema }),
    z.strictObject({ kind: z.literal('all'), conds: z.array(CondSchema) }),
    z.strictObject({ kind: z.literal('any'), conds: z.array(CondSchema) }),
  ]),
)

const target = z.enum(['self', 'left', 'right', 'others', 'all'])

export const EffectSchema: z.ZodType<Effect> = z.discriminatedUnion('op', [
  z.strictObject({ op: z.literal('gain'), amount: z.number(), if: CondSchema.optional() }),
  z.strictObject({ op: z.literal('gainPer'), amount: z.number(), per: CountSchema, if: CondSchema.optional() }),
  z.strictObject({ op: z.literal('mult'), value: z.number().min(0), if: CondSchema.optional() }),
  z.strictObject({ op: z.literal('copyIncome'), from: side, pct: z.number(), if: CondSchema.optional() }),
  z.strictObject({ op: z.literal('addHeat'), amount: z.number(), if: CondSchema.optional() }),
  z.strictObject({
    op: z.literal('addDurability'),
    target,
    amount: z.int(),
    filter: CardFilterSchema.optional(),
    if: CondSchema.optional(),
  }),
  z.strictObject({ op: z.literal('retrigger'), target, filter: CardFilterSchema.optional(), if: CondSchema.optional() }),
  z.strictObject({
    op: z.literal('aura'),
    filter: CardFilterSchema.optional(),
    includeSelf: z.boolean().optional(),
    gain: z.number().optional(),
    mult: z.number().optional(),
  }),
  z.strictObject({
    op: z.literal('custom'),
    id: z.string(),
    params: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).optional(),
  }),
])

export const AbilitySchema: z.ZodType<Ability> = z.strictObject({ on: trigger, effects: z.array(EffectSchema) })

const id = z.string().regex(/^[a-z0-9_]+$/, 'id yalnızca küçük harf, rakam ve _ içerebilir')
const pole = z.enum(['+', '-'])

export const CardSchema: z.ZodType<CardDef> = z.strictObject({
  id,
  name: z.string().min(1),
  elements: z.array(element).min(1).max(2),
  type: z.enum(CREATURE_TYPES),
  rarity,
  durability: z.int().min(1),
  unlockYear: z.int().min(1).optional(),
  keywords: z.array(z.enum(KEYWORDS)).optional(),
  slumber: z.int().min(2).optional(),
  polarity: z.strictObject({ left: pole, right: pole }).optional(),
  abilities: z.array(AbilitySchema),
  text: z.string(),
  source: z.enum(['pack', 'quest', 'starter']).optional(),
  art: z.strictObject({ creature: z.string().min(10) }).optional(),
  draft: z.boolean().optional(),
})

export const ModifierSchema: z.ZodType<Modifier> = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('incomePct'),
    pct: z.number(),
    filter: CardFilterSchema.optional(),
    if: CondSchema.optional(),
  }),
  z.strictObject({
    kind: z.literal('durabilityAtStart'),
    amount: z.int(),
    min: z.int().optional(),
    filter: CardFilterSchema.optional(),
    if: CondSchema.optional(),
  }),
  z.strictObject({ kind: z.literal('abilityScale'), on: trigger, pct: z.number() }),
  z.strictObject({ kind: z.literal('repeatAbility'), on: trigger, times: z.int().min(1) }),
  z.strictObject({ kind: z.literal('weatherScale'), bonusPct: z.number(), penaltyPct: z.number() }),
])

export const TamerSchema: z.ZodType<TamerDef> = z.strictObject({
  id,
  name: z.string(),
  deckSize: z.int().min(5),
  slots: z.int().min(1).max(8),
  modifiers: z.array(ModifierSchema),
  text: z.string(),
  unlock: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('start') }),
    z.strictObject({ kind: z.literal('year'), year: z.int().min(1) }),
    z.strictObject({ kind: z.literal('quest'), quest: z.string() }),
    z.strictObject({ kind: z.literal('lifetime'), amount: z.number() }),
  ]),
  art: z.strictObject({ subject: z.string() }).optional(),
})

export const WeatherSchema: z.ZodType<WeatherDef> = z.strictObject({
  id,
  name: z.string(),
  icon: z.string(),
  modifiers: z.array(ModifierSchema),
  text: z.string(),
  weight: z.number().min(0),
  art: z.strictObject({ subject: z.string() }).optional(),
})

const range = z.tuple([z.number(), z.number()])

export const EconomySchema: z.ZodType<EconomyConfig> = z.strictObject({
  rarities: z.record(rarity, z.strictObject({ deckLimit: z.int().min(1), duplicatePct: z.number().min(0) })),
  packs: z.array(
    z.strictObject({
      id,
      name: z.string(),
      priceMult: z.number().positive(),
      cards: z.int().min(1),
      odds: z.partialRecord(rarity, z.number().min(0)),
      guarantee: z.strictObject({ rarityAtLeast: rarity, count: z.int().min(1) }).optional(),
      element: z.boolean().optional(),
      smart: z.boolean().optional(),
    }),
  ),
  packPricePctOfQuota: z.number().positive(),
  weeklyPack: z.string(),
  quotaFallback: z.strictObject({ base: z.number(), growthPerWeek: z.number() }),
  pity: z.strictObject({ packsWithoutRarePlus: z.int().min(1) }),
  softFail: z.strictObject({ missedWeeks: z.int(), quotaReductionPct: z.number() }),
  timing: z.strictObject({ planningSecPerRound: z.number(), secPerStep: z.number() }),
})

export const CalendarSchema: z.ZodType<CalendarConfig> = z.strictObject({
  daysPerWeek: z.int().min(1),
  weeksPerMonth: z.int().min(1),
  monthsPerYear: z.int().min(1),
  yearsPerCycle: z.int().min(1),
  cycles: z.int().min(1),
  weatherRules: z.strictObject({ minDistinctPerWeek: z.int().min(1), maxSameInARow: z.int().min(1) }),
  zodiac: z
    .array(
      z.strictObject({
        id,
        name: z.string(),
        albumPassive: z.strictObject({
          text: z.string(),
          modifiers: z.array(ModifierSchema),
          duplicateBonusPct: z.number().optional(),
        }),
      }),
    )
    .min(1),
})

export const DeckPresetSchema = z.strictObject({
  id,
  name: z.string(),
  tamer: z.string(),
  text: z.string(),
  cards: z.array(z.strictObject({ card: z.string(), count: z.int().min(1) })),
})
export type DeckPreset = z.infer<typeof DeckPresetSchema>

export const StarterSchema = z.strictObject({
  tamer: z.string(),
  /** decks.json'daki preset id'si */
  deck: z.string(),
  resource: z.number(),
})
export type StarterConfig = z.infer<typeof StarterSchema>

export const BalanceTargetsSchema = z.strictObject({
  seed: z.int(),
  targets: z.strictObject({
    arrangementSkill: z.strictObject({ text: z.string(), masterOverNovice: range }),
    weatherFit: z.strictObject({ text: z.string(), matchedOverMismatched: range }),
    dayLength: z.strictObject({ text: z.string(), minutes: range }),
    duplicates: z.strictObject({ text: z.string(), maxRatio: z.number() }),
    quota: z.strictObject({
      text: z.string(),
      goodPlayerRatio: range,
      mismatchedRatio: range,
      calibrationRatio: z.number(),
    }),
  }),
  simulation: z.strictObject({
    daysPerCheck: z.int().min(1),
    campaignAgents: z.int().min(1),
    calibrationIterations: z.int().min(1),
  }),
})
export type BalanceTargets = z.infer<typeof BalanceTargetsSchema>

const artKind = z.strictObject({
  label: z.string(),
  master: z.strictObject({ width: z.int(), height: z.int() }),
  chatgptSize: z.string(),
  web: z.array(z.strictObject({ suffix: z.string(), width: z.int() })),
  template: z.string(),
})

export const ArtConfigSchema = z.strictObject({
  kinds: z.strictObject({ cards: artKind, tamers: artKind, weather: artKind }),
  elements: z.record(element, z.string()),
  power: z.record(rarity, z.string()),
  negative: z.string(),
  styleAnchor: z.string(),
})
export type ArtConfig = z.infer<typeof ArtConfigSchema>
export type ArtKind = keyof ArtConfig['kinds']

export const CalibratedBalanceSchema = z.strictObject({
  generatedAt: z.string(),
  seed: z.int(),
  agents: z.int(),
  quotaByWeek: z.array(z.number()),
  notes: z.array(z.string()).optional(),
})

/** Dosya başına şema (JSON Schema dışa aktarımı ve doğrulama için). */
export const FILE_SCHEMAS = {
  cards: z.object({ cards: z.array(CardSchema) }),
  tamers: z.object({ tamers: z.array(TamerSchema) }),
  weather: z.object({ weather: z.array(WeatherSchema) }),
  decks: z.object({ decks: z.array(DeckPresetSchema) }),
  economy: EconomySchema,
  calendar: CalendarSchema,
  starter: StarterSchema,
  'balance-targets': BalanceTargetsSchema,
  art: ArtConfigSchema,
} as const
