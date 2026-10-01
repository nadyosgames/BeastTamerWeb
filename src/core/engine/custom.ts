import type { RoundState, SlotState } from './state.ts'

/**
 * DSL'e sığmayan, kural büken kartlar (Mythic/Ancient) için kod ile yazılan efektler.
 * Kart JSON'unda: { "op": "custom", "id": "ornek_id", "params": { ... } }
 *
 * Kural: buraya eklenen her efekt hem simülasyonda hem UI'da otomatik çalışır.
 * Unity portunda aynı id ile C# karşılığı yazılır ve golden testlerle doğrulanır.
 * Önce DSL'e yeni bir op eklemeyi düşün; custom yalnızca tek kartlık istisnalar için.
 */
export interface IncomeAccumulator {
  flat: number
  mult: number
  copied: number
}

export interface CustomOpApi {
  rs: RoundState
  self: SlotState
  acc: IncomeAccumulator
  params: Record<string, number | string | boolean>
}

export type CustomOp = (api: CustomOpApi) => void

export const CUSTOM_OPS: Record<string, CustomOp> = {
  /** Örnek: masadaki en yüksek dayanıklılık kadar düz gelir. */
  gain_max_durability: ({ rs, acc, params }) => {
    let max = 0
    for (const s of rs.slots) max = Math.max(max, s.durability)
    acc.flat += max * Number(params.amount ?? 1)
  },
}
