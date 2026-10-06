import type { ContentDB } from '../content/index.ts'
import { deckLimit, packPrice, type Collection } from '../core/economy.ts'
import {
  huntAppearsToday,
  huntReward,
  huntStars,
  huntUnlocked,
  huntWeather,
  regionBookComplete,
  regionCaptureCount,
  regionForecast,
  regionUnlocked,
  restHeal,
  woundedHp,
} from '../core/expedition.ts'
import { scaleHunt } from '../core/hunt.ts'
import { addToCollection, openPack } from '../core/packs.ts'
import { createRng, deriveSeed } from '../core/rng.ts'
import type { CardDef, HuntDef, HuntTier, Modifier, RegionDef } from '../core/types.ts'
import { buildDeck, collectionToOwned } from './deckbuilder.ts'
import { valuationContext } from './experiments.ts'
import { runHunt, type HuntBot } from './hunt.ts'
import { summarize, type Summary } from './stats.ts'

/**
 * Dünya ilerleme simülasyonu (GDD v0.9 "Dünya, biyomlar ve oyun süresi").
 *
 * "Tipik oyuncu" baştan başlar ve dünyayı gezer: kampta özünü pakete çevirir, koleksiyonundan
 * gideceği bölgenin havasına göre deste kurar, sefere çıkar; her gün hava tahminine bakarak
 * bayıltmadığı en kolay yaratığı seçer, canı azalınca dinlenir, Erzak bitince kampa döner.
 * Bölge kitabını bitirince Efsanevi ve Kadim avları dener, takılırsa sonraki bölgeye geçip
 * güçlenince geri gelir.
 *
 * İki işi var:
 *  1. Oyun süresi: ana hikâye, bölge kitapları ve tüm avlar kaç saat sürer (`world` komutu).
 *  2. Referans koleksiyonu: oyuncunun bir bölgeye girdiği, bölgenin ortasına geldiği ve kitabı
 *     bitirdiği andaki koleksiyonu. Kalibrasyon yaratık canlarını bu koleksiyondan kurulan
 *     desteye göre ayarlar; böylece "elinde olmayan desteyle kalibre edilmiş av" duvarı olmaz.
 *
 * Süre modeli (economy.json → timing): tur başına planlama + adım başına oynatma, üstüne
 * av başına harita/sonuç ekranı. Hızlı Av (★★★ avlar) neredeyse anlıktır.
 */

export type SnapshotPhase = 'entry' | 'mid' | 'late'

/** Avın kalibrasyonunda kullanılan koleksiyon anı: Sıradanlar giriş, Zorlu/Final orta, Efsanevi/Kadim son. */
export const PHASE_OF_TIER: Record<HuntTier, SnapshotPhase> = {
  ordinary: 'entry',
  hard: 'mid',
  final: 'mid',
  legendary: 'late',
  mythic: 'late',
  ancient: 'late',
}

/** Av dışındaki ekran süreleri (dakika). */
export const OVERHEAD = {
  /** Haritada seçim + sonuç ekranı. */
  hunt: 0.6,
  quickHunt: 0.25,
  rest: 0.1,
  camp: 0.3,
  pack: 0.4,
  /** Yeni bölge için deste düzenleme. */
  deckNew: 3,
  /** Aynı bölgede birkaç kart değiştirme. */
  deckTweak: 1,
}

export interface WorldSnapshot {
  region: string
  phase: SnapshotPhase
  minutes: number
  collection: Collection
}

export interface WorldMilestones {
  /** Bölge id → dakika. */
  entry: Record<string, number>
  final: Record<string, number>
  book: Record<string, number>
  /** Bölgedeki tüm avlar (Efsanevi ve Kadim dahil). */
  complete: Record<string, number>
  allFinals: number | null
  allBooks: number | null
  allHunts: number | null
}

