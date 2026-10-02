import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { loadAssets, masterPath, processImage, ROOT } from './lib.ts'

// Run only AFTER inspecting the generated output. Review notes are mandatory.
const [kind, id, input, review, metadata] = process.argv.slice(2)
if (!input || !review || !['cards', 'tamers'].includes(kind)) throw new Error('Usage: node scripts/art/import-retro.mjs <cards|tamers> <id> <PNG> <visual review notes>')
const planPath = path.join(ROOT, 'art/direction/retro/plan.json')
const plan = JSON.parse(await readFile(planPath, 'utf8'))
const job = plan.jobs.find(j => j.key === `${kind}/${id}`)
if (!job) throw new Error('Asset must be present in the approved plan')
const { assets, db } = await loadAssets()
const asset = assets.find(a => a.key === job.key)
if (!asset) throw new Error('Unknown content asset')
const master = masterPath(asset)
if (existsSync(master)) {
  const revisions = path.join(ROOT, 'art/source/revisions', kind)
  await mkdir(revisions, { recursive: true })
  let version = 1
  while (existsSync(path.join(revisions, `${id}.v${version}.png`))) version++
  await copyFile(master, path.join(revisions, `${id}.v${version}.png`))
}
const result = await processImage(await readFile(input), asset, db)
job.status = 'reviewed-and-imported'
job.output = input
job.master = path.relative(ROOT, master).replaceAll('\\', '/')
job.review = review
if (metadata) {
  const details = JSON.parse(metadata)
  if (details.generationPrompt) job.generationPrompt = details.generationPrompt
  if (details.repairs) job.repairs = details.repairs
}
job.reviewedAt = new Date().toISOString()
await writeFile(planPath, JSON.stringify(plan, null, 2)+'\n')
await mkdir(path.join(ROOT, 'art/direction/retro/results', kind), { recursive: true })
await writeFile(path.join(ROOT, 'art/direction/retro/results', kind, `${id}.json`), JSON.stringify({ ...job, result }, null, 2)+'\n')
const done = plan.jobs.filter(j => j.status === 'reviewed-and-imported').length
console.log(`${job.key}: visually reviewed and imported; ${done}/${plan.jobs.length} complete`)
