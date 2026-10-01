import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import sharp from 'sharp'
import { compileModifiers } from '../../src/core/engine/modifiers.ts'
import { resolveRound } from '../../src/core/engine/round.ts'
import type { RoundEvent } from '../../src/core/engine/events.ts'
import { createRng } from '../../src/core/rng.ts'
import { fileHash, hasMaster, loadAssets, masterPath, PATHS, ROOT } from './lib.ts'

/**
 * Unity'ye aktarım paketi. Varsayılan hedef export/unity/ (elle kopyalanır);
 * --unity <UnityProjeKökü> verilirse doğrudan o projenin Assets/ klasörüne yazar.
 *
 *   Assets/BeastTamer/Art/{Cards,Tamers,Weather}/<id>.png   master görseller
 *   Assets/BeastTamer/Content/*.json                        oyun verisi (Newtonsoft ile okunur)
 *   Assets/BeastTamer/Content/art-manifest.json             görsel → id eşlemesi + hash
 *   Assets/BeastTamer/Content/golden-rounds.json            motor eşlik testleri (C# portu bunları geçmeli)
 *   Assets/BeastTamer/Editor/BeastTamerArtPostprocessor.cs  import ayarları
 *
 *   npm run art:export-unity
 *   npm run art:export-unity -- --unity ../BeastTamerUnity --max 512
 */
const { values } = parseArgs({ options: { unity: { type: 'string' }, max: { type: 'string' } } })

let outRoot = PATHS.unity
if (values.unity) {
  const p = path.resolve(values.unity)
  if (!existsSync(path.join(p, 'Assets')) || !existsSync(path.join(p, 'ProjectSettings')))
    throw new Error(`${p} bir Unity projesi değil (Assets/ ve ProjectSettings/ bekleniyor)`)
  outRoot = p
}
const base = path.join(outRoot, 'Assets/BeastTamer')
const { db, assets } = await loadAssets()
const KIND_DIR = { cards: 'Cards', tamers: 'Tamers', weather: 'Weather' } as const
const maxSize = values.max ? Number(values.max) : undefined

// 1. Görseller
const manifest: Record<string, unknown>[] = []
for (const a of assets.filter(hasMaster)) {
  const rel = `Art/${KIND_DIR[a.kind]}/${a.id}.png`
  const dest = path.join(base, rel)
  await mkdir(path.dirname(dest), { recursive: true })
  if (maxSize) await sharp(masterPath(a)).resize({ width: maxSize, height: maxSize, fit: 'inside' }).png().toFile(dest)
  else await copyFile(masterPath(a), dest)
  const meta = await sharp(dest).metadata()
  manifest.push({ key: a.key, kind: a.kind, id: a.id, name: a.name, path: `Assets/BeastTamer/${rel}`, width: meta.width, height: meta.height, hash: await fileHash(dest) })
}

// 2. İçerik
const contentDir = path.join(base, 'Content')
await mkdir(contentDir, { recursive: true })
for (const f of ['cards', 'tamers', 'weather', 'decks', 'economy', 'calendar', 'starter', 'art', 'balance-targets']) {
  const json = JSON.parse(await readFile(path.join(PATHS.content, `${f}.json`), 'utf8'))
  delete json.$schema
  await writeFile(path.join(contentDir, `${f}.json`), JSON.stringify(json, null, 2))
}
await copyFile(path.join(PATHS.content, 'generated/balance.json'), path.join(contentDir, 'balance.json'))
await writeFile(path.join(contentDir, 'art-manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), assets: manifest }, null, 2))

// 3. Golden testler: rastgele turlar + beklenen olay akışı. C# motoru aynı girdiden aynı çıktıyı üretmeli.
const rng = createRng(db.targets.seed)
const golden: unknown[] = []
const fixed = [['spark_fox', 'coral_turtle', 'stone_golem', 'charge_bat', 'cloud_owl']]
for (let i = 0; i < 300; i++) {
  const ids = fixed[i] ?? Array.from({ length: 1 + rng.int(6) }, () => db.cards[rng.int(db.cards.length)].id)
  const weather = i < fixed.length ? null : rng.next() < 0.8 ? db.weather[rng.int(db.weather.length)] : null
  const tamer = db.tamers[rng.int(db.tamers.length)]
  const roundCount = 6
  const roundIndex = rng.int(roundCount)
  const events: RoundEvent[] = []
  const result = resolveRound(
    ids.map((id) => db.card(id)),
    { mods: compileModifiers({ weather, tamer: i < fixed.length ? null : tamer }), roundIndex, roundCount, triggerCap: 60 },
    (e) => events.push(e),
  )
  golden.push({
    input: { cards: ids, weather: weather?.id ?? null, tamer: i < fixed.length ? null : tamer.id, roundIndex, roundCount, triggerCap: 60 },
    expected: { total: result.total, triggers: result.triggers, steps: result.steps, passes: result.passes, slots: result.slots, events },
  })
}
await writeFile(path.join(contentDir, 'golden-rounds.json'), JSON.stringify({ seed: db.targets.seed, rounds: golden }))

// 4. Editör script'i
const editorDir = path.join(base, 'Editor')
await mkdir(editorDir, { recursive: true })
await copyFile(path.join(ROOT, 'tools/unity/BeastTamerArtPostprocessor.cs'), path.join(editorDir, 'BeastTamerArtPostprocessor.cs'))

console.log(`Unity paketi hazır → ${path.relative(ROOT, base) || base}`)
console.log(`  ${manifest.length}/${assets.length} görsel · ${golden.length} golden tur · içerik JSON'ları`)
if (manifest.length < assets.length) console.log('  Eksik görseller için: npm run art:status')
