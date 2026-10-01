/**
 * Canavar Deste - çekirdek veri tipleri.
 *
 * Bu dosya oyunun "spec"idir: content/*.json dosyaları bu tiplere uyar ve
 * Unity'ye geçişte C# tarafında birebir aynı tipler kurulur. Bu yüzden:
 *  - enum yerine string union kullanılır (JSON'da okunabilir, C#'ta enum'a map edilir),
 *  - sınıf / kalıtım yoktur, yalnızca düz veri,
 *  - yetenekler kod değil veridir (Effect DSL). Yeni bir mekanik = yeni bir `op`/`kind`
 *    + engine/rules içinde tek bir handler. Simülasyon ve UI otomatik olarak kullanır.
 */

export const ELEMENTS = ['fire', 'water', 'earth', 'wind', 'electric'] as const
export type Element = (typeof ELEMENTS)[number]

export const CREATURE_TYPES = [
  'beast',
  'ghost',
  'golem',
  'dragon',
  'flora',
  'swarm',
  'avian',
  'serpent',
  'neutral',
] as const
export type CreatureType = (typeof CREATURE_TYPES)[number]

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'ancient'] as const
export type Rarity = (typeof RARITIES)[number]

/** Durum/sıra anahtar kelimeleri. Slumber parametreli olduğu için CardDef.slumber alanındadır. */
export const KEYWORDS = ['swift', 'heavy', 'ward', 'rebirth', 'overload'] as const
export type Keyword = (typeof KEYWORDS)[number]

/** Yeteneğin ne zaman çalıştığı (GDD: zamanlama kelimeleri + Haunt). */
export const ABILITY_TRIGGERS = ['howl', 'harvest', 'lastBreath', 'aura', 'epilogue', 'haunt'] as const
export type AbilityTrigger = (typeof ABILITY_TRIGGERS)[number]

export type Pole = '+' | '-'
export type Side = 'left' | 'right'
export type LinkState = 'compatible' | 'clash'
export type Cmp = '>=' | '<=' | '==' | '>' | '<'

// ---------------------------------------------------------------------------
// Effect DSL
// ---------------------------------------------------------------------------

/** Masadaki kartları seçmek için filtre. Tüm alanlar VE ile, `anyOf` VEYA ile birleşir. */
export interface CardFilter {
  element?: Element
  type?: CreatureType
  keyword?: Keyword
  rarityAtLeast?: Rarity
  state?: 'active' | 'passive'
  baseDurability?: { cmp: Cmp; value: number }
  anyOf?: CardFilter[]
}

/** Sayılabilen şeyler (Sayım, Humus, Karışım, Isı, Büyüme...). */
export type Count =
  /** Masadaki kartlar; `side` verilirse yalnızca o taraftakiler (yön sayımı: "sağındaki her Ateş kartı"). */
  | { kind: 'cards'; filter?: CardFilter; excludeSelf?: boolean; side?: Side }
  /** Kesintisiz zincir: komşudan başlayıp o yönde filtreye uyan ardışık kart sayısı (Alev Zinciri). */
  | { kind: 'chain'; side: Side; filter?: CardFilter }
  | { kind: 'distinctElements' }
  | { kind: 'heat' }
  | { kind: 'selfTriggers' }
  | { kind: 'pass' }

export type Cond =
  | { kind: 'count'; count: Count; cmp: Cmp; value: number }
  | { kind: 'allCards'; filter: CardFilter }
  | { kind: 'slot'; index: number }
  | { kind: 'position'; where: 'first' | 'last' }
  | { kind: 'neighbor'; side: Side; filter: CardFilter }
  | { kind: 'passParity'; parity: 'odd' | 'even' }
  | { kind: 'lastTrigger' }
  | { kind: 'link'; side: Side; state: LinkState }
  | { kind: 'round'; which: 'first' | 'last' }
  | { kind: 'self'; filter: CardFilter }
  | { kind: 'not'; cond: Cond }
  | { kind: 'all'; conds: Cond[] }
  | { kind: 'any'; conds: Cond[] }

