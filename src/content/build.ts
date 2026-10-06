import type { z } from 'zod'
import type { CalibratedHunts, EconomyConfig } from '../core/economy.ts'
import { CUSTOM_OPS } from '../core/engine/custom.ts'
import { scaleHunt } from '../core/hunt.ts'
import type { CardDef, Cond, Effect, HuntDef, RegionDef, TamerDef, WeatherDef, WorldDef } from '../core/types.ts'
import {
  ArtConfigSchema,
  BalanceTargetsSchema,
  CalibratedHuntsSchema,
  CardSchema,
  DeckPresetSchema,
  EconomySchema,
  HuntSchema,
  RegionSchema,
  StarterSchema,
  TamerSchema,
  WeatherSchema,
  WorldSchema,
  type ArtConfig,
  type BalanceTargets,
  type DeckPreset,
  type StarterConfig,
} from './schema.ts'

export interface RawContent {
  cards: unknown
  tamers: unknown
  weather: unknown
  decks: unknown
  economy: unknown
  hunts: unknown
  regions: unknown
  starter: unknown
  targets: unknown
  art: unknown
  /** content/generated/hunts.json: simülasyonla kalibre edilen yaratık canları. */
  huntBalance: unknown
}

export interface ContentDB {
  cards: CardDef[]
  cardById: Map<string, CardDef>
  /** Paketlerden çıkabilen kartlar (avla ve görevle gelenler hariç). */
  packPool: CardDef[]
  tamers: TamerDef[]
  tamerById: Map<string, TamerDef>
  weather: WeatherDef[]
  weatherById: Map<string, WeatherDef>
  /** Hazır desteler (decks.json). */
  decks: DeckPreset[]
  deckById: Map<string, DeckPreset>
  economy: EconomyConfig
  hunts: HuntDef[]
  huntById: Map<string, HuntDef>
  regions: RegionDef[]
  regionById: Map<string, RegionDef>
  /** Dünya haritası (regions.json → world). */
  world: WorldDef
  starter: StarterConfig
  targets: BalanceTargets
  art: ArtConfig
  /** Simülasyon kalibrasyonu çıktısı (yoksa hp boş, tasarım canı kullanılır). */
  huntBalance: CalibratedHunts
  card(id: string): CardDef
  tamer(id: string): TamerDef
  hunt(id: string): HuntDef
  region(id: string): RegionDef
  /** Bölgenin avları (hunts.json sırasıyla). */
  regionHunts(regionId: string): HuntDef[]
  /** Bölgenin Final avı (bayıltılınca sonraki bölgeler açılır). */
  regionFinal(regionId: string): HuntDef | undefined
  /** Yaratığın can çubuğu: kalibre değer varsa o, yoksa tasarım değeri. */
  huntHp(id: string): number
  /** İkinci can çubuğu: kalibrasyon ana çubuğu ölçeklediyse aynı oranda ölçeklenir. */
  huntRevive(id: string): number | undefined
  /** Kalibre cana göre ölçeklenmiş av (ikinci can, Toparlanma, Kaçış eşiği): oyun ve simülasyon bunu oynar. */
  scaledHunt(id: string): HuntDef
  /** Preset destenin kart listesi (kopyalar dahil, 30 kart). */
  deckCards(id: string): CardDef[]
  /**
   * Avın kalibrasyon destesi: hedef "ref" ise ilerleme simülasyonunun referans destesi
   * (yoksa başlangıç destesi), değilse preset deste.
   */
  huntTargetDeck(huntId: string, day?: number): CardDef[]
  starterDeck(): CardDef[]
}

export class ContentError extends Error {}

/** Hedef destesi bu değerse kalibrasyon ilerleme simülasyonunun referans destesini kullanır. */
export const REF_DECK = 'ref'

