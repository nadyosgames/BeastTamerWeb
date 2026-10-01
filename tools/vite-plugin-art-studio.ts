import type { IncomingMessage } from 'node:http'
import path from 'node:path'
import type { Plugin } from 'vite'
import { buildWebAll, hasMaster, IMAGE_EXTS, loadAssets, loadContentFromDisk, processImage } from '../scripts/art/lib.ts'

/**
 * Art pipeline Vite eklentisi: dev ve build başında master'lardan eksik/eski web sürümlerini üretir;
 * dev sunucusunda ayrıca Art Studio uç noktalarını açar.
 * Tarayıcıdaki Art Studio ekranı ChatGPT'den indirilen görseli buraya POST eder,
 * görsel master + web sürümlerine işlenir ve Vite HMR ile kart anında güncellenir.
 *
 *   GET  /__art/status                      → varlık listesi + master var mı
 *   POST /__art/upload?kind=cards&id=xxx    → gövde: ham görsel baytları
 */
export function artStudio(): Plugin {
  return {
    name: 'canavar-art-studio',
    async buildStart() {
      try {
        const db = await loadContentFromDisk()
        const n = await buildWebAll(db)
        if (n) this.info(`art: ${n} görselin web sürümü üretildi`)
      } catch (e) {
        this.warn(`art: web sürümleri üretilemedi: ${(e as Error).message}`)
      }
    },
    configureServer(server) {
      server.middlewares.use('/__art/status', async (_req, res) => {
        try {
          const { assets } = await loadAssets()
          json(res, 200, assets.map((a) => ({ ...a, hasMaster: hasMaster(a) })))
        } catch (e) {
          json(res, 500, { error: (e as Error).message })
        }
      })

      server.middlewares.use('/__art/upload', async (req, res) => {
        if (req.method !== 'POST') return json(res, 405, { error: 'POST bekleniyor' })
        try {
          const url = new URL(req.url ?? '', 'http://x')
          const kind = url.searchParams.get('kind')
          const id = url.searchParams.get('id')
          const name = url.searchParams.get('name') ?? ''
          const { db, assets } = await loadAssets()
          const asset = assets.find((a) => a.kind === kind && a.id === id)
          if (!asset) return json(res, 404, { error: `Varlık bulunamadı: ${kind}/${id}` })
          const ext = IMAGE_EXTS.includes(path.extname(name).toLowerCase()) ? path.extname(name).toLowerCase() : '.png'
          const result = await processImage(await readBody(req), asset, db, ext)
          server.config.logger.info(`art: ${result.key} işlendi (${result.sourceSize.width}×${result.sourceSize.height})`)
          json(res, 200, result)
        } catch (e) {
          json(res, 500, { error: (e as Error).message })
        }
      })
    },
  }
}

function readBody(req: IncomingMessage, limit = 30 * 1024 * 1024): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > limit) reject(new Error('Dosya çok büyük'))
      else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function json(res: import('node:http').ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}
