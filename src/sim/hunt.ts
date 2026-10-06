import { REF_DECK, type ContentDB } from '../content/index.ts'
import type { CalibratedHunts } from '../core/economy.ts'
import type { CardDef, HuntDef, Modifier, TamerDef, WeatherDef } from '../core/types.ts'
import { compileModifiers } from '../core/engine/modifiers.ts'
import { resolveRound } from '../core/engine/round.ts'
import type { RoundContext } from '../core/engine/state.ts'
import {
  expectedAttack,
  huntArrangementValue,
  prepareHuntRound,
  resolveHuntRound,
  scaleHunt,
  startHunt,
  type HuntOutcome,
  type HuntRoundPrep,
  type HuntState,
} from '../core/hunt.ts'
import { hashId } from '../core/expedition.ts'
import { createRng, deriveSeed } from '../core/rng.ts'
import { masterArranger, noviceArranger } from './arrangers.ts'
import { summarize, type Summary } from './stats.ts'

/**
 * Av simülasyonu (GDD v0.8 "Motor, simülasyon ve ilk test"). Yaratık canları elle değil,
 * buradaki kalibrasyonla belirlenir: hedef deste ve havada usta bot yaratığı hedef turda bayıltmalı.
 *
 * Botlar:
 *  - aware:  niyeti ve özellikleri bilir; tüm dizilimleri av sonucuyla dener (hasar + gerekli Koruma).
 *  - master: yaratığı yok sayar; ham geliri en yüksek dizilimi seçer (v0.6 ustası).
 *  - novice: yaratığı yok sayar; tek geçişli açgözlü.
 *  - casual: "ortalama oyuncu"; turların ~%60'ında niyeti bilerek, kalanında yalnızca ham gelire bakarak dizer.
 * aware / master farkı "niyetler dizilim kararı yaratıyor mu" sorusunun ölçüsüdür.
 */
export type HuntBot = 'aware' | 'master' | 'novice' | 'casual'

/** Ortalama oyuncunun niyeti bilerek dizdiği turların payı (%). */
const CASUAL_AWARE_PCT = 60

/** Aynı kart nesnesi birden çok kez varsa tekrar eden dizilimleri atlar. */
export function uniquePermutations<T>(items: readonly T[]): T[][] {
  const out: T[][] = []
  const cur: T[] = []
  const used = new Array<boolean>(items.length).fill(false)
  const rec = () => {
    if (cur.length === items.length) {
      out.push(cur.slice())
      return
    }
    const seen = new Set<T>()
    for (let i = 0; i < items.length; i++) {
      if (used[i] || seen.has(items[i])) continue
      seen.add(items[i])
      used[i] = true
      cur.push(items[i])
      rec()
      cur.pop()
      used[i] = false
    }
  }
  rec()
  return out
}

/** Yaratığı hesaba katan en iyi dizilim (UI'daki "en iyi dizilim" karşılaştırması da bunu kullanır). */
export function bestHuntArrangement(state: HuntState, hand: readonly CardDef[], prep?: HuntRoundPrep): { arrangement: CardDef[]; value: number } {
  const p = prep ?? prepareHuntRound(state, hand.length)
  const attack = expectedAttack(state) + p.thorns * hand.length
  let best: CardDef[] = hand.slice()
  let bestValue = -Infinity
  for (const perm of uniquePermutations(hand)) {
    const { result } = resolveHuntRound(state, perm, undefined, p)
    const v = huntArrangementValue(result, attack)
    if (v > bestValue) {
      bestValue = v
      best = perm
    }
  }
  return { arrangement: best, value: bestValue }
}

/** Yaratıktan habersiz dizilim için turun temel bağlamı (hava + Tamer + pasifler, niyetsiz). */
function baseContext(state: HuntState): RoundContext {
  return {
    mods: compileModifiers({ weather: state.weather, tamer: state.tamer, passives: state.passives }),
    roundIndex: state.round,
    roundCount: state.hands.length,
    triggerCap: state.triggerCap,
  }
}