export type Target = 'self' | 'left' | 'right' | 'others' | 'all'

/**
 * Yetenek efektleri. Gelir formülü (GDD "Hesaplama sırası"):
 *   ham = (Σ gain + Σ gainPer + aura) × Π mult + kopyalanan
 *   son = ham × hava × albüm × Tamer   → yarım yukarı yuvarlanır
 * Efektler listedeki sırayla işlenir (addHeat sonrası gelen gainPer heat güncel ısıyı görür).
 * addDurability ve retrigger "aksiyon"dur: yeteneğin geliri yazıldıktan sonra sırayla çalışır.
 */
export type Effect =
  | { op: 'gain'; amount: number; if?: Cond }
  | { op: 'gainPer'; amount: number; per: Count; if?: Cond }
  | { op: 'mult'; value: number; if?: Cond }
  | { op: 'copyIncome'; from: Side; pct: number; if?: Cond }
  | { op: 'addHeat'; amount: number; if?: Cond }
  | { op: 'addDurability'; target: Target; amount: number; filter?: CardFilter; if?: Cond }
  | { op: 'retrigger'; target: Target; filter?: CardFilter; if?: Cond }
  /** Yalnızca `on: 'aura'` yeteneklerinde: filtreye uyan diğer kartların Harvest'ine eklenir. */
  | { op: 'aura'; filter?: CardFilter; includeSelf?: boolean; gain?: number; mult?: number }
  /** Kural büken Mythic/Ancient kartlar için kaçış kapısı: engine/rules/custom.ts içindeki id. */
  | { op: 'custom'; id: string; params?: Record<string, number | string | boolean> }

export interface Ability {
  on: AbilityTrigger
  effects: Effect[]
}

// ---------------------------------------------------------------------------
// İçerik tanımları
// ---------------------------------------------------------------------------

export interface CardDef {
  id: string
  name: string
  elements: Element[]
  type: CreatureType
  rarity: Rarity
  durability: number
  /** Paketlerden çıkmaya başladığı burç yılı (GDD yol haritası: kural katmanları yıl yıl açılır). Varsayılan 1. */
  unlockYear?: number
  keywords?: Keyword[]
  slumber?: number
  polarity?: { left: Pole; right: Pole }
  abilities: Ability[]
  /** Kartın üstünde yazan metin (oyuncuya gösterilen). */
  text: string
  /** Nereden elde edilir. 'pack' dışındakiler paket havuzuna girmez. */
  source?: 'pack' | 'quest' | 'starter'
  /** Görsel üretimi için yaratık tarifi (İngilizce). */
  art?: { creature: string }
  /** Tasarımı henüz kesinleşmemiş kart. */
  draft?: boolean
}

/** Hava, Tamer ve albüm pasiflerinin ortak dili. */
export type Modifier =
  | { kind: 'incomePct'; pct: number; filter?: CardFilter; if?: Cond }
  | { kind: 'durabilityAtStart'; amount: number; min?: number; filter?: CardFilter; if?: Cond }
  | { kind: 'abilityScale'; on: AbilityTrigger; pct: number }
  | { kind: 'repeatAbility'; on: AbilityTrigger; times: number }
  | { kind: 'weatherScale'; bonusPct: number; penaltyPct: number }

export interface TamerDef {
  id: string
  name: string
  deckSize: number
  slots: number
  modifiers: Modifier[]
  text: string
  unlock: { kind: 'start' } | { kind: 'year'; year: number } | { kind: 'quest'; quest: string } | { kind: 'lifetime'; amount: number }
  art?: { subject: string }
}

export interface WeatherDef {
  id: string
  name: string
  icon: string
  modifiers: Modifier[]
  text: string
  /** Haftalık hava üretiminde göreli ağırlık. */
  weight: number
  art?: { subject: string }
}