export interface WorldRun {
  minutes: number
  days: number
  hunts: number
  quickHunts: number
  expeditions: number
  packs: number
  essenceEarned: number
  distinct: number
  threeStars: number
  /** Kart kopyalarının deste sınırına göre doluluğu (0..1). */
  collection: number
  tamerDowns: number
  milestones: WorldMilestones
  snapshots: WorldSnapshot[]
  stopped: 'done' | 'snapshot' | 'timeout'
  /** Bölge id → o bölgede geçen dakika. */
  regionMinutes: Record<string, number>
}

export interface WorldRunOptions {
  seed: number
  /** Dizilim becerisi (varsayılan: ortalama oyuncu). */
  bot?: HuntBot
  maxHours?: number
  /** Bu bölgenin bu anının koleksiyonu alınınca dur (kalibrasyon). */
  stopAfter?: { region: string; phase: SnapshotPhase }
  /** Av id → can: veritabanındakini ezer (kalibrasyon sırasında). */
  hp?: Record<string, number>
}

interface RecordState {
  captures: number
  stars: number
  attempts: number
}

interface SiegeRun {
  hunt: string
  day: number
  preyHp: number
  fatigued: Set<string>
}

interface ExpeditionRun {
  region: RegionDef
  rations: number
  trail: number
  streak: number
  bag: number
  wounded: Map<string, number>
  tamerHp: number
  siege: SiegeRun | null
  hunts: number
  farmed: number
  fails: Map<string, number>
  newCaptures: number
}

const TIER_ORDER: Record<HuntTier, number> = { ordinary: 0, hard: 1, final: 2, legendary: 3, mythic: 4, ancient: 5 }

/** Bölgenin en olası (etkili) havası: deste bu havaya göre kurulur. */
export function regionMainWeather(region: RegionDef): string {
  return Object.entries(region.climate)
    .filter(([w]) => w !== 'calm')
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'calm'
}

/** Bölgeleri tipik oyuncunun gezdiği sırada döner: seviye, sonra içerik sırası. */
export function regionOrder(db: ContentDB): RegionDef[] {
  return db.regions.map((r, i) => ({ r, i })).sort((a, b) => a.r.level - b.r.level || a.i - b.i).map((x) => x.r)
}