export function arrangeForBot(bot: HuntBot, state: HuntState, hand: readonly CardDef[], prep: HuntRoundPrep): CardDef[] {
  switch (bot) {
    case 'aware':
      return bestHuntArrangement(state, hand, prep).arrangement
    case 'master':
      return masterArranger(hand, baseContext(state))
    case 'novice':
      return noviceArranger(hand, baseContext(state))
    case 'casual':
      // Deterministik "zar": aynı el ve tur hep aynı kararı verir (ortak rastgele sayılar korunur).
      return hashId(`${state.round}|${hand.map((c) => c.id).join(',')}|${state.prey.hp}`) % 100 < CASUAL_AWARE_PCT
        ? bestHuntArrangement(state, hand, prep).arrangement
        : masterArranger(hand, baseContext(state))
  }
}

export interface HuntRunSetup {
  hunt: HuntDef
  hp: number
  revive?: number
  startHp?: number
  deck: readonly CardDef[]
  tamer: TamerDef
  tamerHp?: number
  weather: WeatherDef | null
  passives?: Modifier[]
  fatigued?: ReadonlySet<string>
  siegeContinues?: boolean
}

export interface HuntRun {
  outcome: HuntOutcome
  /** Bayıltılan tur (1 tabanlı) ya da null. */
  capturedRound: number | null
  /** Kesirli bayıltma turu: 3,4 = 4. turun %40'ında bayıldı. Bayılmadıysa tahmini (> tur sayısı). */
  killRound: number
  damage: number
  tamerDamage: number
  tamerHpEnd: number
  preyHpEnd: number
  rounds: number
  steps: number
  /** Oynanan kart id'leri (kuşatmada ertesi günün yorgunluğu için). */
  played: Set<string>
}

export function runHunt(setup: HuntRunSetup, bot: HuntBot, seed: number): HuntRun {
  const hunt = setup.revive !== undefined ? { ...setup.hunt, revive: setup.revive } : setup.hunt
  let state = startHunt(
    {
      hunt,
      hp: setup.hp,
      startHp: setup.startHp,
      deck: setup.deck,
      tamer: setup.tamer,
      tamerHp: setup.tamerHp ?? setup.tamer.hp,
      weather: setup.weather,
      passives: setup.passives,
      fatigued: setup.fatigued,
      siegeContinues: setup.siegeContinues,
    },
    createRng(seed),
  )
  const totalHp = setup.hp + (hunt.revive ?? 0)
  let killRound = 0
  let steps = 0
  const played = new Set<string>()
  while (!state.outcome) {
    const hand = state.hands[state.round]
    const prep = prepareHuntRound(state, hand.length)
    const arrangement = arrangeForBot(bot, state, hand, prep)
    for (const c of arrangement) played.add(c.id)
    const before = state
    const { state: next, result } = resolveHuntRound(state, arrangement, undefined, prep)
    steps += resolveRound(arrangement, { mods: prep.mods, roundIndex: before.round, roundCount: before.hands.length, triggerCap: before.triggerCap }).steps
    if (result.captured) {
      // Kesirli tur: o turda kalan canın ne kadarlık hasarla bittiği (ikinci çubuk dahil).
      const need = result.preyHpBefore + (before.prey.revived || !hunt.revive ? 0 : hunt.revive)
      killRound = before.round + Math.min(1, need / Math.max(1, result.damage))
    }
    state = next
  }
  if (!killRound) {
    // Bayılmadı: kalan can / ortalama tur hasarı kadar fazladan tur.
    const avg = state.damageDealt / Math.max(1, state.round)
    const left = state.prey.hp + (state.prey.revived || !hunt.revive ? 0 : hunt.revive)
    killRound = state.round + (avg > 0 ? left / avg : totalHp)
  }
  return {
    outcome: state.outcome!,
    capturedRound: state.capturedRound === null ? null : state.capturedRound + 1,
    killRound,
    damage: state.damageDealt,
    tamerDamage: state.tamerDamageTaken,
    tamerHpEnd: state.tamerHp,
    preyHpEnd: state.prey.hp,
    rounds: state.round,
    steps,
    played,
  }
}

// ---------------------------------------------------------------------------
// Profil: bir av + deste + hava + bot
// ---------------------------------------------------------------------------

export interface HuntProfile {
  /** Preset deste id'si ya da "ref" (avın referans destesi). */
  deck: string
  weather: string
  bot: HuntBot
  /** Tamer canı sınırsız: yalnızca hasar potansiyeli ölçülür (kalibrasyon). */
  immortalTamer?: boolean
  tamer?: string
  /** Açık kart listesi (deck yerine; kalibrasyon sırasında referans destesi). */
  cards?: readonly CardDef[]
  /** Kuşatmada gün başına kart listesi. */
  dayCards?: readonly (readonly CardDef[])[]
}

