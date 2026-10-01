import { parseArgs } from 'node:util'
import { checkContent } from '../../src/content/index.ts'
import { loadContentFromDisk } from '../art/lib.ts'

/**
 * İçerik doğrulama: şema + çapraz kontroller. Hata varsa çıkış kodu 1 (build'i durdurur).
 *   npm run content:check
 *   npm run content:check -- --set v1     (öneri setini doğrula)
 */
const { values } = parseArgs({ options: { set: { type: 'string' } } })
try {
  const db = await loadContentFromDisk({ set: values.set })
  const problems = checkContent(db)
  for (const p of problems) console.log(`${p.level === 'error' ? '✗' : '⚠'} ${p.message}`)
  console.log(
    `İçerik geçerli${values.set ? ` (öneri seti ${values.set})` : ''}: ${db.cards.length} kart, ${db.tamers.length} Tamer, ${db.weather.length} hava, ${db.decks.length} deste.`,
  )
} catch (e) {
  console.error((e as Error).message)
  process.exit(1)
}
