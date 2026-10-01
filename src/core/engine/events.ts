import type { AbilityTrigger, LinkState } from '../types.ts'

/**
 * Tur çözücünün ürettiği olay akışı. Motor turu anında hesaplar; UI (web ya da Unity)
 * bu olayları x1/x2/x4 hızda sırayla oynatır, "Atla" ise doğrudan sona gider.
 * Simülasyonda olay dinleyicisi verilmez, hiçbir olay nesnesi oluşturulmaz.
 * Slot indeksleri 0 tabanlıdır.
 */
export type RoundEvent =
  | { t: 'roundStart'; slots: number }
  | { t: 'links'; links: { left: number; right: number; state: LinkState }[] }
  | { t: 'passStart'; pass: number }
  | {
      t: 'ability'
      slot: number
      on: AbilityTrigger | 'retrigger'
      pass: number
      income: number
      detail: IncomeDetail
    }
  | { t: 'durability'; slot: number; from: number; to: number; source: DurabilitySource }
  | { t: 'ward'; slot: number }
  | { t: 'exhausted'; slot: number }
  | { t: 'rebirth'; slot: number }
  | { t: 'reactivated'; slot: number }
  | { t: 'heat'; value: number }
  | { t: 'passEnd'; pass: number }
  | { t: 'cap' }
  | { t: 'roundEnd'; total: number; triggers: number; passes: number }

export type DurabilitySource = 'start' | 'trigger' | 'ability'

/** Gelirin nereden geldiği (UI ipucu ve denge analizi için). */
export interface IncomeDetail {
  flat: number
  mult: number
  copied: number
  /** abilityScale (ör. Last Breath +%25) */
  scale: number
  /** hava × albüm × Tamer */
  global: number
  raw: number
}

export type EventSink = (e: RoundEvent) => void
