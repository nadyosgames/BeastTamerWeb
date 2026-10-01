import fs from 'node:fs'

const file = 'art/direction/generated-prompts.json'
const base = JSON.parse(fs.readFileSync(file,'utf8'))
const cards = JSON.parse(fs.readFileSync('content/cards.json','utf8')).cards
const kept = new Set(['spark_fox','sun_dragon','volcano_serpent'])
const records = cards.map(card => {
  const revised = `art/direction/results/readable-cards/${card.id}.json`
  const record = fs.existsSync(revised) ? revised : `art/direction/results/${kept.has(card.id) ? 'cards' : 'readable-cards'}/${card.id}.json`
  if (!fs.existsSync(record)) throw new Error(`Eksik nihai görsel: ${card.id}`)
  return JSON.parse(fs.readFileSync(record,'utf8'))
})
base.generator = 'Built-in image_gen'
base.direction = 'User-approved serpent readability; individual habitats; harmonious palettes, restrained effects and clear tonal silhouettes'
base.assets = [...base.assets.filter(a=>!a.key.startsWith('cards/')), ...records.map(r=>({...r,key:`cards/${r.id ?? r.key?.split('/')[1]}`}))]
fs.writeFileSync(file,JSON.stringify(base,null,2)+'\n')
console.log(`${base.assets.length} asset prompts and final master paths saved`)
