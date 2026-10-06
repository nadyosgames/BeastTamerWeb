import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { listArtAssets, type ArtAssetRef } from '../../src/art/prompts.ts'
import { buildContent, type ArtKind, type ContentDB } from '../../src/content/index.ts'

/**
 * Görsel pipeline'ının dosya tarafı (yalnızca Node).
 *
 *   ChatGPT ──indir──▶ art/inbox/<kind>/<id>.png
 *        art:ingest ──▶ art/originals/  (ham dosya arşivi, git dışı)
 *                   ──▶ art/source/<kind>/<id>.png   (MASTER, git'te: LFS)
 *                   ──▶ src/generated/art/<kind>/<id>.webp + @thumb (web, git dışı)
 *   art:export-unity ─▶ export/unity/Assets/...      (Unity'ye kopyalanacak paket)
 *
 * Master tek gerçek kaynaktır; web ve Unity çıktıları her zaman ondan yeniden üretilebilir.
 */

export const ROOT = path.resolve(import.meta.dirname, '../..')
export const PATHS = {
  content: path.join(ROOT, 'content'),
  inbox: path.join(ROOT, 'art/inbox'),
  originals: path.join(ROOT, 'art/originals'),
  source: path.join(ROOT, 'art/source'),
  prompts: path.join(ROOT, 'art/prompts'),
  styleRef: path.join(ROOT, 'art/style-ref'),
  web: path.join(ROOT, 'src/generated/art'),
  unity: path.join(ROOT, 'export/unity'),
}

export const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp']
export const ART_KINDS: ArtKind[] = ['cards', 'tamers', 'weather']

/**
 * İçeriği her seferinde diskten okur (dev sunucusu açıkken JSON değişebilir).
 * `set` verilirse content/proposals/<set>/cards.json (ve varsa decks.json) kullanılır.
 */
export async function loadContentFromDisk(opts: { set?: string } = {}): Promise<ContentDB> {
  const read = async (f: string) => JSON.parse(await readFile(path.join(PATHS.content, f), 'utf8'))
  const setFile = (f: string) => (opts.set ? path.join('proposals', opts.set, f) : f)
  const setDir = opts.set ? path.join(PATHS.content, 'proposals', opts.set) : null
  if (setDir && !existsSync(path.join(setDir, 'cards.json'))) throw new Error(`Öneri seti bulunamadı: ${setDir}`)
  return buildContent({
    cards: await read(setFile('cards.json')),
    tamers: await read('tamers.json'),
    weather: await read('weather.json'),
    decks: await read(setDir && existsSync(path.join(setDir, 'decks.json')) ? setFile('decks.json') : 'decks.json'),
    economy: await read('economy.json'),
    hunts: await read('hunts.json'),
    regions: await read('regions.json'),
    starter: await read('starter.json'),
    targets: await read('balance-targets.json'),
    art: await read('art.json'),
    huntBalance: await read('generated/hunts.json'),
  })
}

export async function loadAssets(): Promise<{ db: ContentDB; assets: ArtAssetRef[] }> {
  const db = await loadContentFromDisk()
  return { db, assets: listArtAssets(db) }
}

export const masterPath = (a: { kind: string; id: string }) => path.join(PATHS.source, a.kind, `${a.id}.png`)
export const webPath = (a: { kind: string; id: string }, suffix: string) =>
  path.join(PATHS.web, a.kind, `${a.id}${suffix}.webp`)

export function hasMaster(a: { kind: string; id: string }): boolean {
  return existsSync(masterPath(a))
}

function stamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
}

export interface ProcessResult {
  key: string
  master: string
  web: string[]
  width: number
  height: number
  sourceSize: { width: number; height: number }
}

/**
 * Ham görseli (ChatGPT çıktısı) master'a çevirir: oran dışıysa ortadan kırpar,
 * hedef boyuta ölçekler, PNG olarak yazar, ham dosyayı arşivler ve web sürümlerini üretir.
 */
