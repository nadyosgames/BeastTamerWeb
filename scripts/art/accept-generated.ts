import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { buildUiAll, loadAssets, masterPath, PATHS, processImage } from './lib.ts'

/** Yerleşik imagegen çıktısını kayıtlı asset kimliğiyle mevcut master/web pipeline'ına alır. */
const [kind, id, input] = process.argv.slice(2)
if (!kind || !id || !input || !/^[a-z0-9_]+$/.test(id)) throw new Error('Kullanım: node scripts/art/accept-generated.ts <cards|tamers|weather|ui> <id> <PNG yolu>')
const target = masterPath({ kind, id })
if (existsSync(target)) throw new Error(`Mevcut master korunuyor: ${target}`)
if (kind === 'ui') {
  await mkdir(path.join(PATHS.source, 'ui'), { recursive: true })
  await copyFile(input, target)
  await buildUiAll()
} else {
  const { db, assets } = await loadAssets()
  const asset = assets.find((a) => a.kind === kind && a.id === id)
  if (!asset) throw new Error(`İçerikte bulunmayan görsel: ${kind}/${id}`)
  await processImage(await readFile(input), asset, db)
}
console.log(`${kind}/${id} → master + web hazır`)
