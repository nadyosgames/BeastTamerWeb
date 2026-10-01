import { copyFile, mkdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { loadAssets, masterPath, processImage } from './lib.ts'

// Yerleşik image_gen revizyonunu alır; önceki master asla kaybolmaz.
const [kind, id, input] = process.argv.slice(2)
const { assets, db } = await loadAssets()
const asset = assets.find((a) => a.kind === kind && a.id === id)
if (!asset || !input) throw new Error('Kullanım: node scripts/art/replace-generated.ts cards <id> <PNG yolu>')
const master = masterPath(asset)
if (existsSync(master)) {
  const revisions = path.resolve('art/source/revisions', kind)
  await mkdir(revisions, { recursive: true })
  let version = 1
  while (existsSync(path.join(revisions, `${id}.v${version}.png`))) version++
  await copyFile(master, path.join(revisions, `${id}.v${version}.png`))
}
await processImage(await readFile(input), asset, db)
console.log(`${asset.key}: revizyon master ve WebP olarak kaydedildi`)
