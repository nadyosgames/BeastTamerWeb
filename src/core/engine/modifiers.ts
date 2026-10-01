import type { AbilityTrigger, CardFilter, Cond, Modifier, TamerDef, WeatherDef } from '../types.ts'
import { ABILITY_TRIGGERS } from '../types.ts'

export interface IncomeMod {
  pct: number
  filter?: CardFilter
  if?: Cond
}

export interface StartDurabilityMod {
  amount: number
  min: number
  filter?: CardFilter
  if?: Cond
}

/**
 * Bir gün boyunca sabit kalan global etkiler (hava + Tamer + albüm/burç pasifleri),
 * gün başında bir kez derlenir. Çarpım sırası GDD'ye göre: hava, albüm, en son Tamer.
 */
export interface ModifierSet {
  /** Hava yüzdeleri kart başına toplanır (hibrit kart: iki elementin bonus/cezası toplanır). */
  weatherIncome: IncomeMod[]
  /** Albüm pasifleri toplanır ("birbirine eklenir"). */
  passiveIncome: IncomeMod[]
  /** Tamer çarpanları ayrı ayrı çarpılır, son çarpandır. */
  tamerIncome: IncomeMod[]
  startDurability: StartDurabilityMod[]
  /** Yetenek türü başına çarpan (1 = etkisiz). */
  abilityScale: Record<AbilityTrigger, number>
  /** Yetenek türü başına kaç kez çalışır (Hasatçı: Epilogue ×2). */
  repeat: Record<AbilityTrigger, number>
}

export interface ModifierSources {
  weather?: WeatherDef | null
  tamer?: TamerDef | null
  passives?: Modifier[]
}

export function compileModifiers({ weather, tamer, passives = [] }: ModifierSources): ModifierSet {
  const set: ModifierSet = {
    weatherIncome: [],
    passiveIncome: [],
    tamerIncome: [],
    startDurability: [],
    abilityScale: Object.fromEntries(ABILITY_TRIGGERS.map((t) => [t, 1])) as Record<AbilityTrigger, number>,
    repeat: Object.fromEntries(ABILITY_TRIGGERS.map((t) => [t, 1])) as Record<AbilityTrigger, number>,
  }

  // Mevsimci gibi hava ölçekleyicileri önce toplanır.
  let bonusScale = 1
  let penaltyScale = 1
  for (const m of [...(tamer?.modifiers ?? []), ...passives]) {
    if (m.kind === 'weatherScale') {
      bonusScale *= 1 + m.bonusPct / 100
      penaltyScale *= 1 + m.penaltyPct / 100
    }
  }

  const addCommon = (m: Modifier, income: IncomeMod[]) => {
    switch (m.kind) {
      case 'incomePct':
        income.push({ pct: m.pct, filter: m.filter, if: m.if })
        break
      case 'durabilityAtStart':
        set.startDurability.push({ amount: m.amount, min: m.min ?? 0, filter: m.filter, if: m.if })
        break
      case 'abilityScale':
        set.abilityScale[m.on] *= 1 + m.pct / 100
        break
      case 'repeatAbility':
        set.repeat[m.on] = Math.max(set.repeat[m.on], m.times)
        break
      case 'weatherScale':
        break
    }
  }

  for (const m of weather?.modifiers ?? []) {
    if (m.kind === 'incomePct') {
      const scale = m.pct >= 0 ? bonusScale : penaltyScale
      set.weatherIncome.push({ pct: m.pct * scale, filter: m.filter, if: m.if })
    } else {
      addCommon(m, set.weatherIncome)
    }
  }
  for (const m of passives) addCommon(m, set.passiveIncome)
  for (const m of tamer?.modifiers ?? []) addCommon(m, set.tamerIncome)
  return set
}

export const EMPTY_MODIFIERS: ModifierSet = compileModifiers({})
