import { weightedPick, type Rng } from './rng.ts'
import type { Modifier, WeatherDef } from './types.ts'

export interface ZodiacDef {
  id: string
  name: string
  /** Yılın albümü tamamlanınca kalıcı açılan pasif (yalnızca ödül, ceza yok). */
  albumPassive: { text: string; modifiers: Modifier[]; duplicateBonusPct?: number }
}

export interface CalendarConfig {
  daysPerWeek: number
  weeksPerMonth: number
  monthsPerYear: number
  yearsPerCycle: number
  cycles: number
  zodiac: ZodiacDef[]
  weatherRules: { minDistinctPerWeek: number; maxSameInARow: number }
}

export interface CalendarDate {
  dayIndex: number
  weekIndex: number
  cycle: number
  year: number
  month: number
  week: number
  day: number
  zodiacId: string
}

/** Mutlak gün indeksinden (0 tabanlı) takvim tarihi. Gösterim alanları 1 tabanlıdır. */
export function dateOf(dayIndex: number, cal: CalendarConfig): CalendarDate {
  const weekIndex = Math.floor(dayIndex / cal.daysPerWeek)
  const monthIndex = Math.floor(weekIndex / cal.weeksPerMonth)
  const yearIndex = Math.floor(monthIndex / cal.monthsPerYear)
  return {
    dayIndex,
    weekIndex,
    cycle: Math.floor(yearIndex / cal.yearsPerCycle) + 1,
    year: (yearIndex % cal.yearsPerCycle) + 1,
    month: (monthIndex % cal.monthsPerYear) + 1,
    week: (weekIndex % cal.weeksPerMonth) + 1,
    day: (dayIndex % cal.daysPerWeek) + 1,
    zodiacId: cal.zodiac[yearIndex % cal.zodiac.length].id,
  }
}

export function weeksPerYear(cal: CalendarConfig): number {
  return cal.weeksPerMonth * cal.monthsPerYear
}

/**
 * Haftalık hava: en az N farklı hava, aynı hava en fazla M gün üst üste
 * (önceki haftanın son günü de sayılır).
 */
export function generateWeekWeather(
  weathers: readonly WeatherDef[],
  cal: CalendarConfig,
  rng: Rng,
  previousDay?: string,
): string[] {
  const { minDistinctPerWeek, maxSameInARow } = cal.weatherRules
  for (let attempt = 0; attempt < 100; attempt++) {
    const days: string[] = []
    let last = previousDay
    let run = previousDay ? 1 : 0
    for (let d = 0; d < cal.daysPerWeek; d++) {
      const candidates = weathers.filter((w) => !(w.id === last && run >= maxSameInARow))
      const id = weightedPick(candidates, (w) => w.weight, rng).id
      run = id === last ? run + 1 : 1
      last = id
      days.push(id)
    }
    if (new Set(days).size >= minDistinctPerWeek) return days
  }
  throw new Error('Hava kuralları sağlanamadı: weather.json ağırlıklarını kontrol et')
}
