// Çekirdek motorun genel API'si. src/core hiçbir tarayıcı/React/Node API'si kullanmaz
// (oxlint kuralı ile korunur): aynı kod tarayıcıda, simülasyonda ve testlerde çalışır,
// Unity'ye C# olarak birebir taşınır.
export * from './types.ts'
export * from './math.ts'
export * from './rng.ts'
export * from './calendar.ts'
export * from './economy.ts'
export * from './packs.ts'
export * from './day.ts'
export * from './engine/events.ts'
export * from './engine/modifiers.ts'
export * from './engine/state.ts'
export { resolveRound, compileCard, polarityLinks, type PolarityLink, type RoundResult, type SlotResult } from './engine/round.ts'
export { CUSTOM_OPS, type CustomOp } from './engine/custom.ts'
