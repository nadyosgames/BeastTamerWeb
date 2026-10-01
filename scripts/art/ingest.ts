import { existsSync } from 'node:fs'
import { readdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { buildWebAll, IMAGE_EXTS, loadAssets, matchInboxFile, PATHS, processImage, ROOT } from './lib.ts'

/**
 * art/inbox/ altındaki görselleri işler: master + web sürümleri, ham dosya arşive.
 * Başarılı işlenen dosya inbox'tan silinir; eşleşmeyenler yerinde kalır ve listelenir.
 *
 *   npm run art:ingest
 *   npm run art:ingest -- --rebuild-web   (yalnızca master'lardan web sürümlerini yeniden üret)
 */
const { values } = parseArgs({ options: { 'rebuild-web': { type: 'boolean', default: false } } })
const { db, assets } = await loadAssets()

if (values['rebuild-web']) {
  const n = await buildWebAll(db, true)
  console.log(`${n} görselin web sürümü yeniden üretildi.`)
  process.exit(0)
}

async function walk(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walk(p)))
    else if (IMAGE_EXTS.includes(path.extname(e.name).toLowerCase())) out.push(p)
  }
  return out
}

const files = await walk(PATHS.inbox)
if (!files.length) {
  console.log('art/inbox boş. Görselleri art/inbox/<tür>/<id>.png olarak koy.')
  process.exit(0)
}

let ok = 0
const unmatched: string[] = []
for (const file of files) {
  const rel = path.relative(PATHS.inbox, file)
  const asset = matchInboxFile(rel, assets)
  if (!asset) {
    unmatched.push(rel)
    continue
  }
  try {
    const r = await processImage(await readFile(file), asset, db, path.extname(file).toLowerCase())
    await rm(file)
    ok++
    console.log(`✓ ${rel} → ${r.key} (${r.sourceSize.width}×${r.sourceSize.height} → ${r.width}×${r.height})`)
  } catch (e) {
    console.error(`✗ ${rel}: ${(e as Error).message}`)
  }
}
console.log(`\n${ok} görsel işlendi → ${path.relative(ROOT, PATHS.source)}/`)
if (unmatched.length) {
  console.log(`Eşleşmeyen ${unmatched.length} dosya (id'yi kontrol et, ör. cards/spark_fox.png):`)
  for (const u of unmatched) console.log(`  ? ${u}`)
}
