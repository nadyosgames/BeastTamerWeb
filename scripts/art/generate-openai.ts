import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { fullPrompt, type ArtAssetRef } from '../../src/art/prompts.ts'
import { hasMaster, loadAssets, PATHS, processImage, ROOT } from './lib.ts'

/**
 * İSTEĞE BAĞLI: OpenAI Images API ile toplu üretim (ChatGPT arayüzünde elle üretmenin alternatifi).
 * Varsayılan olarak yalnızca ne üretileceğini listeler; API'ye gitmek için --yes gerekir (ücretlidir).
 *
 *   npm run art:generate                          eksik görselleri listele (kuru çalıştırma)
 *   npm run art:generate -- --yes                 eksiklerin hepsini üret
 *   npm run art:generate -- --ids spark_fox,cloud_owl --yes
 *   npm run art:generate -- --kind tamers --limit 3 --yes
 *
 * Stil tutarlılığı: art/style-ref/<kind>.png varsa referans görsel olarak gönderilir (images/edits).
 * Gerekli: .env içinde OPENAI_API_KEY (bkz. .env.example).
 */
const { values } = parseArgs({
  options: {
    ids: { type: 'string' },
    kind: { type: 'string' },
    limit: { type: 'string' },
    all: { type: 'boolean', default: false },
    yes: { type: 'boolean', default: false },
  },
})

try {
  process.loadEnvFile(path.join(ROOT, '.env'))
} catch {
  // .env yoksa ortam değişkenleri kullanılır
}

const { db, assets } = await loadAssets()
const ids = values.ids?.split(',').map((s) => s.trim())
let queue = assets.filter(
  (a) =>
    (!values.kind || a.kind === values.kind) &&
    (ids ? ids.includes(a.id) : values.all || !hasMaster(a)),
)
if (values.limit) queue = queue.slice(0, Number(values.limit))

console.log(`${queue.length} görsel üretilecek:`)
for (const a of queue) console.log(`  · ${a.key} (${a.name})${hasMaster(a) ? '  [mevcut görselin yerine geçer]' : ''}`)
if (!values.yes) {
  console.log('\nKuru çalıştırma. API çağrısı ücretlidir; üretmek için --yes ekle.')
  process.exit(0)
}

const key = process.env.OPENAI_API_KEY
if (!key) {
  console.error('OPENAI_API_KEY yok. .env.example dosyasını .env olarak kopyalayıp anahtarı yaz.')
  process.exit(1)
}
const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1'
const quality = process.env.OPENAI_IMAGE_QUALITY || 'high'

async function generate(a: ArtAssetRef): Promise<Buffer> {
  const ref = path.join(PATHS.styleRef, `${a.kind}.png`)
  const useRef = existsSync(ref)
  const prompt = fullPrompt(a, db.art, useRef)
  const size = db.art.kinds[a.kind].chatgptSize
  let res: Response
  if (useRef) {
    const form = new FormData()
    form.append('model', model)
    form.append('prompt', prompt)
    form.append('size', size)
    form.append('quality', quality)
    form.append('image[]', new Blob([await readFile(ref)], { type: 'image/png' }), `${a.kind}-style-ref.png`)
    res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    })
  } else {
    res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, size, quality, n: 1 }),
    })
  }
  const body = (await res.json()) as { data?: { b64_json?: string }[]; error?: { message: string } }
  if (!res.ok || !body.data?.[0]?.b64_json) throw Object.assign(new Error(body.error?.message ?? `HTTP ${res.status}`), { status: res.status })
  return Buffer.from(body.data[0].b64_json, 'base64')
}

let done = 0
for (const a of queue) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const img = await generate(a)
      const r = await processImage(img, a, db, '.png')
      done++
      console.log(`✓ ${r.key}`)
      break
    } catch (e) {
      const status = (e as { status?: number }).status
      console.error(`✗ ${a.key} (deneme ${attempt}): ${(e as Error).message}`)
      if (status !== 429 && (status ?? 500) < 500) break
      await new Promise((r) => setTimeout(r, 5000 * attempt))
    }
  }
}
console.log(`\n${done}/${queue.length} görsel üretildi ve işlendi.`)