/** Kuşatmanın n. günü (0 tabanlı, n > 0) için huntDecks anahtarı. */
export function refDayKey(huntId: string, day: number): string {
  return `${huntId}@${day}`
}

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
  const decks = listOf(DeckPresetSchema, raw.decks, 'decks', 'decks.json')
  const economy = parse(EconomySchema, raw.economy, 'economy.json')
  const hunts = listOf(HuntSchema, raw.hunts, 'hunts', 'hunts.json')
  const regions = listOf(RegionSchema, raw.regions, 'regions', 'regions.json')
  const world = parse(WorldSchema, (raw.regions as { world?: unknown })?.world, 'regions.json → world')
  const starter = parse(StarterSchema, raw.starter, 'starter.json')
  const targets = parse(BalanceTargetsSchema, raw.targets, 'balance-targets.json')
  const art = parse(ArtConfigSchema, raw.art, 'art.json')
  const huntBalance = parse(CalibratedHuntsSchema, raw.huntBalance, 'generated/hunts.json')

  const cardById = new Map(cards.map((c) => [c.id, c]))
  const tamerById = new Map(tamers.map((t) => [t.id, t]))
  const weatherById = new Map(weather.map((w) => [w.id, w]))
  const deckById = new Map(decks.map((d) => [d.id, d]))
  const huntById = new Map(hunts.map((h) => [h.id, h]))
  const regionById = new Map(regions.map((r) => [r.id, r]))

  const db: ContentDB = {
    cards,
    cardById,
    packPool: cards.filter((c) => ['pack', 'starter'].includes(c.source ?? 'pack')),
    tamers,
    tamerById,
    weather,
    weatherById,
    decks,
    deckById,
    economy,
    hunts,
    huntById,
    regions,
    regionById,
    world,
    starter,
    targets,
    art,
    huntBalance,
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
    hunt(id) {
      const h = huntById.get(id)
      if (!h) throw new ContentError(`Bilinmeyen av: ${id}`)
      return h
    },
    region(id) {
      const r = regionById.get(id)
      if (!r) throw new ContentError(`Bilinmeyen bölge: ${id}`)
      return r
    },
    regionHunts(regionId) {
      return hunts.filter((h) => h.region === regionId)
    },
    regionFinal(regionId) {
      return hunts.find((h) => h.region === regionId && h.tier === 'final')
    },
    huntHp(id) {
      return huntBalance.hp[id] ?? db.hunt(id).hp
    },
    huntRevive(id) {
      return db.scaledHunt(id).revive
    },
    scaledHunt(id) {
      return scaleHunt(db.hunt(id), db.huntHp(id))
    },
    deckCards(id) {
      const d = deckById.get(id)
      if (!d) throw new ContentError(`Bilinmeyen deste: ${id}`)
      return d.cards.flatMap(({ card, count }) => Array.from({ length: count }, () => db.card(card)))
    },
    starterDeck() {
      return db.deckCards(starter.deck)
    },
    huntTargetDeck(huntId, day = 0) {
      const h = db.hunt(huntId)
      if (h.target?.deck !== REF_DECK) return db.deckCards(h.siege?.decks?.[day] ?? h.target?.deck ?? starter.deck)
      const key = huntBalance.huntDecks?.[day ? refDayKey(huntId, day) : huntId] ?? huntBalance.huntDecks?.[huntId]
      const list = key ? huntBalance.refDecks?.[key] : undefined
      if (!list) return db.starterDeck()
      return list.flatMap(({ card, count }) => Array.from({ length: count }, () => db.card(card)))
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
        if (e.op === 'guard' && !/Koruma/.test(c.text)) warn(`${c.id}: Koruma üretiyor ama kart metninde yazmıyor`)
      }
    }
  }

  if (!db.tamerById.get(db.starter.tamer)) err(`starter.json: Tamer "${db.starter.tamer}" yok`)
  if (!db.deckById.get(db.starter.deck)) err(`starter.json: deste "${db.starter.deck}" decks.json'da yok`)
  dup(db.decks.map((d) => d.id), 'Deste')
  for (const d of db.decks) {
    const tamer = db.tamerById.get(d.tamer)
    if (!tamer) err(`decks.json: ${d.id} Tamer "${d.tamer}" yok`)
    let size = 0
    for (const { card, count } of d.cards) {
      const c = db.cardById.get(card)
      if (!c) {
        err(`decks.json: ${d.id} kart "${card}" yok`)
        continue
      }
      size += count
      if (count > db.economy.rarities[c.rarity].deckLimit) err(`decks.json: ${d.id} ${card} deste sınırını aşıyor`)
    }
    if (tamer && size !== tamer.deckSize) err(`decks.json: ${d.id} ${size} kart, ${tamer.name} ${tamer.deckSize} ister`)
  }

  if (!db.economy.packs.some((p) => p.id === db.economy.basePack))
    err(`economy.json: basePack "${db.economy.basePack}" paketlerde yok`)
  for (const p of db.economy.packs) {
    const sum = Object.values(p.odds).reduce((a, b) => a + (b ?? 0), 0)
    if (Math.abs(sum - 100) > 0.01) warn(`economy.json: ${p.id} oranları toplamı ${sum} (100 olmalı)`)
    if ((p.odds.mythic ?? 0) > 0 || (p.odds.ancient ?? 0) > 0) warn(`economy.json: ${p.id} Mythic/Ancient çıkarıyor (GDD v0.8: yalnızca avla)`)
  }

  dup(db.hunts.map((h) => h.id), 'Av')
  dup(db.regions.map((r) => r.id), 'Bölge')
  const weatherIds = (ids: readonly string[], where: string) => {
    for (const w of ids) if (!db.weatherById.has(w)) err(`${where}: hava "${w}" yok`)
  }
  for (const r of db.regions) {
    const [ax, ay, aw, ah] = r.area
    if (ax + aw > db.world.size[0] || ay + ah > db.world.size[1]) err(`regions.json: ${r.id} alanı dünyanın dışına taşıyor`)
    if (r.unlock.kind === 'finals')
      for (const id of r.unlock.regions) {
        const other = db.regionById.get(id)
        if (!other) err(`regions.json: ${r.id} kilidi bilinmeyen bölgeye bağlı: ${id}`)
        else if (other.level >= r.level) warn(`regions.json: ${r.id} (seviye ${r.level}) kendinden düşük olmayan ${id} bölgesine bağlı`)
      }
    if (!db.regionFinal(r.id)) err(`regions.json: ${r.id} bölgesinde Final avı yok (sonraki bölgeler açılamaz)`)
    weatherIds(Object.keys(r.climate), `regions.json: ${r.id} iklimi`)
    if (!Object.values(r.climate).some((w) => w > 0)) err(`regions.json: ${r.id} ikliminde hava yok`)
    if (!db.regionHunts(r.id).length) warn(`regions.json: ${r.id} bölgesinde av yok`)
    for (const p of r.map.paths)
      for (const end of p) if (end !== 'camp' && db.huntById.get(end)?.region !== r.id) err(`regions.json: ${r.id} patikası bölgede olmayan bir ava gidiyor: ${end}`)
  }
  const huntCards = new Set<string>()
  for (const h of db.hunts) {
    const where = `hunts.json: ${h.id}`
    const card = db.cardById.get(h.card)
    if (!card) err(`${where} kart "${h.card}" yok`)
    if (huntCards.has(h.card)) err(`${where} kart "${h.card}" başka bir avda da var`)
    huntCards.add(h.card)
    if (!db.regionById.has(h.region)) err(`${where} bölge "${h.region}" yok`)
    if (h.weather) weatherIds([h.weather], where)
    if (h.appearsIn) weatherIds(h.appearsIn, `${where} appearsIn`)
    if (h.siege) {
      weatherIds(h.siege.weathers, `${where} siege`)
      for (const d of h.siege.decks ?? []) if (!db.deckById.has(d)) err(`${where} siege destesi "${d}" yok`)
      if (h.siege.decks && h.siege.decks.length !== h.siege.weathers.length) err(`${where} siege: deste ve hava sayısı eşit olmalı`)
    }
    for (const t of [...(h.traits ?? []), ...(h.phases ?? []).flatMap((p) => p.traits ?? [])])
      if (t.kind === 'armor') weatherIds(t.offIn ?? [], `${where} zırh`)
    if (h.unlock.kind === 'after' && !db.huntById.has(h.unlock.hunt)) err(`${where} kilit avı "${h.unlock.hunt}" yok`)
    if (h.target) {
      if (h.target.deck !== REF_DECK && !db.deckById.has(h.target.deck)) err(`${where} hedef destesi "${h.target.deck}" yok`)
      weatherIds([h.target.weather], `${where} hedef`)
    } else warn(`${where} kalibrasyon hedefi yok: can elle ayarlı`)
    if (card && ['mythic', 'ancient'].includes(card.rarity) && (card.source ?? 'pack') === 'pack')
      warn(`${where}: ${card.rarity} kart paket havuzunda (GDD v0.8: yalnızca avla)`)
  }
  const noRef = db.hunts.filter((h) => h.target?.deck === REF_DECK && !db.huntBalance.huntDecks?.[h.id])
  if (noRef.length) warn(`${noRef.length} avın referans destesi henüz üretilmedi (başlangıç destesi kullanılıyor). \`npm run sim -- calibrate\` çalıştır.`)
  const missing = db.hunts.filter((h) => h.target && !db.huntBalance.hp[h.id])
  if (missing.length)
    warn(`generated/hunts.json ${missing.length} avın kalibre canını içermiyor (tasarım canı kullanılıyor). \`npm run sim -- calibrate\` çalıştır.`)
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