/** Profilin gün destesi: açık liste > "ref" > kuşatmanın preset destesi > profil destesi. */
export function profileDeck(db: ContentDB, hunt: HuntDef, profile: HuntProfile, day = 0): readonly CardDef[] {
  if (profile.dayCards?.[day]) return profile.dayCards[day]
  if (profile.cards) return profile.cards
  if (profile.deck === REF_DECK) return db.huntTargetDeck(hunt.id, day)
  const siegeDeck = hunt.siege?.decks?.[day]
  return db.deckCards(siegeDeck ?? profile.deck)
}

export interface HuntProfileReport {
  hunt: string
  profile: HuntProfile
  hp: number
  samples: number
  captureRate: number
  killRound: Summary
  tamerDamage: Summary
  outcomes: Partial<Record<HuntOutcome, number>>
  minutes: Summary
}

/** Kuşatma dahil: Kadim Av'da günler sırayla oynanır, can ve Tamer canı taşınır. */
export function simulateHunt(db: ContentDB, huntId: string, profile: HuntProfile, opts: { seed: number; samples: number; hp?: number }): HuntProfileReport {
  const hp = opts.hp ?? db.huntHp(huntId)
  const hunt = scaleHunt(db.hunt(huntId), hp)
  const tamer = db.tamer(profile.tamer ?? db.starter.tamer)
  const t = db.economy.timing
  const kills: number[] = []
  const tamerDamage: number[] = []
  const minutes: number[] = []
  const outcomes: Partial<Record<HuntOutcome, number>> = {}
  let captured = 0
  for (let i = 0; i < opts.samples; i++) {
    const seed = deriveSeed(opts.seed, i, 31)
    let run: HuntRun
    if (hunt.siege) {
      const days = hunt.siege.weathers.length
      let preyHp = hp
      let tamerHp = profile.immortalTamer ? 1e9 : tamer.hp
      let fatigued = new Set<string>()
      let roundsBefore = 0
      let dealt = 0
      let taken = 0
      let total: HuntRun | undefined
      let mins = 0
      for (let d = 0; d < days; d++) {
        const r = runHunt(
          {
            hunt,
            hp,
            startHp: preyHp,
            deck: profileDeck(db, hunt, profile, d),
            tamer,
            tamerHp,
            weather: db.weatherById.get(hunt.siege.weathers[d]) ?? null,
            fatigued,
            siegeContinues: d + 1 < days,
          },
          profile.bot,
          deriveSeed(seed, d),
        )
        mins += (r.rounds * t.planningSecPerRound + r.steps * t.secPerStep) / 60
        dealt += r.damage
        taken += r.tamerDamage
        total = { ...r, killRound: roundsBefore + r.killRound, damage: dealt, tamerDamage: taken }
        if (r.outcome !== 'nightfall') break
        roundsBefore += r.rounds
        preyHp = r.preyHpEnd
        tamerHp = profile.immortalTamer ? 1e9 : Math.min(tamer.hp, r.tamerHpEnd + Math.ceil((tamer.hp * db.economy.expedition.siegeNightHealPct) / 100))
        fatigued = r.played
      }
      run = total!
      minutes.push(mins)
    } else {
      run = runHunt(
        {
          hunt,
          hp,
          deck: profileDeck(db, hunt, profile),
          tamer,
          tamerHp: profile.immortalTamer ? 1e9 : tamer.hp,
          weather: db.weatherById.get(hunt.weather ?? profile.weather) ?? null,
        },
        profile.bot,
        seed,
      )
      minutes.push((run.rounds * t.planningSecPerRound + run.steps * t.secPerStep) / 60)
    }
    kills.push(run.killRound)
    tamerDamage.push(run.tamerDamage)
    outcomes[run.outcome] = (outcomes[run.outcome] ?? 0) + 1
    if (run.outcome === 'captured') captured++
  }
  return {
    hunt: huntId,
    profile,
    hp,
    samples: opts.samples,
    captureRate: captured / opts.samples,
    killRound: summarize(kills),
    tamerDamage: summarize(tamerDamage),
    outcomes,
    minutes: summarize(minutes),
  }
}

