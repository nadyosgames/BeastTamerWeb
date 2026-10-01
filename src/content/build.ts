import type { z } from 'zod'
import type { CalendarConfig } from '../core/calendar.ts'
import type { CalibratedBalance, EconomyConfig } from '../core/economy.ts'
import { CUSTOM_OPS } from '../core/engine/custom.ts'
import type { CardDef, Cond, Effect, TamerDef, WeatherDef } from '../core/types.ts'
import {
  ArtConfigSchema,
  BalanceTargetsSchema,
  CalendarSchema,
  CalibratedBalanceSchema,
  CardSchema,
  EconomySchema,
  StarterSchema,
  TamerSchema,
  WeatherSchema,
  type ArtConfig,
  type BalanceTargets,
  type StarterConfig,
} from './schema.ts'

export interface RawContent {
  cards: unknown
  tamers: unknown
  weather: unknown
  economy: unknown
  calendar: unknown
  starter: unknown
  targets: unknown
  art: unknown
  balance: unknown
}

export interface ContentDB {
  cards: CardDef[]
  cardById: Map<string, CardDef>
  /** Paketlerden çıkabilen kartlar. */
  packPool: CardDef[]
  tamers: TamerDef[]
  tamerById: Map<string, TamerDef>
  weather: WeatherDef[]
  weatherById: Map<string, WeatherDef>
  economy: EconomyConfig
  calendar: CalendarConfig
  starter: StarterConfig
  targets: BalanceTargets
  art: ArtConfig
  /** Simülasyon kalibrasyonu çıktısı (yoksa quotaByWeek boş). */
  balance: CalibratedBalance
  card(id: string): CardDef
  tamer(id: string): TamerDef
  starterDeck(): CardDef[]
}

export class ContentError extends Error {}

function parse<T>(schema: z.ZodType<T>, value: unknown, file: string): T {
  const { $schema: _ignored, ...rest } = (value ?? {}) as Record<string, unknown>
  const r = schema.safeParse(rest)
  if (!r.success) {
    const lines = r.error.issues.map((i) => `  ${file}: ${i.path.join('.')} → ${i.message}`)
    throw new ContentError(`İçerik doğrulanamadı:\n${lines.join('\n')}`)
  }
  return r.data
}

function listOf<T>(schema: z.ZodType<T>, value: unknown, key: string, file: string): T[] {
  const arr = (value as Record<string, unknown>)?.[key]
  if (!Array.isArray(arr)) throw new ContentError(`${file}: "${key}" dizisi bulunamadı`)
  return arr.map((item, i) => parse(schema, item, `${file}[${i}]${(item as { id?: string })?.id ? ` (${(item as { id: string }).id})` : ''}`))
}

export function buildContent(raw: RawContent): ContentDB {
  const cards = listOf(CardSchema, raw.cards, 'cards', 'cards.json')
  const tamers = listOf(TamerSchema, raw.tamers, 'tamers', 'tamers.json')
  const weather = listOf(WeatherSchema, raw.weather, 'weather', 'weather.json')
  const economy = parse(EconomySchema, raw.economy, 'economy.json')
  const calendar = parse(CalendarSchema, raw.calendar, 'calendar.json')
  const starter = parse(StarterSchema, raw.starter, 'starter.json')
  const targets = parse(BalanceTargetsSchema, raw.targets, 'balance-targets.json')
  const art = parse(ArtConfigSchema, raw.art, 'art.json')
  const balance = parse(CalibratedBalanceSchema, raw.balance, 'generated/balance.json')

  const cardById = new Map(cards.map((c) => [c.id, c]))
  const tamerById = new Map(tamers.map((t) => [t.id, t]))
  const weatherById = new Map(weather.map((w) => [w.id, w]))

  const db: ContentDB = {
    cards,
    cardById,
    packPool: cards.filter((c) => (c.source ?? 'pack') !== 'quest'),
    tamers,
    tamerById,
    weather,
    weatherById,
    economy,
    calendar,
    starter,
    targets,
    art,
    balance,
    card(id) {
      const c = cardById.get(id)
      if (!c) throw new ContentError(`Bilinmeyen kart: ${id}`)
      return c
    },
    tamer(id) {
      const t = tamerById.get(id)
      if (!t) throw new ContentError(`Bilinmeyen Tamer: ${id}`)
      return t
    },
    starterDeck() {
      return starter.deck.flatMap(({ card, count }) => Array.from({ length: count }, () => db.card(card)))
    },
  }

  const problems = checkContent(db)
  const errors = problems.filter((p) => p.level === 'error')
  if (errors.length) throw new ContentError(`İçerik hataları:\n${errors.map((e) => '  ' + e.message).join('\n')}`)
  return db
}

