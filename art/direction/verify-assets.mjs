import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

// Görsel teslimatını içerik kimlikleri, boyutlar ve web türevleriyle karşılaştırır.
const root = path.resolve(import.meta.dirname, '../..')
const problems = []
let checked = 0
for (const kind of ['cards', 'tamers', 'weather']) {
  const data = JSON.parse(await readFile(path.join(root, `content/${kind}.json`), 'utf8'))
  const config = JSON.parse(await readFile(path.join(root, 'content/art.json'), 'utf8')).kinds[kind]
  for (const asset of data[kind]) {
    try {
      const meta = await sharp(path.join(root, `art/source/${kind}/${asset.id}.png`)).metadata()
      if (meta.width !== config.master.width || meta.height !== config.master.height) problems.push(`${kind}/${asset.id}: master boyutu ${meta.width}×${meta.height}`)
      for (const variant of config.web) {
        const web = await sharp(path.join(root, `src/generated/art/${kind}/${asset.id}${variant.suffix}.webp`)).metadata()
        if (web.width !== variant.width) problems.push(`${kind}/${asset.id}${variant.suffix}: web genişliği ${web.width}`)
      }
      checked++
    } catch (e) { problems.push(`${kind}/${asset.id}: ${e.message}`) }
  }
}
for (const file of await readdir(path.join(root, 'art/source/ui'))) {
  if (!file.endsWith('.png')) continue
  try { await sharp(path.join(root, `public/art/ui/${file.slice(0, -4)}.webp`)).metadata(); checked++ }
  catch (e) { problems.push(`ui/${file}: ${e.message}`) }
}
console.log(`${checked} görsel ve web türevleri kontrol edildi.`)
if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1 }
else console.log('Eksik ya da hatalı boyutlu görsel yok.')