// ---------------------------------------------------------------------------
// Kalibrasyon: yaratık canı = hedef turda bayıltan can
// ---------------------------------------------------------------------------

export interface HuntCalibration {
  hunt: string
  target: number
  designHp: number
  hp: number
  killRound: number
  iterations: number
}

/**
 * Hedef profilde (hedef deste + hava, aware usta bot, Tamer ölümsüz) medyan kesirli bayıltma
 * turu hedefe eşit olana kadar can ayarlanır. Bayıltma turu cana göre neredeyse doğrusal
 * olduğu için kesen (secant) adımlar birkaç iterasyonda yakınsar. Ortak rastgele sayılar
 * (aynı tohumlar) gürültüyü azaltır.
 */
export function calibrateHunt(
  db: ContentDB,
  huntId: string,
  opts: { seed: number; samples: number; iterations: number; cards?: readonly CardDef[]; dayCards?: readonly (readonly CardDef[])[]; startHp?: number },
): HuntCalibration | null {
  const hunt = db.hunt(huntId)
  if (!hunt.target) return null
  const profile: HuntProfile = { deck: hunt.target.deck, weather: hunt.target.weather, bot: 'aware', immortalTamer: true, cards: opts.cards, dayCards: opts.dayCards }
  const target = hunt.target.round
  const cache = new Map<number, number>()
  let it = 0
  const measure = (hp: number) => {
    const key = roundHp(hp)
    let f = cache.get(key)
    if (f === undefined) {
      it++
      f = simulateHunt(db, huntId, profile, { seed: opts.seed, samples: opts.samples, hp: key }).killRound.p50
      cache.set(key, f)
    }
    return f
  }
  // 1. Oransal adımlar hedefin yakınına getirir.
  let hp = roundHp(opts.startHp ?? hunt.hp)
  for (let k = 0; k < 2 && Math.abs(measure(hp) - target) > 0.1; k++) hp = roundHp((hp * target) / measure(hp))
  // 2. Bayıltma turu cana göre artan bir fonksiyondur: hedefi kuşatan aralık bulunur ve ikiye bölünür.
  let lo = hp
  let hi = hp
  while (measure(lo) > target && lo > 10) lo = roundHp(lo * 0.85)
  while (measure(hi) < target && hi < 1e5) hi = roundHp(hi * 1.15)
  while (hi - lo > 10 && it < opts.iterations + 6) {
    const mid = roundHp((lo + hi) / 2)
    if (mid === lo || mid === hi) break
    if (measure(mid) < target) lo = mid
    else hi = mid
  }
  const best = [lo, hi].reduce((a, b) => (Math.abs(measure(b) - target) < Math.abs(measure(a) - target) ? b : a))
  return { hunt: huntId, target, designHp: hunt.hp, hp: best, killRound: measure(best), iterations: it }
}

/** Oyuncuya gösterilen can 10'un katı olur (okunur sayılar). */
function roundHp(hp: number): number {
  return Math.max(10, Math.round(hp / 10) * 10)
}

// ---------------------------------------------------------------------------
// Hedef deneyleri
// ---------------------------------------------------------------------------

/** Niyeti bilerek dizmenin kazancı: ölümsüz yaratığa 6 turda verilen hasar, aware / master. */
/** Dizilim kararı soran turlar: kartlara dokunan niyetler ve Savuşturma (Çevik dahil). */
export function arrangementIntent(prep: HuntRoundPrep): boolean {
  return prep.evade || prep.intent.kind === 'rend' || prep.intent.kind === 'tailSweep' || prep.intent.kind === 'roar'
}

/**
 * Niyeti bilerek dizmenin kazancı. Ölümsüz yaratıkla aynı eller oynanır; yalnızca niyetin dizilim
 * sorduğu turlarda, aynı el için aware ve master dizilimlerinin hasarı karşılaştırılır (eşli ölçüm).
 */
