import { parentPort, workerData } from 'node:worker_threads'
import { runCalibrateTask, type CalibrateTask } from '../../src/sim/calibrate-world.ts'
import { simulateWorld, type WorldRunOptions } from '../../src/sim/progression.ts'
import { loadContentFromDisk } from '../art/lib.ts'

/** pool.ts işçisi: içeriği bir kez yükler, gelen görevi çalıştırıp sonucu döner. */
const db = await loadContentFromDisk({ set: (workerData as { set?: string } | undefined)?.set })

parentPort!.on('message', (msg: { kind: 'world'; opts: WorldRunOptions } | { kind: 'calibrate'; task: CalibrateTask }) => {
  try {
    const result = msg.kind === 'world' ? simulateWorld(db, msg.opts) : runCalibrateTask(db, msg.task)
    parentPort!.postMessage({ ok: true, result })
  } catch (e) {
    parentPort!.postMessage({ ok: false, error: e instanceof Error ? `${e.message}\n${e.stack}` : String(e) })
  }
})