export async function processImage(
  input: Buffer,
  asset: { kind: ArtKind; id: string },
  db: ContentDB,
  originalExt = '.png',
): Promise<ProcessResult> {
  const cfg = db.art.kinds[asset.kind]
  const meta = await sharp(input).metadata()
  if (!meta.width || !meta.height) throw new Error('Görsel okunamadı')

  const origDir = path.join(PATHS.originals, asset.kind)
  await mkdir(origDir, { recursive: true })
  await writeFile(path.join(origDir, `${asset.id}_${stamp()}${originalExt}`), input)

  const master = masterPath(asset)
  await mkdir(path.dirname(master), { recursive: true })
  await sharp(input)
    .rotate()
    .resize(cfg.master.width, cfg.master.height, { fit: 'cover', position: 'centre' })
    .png({ compressionLevel: 9 })
    .toFile(master)

  const web = await buildWeb(asset, db)
  return {
    key: `${asset.kind}/${asset.id}`,
    master,
    web,
    width: cfg.master.width,
    height: cfg.master.height,
    sourceSize: { width: meta.width, height: meta.height },
  }
}

export async function buildWeb(asset: { kind: ArtKind; id: string }, db: ContentDB): Promise<string[]> {
  const cfg = db.art.kinds[asset.kind]
  const out: string[] = []
  for (const v of cfg.web) {
    const file = webPath(asset, v.suffix)
    await mkdir(path.dirname(file), { recursive: true })
    await sharp(masterPath(asset)).resize({ width: v.width }).webp({ quality: 86 }).toFile(file)
    out.push(file)
  }
  return out
}

/** Master'dan web sürümlerini yalnızca eskiyse yeniden üretir (npm run dev öncesi). */
export async function buildWebAll(db: ContentDB, force = false): Promise<number> {
  let built = 0
  for (const kind of ART_KINDS) {
    const dir = path.join(PATHS.source, kind)
    if (!existsSync(dir)) continue
    for (const f of await readdir(dir)) {
      if (!f.endsWith('.png')) continue
      const asset = { kind, id: f.slice(0, -4) }
      if (force || (await isWebStale(asset, db))) {
        await buildWeb(asset, db)
        built++
      }
    }
  }
  return built
}

/** Arayüz sahneleri ve paket illüstrasyonları da master PNG'lerden yeniden üretilebilir. */
export async function buildUiAll(force = false): Promise<number> {
  const sourceDir = path.join(PATHS.source, 'ui')
  const webDir = path.join(ROOT, 'public/art/ui')
  if (!existsSync(sourceDir)) return 0
  await mkdir(webDir, { recursive: true })
  let built = 0
  for (const file of await readdir(sourceDir)) {
    if (!file.endsWith('.png')) continue
    const source = path.join(sourceDir, file)
    const target = path.join(webDir, `${file.slice(0, -4)}.webp`)
    if (!force && existsSync(target) && (await stat(target)).mtimeMs >= (await stat(source)).mtimeMs) continue
    const scene = file === 'library.png' || file === 'board.png'
    const image = sharp(source).rotate()
    if (scene) image.resize(1920, 1080, { fit: 'cover' })
    else image.resize({ width: 640 })
    await image.webp({ quality: scene ? 88 : 86 }).toFile(target)
    built++
  }
  return built
}

async function isWebStale(asset: { kind: ArtKind; id: string }, db: ContentDB): Promise<boolean> {
  const srcTime = (await stat(masterPath(asset))).mtimeMs
  for (const v of db.art.kinds[asset.kind].web) {
    const w = webPath(asset, v.suffix)
    if (!existsSync(w) || (await stat(w)).mtimeMs < srcTime) return true
  }
  return false
}

export async function fileHash(file: string): Promise<string> {
  return createHash('sha1').update(await readFile(file)).digest('hex').slice(0, 12)
}

/** Inbox'taki dosyayı bir varlığa eşler: "<kind>/<id>.png" ya da kökte benzersiz "<id>.png". */
export function matchInboxFile(rel: string, assets: ArtAssetRef[]): ArtAssetRef | undefined {
  const parts = rel.split(/[\\/]/)
  const base = parts[parts.length - 1]
  const id = base
    .slice(0, base.length - path.extname(base).length)
    .toLowerCase()
    .replace(/[@_-]v\d+$/, '')
  if (parts.length >= 2) {
    const kind = parts[parts.length - 2]
    return assets.find((a) => a.kind === kind && a.id === id)
  }
  const found = assets.filter((a) => a.id === id)
  return found.length === 1 ? found[0] : undefined
}
