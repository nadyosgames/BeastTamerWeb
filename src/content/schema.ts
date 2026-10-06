import { z } from 'zod'
import type { CalibratedHunts, EconomyConfig } from '../core/economy.ts'
import type {
  Ability,
  CardDef,
  CardFilter,
  Cond,
  Count,
  Effect,
  HuntDef,
  HuntPhase,
  Intent,
  MapFeature,
  Modifier,
  PreyTrait,
  RegionDef,
  TamerDef,
  WeatherDef,
  WorldDef,
} from '../core/types.ts'
import { ABILITY_TRIGGERS, BIOMES, CREATURE_TYPES, ELEMENTS, HUNT_TIERS, KEYWORDS, RARITIES } from '../core/types.ts'

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
  z.strictObject({ op: z.literal('guard'), amount: z.number().min(0), per: CountSchema.optional(), if: CondSchema.optional() }),
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
  source: z.enum(['pack', 'quest', 'starter', 'hunt']).optional(),
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
  z.strictObject({
    kind: z.literal('slumberAtStart'),
    passes: z.int().min(2),
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
  hp: z.int().min(1),
  modifiers: z.array(ModifierSchema),
  text: z.string(),
  unlock: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('start') }),
    z.strictObject({ kind: z.literal('captures'), count: z.int().min(1) }),
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
const rarityNumbers = z.strictObject(Object.fromEntries(RARITIES.map((r) => [r, z.number().min(0)])) as Record<(typeof RARITIES)[number], z.ZodNumber>)

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
  packBasePrice: z.number().positive(),
  basePack: z.string(),
  pity: z.strictObject({ packsWithoutRarePlus: z.int().min(1) }),
  timing: z.strictObject({ planningSecPerRound: z.number(), secPerStep: z.number() }),
  expedition: z.strictObject({
    rations: z.int().min(0),
    restHealPct: z.number().min(0),
    speedBonusPct: z.number().min(0),
    streakBonusPct: z.number().min(0),
    bagLossPct: z.number().min(0).max(100),
    woundCarryPct: z.number().min(0).max(100),
    siegeNightHealPct: z.number().min(0),
    essenceByRarity: rarityNumbers,
  }),
})

const slotNo = z.int().min(1).max(8)

export const IntentSchema: z.ZodType<Intent> = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('claw'), damage: z.int().min(1) }),
  z.strictObject({ kind: z.literal('rend'), slot: slotNo }),
  z.strictObject({ kind: z.literal('tailSweep'), count: z.int().min(1).max(8) }),
  z.strictObject({ kind: z.literal('roar'), slot: slotNo }),
  z.strictObject({ kind: z.literal('evade') }),
  z.strictObject({ kind: z.literal('recover'), amount: z.int().min(1) }),
  z.strictObject({ kind: z.literal('charge') }),
  z.strictObject({ kind: z.literal('flee'), damage: z.int().min(1), belowPct: z.number().min(1).max(100) }),
  z.strictObject({ kind: z.literal('scorch') }),
])

export const PreyTraitSchema: z.ZodType<PreyTrait> = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('armor'), amount: z.int().min(1), offIn: z.array(z.string()).optional() }),
  z.strictObject({ kind: z.literal('shell'), amount: z.int().min(1) }),
  z.strictObject({ kind: z.literal('veiled') }),
  z.strictObject({ kind: z.literal('agile') }),
  z.strictObject({ kind: z.literal('thorns'), amount: z.int().min(1) }),
  z.strictObject({ kind: z.literal('resist'), element, pct: z.number().min(1).max(100) }),
  z.strictObject({ kind: z.literal('weak'), element, pct: z.number().min(1) }),
])

const HuntPhaseSchema: z.ZodType<HuntPhase> = z.strictObject({
  belowPct: z.number().min(1).max(99),
  intents: z.array(IntentSchema).min(1),
  traits: z.array(PreyTraitSchema).optional(),
  text: z.string(),
})

