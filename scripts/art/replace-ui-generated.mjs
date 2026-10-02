import { copyFile, mkdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

// Keep the previous approved UI master before ingesting a new built-in output.
const [id, input] = process.argv.slice(2)
if (!id || !/^[a-z][a-z0-9_]*$/.test(id) || !input) throw new Error('Usage: node scripts/art/replace-ui-generated.mjs <id> <PNG>')
const root = path.resolve(import.meta.dirname, '../..')
const master = path.join(root, 'art/source/ui', `${id}.png`)
if (existsSync(master)) {
  const revisions = path.join(root, 'art/source/revisions/ui')
  await mkdir(revisions, { recursive: true })
  let version = 1
  while (existsSync(path.join(revisions, `${id}.v${version}.png`))) version++
  await copyFile(master, path.join(revisions, `${id}.v${version}.png`))
}
await mkdir(path.dirname(master), { recursive: true })
const scene = id === 'library' || id === 'board'
await sharp(input).rotate().resize(scene ? { width: 1920, height: 1080, fit: 'cover' } : { width: 1024 }).png().toFile(master)
const web = path.join(root, 'public/art/ui', `${id}.webp`)
await mkdir(path.dirname(web), { recursive: true })
await sharp(master).resize({ width: scene ? 1920 : 640 }).webp({ quality: 88 }).toFile(web)
console.log(`${id}: master + web saved (${(await stat(web)).size} bytes); old master retained`)
