import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { deriveSeed } from '../../src/core/rng.ts'
import {
  arrangementExperiment,
  calibrateWorld,
  cardPowerReport,
  checkBalance,
  presetMatrix,
  reviewSet,
  simulateHunt,
  weatherFitExperiment,
  worldReport,
  type HuntBot,
} from '../../src/sim/index.ts'
import { loadContentFromDisk, ROOT } from '../art/lib.ts'
import { workerPool } from './pool.ts'
import { reviewToMarkdown } from './review-md.ts'

/**
 * Simülasyon CLI.
 *
 *   npm run sim -- check                 GDD denge hedeflerinin hepsi (varsayılan)
 *   npm run sim -- arrange --days 500    dizilim becerisi: usta / acemi / rastgele
 *   npm run sim -- weather               hava uyumu: uygun deste / uygunsuz deste
 *   npm run sim -- cards                 kart gücü tablosu (nadirlik içi aykırılar)
 *   npm run sim -- hunts                 her av: hedef profil, başlangıç destesi, Sakin gün (bayıltma turu, Tamer kaybı)
 *   npm run sim -- hunts --hunt storm_hound --deck firtina --weather stormy --bot master
 *   npm run sim -- world                 dünya ilerlemesi: tipik oyuncu kaç saatte nereye varır (--samples 32 --bot casual|aware)
 *   npm run sim -- calibrate             referans desteleri + yaratık canları, bölge bölge → content/generated/hunts.json
 *   npm run sim -- decks                 preset desteler: dizilim etkisi + hava matrisi
 *   npm run sim -- review --set v1       öneri kart setini incele → Docs/proposals/kart-seti-v1.md
 *
 * --set <ad>: content/proposals/<ad>/ altındaki öneri setiyle çalışır (oyun içeriğine dokunmaz).
 * Ortak: --seed N  --json (yalnızca JSON yaz)  --strict (hedef tutmazsa çıkış kodu 1)
 * Her çalıştırma sim-results/ altına JSON bırakır (karşılaştırma ve ileride rapor ekranı için).
 */

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    seed: { type: 'string' },
    days: { type: 'string' },
    iterations: { type: 'string' },
    samples: { type: 'string' },
    hunt: { type: 'string' },
    deck: { type: 'string' },
    weather: { type: 'string' },
    bot: { type: 'string', default: 'aware' },
    collection: { type: 'string', default: 'full' },
    strict: { type: 'boolean', default: false },
    dry: { type: 'boolean', default: false },
    set: { type: 'string' },
    threads: { type: 'string' },
    hours: { type: 'string' },
  },
})

const db = await loadContentFromDisk({ set: values.set })
if (values.set) console.log(`Öneri seti: ${values.set} (${db.cards.length} kart)`)
const cmd = positionals[0] ?? 'check'
const seed = Number(values.seed ?? db.targets.seed)
const num = (v: string | undefined, d: number) => (v === undefined ? d : Number(v))
const sim = db.targets.simulation
const progress = (m: string) => console.log(`  · ${m}`)
const f1 = (n: number) => n.toFixed(1)
const f2 = (n: number) => n.toFixed(2)
const pct = (n: number) => `${(n * 100).toFixed(0)}%`

