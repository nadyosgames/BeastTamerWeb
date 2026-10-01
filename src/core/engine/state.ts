import type { AbilityTrigger, CardDef, Effect, LinkState } from '../types.ts'
import type { EventSink } from './events.ts'
import type { ModifierSet } from './modifiers.ts'

export interface RoundContext {
  mods: ModifierSet
  /** 0 tabanlı tur indeksi ve gündeki toplam tur (round: first/last koşulları). */
  roundIndex: number
  roundCount: number
  /** Sonsuz döngü koruması: turdaki yetenek çözümü sınırı (GDD önerisi 60). */
  triggerCap: number
}

/** Kartın derlenmiş hali (her CardDef için bir kez, WeakMap önbelleği). */
export interface CompiledCard {
  byTrigger: Partial<Record<AbilityTrigger, Effect[]>>
  aura: Extract<Effect, { op: 'aura' }>[]
  swift: boolean
  heavy: boolean
  overload: boolean
  ward: boolean
  rebirth: boolean
  slumber: number
}

export interface SlotState {
  index: number
  card: CardDef
  c: CompiledCard
  durability: number
  ward: boolean
  rebirth: boolean
  lastBreathDone: boolean
  /** Bu turda kaç kez Harvest tetiklendi (Büyüme). */
  triggers: number
  /** Bu geçişteki son ham gelir (copyIncome okur). */
  passRaw: number
  passRawPass: number
  /** Bu turdaki toplam gelir (istatistik / UI). */
  income: number
  leftLink: LinkState | null
  rightLink: LinkState | null
}

export interface RoundState {
  slots: SlotState[]
  ctx: RoundContext
  heat: number
  pass: number
  /** Çözülen yetenek sayısı (tetik sınırı bununla ölçülür). */
  steps: number
  /** Harvest tetik sayısı (süre tahmini bununla yapılır). */
  triggers: number
  total: number
  capped: boolean
  distinctElements: number
  auraSources: SlotState[]
  emit?: EventSink
}
