import type { HuntOutcome } from './hunt.ts'
import { createRng, deriveSeed, weightedPick } from './rng.ts'
import type { HuntDef, HuntTier, Rarity, RegionDef, WeatherDef } from './types.ts'

/**
 * Sefer ve av ödülleri (GDD v0.8 "Sefer, gün ve hava" + "Ödül ve ekonomi").
 * Sayılar content/economy.json → expedition'dadır; burada yalnızca kurallar durur.
 */
export interface ExpeditionConfig {
  /** Sefere çıkarken alınan Erzak (her dinlenme 1 harcar). */
  rations: number
  /** Dinlenme günü Tamer'ın azami canının yüzde kaçını doldurur. */
  restHealPct: number
  /** Bayıltmadan sonra kalan her tur için öz bonusu (%). */
  speedBonusPct: number
  /** Seferdeki her ardışık başarılı av için öz bonusu (%). */
  streakBonusPct: number
  /** Tamer düşerse çantadaki özün kaybolan yüzdesi. */
  bagLossPct: number
  /** Kaçan yaratığa verilen hasarın aynı seferde kalan yüzdesi. */
  woundCarryPct: number
  /** Kadim kuşatmada gece Tamer canının dolan yüzdesi. */
  siegeNightHealPct: number
  /** Nadirliğe göre taban öz ödülü. */
  essenceByRarity: Record<Rarity, number>
}

export interface Expedition {
  region: string
  /** Sefere çıkılan gün. */
  startedDay: number
  rations: number
  /** Bu seferde kazanılan av sayısı (Efsanevi Av'ın İz şartı). */
  trail: number
  /** Ardışık başarılı av (öz bonusu); kayıp avda sıfırlanır. */
  streak: number
  /** Çantadaki öz: kampa dönünce bakiyeye geçer. */
  bag: number
  /** Kaçan yaratıkların bu seferdeki kalan canı (av id → can). */
  wounded: Record<string, number>
  hunts: number
}

export function startExpedition(region: string, day: number, cfg: ExpeditionConfig): Expedition {
  return { region, startedDay: day, rations: cfg.rations, trail: 0, streak: 0, bag: 0, wounded: {}, hunts: 0 }
}

export function restHeal(hp: number, maxHp: number, cfg: ExpeditionConfig): number {
  return Math.min(maxHp, hp + Math.ceil((maxHp * cfg.restHealPct) / 100))
}

/** Kaçan yaratığın kalan canı: avın başındaki candan, verilen hasarın woundCarryPct'i düşer (en az 1 can kalır). */
export function woundedHp(startHp: number, damageDealt: number, cfg: ExpeditionConfig): number {
  return Math.max(1, startHp - Math.round((damageDealt * cfg.woundCarryPct) / 100))
}

export interface HuntReward {
  essence: number
  base: number
  /** Bayıltmadan sonra kalan tur. */
  remainingRounds: number
  speedPct: number
  streakPct: number
}

/** Öz = taban × (1 + hız% × kalan tur) × (1 + seri% × seri). */
export function huntReward(rarity: Rarity, capturedRound: number, rounds: number, streak: number, cfg: ExpeditionConfig): HuntReward {
  const base = cfg.essenceByRarity[rarity]
  const remainingRounds = Math.max(0, rounds - (capturedRound + 1))
  const speedPct = cfg.speedBonusPct * remainingRounds
  const streakPct = cfg.streakBonusPct * streak
  return { essence: Math.round(base * (1 + speedPct / 100) * (1 + streakPct / 100)), base, remainingRounds, speedPct, streakPct }
}

/** ★ bayılttı · ★★ 5. turda ya da önce · ★★★ 4. turda ya da önce ve Tamer canının en fazla %10'unu kaybetti. */
export function huntStars(outcome: HuntOutcome, capturedRound: number | null, tamerLost: number, tamerMax: number): 0 | 1 | 2 | 3 {
  if (outcome !== 'captured' || capturedRound === null) return 0
  const roundNo = capturedRound + 1
  if (roundNo <= 4 && tamerLost <= tamerMax * 0.1) return 3
  if (roundNo <= 5) return 2
  return 1
}

