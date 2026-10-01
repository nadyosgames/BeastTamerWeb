import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { FILE_SCHEMAS } from '../../src/content/schema.ts'
import { PATHS, ROOT } from '../art/lib.ts'

/**
 * content/schema/*.schema.json üretir. JSON dosyalarının başındaki "$schema" alanı bunlara
 * işaret eder: VS Code'da kart yazarken otomatik tamamlama ve anında hata gösterimi.
 */
const dir = path.join(PATHS.content, 'schema')
await mkdir(dir, { recursive: true })
for (const [name, schema] of Object.entries(FILE_SCHEMAS)) {
  const json = z.toJSONSchema(schema, { unrepresentable: 'any', io: 'input' }) as Record<string, unknown>
  // Dosyaların başındaki "$schema" alanına izin ver.
  if (json.type === 'object') {
    json.properties = { $schema: { type: 'string' }, ...(json.properties as object) }
    json.additionalProperties = false
  }
  await writeFile(path.join(dir, `${name}.schema.json`), JSON.stringify(json, null, 2) + '\n')
}
console.log(`${Object.keys(FILE_SCHEMAS).length} şema → ${path.relative(ROOT, dir)}/`)
