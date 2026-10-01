import fs from 'node:fs'
import path from 'node:path'

const [planKind,id,source] = process.argv.slice(2)
if (!['readable','framing'].includes(planKind) || !/^[a-z0-9_]+$/.test(id ?? '') || !source || !fs.existsSync(source)) throw new Error('Geçersiz görsel kaydı')
const planFile = planKind === 'framing' ? 'framing-repair-plan.json' : 'readable-card-plan.json'
const job = JSON.parse(fs.readFileSync(`art/direction/${planFile}`,'utf8')).jobs.find(j=>j.id===id)
if (!job) throw new Error(`Plan içinde kart yok: ${id}`)
const file = `art/direction/results/readable-cards/${id}.json`
if (fs.existsSync(file)) {
  const dir = 'art/direction/results/revisions'
  fs.mkdirSync(dir,{recursive:true})
  let version = 1
  while (fs.existsSync(`${dir}/${id}.v${version}.json`)) version++
  fs.copyFileSync(file,`${dir}/${id}.v${version}.json`)
}
const revisionDir = 'art/source/revisions/cards'
const versions = fs.existsSync(revisionDir) ? fs.readdirSync(revisionDir).filter(f=>f.startsWith(`${id}.v`) && f.endsWith('.png')).sort((a,b)=>Number(a.match(/\.v(\d+)/)[1])-Number(b.match(/\.v(\d+)/)[1])) : []
const previousMaster = versions.length ? `${revisionDir}/${versions.at(-1)}` : undefined
const originalReference = path.resolve(`art/source/cards/${id}.png`).replaceAll('\\','/')
const references = job.references.map(ref=>ref === originalReference && previousMaster ? path.resolve(previousMaster).replaceAll('\\','/') : ref)
fs.writeFileSync(file,JSON.stringify({...job,source,master:`art/source/cards/${id}.png`,previousMaster,references,generationReferences:job.references},null,2)+'\n')
console.log(`${id}: prompt ve kaynak kaydedildi`)