// ---------------------------------------------------------------------------
// Bölge ilerlemesi ve kilitler
// ---------------------------------------------------------------------------

/** Bölge kitabını oluşturan kademeler: Efsanevi ve üstü kitabın ödülüdür, parçası değil. */
export const BOOK_TIERS: readonly HuntTier[] = ['ordinary', 'hard', 'final']

export function regionBookComplete(regionHunts: readonly HuntDef[], captured: ReadonlySet<string>): boolean {
  return regionHunts.filter((h) => BOOK_TIERS.includes(h.tier)).every((h) => captured.has(h.id))
}

export function regionCaptureCount(regionHunts: readonly HuntDef[], captured: ReadonlySet<string>): number {
  return regionHunts.filter((h) => (h.tier === 'ordinary' || h.tier === 'hard') && captured.has(h.id)).length
}

export function huntUnlocked(hunt: HuntDef, regionHunts: readonly HuntDef[], captured: ReadonlySet<string>, trail: number): boolean {
  switch (hunt.unlock.kind) {
    case 'start':
      return true
    case 'captures':
      return regionCaptureCount(regionHunts, captured) >= hunt.unlock.count
    case 'book':
      return regionBookComplete(regionHunts, captured) && trail >= hunt.unlock.trail
    case 'after':
      return captured.has(hunt.unlock.hunt)
  }
}

/**
 * Bölge açık mı (GDD v0.9 "Dünya ve biyomlar"): başlangıç bölgesi her zaman açıktır; diğerleri
 * kilidinde listelenen bölgelerin hepsinin Final avı bayıltılınca açılır.
 */
export function regionUnlocked(region: RegionDef, finalOf: (regionId: string) => string | undefined, captured: ReadonlySet<string>): boolean {
  if (region.unlock.kind === 'start') return true
  return region.unlock.regions.every((id) => {
    const fin = finalOf(id)
    return fin !== undefined && captured.has(fin)
  })
}

/** Yaratık bugün iz veriyor mu (appearsIn havaları dışında haritada görünür ama avlanamaz). */
export function huntAppearsToday(hunt: HuntDef, weatherId: string): boolean {
  return !hunt.appearsIn || hunt.appearsIn.includes(weatherId)
}

/** Avın gün havası: Efsanevi Av'da yaratığın havası, Kadim kuşatmada günün havası, yoksa bölgenin günü. */
export function huntWeather(hunt: HuntDef, dayWeather: string, siegeDay = 0): string {
  if (hunt.siege) return hunt.siege.weathers[Math.min(siegeDay, hunt.siege.weathers.length - 1)]
  return hunt.weather ?? dayWeather
}

// ---------------------------------------------------------------------------
// Bölge havası: 5 günlük tahmin
// ---------------------------------------------------------------------------

/** Kararlı string → uint32 (FNV-1a). Bölge id'sinden tohum türetmek için. */
export function hashId(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/**
 * Bölgenin `fromDay`'den başlayan `count` günlük havası. Hava günün özelliğidir: her av,
 * dinlenme ve yolculuk bir gün geçirir. İklim ağırlıkları bölgeden gelir; aynı hava en fazla
 * `maxSameInARow` gün üst üste gelir. Aynı tohum ve gün her zaman aynı havayı verir.
 */
export function regionForecast(
  weathers: readonly WeatherDef[],
  climate: Readonly<Record<string, number>>,
  seed: number,
  regionId: string,
  fromDay: number,
  count: number,
  maxSameInARow = 2,
): string[] {
  const pool = weathers.filter((w) => (climate[w.id] ?? 0) > 0)
  if (!pool.length) throw new Error(`${regionId}: iklimde hava yok`)
  const rng = createRng(deriveSeed(seed, hashId(regionId)))
  const out: string[] = []
  let last = ''
  let run = 0
  for (let d = 0; d < fromDay + count; d++) {
    const candidates = pool.filter((w) => !(w.id === last && run >= maxSameInARow))
    const id = weightedPick(candidates, (w) => climate[w.id] ?? 0, rng).id
    run = id === last ? run + 1 : 1
    last = id
    if (d >= fromDay) out.push(id)
  }
  return out
}
