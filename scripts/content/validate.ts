import { checkContent } from '../../src/content/index.ts'
import { loadContentFromDisk } from '../art/lib.ts'

/** İçerik doğrulama: şema + çapraz kontroller. Hata varsa çıkış kodu 1 (build'i durdurur). */
try {
  const db = await loadContentFromDisk()
  const problems = checkContent(db)
  for (const p of problems) console.log(`${p.level === 'error' ? '✗' : '⚠'} ${p.message}`)
  console.log(`İçerik geçerli: ${db.cards.length} kart, ${db.tamers.length} Tamer, ${db.weather.length} hava.`)
} catch (e) {
  console.error((e as Error).message)
  process.exit(1)
}