export interface ContentProblem {
  level: 'error' | 'warning'
  message: string
}

/** Şemanın yakalayamadığı çapraz kontroller. */
export function checkContent(db: ContentDB): ContentProblem[] {
  const out: ContentProblem[] = []
  const err = (message: string) => out.push({ level: 'error', message })
  const warn = (message: string) => out.push({ level: 'warning', message })

  const dup = (ids: string[], what: string) => {
    const seen = new Set<string>()
    for (const id of ids) {
      if (seen.has(id)) err(`${what} id tekrar ediyor: ${id}`)
      seen.add(id)
    }
  }
  dup(db.cards.map((c) => c.id), 'Kart')
  dup(db.tamers.map((t) => t.id), 'Tamer')
  dup(db.weather.map((w) => w.id), 'Hava')

  for (const c of db.cards) {
    const isElectric = c.elements.includes('electric')
    if (isElectric && !c.polarity) warn(`${c.id}: Elektrik kartının kutupları yok`)
    if (!isElectric && c.polarity) err(`${c.id}: kutup yalnızca Elektrik kartlarında olur`)
    if (c.elements.length === 2 && ['common', 'uncommon'].includes(c.rarity))
      warn(`${c.id}: hibrit kart Rare altında (GDD önerisi Rare+)`)
    if (!c.art) warn(`${c.id}: görsel tarifi (art.creature) yok`)
    for (const ab of c.abilities) {
      for (const e of ab.effects) {
        if (e.op === 'custom' && !CUSTOM_OPS[e.id]) err(`${c.id}: custom op "${e.id}" tanımlı değil`)
        if (e.op === 'aura' && ab.on !== 'aura') err(`${c.id}: aura efekti yalnızca "on": "aura" içinde olur`)
        if (ab.on === 'aura' && e.op !== 'aura') err(`${c.id}: aura yeteneğinde yalnızca aura efekti olur`)
        if (usesCond(e, 'link') && !c.polarity) err(`${c.id}: bağlantı koşulu var ama kutup yok`)
      }
    }
  }

  const starterTamer = db.tamerById.get(db.starter.tamer)
  if (!starterTamer) err(`starter.json: Tamer "${db.starter.tamer}" yok`)
  let size = 0
  for (const { card, count } of db.starter.deck) {
    const c = db.cardById.get(card)
    if (!c) {
      err(`starter.json: kart "${card}" yok`)
      continue
    }
    size += count
    if (count > db.economy.rarities[c.rarity].deckLimit) err(`starter.json: ${card} deste sınırını aşıyor`)
  }
  if (starterTamer && size !== starterTamer.deckSize)
    err(`starter.json: deste ${size} kart, ${starterTamer.id} ${starterTamer.deckSize} ister`)

  if (!db.economy.packs.some((p) => p.id === db.economy.weeklyPack))
    err(`economy.json: weeklyPack "${db.economy.weeklyPack}" paketlerde yok`)
  for (const p of db.economy.packs) {
    const sum = Object.values(p.odds).reduce((a, b) => a + (b ?? 0), 0)
    if (Math.abs(sum - 100) > 0.01) warn(`economy.json: ${p.id} oranları toplamı ${sum} (100 olmalı)`)
  }
  if (!db.balance.quotaByWeek.length)
    warn('generated/balance.json boş: kota geçici formülden geliyor. `npm run sim -- calibrate` çalıştır.')
  return out
}

function usesCond(e: Effect, kind: Cond['kind']): boolean {
  const walk = (c: Cond | undefined): boolean => {
    if (!c) return false
    if (c.kind === kind) return true
    if (c.kind === 'not') return walk(c.cond)
    if (c.kind === 'all' || c.kind === 'any') return c.conds.some(walk)
    return false
  }
  return 'if' in e ? walk(e.if) : false
}
