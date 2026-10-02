import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { loadAssets, ROOT } from './lib.ts'
import { fullPrompt } from '../../src/art/prompts.ts'

const { db, assets } = await loadAssets()
const planFile = path.join(ROOT, 'art/direction/retro/plan.json')
const previous = existsSync(planFile) ? JSON.parse(await readFile(planFile, 'utf8')) : null
const featured = ['spark_fox', 'coral_turtle', 'stone_golem', 'cloud_owl', 'charge_bat', 'drop_frog', 'rock_lizard', 'storm_eagle', 'flame_swarm', 'whirl_octopus', 'ancient_tree', 'mist_ghost', 'ember_hedgehog', 'coral_crab', 'root_keeper', 'gust_cat', 'static_rabbit', 'lava_salamander', 'pearl_seahorse', 'moss_giant', 'storm_moth', 'thunder_ram', 'sun_dragon', 'baby_dragon']
const anatomy = (asset) => {
  const card = db.cards.find(c => c.id === asset.id)
  if (!card) return 'Portrait QC: two coherent eyes, one head, correctly connected visible hands and arms; no extra fingers or malformed hands. Companion has its own separate complete face and limbs.'
  if (['whirl_octopus', 'kraken'].includes(card.id)) return 'Species QC: exactly EIGHT distinct attached arms, each readable from base to tip; no ninth tentacle or fused duplicated suckers. Two coherent eyes.'
  if (card.id === 'wyvern') return 'Species QC: exactly TWO hind legs and TWO membranous wings as forelimbs, one head and one tail. No separate front legs or human arms.'
  if (card.type === 'flora') return 'Species QC: a PLANT body made of stems, leaves, bark and roots. Do not invent a fox-like torso, fur, animal paws or tail. Walking plants may have two leaf/branch arms and two root feet, each attached to a single stem/trunk. Keep one coherent face.'
  if (/beetle|mantis|moth|butterfly|bee|dragonfly/.test(card.id)) return 'Species QC: exactly SIX insect legs and TWO antennae, each correctly attached; no extra legs, animal paws or bird beak. Winged insects have their species-appropriate wing pairs, all readable.'
  if (/spider/.test(card.id)) return 'Species QC: exactly EIGHT attached spider legs with eight countable tips, no antennae or mammal limbs.'
  if (/scorpion/.test(card.id)) return 'Species QC: exactly EIGHT walking legs, TWO claw arms and ONE curved segmented stinger tail; no extra claws or tails.'
  if (card.type === 'avian') return 'Species QC: exactly TWO feathered wings and TWO taloned feet; no human arms/hands. Single head, coherent beak and two eyes. Full wings inside frame.'
  if (/serpent|eel|snake/.test(card.id)) return 'Species QC: one continuous limbless serpentine body, ONE head and ONE tapering tail. No arms or legs; no duplicated head, loose coils or disconnected body segments.'
  if (/turtle|tortoise/.test(card.id)) return 'Species QC: ONE shell with exactly FOUR anatomically attached feet/flippers, ONE head and ONE short tail. Face is on the head, not on the shell.'
  if (/bat/.test(card.id)) return 'Species QC: TWO membranous wings, TWO small feet, two ears, one head. Wings are the forelimbs: NO additional arms or human hands.'
  if (/dragon/.test(card.id)) return 'Species QC: one head, one tail; if the described dragon is winged, exactly two wings and four correctly attached limbs, all separately readable. If serpentine, preserve one continuous long body without inventing mammal limbs.'
  if (/crab/.test(card.id)) return 'Species QC: two distinct front claws and eight small walking legs, one shell/body, one coherent pair of eyes; no extra claws.'
  if (card.type === 'swarm') return 'Species QC: a few clearly separated members of the specified species; each has its own coherent face and correct limbs. No fused bodies or mixed-species members.'
  return 'Species QC: correct species-specific limbs and tail. If bipedal, two arms and two legs; if quadrupedal, four legs. Clearly show attachment of each visible limb; no extras, fused joints, split paws or duplicated pupils.'
}
const rank = (a) => a.kind === 'tamers' ? -100 + db.tamers.findIndex(t => t.id === a.id) : featured.includes(a.id) ? featured.indexOf(a.id) : 100 + db.cards.findIndex(c => c.id === a.id)
const jobs = assets.filter(a => a.kind !== 'weather').sort((a,b) => rank(a)-rank(b)).map(a => previous?.jobs.find(j => j.key === a.key && j.status !== 'pending') ?? ({
  key: a.key, kind: a.kind, id: a.id, name: a.name, status: 'pending',
  prompt: `${fullPrompt(a, db.art, true)} ${anatomy(a)}`,
  references: ['art/style-ref/retro-run.png', 'art/style-ref/retro-menu.png'],
  checks: ['face-eyes-pupils', 'limb-count-and-attachments', 'wings-tail-and-silhouette', 'safe-framing', 'thumbnail-readability'],
}))
await mkdir(path.join(ROOT, 'art/direction/retro'), { recursive: true })
await writeFile(planFile, JSON.stringify({ generator: 'built-in image_gen', direction: 'Approved 1930s ink-and-parchment cartoon', jobs }, null, 2)+'\n')
console.log(`Prepared ${jobs.length} individual jobs (${db.tamers.length} tamers, ${db.cards.length} cards). Weather and packs use native vector UI.`)
