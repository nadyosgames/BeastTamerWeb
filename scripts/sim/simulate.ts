import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { weeksPerYear } from '../../src/core/calendar.ts'
import {
  arrangementExperiment,
  calibrateQuota,
  cardPowerReport,
  checkBalance,
  presetMatrix,
  PROFILES,
  reviewSet,
  runAgents,
  summarize,
  validate,
  weatherFitExperiment,
} from '../../src/sim/index.ts'
import { loadContentFromDisk, ROOT } from '../art/lib.ts'
import { reviewToMarkdown } from './review-md.ts'

/**
 * Simülasyon CLI.
 *
 *   npm run sim -- check                 GDD denge hedeflerinin hepsi (varsayılan)
 *   npm run sim -- arrange --days 500    dizilim becerisi: usta / acemi / rastgele
 *   npm run sim -- weather               hava uyumu: uygun deste / uygunsuz deste
 *   npm run sim -- cards                 kart gücü tablosu (nadirlik içi aykırılar)
 *   npm run sim -- campaign --profile good --weeks 144
 *   npm run sim -- calibrate             kota eğrisini üret → content/generated/balance.json
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
    weeks: { type: 'string' },
    agents: { type: 'string' },
    iterations: { type: 'string' },
    samples: { type: 'string' },
    profile: { type: 'string', default: 'good' },
    collection: { type: 'string', default: 'full' },
    strict: { type: 'boolean', default: false },
    dry: { type: 'boolean', default: false },
    set: { type: 'string' },
  },
})

const db = await loadContentFromDisk({ set: values.set })
if (values.set) console.log(`Öneri seti: ${values.set} (${db.cards.length} kart)`)
const cmd = positionals[0] ?? 'check'
const seed = Number(values.seed ?? db.targets.seed)
const num = (v: string | undefined, d: number) => (v === undefined ? d : Number(v))
const sim = db.targets.simulation
const wpy = weeksPerYear(db.calendar)
const cycleWeeks = wpy * db.calendar.yearsPerCycle
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
  return { cards: db.cards.length, tamers: db.tamers.length, calibratedAt: db.balance.generatedAt }
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
  case 'campaign': {
    const profile = values.profile ?? 'good'
    if (!PROFILES[profile]) throw new Error(`Profil yok: ${profile} (${Object.keys(PROFILES).join(', ')})`)
    const weeks = num(values.weeks, cycleWeeks)
    const agents = num(values.agents, 2)
    const runs = runAgents(db, profile, undefined, { weeks, agents }, seed)
    const years = Math.ceil(weeks / wpy)
    console.log(`\nKampanya · ${PROFILES[profile].label} · ${agents} ajan · ${weeks} hafta`)
    console.table(
      Array.from({ length: years }, (_, y) => {
        const ws = runs.flatMap((r) => r.weeks.filter((w) => w.year === y + 1))
        const ratio = summarize(ws.map((w) => w.income / w.quota))
        return {
          yıl: y + 1,
          'kota (ort)': Math.round(ws.reduce((a, w) => a + w.quota, 0) / ws.length),
          'gelir (ort)': Math.round(ws.reduce((a, w) => a + w.income, 0) / ws.length),
          'gelir/kota p50': f2(ratio.p50),
          'kota tutma': pct(ws.filter((w) => w.passed).length / ws.length),
          'paket/hafta': f1(ws.reduce((a, w) => a + w.packsOpened, 0) / ws.length),
          koleksiyon: pct(Math.max(...ws.map((w) => w.completion))),
          saat: f1(ws.reduce((a, w) => a + w.minutes, 0) / 60 / agents),
        }
      }),
    )
    const v = validate(profile, runs)
    console.log(`toplam: ${f1(v.hours)} saat · kota tutma ${pct(v.passRate)} · koleksiyon ${pct(v.finalCompletion)}`)
    console.log(`Tamer kullanımı (hafta): ${JSON.stringify(runs[0].tamersUsed)}`)
    if (!db.balance.quotaByWeek.length) console.log('Not: kota eğrisi kalibre edilmemiş (geçici formül). `npm run sim -- calibrate`')
    await save(`campaign-${profile}`, { validation: v, runs })
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
  case 'calibrate': {
    if (values.set && !values.dry) throw new Error('Öneri setiyle kalibrasyon yalnızca --dry ile çalışır (oyun dengesine yazmaz).')
    const weeks = num(values.weeks, cycleWeeks)
    console.log(`\nKota kalibrasyonu · ${weeks} hafta · ${num(values.agents, sim.campaignAgents)} ajan`)
    const r = calibrateQuota(db, {
      seed,
      weeks,
      agents: num(values.agents, sim.campaignAgents),
      iterations: num(values.iterations, sim.calibrationIterations),
      ratio: db.targets.targets.quota.calibrationRatio,
      onProgress: progress,
    })
    console.table(
      r.validation.map((v) => ({
        profil: PROFILES[v.profile].label,
        'kota tutma': pct(v.passRate),
        'gelir/kota p10': f2(v.ratio.p10),
        p50: f2(v.ratio.p50),
        p90: f2(v.ratio.p90),
        saat: f1(v.hours),
        koleksiyon: pct(v.finalCompletion),
      })),
    )
    const q = r.balance.quotaByWeek
    console.log(`kota: hafta 1 = ${q[0]}, yıl 1 sonu = ${q[wpy - 1]}, son = ${q[q.length - 1]}`)
    if (!values.dry) {
      const file = path.join(ROOT, 'content/generated/balance.json')
      await writeFile(file, JSON.stringify(r.balance, null, 2) + '\n')
      console.log(`Yazıldı: ${path.relative(ROOT, file)} (oyun ve sonraki simülasyonlar bu eğriyi kullanır)`)
    }
    await save('calibrate', r)
    break
  }
  case 'check': {
    console.log('\nDenge hedefleri (content/balance-targets.json)')
    const checks = checkBalance(db, {
      seed,
      days: num(values.days, sim.daysPerCheck),
      weeks: num(values.weeks, wpy * 2),
      agents: num(values.agents, Math.min(4, sim.campaignAgents)),
      onProgress: progress,
    })
    console.table(
      checks.map((c) => ({
        '': c.pass ? '✓' : '✗',
        hedef: c.id,
        değer: c.id === 'dayLength' ? `${f1(c.value)} dk` : c.id === 'presetDominance' ? (c.pass ? 'yok' : 'var') : c.id.startsWith('quota') || c.id === 'duplicates' ? pct(c.value) : `x${f2(c.value)}`,
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
    console.error(`Bilinmeyen komut: ${cmd}. Komutlar: check, arrange, weather, cards, campaign, calibrate`)
    process.exitCode = 1
}
console.log(`(${((performance.now() - t0) / 1000).toFixed(1)} sn)`)