export function intentAwarenessGain(db: ContentDB, huntId: string, opts: { seed: number; samples: number }): { aware: number; master: number; gain: number; rounds: number } {
  const hunt = db.hunt(huntId)
  const deck = db.huntTargetDeck(huntId)
  const weather = db.weatherById.get(hunt.weather ?? hunt.target?.weather ?? 'calm') ?? null
  const tamer = db.tamer(db.starter.tamer)
  const immortal = { ...hunt, phases: undefined, revive: undefined }
  const sum = { aware: 0, master: 0 }
  let rounds = 0
  for (let i = 0; i < opts.samples; i++) {
    let state = startHunt({ hunt: immortal, hp: 1e7, deck, tamer, tamerHp: 1e9, weather }, createRng(deriveSeed(opts.seed, i, 47)))
    while (!state.outcome) {
      const hand = state.hands[state.round]
      const prep = prepareHuntRound(state, hand.length)
      const master = arrangeForBot('master', state, hand, prep)
      if (arrangementIntent(prep)) {
        sum.aware += resolveHuntRound(state, bestHuntArrangement(state, hand, prep).arrangement, undefined, prep).result.damage
        sum.master += resolveHuntRound(state, master, undefined, prep).result.damage
        rounds++
      }
      state = resolveHuntRound(state, master, undefined, prep).state
    }
  }
  return { aware: sum.aware / Math.max(1, rounds), master: sum.master / Math.max(1, rounds), gain: sum.aware / Math.max(1, sum.master) - 1, rounds }
}

export interface ExpeditionRun {
  /** Her avdan sonra Tamer canı (%); düştüyse 0 ve sonrası yok. */
  hpPctAfter: number[]
  captures: number
}

/**
 * Başlangıç destesiyle Sıradan avlardan oluşan bir sefer: avlar rastgele sırada, Tamer canı taşınır,
 * dinlenme yok. "Kampa dönmeden kaç av" sorusunun ölçüsü.
 */
export function expeditionExperiment(db: ContentDB, opts: { seed: number; samples: number; hunts: number; region?: string; deck?: string; weather?: string }): ExpeditionRun[] {
  const region = opts.region ?? db.regions[0].id
  const pool = db.regionHunts(region).filter((h) => h.tier === 'ordinary')
  const tamer = db.tamer(db.starter.tamer)
  const deck = db.deckCards(opts.deck ?? db.starter.deck)
  const weather = db.weatherById.get(opts.weather ?? 'calm') ?? null
  const out: ExpeditionRun[] = []
  for (let i = 0; i < opts.samples; i++) {
    const rng = createRng(deriveSeed(opts.seed, i, 53))
    const order = pool.slice()
    for (let k = order.length - 1; k > 0; k--) {
      const j = rng.int(k + 1)
      ;[order[k], order[j]] = [order[j], order[k]]
    }
    let hp = tamer.hp
    const hpPctAfter: number[] = []
    let captures = 0
    for (let n = 0; n < opts.hunts && hp > 0; n++) {
      const hunt = order[n % order.length]
      const r = runHunt({ hunt, hp: db.huntHp(hunt.id), deck, tamer, tamerHp: hp, weather }, 'aware', deriveSeed(opts.seed, i, n))
      hp = r.tamerHpEnd
      if (r.outcome === 'captured') captures++
      hpPctAfter.push((hp / tamer.hp) * 100)
    }
    while (hpPctAfter.length < opts.hunts) hpPctAfter.push(0)
    out.push({ hpPctAfter, captures })
  }
  return out
}

/** Tüm avların canını kalibre eder → content/generated/hunts.json içeriği. */
export function calibrateAllHunts(
  db: ContentDB,
  opts: { seed: number; samples: number; iterations: number; onProgress?: (msg: string) => void },
): { balance: CalibratedHunts; rows: HuntCalibration[] } {
  const rows: HuntCalibration[] = []
  for (const h of db.hunts) {
    if (!h.target) continue
    opts.onProgress?.(`${db.card(h.card).name} kalibre ediliyor...`)
    const r = calibrateHunt(db, h.id, opts)
    if (r) rows.push(r)
  }
  return {
    rows,
    balance: {
      generatedAt: new Date().toISOString(),
      seed: opts.seed,
      samples: opts.samples,
      hp: Object.fromEntries(rows.map((r) => [r.hunt, r.hp])),
      notes: [
        'Can = hedef deste ve havada, niyeti bilen usta botun medyan olarak hedef turda bayılttığı değer (Tamer ölümsüz).',
        'İkinci can çubuğu (revive) ana çubukla aynı oranda ölçeklenir.',
      ],
    },
  }
}