export function simulateWorld(db: ContentDB, opts: WorldRunOptions): WorldRun {
  const eco = db.economy
  const cfg = eco.expedition
  const timing = eco.timing
  const tamer = db.tamer(db.starter.tamer)
  const bot = opts.bot ?? 'casual'
  const maxMinutes = (opts.maxHours ?? 160) * 60
  const seed = opts.seed
  const packRng = createRng(deriveSeed(seed, 91))
  const deckRng = createRng(deriveSeed(seed, 92))
  const huntHp = (id: string) => opts.hp?.[id] ?? db.huntHp(id)
  const scaled = new Map<string, HuntDef>()
  const scaledHunt = (h: HuntDef) => {
    let s = scaled.get(h.id)
    if (!s) scaled.set(h.id, (s = scaleHunt(h, huntHp(h.id))))
    return s
  }
  const standard = eco.packs.find((p) => p.id === eco.basePack) ?? eco.packs[0]
  const standardPrice = packPrice(standard, eco)

  // --- Durum -----------------------------------------------------------------------------------
  const collection: Collection = {}
  for (const c of db.starterDeck()) collection[c.id] = (collection[c.id] ?? 0) + 1
  const records = new Map<string, RecordState>()
  const captured = new Set<string>()
  let essence = db.starter.resource
  let essenceEarned = 0
  let day = 0
  let minutes = 0
  let pity = 0
  let packs = 0
  let hunts = 0
  let quickHunts = 0
  let expeditions = 0
  let tamerDowns = 0
  let deck: CardDef[] = db.starterDeck()
  let deckRegion = ''
  let deckCollectionSize = -1
  const snapshots: WorldSnapshot[] = []
  const snapped = new Set<string>()
  const milestones: WorldMilestones = { entry: {}, final: {}, book: {}, complete: {}, allFinals: null, allBooks: null, allHunts: null }
  const regionMinutes: Record<string, number> = {}
  const stuck = new Map<string, number>()
  const deferred = new Set<string>()
  /**
   * Oyuncuyu bayıltan ya da bir seferde iki kez kaçan av: deste güçlenene (8 yeni kart) ya da 4 sefer geçene
   * kadar denenmez (koleksiyon dolduğunda da sonsuza kadar kaçınılmasın).
   */
  const danger = new Map<string, { size: number; expedition: number }>()
  const dangerous = (id: string) => {
    const d = danger.get(id)
    return !!d && collectionSize() < d.size + 8 && expeditions < d.expedition + 4
  }
  const markDanger = (id: string) => danger.set(id, { size: collectionSize(), expedition: expeditions })

  // Bölge havası: tohum + bölge ile belirlenir (oyundakiyle aynı üretici), baştan bir kez üretilir.
  const forecastCache = new Map<string, string[]>()
  const weatherOn = (region: RegionDef, d: number): string => {
    let days = forecastCache.get(region.id)
    if (!days || days.length <= d + 3) {
      days = regionForecast(db.weather, region.climate, seed, region.id, 0, Math.max(d + 400, (days?.length ?? 0) * 2))
      forecastCache.set(region.id, days)
    }
    return days[d]
  }

  const finalOf = (rid: string) => db.regionFinal(rid)?.id
  const isUnlocked = (r: RegionDef) => regionUnlocked(r, finalOf, captured)
  const passives = (): Modifier[] => db.regions.filter((r) => regionBookComplete(db.regionHunts(r.id), captured)).flatMap((r) => r.buff.modifiers)

  const snapshot = (region: string, phase: SnapshotPhase) => {
    const key = `${region}:${phase}`
    if (snapped.has(key)) return false
    snapped.add(key)
    snapshots.push({ region, phase, minutes, collection: { ...collection } })
    return opts.stopAfter?.region === region && opts.stopAfter.phase === phase
  }

  const finish = (stopped: WorldRun['stopped']): WorldRun => {
    let have = 0
    let limit = 0
    for (const c of db.cards) {
      const l = deckLimit(c, eco)
      limit += l
      have += Math.min(l, collection[c.id] ?? 0)
    }
    return {
      minutes,
      days: day,
      hunts,
      quickHunts,
      expeditions,
      packs,
      essenceEarned,
      distinct: captured.size,
      threeStars: [...records.values()].filter((r) => r.stars >= 3).length,
      collection: have / limit,
      tamerDowns,
      milestones,
      snapshots,
      stopped,
      regionMinutes,
    }
  }

  // --- Kamp kararları ----------------------------------------------------------------------------
  const regionDone = (r: RegionDef) => db.regionHunts(r.id).every((h) => captured.has(h.id))

  const chooseRegion = (): RegionDef | null => {
    const open = regionOrder(db).filter((r) => isUnlocked(r) && !regionDone(r))
    if (!open.length) return null
    // Önce kitabı bitmemiş bölgeler (ana yol), sonra Efsanevi/Kadim kalanlar.
    const pick = open.find((r) => !deferred.has(r.id) && !regionBookComplete(db.regionHunts(r.id), captured)) ?? open.find((r) => !deferred.has(r.id))
    if (pick) return pick
    deferred.clear()
    return open[0]
  }

  const buyPacks = () => {
    while (essence >= standardPrice) {
      const opened = openPack(standard, db.packPool, collection, eco, packRng, { pity })
      const added = addToCollection(collection, opened.cards, eco)
      essence += added.essence - standardPrice
      pity = opened.pity
      packs++
      minutes += OVERHEAD.pack
    }
  }

  const collectionSize = () => Object.values(collection).reduce((a, b) => a + b, 0)

  const prepareDeck = (region: RegionDef) => {
    const size = collectionSize()
    // Oyuncu her kampta desteyi baştan kurmaz: yeni bölgede ya da koleksiyon belirgin büyüyünce düzenler.
    if (region.id === deckRegion && size - deckCollectionSize < 8) return
    const weather = db.weatherById.get(regionMainWeather(region)) ?? null
    const next = buildDeck(collectionToOwned(collection, db.cardById), valuationContext(tamer, weather), eco, deckRng, { deckSize: tamer.deckSize, samples: 12 })
    if (next.length < tamer.deckSize) return
    minutes += region.id === deckRegion ? OVERHEAD.deckTweak : OVERHEAD.deckNew
    deck = next
    deckRegion = region.id
    deckCollectionSize = size
  }

  // --- Seferde günlük karar --------------------------------------------------------------------
  /** Oyuncunun niyet döngüsüne bakıp tahmin ettiği hasar: 5 turun pençeleri (Şarj sonrakini ikiye katlar) + diken. */
  const expectedDamage = (h: HuntDef) => {
    let dmg = 0
    let charged = false
    for (let r = 0; r < 5; r++) {
      const it = h.intents[r % h.intents.length]
      if (it.kind === 'charge') charged = true
      else if (it.kind === 'claw') {
        dmg += it.damage * (charged ? 2 : 1)
        charged = false
      }
    }
    for (const t of h.traits ?? []) if (t.kind === 'thorns') dmg += t.amount * 6
    return dmg
  }

  const effectiveHp = (h: HuntDef, exp: ExpeditionRun, weather: string) => {
    let hp = Math.min(huntHp(h.id), exp.wounded.get(h.id) ?? Infinity)
    for (const t of h.traits ?? []) if (t.kind === 'armor' && !t.offIn?.includes(weather)) hp *= 1 + 0.35 * t.amount
    return hp
  }

  /** Zırhı belli havada sönen yaratık: o hava 2 gün içinde geliyorsa bugün bekle. */
  const waitForWeather = (h: HuntDef, region: RegionDef, today: string) => {
    const off = (h.traits ?? []).flatMap((t) => (t.kind === 'armor' ? (t.offIn ?? []) : []))
    if (!off.length || off.includes(today)) return false
    return [1, 2].some((k) => off.includes(weatherOn(region, day + k)))
  }

  const pickTarget = (exp: ExpeditionRun, today: string): HuntDef | null => {
    const regionHunts = db.regionHunts(exp.region.id)
    const book = regionBookComplete(regionHunts, captured)
    const open = regionHunts.filter((h) => {
      if (captured.has(h.id) || (exp.fails.get(h.id) ?? 0) >= 2) return false
      if (dangerous(h.id)) return false
      if (!huntUnlocked(h, regionHunts, captured, exp.trail)) return false
      if (!h.weather && !h.siege && !huntAppearsToday(h, today)) return false
      if ((h.tier === 'legendary' || h.tier === 'ancient') && !book) return false
      if (h.siege && exp.tamerHp < tamer.hp * 0.7) return false
      return !waitForWeather(h, exp.region, today)
    })
    if (!open.length) return null
    return open.reduce((a, b) => {
      const ka = TIER_ORDER[a.tier] * 1e6 + effectiveHp(a, exp, today)
      const kb = TIER_ORDER[b.tier] * 1e6 + effectiveHp(b, exp, today)
      return kb < ka ? b : a
    })
  }

  const pickFarm = (exp: ExpeditionRun, today: string): HuntDef | null => {
    const regionHunts = db.regionHunts(exp.region.id)
    const done = regionHunts.filter((h) => captured.has(h.id) && !h.siege && (h.tier === 'ordinary' || h.tier === 'hard') && huntAppearsToday(h, today))
    if (!done.length) return null
    // Önce kopyası eksik olan (deste için), sonra en yüksek ödül.
    const copies = (h: HuntDef) => (collection[h.card] ?? 0) < deckLimit(db.card(h.card), eco)
    return done.reduce((a, b) => {
      const sa = (copies(a) ? 1e6 : 0) + (records.get(a.id)?.stars === 3 ? 5e5 : 0) - effectiveHp(a, exp, today)
      const sb = (copies(b) ? 1e6 : 0) + (records.get(b.id)?.stars === 3 ? 5e5 : 0) - effectiveHp(b, exp, today)
      return sb > sa ? b : a
    })
  }

  /** Kampa dönülmüş bölgede yaratık bekleniyor mu (havası yakında gelecek)? */
  const worthWaiting = (exp: ExpeditionRun) => {
    const regionHunts = db.regionHunts(exp.region.id)
    return regionHunts.some((h) => {
      if (captured.has(h.id) || !huntUnlocked(h, regionHunts, captured, exp.trail)) return false
      if (h.appearsIn) return [1, 2].some((k) => h.appearsIn!.includes(weatherOn(exp.region, day + k)))
      return waitForWeather(h, exp.region, weatherOn(exp.region, day))
    })
  }

  // --- Av --------------------------------------------------------------------------------------
  const playHunt = (h: HuntDef, exp: ExpeditionRun, today: string, quick: boolean): boolean => {
    const siege = exp.siege?.hunt === h.id ? exp.siege : null
    const weatherId = huntWeather(h, today, siege?.day ?? 0)
    const maxHp = huntHp(h.id)
    const startHp = siege ? siege.preyHp : Math.min(maxHp, exp.wounded.get(h.id) ?? maxHp)
    const run = runHunt(
      {
        hunt: scaledHunt(h),
        hp: maxHp,
        startHp,
        deck,
        tamer,
        tamerHp: exp.tamerHp,
        weather: db.weatherById.get(weatherId) ?? null,
        passives: passives(),
        fatigued: siege?.fatigued,
        siegeContinues: !!h.siege && (siege?.day ?? 0) + 1 < h.siege.weathers.length,
      },
      quick ? 'aware' : bot,
      deriveSeed(seed, day, hunts, 17),
    )
    const spent = quick ? OVERHEAD.quickHunt : (run.rounds * timing.planningSecPerRound + run.steps * timing.secPerStep) / 60 + OVERHEAD.hunt
    minutes += spent
    regionMinutes[exp.region.id] = (regionMinutes[exp.region.id] ?? 0) + spent
    hunts++
    if (quick) quickHunts++
    exp.hunts++
    day++

    const rec = records.get(h.id) ?? { captures: 0, stars: 0, attempts: 0 }
    rec.attempts++
    records.set(h.id, rec)
    exp.tamerHp = run.tamerHpEnd

    switch (run.outcome) {
      case 'captured': {
        const card = db.card(h.card)
        const capturedRound = (run.capturedRound ?? run.rounds) - 1
        const reward = huntReward(card.rarity, capturedRound, Math.ceil(deck.length / tamer.slots), exp.streak, cfg)
        const added = addToCollection(collection, [card], eco)
        exp.bag += reward.essence + added.essence
        rec.captures++
        rec.stars = Math.max(rec.stars, huntStars('captured', capturedRound, run.tamerDamage, tamer.hp))
        exp.wounded.delete(h.id)
        exp.trail++
        exp.streak++
        exp.siege = null
        if (!captured.has(h.id)) {
          captured.add(h.id)
          exp.newCaptures++
          return onFirstCapture(h)
        }
        return false
      }
      case 'escaped':
      case 'fled':
        if (!h.siege) exp.wounded.set(h.id, woundedHp(startHp, run.damage, cfg))
        exp.fails.set(h.id, (exp.fails.get(h.id) ?? 0) + 1)
        if (exp.fails.get(h.id)! >= 2) markDanger(h.id)
        exp.streak = 0
        exp.siege = null
        return false
      case 'nightfall':
        exp.siege = { hunt: h.id, day: (siege?.day ?? 0) + 1, preyHp: run.preyHpEnd, fatigued: run.played }
        exp.tamerHp = Math.min(tamer.hp, run.tamerHpEnd + Math.ceil((tamer.hp * cfg.siegeNightHealPct) / 100))
        return false
      case 'tamerDown': {
        const lost = Math.round((exp.bag * cfg.bagLossPct) / 100)
        exp.bag -= lost
        exp.tamerHp = 0
        exp.fails.set(h.id, (exp.fails.get(h.id) ?? 0) + 1)
        markDanger(h.id)
        tamerDowns++
        return false
      }
    }
  }

  /** İlk bayıltmadan sonra: kilometre taşları ve koleksiyon anları. true → dur. */
  const onFirstCapture = (h: HuntDef): boolean => {
    let stop = false
    const region = db.region(h.region)
    const regionHunts = db.regionHunts(region.id)
    if (h.tier === 'final') {
      milestones.final[region.id] = minutes
      deferred.clear()
      stuck.clear()
      if (db.regions.every((r) => milestones.final[r.id] !== undefined)) milestones.allFinals = minutes
    }
    if (regionCaptureCount(regionHunts, captured) >= 4) stop = snapshot(region.id, 'mid') || stop
    if (regionBookComplete(regionHunts, captured) && milestones.book[region.id] === undefined) {
      milestones.book[region.id] = minutes
      stop = snapshot(region.id, 'late') || stop
      if (db.regions.every((r) => milestones.book[r.id] !== undefined)) milestones.allBooks = minutes
    }
    if (regionDone(region)) milestones.complete[region.id] = minutes
    if (captured.size === db.hunts.length) milestones.allHunts = minutes
    return stop
  }

  // --- Ana döngü -------------------------------------------------------------------------------
  while (minutes < maxMinutes) {
    const region = chooseRegion()
    if (!region) return finish('done')
    if (milestones.entry[region.id] === undefined) milestones.entry[region.id] = minutes
    if (snapshot(region.id, 'entry')) return finish('snapshot')
    buyPacks()
    prepareDeck(region)
    expeditions++
    minutes += OVERHEAD.camp
    const exp: ExpeditionRun = {
      region,
      rations: cfg.rations,
      trail: 0,
      streak: 0,
      bag: 0,
      wounded: new Map(),
      tamerHp: tamer.hp,
      siege: null,
      hunts: 0,
      farmed: 0,
      fails: new Map(),
      newCaptures: 0,
    }
    let stop = false
    while (exp.tamerHp > 0 && minutes < maxMinutes) {
      const today = weatherOn(region, day)
      if (exp.siege) {
        if (exp.tamerHp >= tamer.hp * 0.25) {
          stop = playHunt(db.hunt(exp.siege.hunt), exp, today, false)
          if (stop) break
          continue
        }
        exp.siege = null
      }
      if (exp.tamerHp < tamer.hp * 0.45) {
        if (exp.rations > 0) {
          exp.rations--
          exp.tamerHp = restHeal(exp.tamerHp, tamer.hp, cfg)
          day++
          minutes += OVERHEAD.rest
          continue
        }
        break
      }
      if (exp.hunts >= 9) break
      const target = pickTarget(exp, today)
      if (target && exp.tamerHp < expectedDamage(target) * 1.1) {
        // Bu canla riskli: dinlen ya da kampa dön.
        if (exp.rations > 0 && exp.tamerHp < tamer.hp * 0.8) {
          exp.rations--
          exp.tamerHp = restHeal(exp.tamerHp, tamer.hp, cfg)
          day++
          minutes += OVERHEAD.rest
          continue
        }
        if (exp.tamerHp < tamer.hp * 0.8) break
      }
      if (target) {
        stop = playHunt(target, exp, today, false)
        if (stop) break
        continue
      }
      const farm = exp.farmed < 3 ? pickFarm(exp, today) : null
      if (farm) {
        exp.farmed++
        stop = playHunt(farm, exp, today, records.get(farm.id)?.stars === 3)
        if (stop) break
        continue
      }
      if (exp.rations > 0 && worthWaiting(exp)) {
        exp.rations--
        exp.tamerHp = restHeal(exp.tamerHp, tamer.hp, cfg)
        day++
        minutes += OVERHEAD.rest
        continue
      }
      break
    }
    // Kampa dönüş (Tamer düştüyse çanta zaten yarıya indi).
    essence += exp.bag
    essenceEarned += exp.bag
    day++
    minutes += OVERHEAD.camp
    if (stop) return finish('snapshot')
    if (exp.newCaptures === 0) {
      const n = (stuck.get(region.id) ?? 0) + 1
      stuck.set(region.id, n)
      if (n >= 2) deferred.add(region.id)
    } else stuck.delete(region.id)
  }
  return finish('timeout')
}

