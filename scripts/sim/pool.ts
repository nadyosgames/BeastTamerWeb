import os from 'node:os'
import { Worker } from 'node:worker_threads'
import type { CalibrateTask, WorldTaskRunner } from '../../src/sim/calibrate-world.ts'
import type { HuntCalibration } from '../../src/sim/hunt.ts'
import type { WorldRun, WorldRunOptions } from '../../src/sim/progression.ts'

/**
 * Simülasyon iş parçacığı havuzu: dünya oyunlarını ve av kalibrasyonlarını çekirdeklere dağıtır.
 * Her işçi içeriği diskten kendisi yükler (worker.ts); görev ve sonuçlar düz JSON'dur.
 */
type Task = { kind: 'world'; opts: WorldRunOptions } | { kind: 'calibrate'; task: CalibrateTask }

export function workerPool(opts: { set?: string; threads?: number } = {}): WorldTaskRunner & { close(): Promise<void>; size: number } {
  const size = Math.max(1, opts.threads ?? Math.min(15, os.availableParallelism() - 1))
  const workers: Worker[] = []
  const idle: Worker[] = []
  const queue: { task: Task; resolve: (v: unknown) => void; reject: (e: unknown) => void }[] = []
  const busy = new Map<Worker, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>()

  const pump = () => {
    while (idle.length && queue.length) {
      const w = idle.pop()!
      const job = queue.shift()!
      busy.set(w, job)
      w.postMessage(job.task)
    }
  }

  for (let i = 0; i < size; i++) {
    const w = new Worker(new URL('./worker.ts', import.meta.url), { execArgv: ['--import', 'tsx'], workerData: { set: opts.set } })
    w.on('message', (msg: { ok: boolean; result?: unknown; error?: string }) => {
      const job = busy.get(w)
      busy.delete(w)
      idle.push(w)
      if (job) {
        if (msg.ok) job.resolve(msg.result)
        else job.reject(new Error(msg.error))
      }
      pump()
    })
    w.on('error', (e) => {
      const job = busy.get(w)
      busy.delete(w)
      job?.reject(e)
    })
    workers.push(w)
    idle.push(w)
  }

  const run = <T>(task: Task) =>
    new Promise<T>((resolve, reject) => {
      queue.push({ task, resolve: resolve as (v: unknown) => void, reject })
      pump()
    })

  return {
    size,
    world: (tasks) => Promise.all(tasks.map((o) => run<WorldRun>({ kind: 'world', opts: o }))),
    calibrate: (tasks) => Promise.all(tasks.map((t) => run<HuntCalibration | null>({ kind: 'calibrate', task: t }))),
    close: async () => {
      await Promise.all(workers.map((w) => w.terminate()))
    },
  }
}