export const HuntSchema: z.ZodType<HuntDef> = z.strictObject({
  id,
  card: z.string(),
  region: z.string(),
  tier: z.enum(HUNT_TIERS),
  hp: z.int().min(1),
  revive: z.int().min(1).optional(),
  intents: z.array(IntentSchema).min(1),
  traits: z.array(PreyTraitSchema).optional(),
  phases: z.array(HuntPhaseSchema).optional(),
  weather: z.string().optional(),
  siege: z.strictObject({ weathers: z.array(z.string()).min(2), decks: z.array(z.string()).optional() }).optional(),
  appearsIn: z.array(z.string()).min(1).optional(),
  unlock: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('start') }),
    z.strictObject({ kind: z.literal('captures'), count: z.int().min(1) }),
    z.strictObject({ kind: z.literal('book'), trail: z.int().min(0) }),
    z.strictObject({ kind: z.literal('after'), hunt: z.string() }),
  ]),
  pos: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
  target: z.strictObject({ deck: z.string(), weather: z.string(), round: z.number().positive() }).optional(),
  lore: z.string(),
})

const unit = z.number().min(0).max(1)
const unitPos = z.tuple([unit, unit])

const MapFeatureSchema: z.ZodType<MapFeature> = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('river'), points: z.array(unitPos).min(2) }),
  z.strictObject({ kind: z.literal('lake'), pos: unitPos, size: z.tuple([z.number().positive(), z.number().positive()]) }),
  z.strictObject({
    kind: z.literal('landmark'),
    style: z.enum(['mountain', 'volcano', 'hill', 'mesa', 'crystal', 'snowpeak', 'ruin', 'lighthouse']),
    pos: unitPos,
    scale: z.number().positive().optional(),
  }),
  z.strictObject({ kind: z.literal('label'), pos: unitPos, text: z.string(), rotate: z.number().optional() }),
])

export const RegionSchema: z.ZodType<RegionDef> = z.strictObject({
  id,
  name: z.string(),
  text: z.string(),
  level: z.int().min(1),
  biome: z.enum(BIOMES),
  unlock: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('start') }),
    z.strictObject({ kind: z.literal('finals'), regions: z.array(z.string()).min(1) }),
  ]),
  elements: z.array(element).min(1),
  climate: z.record(z.string(), z.number().min(0)),
  buff: z.strictObject({ text: z.string(), modifiers: z.array(ModifierSchema) }),
  area: z.tuple([z.number().min(0), z.number().min(0), z.number().positive(), z.number().positive()]),
  map: z.strictObject({
    camp: unitPos,
    paths: z.array(z.tuple([z.string(), z.string()])),
    features: z.array(MapFeatureSchema).optional(),
  }),
})

export const WorldSchema: z.ZodType<WorldDef> = z.strictObject({
  name: z.string(),
  size: z.tuple([z.number().positive(), z.number().positive()]),
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
    huntRound: z.strictObject({ text: z.string(), tolerance: z.number().positive() }),
    starterHunts: z.strictObject({ text: z.string(), captureRate: z.number().min(0).max(1) }),
    intentAwareness: z.strictObject({ text: z.string(), minGain: z.number() }),
    weatherHunt: z.strictObject({ text: z.string(), minRounds: z.number() }),
    expedition: z.strictObject({ text: z.string(), hunts: z.int().min(1), hpPct: range }),
    tamerSafety: z.strictObject({ text: z.string(), maxDownRate: z.number().min(0).max(1) }),
  }),
  simulation: z.strictObject({
    daysPerCheck: z.int().min(1),
    huntSamples: z.int().min(1),
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

export const CalibratedHuntsSchema: z.ZodType<CalibratedHunts> = z.strictObject({
  generatedAt: z.string(),
  seed: z.int(),
  samples: z.int(),
  hp: z.record(z.string(), z.int().min(1)),
  refDecks: z.record(z.string(), z.array(z.strictObject({ card: z.string(), count: z.int().min(1) }))).optional(),
  huntDecks: z.record(z.string(), z.string()).optional(),
  notes: z.array(z.string()).optional(),
})

/** Dosya başına şema (JSON Schema dışa aktarımı ve doğrulama için). */
export const FILE_SCHEMAS = {
  cards: z.object({ cards: z.array(CardSchema) }),
  tamers: z.object({ tamers: z.array(TamerSchema) }),
  weather: z.object({ weather: z.array(WeatherSchema) }),
  decks: z.object({ decks: z.array(DeckPresetSchema) }),
  economy: EconomySchema,
  hunts: z.object({ hunts: z.array(HuntSchema) }),
  regions: z.object({ world: WorldSchema, regions: z.array(RegionSchema) }),
  starter: StarterSchema,
  'balance-targets': BalanceTargetsSchema,
  art: ArtConfigSchema,
} as const