// ---------------------------------------------------------------------------
// Rapor: birden çok oyun
// ---------------------------------------------------------------------------

export interface WorldReport {
  bot: HuntBot
  samples: number
  hours: { allFinals: Summary; allBooks: Summary; allHunts: Summary; total: Summary }
  /** Her bölge: giriş, Final, kitap ve tamamlanma saati (medyan) + o bölgede geçen saat. */
  regions: { id: string; name: string; level: number; entry: number; final: number; book: number; complete: number; hoursIn: number; reached: number }[]
  /** Oyun başına ortalamalar. */
  per: { hunts: number; quickHunts: number; expeditions: number; packs: number; tamerDowns: number; threeStars: number; collection: number; days: number }
  unfinished: number
}

const hrs = (m: number | null | undefined) => (m === null || m === undefined ? NaN : m / 60)

export function worldReport(db: ContentDB, runs: readonly WorldRun[], bot: HuntBot): WorldReport {
  const finite = (xs: number[]) => xs.filter((x) => Number.isFinite(x))
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
  const med = (xs: number[]) => {
    const f = finite(xs)
    return f.length * 2 >= xs.length ? summarize(f).p50 : NaN
  }
  return {
    bot,
    samples: runs.length,
    hours: {
      allFinals: summarize(finite(runs.map((r) => hrs(r.milestones.allFinals)))),
      allBooks: summarize(finite(runs.map((r) => hrs(r.milestones.allBooks)))),
      allHunts: summarize(finite(runs.map((r) => hrs(r.milestones.allHunts)))),
      total: summarize(runs.map((r) => r.minutes / 60)),
    },
    regions: regionOrder(db).map((r) => ({
      id: r.id,
      name: r.name,
      level: r.level,
      entry: med(runs.map((x) => hrs(x.milestones.entry[r.id]))),
      final: med(runs.map((x) => hrs(x.milestones.final[r.id]))),
      book: med(runs.map((x) => hrs(x.milestones.book[r.id]))),
      complete: med(runs.map((x) => hrs(x.milestones.complete[r.id]))),
      hoursIn: mean(runs.map((x) => (x.regionMinutes[r.id] ?? 0) / 60)),
      reached: runs.filter((x) => x.milestones.entry[r.id] !== undefined).length / Math.max(1, runs.length),
    })),
    per: {
      hunts: mean(runs.map((r) => r.hunts)),
      quickHunts: mean(runs.map((r) => r.quickHunts)),
      expeditions: mean(runs.map((r) => r.expeditions)),
      packs: mean(runs.map((r) => r.packs)),
      tamerDowns: mean(runs.map((r) => r.tamerDowns)),
      threeStars: mean(runs.map((r) => r.threeStars)),
      collection: mean(runs.map((r) => r.collection)),
      days: mean(runs.map((r) => r.days)),
    },
    unfinished: runs.filter((r) => r.stopped !== 'done').length,
  }
}

// ---------------------------------------------------------------------------
// Referans koleksiyonu
// ---------------------------------------------------------------------------

/** Kart başına medyan kopya: "tipik oyuncunun" o andaki koleksiyonu. */
export function medianCollection(collections: readonly Collection[]): Collection {
  const ids = new Set(collections.flatMap((c) => Object.keys(c)))
  const out: Collection = {}
  for (const id of ids) {
    const counts = collections.map((c) => c[id] ?? 0).sort((a, b) => a - b)
    const m = counts[Math.floor((counts.length - 1) / 2)]
    if (m > 0) out[id] = m
  }
  return out
}
