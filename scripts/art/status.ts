import { hasMaster, loadAssets } from './lib.ts'

/** Hangi varlığın görseli var / eksik. */
const { assets } = await loadAssets()
for (const kind of ['cards', 'tamers', 'weather'] as const) {
  const items = assets.filter((a) => a.kind === kind)
  const done = items.filter(hasMaster)
  console.log(`\n${kind}: ${done.length}/${items.length}`)
  for (const a of items) console.log(`  ${hasMaster(a) ? '✅' : '⬜'} ${a.id.padEnd(24)} ${a.name}`)
}
const total = assets.filter(hasMaster).length
console.log(`\nToplam: ${total}/${assets.length} görsel hazır. Eksikler için: npm run art:prompts -- --missing`)
