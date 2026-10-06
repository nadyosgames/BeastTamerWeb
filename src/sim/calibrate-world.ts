import { refDayKey, REF_DECK, type ContentDB } from '../content/index.ts'
import type { CalibratedHunts, Collection } from '../core/economy.ts'
import { createRng, deriveSeed } from '../core/rng.ts'
import type { CardDef, HuntDef } from '../core/types.ts'
import { buildDeck, collectionToOwned } from './deckbuilder.ts'
import { valuationContext } from './experiments.ts'
import { calibrateHunt, type HuntCalibration } from './hunt.ts'
import { medianCollection, PHASE_OF_TIER, regionOrder, simulateWorld, type SnapshotPhase, type WorldRun, type WorldRunOptions } from './progression.ts'

/**
 * Dünya kalibrasyonu (GDD v0.9): yaratık canları bölge bölge, tipik oyuncunun o noktadaki
 * koleksiyonuna göre bulunur.
 *
 * Bölgeler oyuncunun gezdiği sırayla işlenir. Her bölge için üç an vardır:
 *   giriş → Sıradan avlar · orta (4 yakalama) → Zorlu ve Final · kitap tamam → Efsanevi ve Kadim.
 * Her anda ilerleme simülasyonu (önceki bölgeler zaten kalibre) o ana kadar oynatılır, oyuncuların
 * koleksiyonlarının medyanı alınır, bundan avın hedef havasına göre referans destesi kurulur ve
 * aware usta bot o desteyle hedef turda bayıltacak can aranır. Böylece bir bölgenin zorluğu, oraya
 * gelen oyuncunun gerçekten sahip olabileceği desteye bağlanır.
 */

export interface CalibrateTask {
  huntId: string
  /** Kart id'leri (kopyalar dahil). */
  cards: string[]
  /** Kuşatmada gün başına kart id'leri. */
  dayCards?: string[][]
  startHp: number
  seed: number
  samples: number
  iterations: number
}

/** Ağır işleri yürüten taraf: CLI iş parçacığı havuzu ya da sıralı yerel çalıştırıcı. */
export interface WorldTaskRunner {
  world(tasks: WorldRunOptions[]): Promise<WorldRun[]>
  calibrate(tasks: CalibrateTask[]): Promise<(HuntCalibration | null)[]>
}

export function runCalibrateTask(db: ContentDB, t: CalibrateTask): HuntCalibration | null {
  const ids = (xs: string[]) => xs.map((id) => db.card(id))
  return calibrateHunt(db, t.huntId, {
    seed: t.seed,
    samples: t.samples,
    iterations: t.iterations,
    startHp: t.startHp,
    cards: ids(t.cards),
    dayCards: t.dayCards?.map(ids),
  })
}

export function localRunner(db: ContentDB): WorldTaskRunner {
  return {
    world: async (tasks) => tasks.map((t) => simulateWorld(db, t)),
    calibrate: async (tasks) => tasks.map((t) => runCalibrateTask(db, t)),
  }
}

export interface WorldCalibrationRow extends HuntCalibration {
  region: string
  phase: SnapshotPhase
  deck: string
  /** Bu ana ulaşan oyun sayısı / örnek. */
  reached: number
  /** Oyuncunun bu ana medyan varış saati. */
  hours: number
}

export interface WorldCalibrationOptions {
  seed: number
  /** Her an için oynatılan oyun sayısı. */
  samples: number
  huntSamples: number
  iterations: number
  maxHours?: number
  onProgress?: (msg: string) => void
}

const PHASES: SnapshotPhase[] = ['entry', 'mid', 'late']

export function refDeckList(cards: readonly CardDef[]): { card: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const c of cards) counts.set(c.id, (counts.get(c.id) ?? 0) + 1)
  return [...counts].map(([card, count]) => ({ card, count })).sort((a, b) => b.count - a.count || (a.card < b.card ? -1 : 1))
}

