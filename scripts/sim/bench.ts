import { content } from '../../src/content/index.ts'
import { compileModifiers, createRng, playDay, resolveRound } from '../../src/core/index.ts'
import { masterArranger } from '../../src/sim/arrangers.ts'

/** Motor performansı. Simülasyon milyonlarca tur çözer; yeni mekanik eklendikçe bunu izle. */
const hand = ['spark_fox', 'coral_turtle', 'stone_golem', 'charge_bat', 'cloud_owl'].map((id) => content.card(id))
const ctx = {
  mods: compileModifiers({ weather: content.weatherById.get('sunny'), tamer: content.tamer('wanderer') }),
  roundIndex: 1,
  roundCount: 6,
  triggerCap: 60,
}
for (let i = 0; i < 20000; i++) resolveRound(hand, ctx)

const N = 200000
let t = performance.now()
for (let i = 0; i < N; i++) resolveRound(hand, ctx)
console.log(`resolveRound: ${(((performance.now() - t) * 1000) / N).toFixed(2)} µs`)

const setup = { deck: content.starterDeck(), tamer: content.tamer('wanderer'), weather: content.weatherById.get('sunny') }
t = performance.now()
for (let i = 0; i < 50; i++) playDay(setup, createRng(i), masterArranger)
console.log(`usta botla bir gün: ${((performance.now() - t) / 50).toFixed(1)} ms`)
