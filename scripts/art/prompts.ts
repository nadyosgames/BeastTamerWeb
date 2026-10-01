import { existsSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { fullPrompt } from '../../src/art/prompts.ts'
import { hasMaster, loadAssets, PATHS, ROOT } from './lib.ts'

/**
 * İçerikten ChatGPT prompt'larını üretir.
 *   art/prompts/<kind>/<id>.txt   tek tek kopyalamak için
 *   art/prompts/PROMPTS.md        kontrol listesi (eksikler üstte)
 *
 *   npm run art:prompts                 tümü
 *   npm run art:prompts -- --missing    yalnızca görseli olmayanlar
 */
const { values } = parseArgs({ options: { missing: { type: 'boolean', default: false } } })
const { db, assets } = await loadAssets()

await rm(PATHS.prompts, { recursive: true, force: true })
const list = assets.filter((a) => !values.missing || !hasMaster(a))
const hasRef = (kind: string) => existsSync(path.join(PATHS.styleRef, `${kind}.png`))

for (const a of list) {
  const file = path.join(PATHS.prompts, a.kind, `${a.id}.txt`)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, fullPrompt(a, db.art, hasRef(a.kind)) + '\n')
}

const lines: string[] = [
  '# Görsel prompt listesi',
  '',
  'Üretildi: `npm run art:prompts`. Akış: prompt\'u ChatGPT\'ye yapıştır → görseli indir →',
  '`art/inbox/<tür>/<id>.png` olarak kaydet → `npm run art:ingest` (ya da Art Studio\'ya sürükle).',
  '',
  'İpuçları (GDD): her istekte tek görsel; tüm kartları aynı sohbette üret; beğendiğin ilk görseli',
  '`art/style-ref/<tür>.png` olarak kaydet ve sonraki isteklere ekle — prompt başına stil cümlesi eklenir.',
  '',
]
for (const kind of ['cards', 'tamers', 'weather'] as const) {
  const items = list.filter((a) => a.kind === kind).sort((x, y) => Number(hasMaster(x)) - Number(hasMaster(y)))
  if (!items.length) continue
  const cfg = db.art.kinds[kind]
  lines.push(`## ${cfg.label} (${kind}) · ChatGPT boyutu ${cfg.chatgptSize} → master ${cfg.master.width}×${cfg.master.height}`, '')
  for (const a of items) {
    lines.push(`### ${hasMaster(a) ? '✅' : '⬜'} ${a.name} — \`${a.kind}/${a.id}\``, '', '```text', fullPrompt(a, db.art, hasRef(kind)), '```', '')
  }
}
await mkdir(PATHS.prompts, { recursive: true })
await writeFile(path.join(PATHS.prompts, 'PROMPTS.md'), lines.join('\n'))

const missing = assets.filter((a) => !hasMaster(a)).length
console.log(`${list.length} prompt yazıldı → ${path.relative(ROOT, PATHS.prompts)}/ (eksik görsel: ${missing}/${assets.length})`)