export async function calibrateWorld(db: ContentDB, runner: WorldTaskRunner, opts: WorldCalibrationOptions): Promise<{ balance: CalibratedHunts; rows: WorldCalibrationRow[] }> {
  const log = opts.onProgress ?? (() => {})
  const tamer = db.tamer(db.starter.tamer)
  const hp: Record<string, number> = { ...db.huntBalance.hp }
  const refDecks: Record<string, { card: string; count: number }[]> = {}
  const huntDecks: Record<string, string> = {}
  const rows: WorldCalibrationRow[] = []
  let last: Collection = Object.fromEntries(refDeckList(db.starterDeck()).map((x) => [x.card, x.count]))

  const refDeck = (key: string, coll: Collection, weatherId: string) => {
    if (!refDecks[key]) {
      const cards = buildDeck(
        collectionToOwned(coll, db.cardById),
        valuationContext(tamer, db.weatherById.get(weatherId) ?? null),
        db.economy,
        createRng(deriveSeed(opts.seed, 401)),
        { deckSize: tamer.deckSize, samples: 32, iterations: 3 },
      )
      refDecks[key] = refDeckList(cards)
    }
    return refDecks[key].flatMap(({ card, count }) => Array.from({ length: count }, () => card))
  }

  for (const region of regionOrder(db)) {
    for (const phase of PHASES) {
      const targets: HuntDef[] = db.regionHunts(region.id).filter((h) => h.target?.deck === REF_DECK && PHASE_OF_TIER[h.tier] === phase)
      if (!targets.length) continue
      log(`${region.name} · ${phase === 'entry' ? 'giriş' : phase === 'mid' ? 'orta' : 'kitap'}: ${opts.samples} oyun bu ana kadar oynanıyor...`)
      const runs = await runner.world(
        Array.from({ length: opts.samples }, (_, i) => ({ seed: deriveSeed(opts.seed, i, 301), stopAfter: { region: region.id, phase }, hp, maxHours: opts.maxHours ?? 220 })),
      )
      const snaps = runs.flatMap((r) => r.snapshots.filter((s) => s.region === region.id && s.phase === phase))
      const reached = snaps.length / opts.samples
      const hours = snaps.length ? snaps.map((s) => s.minutes / 60).sort((a, b) => a - b)[Math.floor((snaps.length - 1) / 2)] : NaN
      const coll = snaps.length * 2 >= opts.samples ? medianCollection(snaps.map((s) => s.collection)) : last
      if (snaps.length * 2 < opts.samples) log(`  ! yalnızca ${snaps.length}/${opts.samples} oyun bu ana ulaştı: önceki koleksiyon kullanılıyor`)
      last = coll

      const tasks: CalibrateTask[] = targets.map((h) => {
        const weathers = h.siege ? h.siege.weathers : [h.weather ?? h.target!.weather]
        const days = weathers.map((w, d) => {
          const key = `${region.id}:${phase}:${w}`
          const cards = refDeck(key, coll, w)
          huntDecks[d ? refDayKey(h.id, d) : h.id] = key
          return cards
        })
        return {
          huntId: h.id,
          cards: days[0],
          dayCards: h.siege ? days : undefined,
          startHp: hp[h.id] ?? h.hp,
          seed: opts.seed,
          samples: opts.huntSamples,
          iterations: opts.iterations,
        }
      })
      const results = await runner.calibrate(tasks)
      results.forEach((r, k) => {
        if (!r) return
        hp[r.hunt] = r.hp
        rows.push({ ...r, region: region.id, phase, deck: huntDecks[targets[k].id], reached, hours })
      })
      log(`  ${results.filter(Boolean).map((r) => `${db.card(db.hunt(r!.hunt).card).name} ${r!.hp}`).join(' · ')}`)
    }
  }

  const known = new Set(db.hunts.map((h) => h.id))
  return {
    rows,
    balance: {
      generatedAt: new Date().toISOString(),
      seed: opts.seed,
      samples: opts.huntSamples,
      hp: Object.fromEntries(Object.entries(hp).filter(([id]) => known.has(id))),
      refDecks,
      huntDecks,
      notes: [
        'Can = referans destesi ve hedef havada, niyeti bilen usta botun medyan olarak hedef turda bayılttığı değer (Tamer ölümsüz).',
        'Referans destesi: dünya ilerleme simülasyonunda tipik oyuncunun bölgeye girdiği (Sıradan), 4. yakalamaya ulaştığı (Zorlu, Final) ve kitabı bitirdiği (Efsanevi, Kadim) andaki medyan koleksiyonundan kurulan deste.',
        'İkinci can çubuğu (revive) ana çubukla aynı oranda ölçeklenir.',
      ],
    },
  }
}