async function save(name: string, data: unknown) {
  const dir = path.join(ROOT, 'sim-results')
  await mkdir(dir, { recursive: true })
  const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${name}.json`)
  await writeFile(file, JSON.stringify({ command: name, seed, content: summaryOfContent(), data }, null, 2))
  console.log(`\nSonuç: ${path.relative(ROOT, file)}`)
}

function summaryOfContent() {
  return { cards: db.cards.length, tamers: db.tamers.length, hunts: db.hunts.length, calibratedAt: db.huntBalance.generatedAt }
}

const t0 = performance.now()
switch (cmd) {
  case 'arrange': {
    const r = arrangementExperiment(db, { seed, days: num(values.days, sim.daysPerCheck) })
    console.log(`\nDizilim becerisi · ${r.deck} destesi · ${r.tamer} · ${r.days} gün`)
    console.table(
      Object.fromEntries(
        Object.entries(r.income).map(([k, s]) => [k, { ortalama: f1(s.mean), p10: s.p10, p50: s.p50, p90: s.p90 }]),
      ),
    )
    console.log(`usta/acemi x${f2(r.masterOverNovice)} · usta/rastgele x${f2(r.masterOverRandom)}`)
    console.log(`gün süresi ort. ${f1(r.dayMinutes.mean)} dk · ${f1(r.triggersPerDay.mean)} tetik/gün`)
    await save('arrange', r)
    break
  }
  case 'weather': {
    const r = weatherFitExperiment(db, {
      seed,
      days: num(values.days, 40),
      collection: values.collection === 'starter' ? 'starter' : 'full',
    })
    console.log(`\nHava uyumu · koleksiyon: ${r.collection}`)
    console.table(
      r.rows.map((x) => ({
        hava: x.weather,
        uygun: f1(x.matched),
        uygunsuz: f1(x.mismatched),
        'uygunsuz deste': x.mismatchedDeckFor,
        oran: `x${f2(x.ratio)}`,
      })),
    )
    console.log(`ortalama oran x${f2(r.meanRatio)}`)
    await save('weather', r)
    break
  }
  case 'cards': {
    const rows = cardPowerReport(db, { seed, samples: num(values.samples, 400) })
    console.log('\nKart gücü · tur başına marjinal katkı (tam koleksiyon havuzu, Gezgin)')
    console.table(
      rows.map((r) => ({
        kart: r.name,
        nadirlik: r.rarity,
        dyn: r.durability,
        değer: f1(r.value),
        'en iyi hava': `${f1(r.bestWeatherValue)} (${r.bestWeather})`,
        z: (r.z > 1.5 ? '▲ ' : r.z < -1.5 ? '▼ ' : '') + f2(r.z),
      })),
    )
    await save('cards', rows)
    break
  }
  case 'hunts': {
    const samples = num(values.samples, sim.huntSamples)
    const bot = (values.bot ?? 'aware') as HuntBot
    const list = values.hunt ? [db.hunt(values.hunt)] : db.hunts
    const rows = list.flatMap((h) => {
      const profiles = values.deck || values.weather
        ? [{ label: 'seçilen', deck: values.deck ?? h.target?.deck ?? db.starter.deck, weather: values.weather ?? h.target?.weather ?? 'calm' }]
        : [
            ...(h.target ? [{ label: 'hedef', deck: h.target.deck, weather: h.target.weather }] : []),
            { label: 'başlangıç', deck: db.starter.deck, weather: 'calm' },
          ]
      return profiles.map((p) => {
        const r = simulateHunt(db, h.id, { deck: p.deck, weather: p.weather, bot }, { seed, samples })
        return {
          av: db.card(h.card).name,
          kademe: h.tier,
          can: r.hp,
          profil: `${p.label}: ${p.deck}/${h.weather ?? p.weather}`,
          bayıltma: pct(r.captureRate),
          'tur p50': f1(r.killRound.p50),
          'hedef': h.target && p.label === 'hedef' ? h.target.round : '',
          'Tamer kaybı p50': Math.round(r.tamerDamage.p50),
          dk: f1(r.minutes.p50),
          sonuçlar: Object.entries(r.outcomes).map(([k, v]) => `${k}:${v}`).join(' '),
        }
      })
    })
    console.log(`\nAvlar · bot: ${bot} · ${samples} örnek · Tamer: ${db.tamer(db.starter.tamer).name}`)
    console.table(rows)
    await save('hunts', rows)
    break
  }
  case 'decks': {
    const m = presetMatrix(db, { seed, days: num(values.days, 120) })
    console.log('\nPreset desteler · usta botla gün geliri (hava başına)')
    console.table(
      m.rows.map((r) => ({
        deste: r.name,
        'usta/acemi': `x${f2(r.masterOverNovice)}`,
        'usta/rastgele': `x${f2(r.masterOverRandom)}`,
        'dk/gün': f1(r.dayMinutes),
        ...Object.fromEntries(db.weather.map((w) => [w.name, Math.round(r.byWeather[w.id]) + (m.bestIn[w.id] === r.id ? ' ★' : '')])),
      })),
    )
    console.log(m.dominant ? `✗ ${m.dominant} tüm havalarda birinci (GDD: hiçbir deste her havada üstte olmamalı)` : '✓ Hiçbir deste tüm havalarda birinci değil.')
    await save('decks', m)
    break
  }
  case 'review': {
    const set = values.set ?? 'base'
    const r = reviewSet(db, {
      set,
      seed,
      valueSamples: num(values.samples, 120),
      pairSamples: num(values.days, 24),
      deckDays: 120,
      weatherDays: 20,
      onProgress: progress,
    })
    const md = reviewToMarkdown(r, db, { seed, seconds: (performance.now() - t0) / 1000 })
    const dir = path.join(ROOT, 'Docs/proposals')
    await mkdir(dir, { recursive: true })
    const file = path.join(dir, `kart-seti-${set}.md`)
    await writeFile(file, md)
    console.log(`
İnceleme yazıldı: ${path.relative(ROOT, file)}`)
    await save(`review-${set}`, r)
    break
  }
  case 'world': {
    const samples = num(values.samples, 32)
    // Varsayılan "ortalama oyuncu"; --bot aware ile usta oyuncu.
    const bot = (process.argv.includes('--bot') ? values.bot : 'casual') as HuntBot
    const pool = workerPool({ set: values.set, threads: values.threads ? Number(values.threads) : undefined })
    console.log(`\nDünya ilerlemesi · ${samples} oyun · bot: ${bot} · ${pool.size} iş parçacığı`)
    const runs = await pool.world(Array.from({ length: samples }, (_, i) => ({ seed: deriveSeed(seed, i, 501), bot, maxHours: num(values.hours, 160) })))
    await pool.close()
    const r = worldReport(db, runs, bot)
    const h = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : '—')
    console.table(
      r.regions.map((x) => ({
        bölge: x.name,
        sev: x.level,
        'giriş sa': h(x.entry),
        'Final sa': h(x.final),
        'kitap sa': h(x.book),
        'tamam sa': h(x.complete),
        'bölgede sa': h(x.hoursIn),
        ulaşan: pct(x.reached),
      })),
    )
    const span = (x: { p10: number; p50: number; p90: number; n: number }) => (x.n ? `${h(x.p50)} sa (p10 ${h(x.p10)} · p90 ${h(x.p90)}) · ${x.n}/${samples} oyun` : '— (hiçbir oyun ulaşmadı)')
    console.log(`Ana hikâye (tüm Finaller): ${span(r.hours.allFinals)}`)
    console.log(`Bölge kitapları:           ${span(r.hours.allBooks)}`)
    console.log(`Tüm avlar:                 ${span(r.hours.allHunts)}`)
    console.log(`Oyun başına: ${f1(r.per.hunts)} av (${f1(r.per.quickHunts)} hızlı) · ${f1(r.per.expeditions)} sefer · ${f1(r.per.packs)} paket · Tamer ${f1(r.per.tamerDowns)} kez düştü · ${f1(r.per.threeStars)} ★★★ · koleksiyon ${pct(r.per.collection)} · ${f1(r.per.days)} gün`)
    if (r.unfinished) console.log(`! ${r.unfinished}/${samples} oyun süre sınırında bitmedi`)
    await save(`world-${bot}`, r)
    break
  }
  case 'calibrate': {
    if (values.set && !values.dry) throw new Error('Öneri setiyle kalibrasyon yalnızca --dry ile çalışır (oyun dengesine yazmaz).')
    const huntSamples = num(values.samples, Math.max(60, Math.floor(sim.huntSamples / 2)))
    const worlds = num(values.days, 24)
    const pool = workerPool({ set: values.set, threads: values.threads ? Number(values.threads) : undefined })
    console.log(`\nDünya kalibrasyonu · an başına ${worlds} oyun · av başına ${huntSamples} örnek · aware usta bot · ${pool.size} iş parçacığı`)
    const r = await calibrateWorld(db, pool, { seed, samples: worlds, huntSamples, iterations: num(values.iterations, sim.calibrationIterations), onProgress: progress })
    await pool.close()
    console.table(
      r.rows.map((x) => ({
        av: db.card(db.hunt(x.hunt).card).name,
        bölge: db.region(x.region).name,
        an: x.phase,
        'varış sa': Number.isFinite(x.hours) ? f1(x.hours) : '—',
        hedef: x.target,
        'kalibre can': x.hp,
        'ölçülen tur': f2(x.killRound),
      })),
    )
    if (!values.dry) {
      const file = path.join(ROOT, 'content/generated/hunts.json')
      await writeFile(file, JSON.stringify(r.balance, null, 2) + '\n')
      console.log(`Yazıldı: ${path.relative(ROOT, file)} (oyun ve sonraki simülasyonlar bu canları kullanır)`)
    }
    await save('calibrate', r)
    break
  }
  case 'check': {
    console.log('\nDenge hedefleri (content/balance-targets.json)')
    const checks = checkBalance(db, {
      seed,
      days: num(values.days, sim.daysPerCheck),
      samples: num(values.samples, sim.huntSamples),
      onProgress: progress,
    })
    console.table(
      checks.map((c) => ({
        '': c.pass ? '✓' : '✗',
        hedef: c.id,
        değer: c.shown,
        aralık: c.target,
        detay: c.detail ?? '',
      })),
    )
    const failed = checks.filter((c) => !c.pass).length
    console.log(failed ? `${failed}/${checks.length} hedef tutmuyor.` : 'Tüm hedefler tutuyor.')
    await save('check', checks)
    if (values.strict && failed) process.exitCode = 1
    break
  }
  default:
    console.error(`Bilinmeyen komut: ${cmd}. Komutlar: check, arrange, weather, cards, decks, hunts, world, calibrate, review`)
    process.exitCode = 1
}
console.log(`(${((performance.now() - t0) / 1000).toFixed(1)} sn)`)
