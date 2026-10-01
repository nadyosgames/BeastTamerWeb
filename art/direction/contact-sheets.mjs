import { readFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(import.meta.dirname, '../..')
const { cards } = JSON.parse(await readFile(path.join(root, 'content/cards.json'), 'utf8'))
const prefix = process.argv[2] ?? 'cards'
if (!/^[a-z0-9-]+$/.test(prefix)) throw new Error('Geçersiz önizleme adı')
const readableOnly = process.argv[3] === '--readable'
const available = cards.filter((c) => existsSync(path.join(root, 'art/source/cards', `${c.id}.png`)) && (!readableOnly || ['volcano_serpent','sun_dragon','spark_fox'].includes(c.id) || existsSync(path.join(root, 'art/direction/results/readable-cards', `${c.id}.json`))))
const dir = path.join(root, 'art/direction/previews')
await mkdir(dir, { recursive: true })
for (let page = 0; page < Math.ceil(available.length / 25); page++) {
  const layers = []
  const group = available.slice(page * 25, (page + 1) * 25)
  for (const [i, card] of group.entries()) {
    const left = (i % 5) * 204 + 2
    const top = Math.floor(i / 5) * 230 + 2
    const thumb = await sharp(path.join(root, 'art/source/cards', `${card.id}.png`)).resize(200, 200).jpeg().toBuffer()
    const label = Buffer.from(`<svg width="200" height="26"><text x="100" y="18" text-anchor="middle" fill="#e9d7a5" font-family="sans-serif" font-size="12">${card.id}</text></svg>`)
    layers.push({ input: thumb, left, top }, { input: label, left, top: top + 200 })
  }
  const file = path.join(dir, `${prefix}-${page + 1}.jpg`)
  await sharp({ create: { width: 1020, height: Math.ceil(group.length / 5) * 230, channels: 3, background: '#071017' } }).composite(layers).jpeg({ quality: 90 }).toFile(file)
  console.log(file)
}
console.log(`${available.length} kart görseli denetim sayfalarına alındı`)
