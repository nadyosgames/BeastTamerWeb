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
  /**
   * Koruma (GDD v0.8): tur sonunda av yaratığının saldırısını emer, tur bitince sıfırlanır.
   * Kart çarpanları (mult) uygulanmaz; yetenek ölçeği, hava ve Tamer çarpanları uygulanır.
   * `per` verilirse amount × sayım.
   */
  | { op: 'guard'; amount: number; per?: Count; if?: Cond }
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
  /** Nereden elde edilir. 'pack' dışındakiler paket havuzuna girmez ('hunt': yalnızca avla). */
  source?: 'pack' | 'quest' | 'starter' | 'hunt'
  /** Görsel üretimi için yaratık tarifi (İngilizce). */
  art?: { creature: string }
  /** Tasarımı henüz kesinleşmemiş kart. */
  draft?: boolean
}

/** Hava, Tamer, bölge buff'ı ve av niyetlerinin ortak dili. */
export type Modifier =
  | { kind: 'incomePct'; pct: number; filter?: CardFilter; if?: Cond }
  | { kind: 'durabilityAtStart'; amount: number; min?: number; filter?: CardFilter; if?: Cond }
  /** Tur başında uyutur: kart en az `passes`. geçişe kadar tetiklenmez (Slumber gibi). Kükreme niyeti. */
  | { kind: 'slumberAtStart'; passes: number; filter?: CardFilter; if?: Cond }
  | { kind: 'abilityScale'; on: AbilityTrigger; pct: number }
  | { kind: 'repeatAbility'; on: AbilityTrigger; times: number }
  | { kind: 'weatherScale'; bonusPct: number; penaltyPct: number }

export interface TamerDef {
  id: string
  name: string
  deckSize: number
  slots: number
  /** Sahadaki Tamer'ın canı (GDD v0.8). Sefer boyunca taşınır, kampta dolar. */
  hp: number
  modifiers: Modifier[]
  text: string
  /** Açılış: başlangıçta ya da toplam bu kadar farklı yaratık bayıltılınca (GDD v0.8 açık karar: ilk öneri). */
  unlock: { kind: 'start' } | { kind: 'captures'; count: number }
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

// ---------------------------------------------------------------------------
// Av (GDD v0.8): av yaratığı, niyetler, özellikler, bölgeler
// ---------------------------------------------------------------------------

/** Av kademesi. Nadirlik bulunduğu yeri anlatır; kademe avın kurallarını belirler. */
export const HUNT_TIERS = ['ordinary', 'hard', 'final', 'legendary', 'mythic', 'ancient'] as const
export type HuntTier = (typeof HUNT_TIERS)[number]

/**
 * Av yaratığının tur niyeti. Turdan önce görünür; kart etkileri tur başında,
 * saldırı ve iyileşme tur sonunda uygulanır. O tur bayılan yaratık niyetini uygulayamaz.
 * Slot numaraları 1 tabanlıdır.
 */
export type Intent =
  /** Pençe: tur sonunda Tamer'a hasar (Şarj sonrası iki katı). */
  | { kind: 'claw'; damage: number }
  /** Yırtma: tur başında bu slottaki kart −1 dayanıklılık (Ward korur). */
  | { kind: 'rend'; slot: number }
  /** Kuyruk Savurma: tur başında en sağdaki `count` kart −1 dayanıklılık. */
  | { kind: 'tailSweep'; count: number }
  /** Kükreme: bu slottaki kart ilk geçişte uyur. */
  | { kind: 'roar'; slot: number }
  /** Savuşturma: bu tur her geçişin ilk Strike'ı boşa gider. */
  | { kind: 'evade' }
  /** Toparlanma: tur sonunda yaratık can kazanır (çubuğunun üstüne çıkmaz). */
  | { kind: 'recover'; amount: number }
  /** Şarj: saldırmaz, sonraki Pençe iki katı vurur. */
  | { kind: 'charge' }
  /** Kaçış Hazırlığı: canı %belowPct altındayken bu tur `damage` hasar almazsa tur sonunda kaçar. */
  | { kind: 'flee'; damage: number; belowPct: number }
  /** Alev Yağmuru: tur başında tüm kartlar −1 dayanıklılık (en az 1, Ward korur). */
  | { kind: 'scorch' }

/** Av boyunca geçerli özellikler: çoğu deste seçimini, Çevik her turun dizilimini sorar. */
export type PreyTrait =
  /** Zırh: her vuruştan N düşer. `offIn` havalarında söner (Buhar Kaplumbağası, Yağmurlu). */
  | { kind: 'armor'; amount: number; offIn?: string[] }
  /** Kabuk: her turun ilk N hasarı emilir. */
  | { kind: 'shell'; amount: number }
  /** Yarı Saydam: 1. geçişte hasarın yarısı işler. */
  | { kind: 'veiled' }
  /** Çevik: her tur Savuşturma. */
  | { kind: 'agile' }
  /** Diken: turda Strike yapan her kart Tamer'a bir kez N hasar yansıtır (tur sonunda, Koruma emer). */
  | { kind: 'thorns'; amount: number }
  /** Direnç: bu elementin vuruşları −pct. */
  | { kind: 'resist'; element: Element; pct: number }
  /** Zayıflık: bu elementin vuruşları +pct. */
  | { kind: 'weak'; element: Element; pct: number }

/** Can %belowPct altına inince (tur sonunda) niyet döngüsü ve özellikler değişir. */
export interface HuntPhase {
  belowPct: number
  intents: Intent[]
  traits?: PreyTrait[]
  text: string
}

export type HuntUnlock =
  | { kind: 'start' }
  /** Bölgede bu kadar farklı yaratık bayıltılınca (Final). */
  | { kind: 'captures'; count: number }
  /** Bölge kitabı tam (Efsanevi ve üstü hariç) ve aynı seferde bu kadar İz (Efsanevi Av). */
  | { kind: 'book'; trail: number }
  /** Başka bir av kazanılınca (Kadim Av). */
  | { kind: 'after'; hunt: string }

export interface HuntDef {
  id: string
  /** Avlanan yaratık = ödül kartı. Ad, element, tip ve görsel karttan gelir. */
  card: string
  region: string
  tier: HuntTier
  /** Tasarım canı. Kalibre değer varsa (content/generated/hunts.json) o kullanılır. */
  hp: number
  /** İkinci can çubuğu: can bitince bir kez bu canla döner (Efsanevi). */
  revive?: number
  intents: Intent[]
  traits?: PreyTrait[]
  phases?: HuntPhase[]
  /** Av gününün havasını yaratık belirler (Efsanevi Av). */
  weather?: string
  /**
   * Kadim Av: her gün bir hava, can günler arasında kalıcıdır. Gün sayısı = hava sayısı.
   * `decks`: kalibrasyonda her gün kullanılan preset deste.
   */
  siege?: { weathers: string[]; decks?: string[] }
  /** Yalnızca bu havalarda iz verir; diğer günler haritada görünür ama avlanamaz. */
  appearsIn?: string[]
  unlock: HuntUnlock
  /** Bölge haritasındaki konum (0..1). */
  pos: [number, number]
  /**
   * Kalibrasyon hedefi: bu deste ve havada usta bot medyan olarak `round`. turda bayıltmalı
   * (kesirli: 4,5 = 5. turun ortası). Kadim kuşatmada tüm günlerin toplam turu.
   * `deck: "ref"` = ilerleme simülasyonunun referans destesi: tipik oyuncunun o noktadaki
   * koleksiyonundan kurulan deste (content/generated/hunts.json → refDecks).
   */
  target?: { deck: string; weather: string; round: number }
  lore: string
}

/** Biyom: bölgenin haritadaki görünümü (arazi çizimleri ve renkleri UI'dadır). */
export const BIOMES = ['volcanic', 'coast', 'forest', 'highlands', 'desert', 'caves', 'marsh', 'summit'] as const
export type Biome = (typeof BIOMES)[number]

export type RegionUnlock =
  | { kind: 'start' }
  /** Listelenen bölgelerin hepsinin Final avı bayıltılınca. */
  | { kind: 'finals'; regions: string[] }

/** Bölge haritasına elle konan yer şekilleri (konumlar bölge alanında 0..1). */
export type MapFeature =
  | { kind: 'river'; points: [number, number][] }
  | { kind: 'lake'; pos: [number, number]; size: [number, number] }
  | { kind: 'landmark'; style: 'mountain' | 'volcano' | 'hill' | 'mesa' | 'crystal' | 'snowpeak' | 'ruin' | 'lighthouse'; pos: [number, number]; scale?: number }
  | { kind: 'label'; pos: [number, number]; text: string; rotate?: number }

export interface RegionDef {
  id: string
  name: string
  text: string
  /** Zorluk basamağı: 1 başlangıç bölgesi. Referans destesi bu sırayla kurulur. */
  level: number
  biome: Biome
  unlock: RegionUnlock
  elements: Element[]
  /** Hava id → ağırlık: bölgenin iklimi. */
  climate: Record<string, number>
  /** Bölge kitabı tamamlanınca kalıcı buff (tüm avlarda geçerli). */
  buff: { text: string; modifiers: Modifier[] }
  /** Dünya haritasındaki alan: [x, y, genişlik, yükseklik] (dünya birimi). */
  area: [number, number, number, number]
  /** Harita: kampın konumu (0..1), avlar arası patikalar (av id çiftleri; 'camp' kampı gösterir), yer şekilleri. */
  map: { camp: [number, number]; paths: [string, string][]; features?: MapFeature[] }
}

/** Dünya haritası: bölgeler bu tuvalin üstüne yerleşir. */
export interface WorldDef {
  name: string
  /** Dünya birimi cinsinden [genişlik, yükseklik]. */
  size: [number, number]
}
