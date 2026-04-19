import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { watch } from 'chokidar'
import { join } from 'pathe'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

/**
 * chokidar@5 is a major bump over 4 and our schema-sync plugin's HMR loop is
 * the hottest consumer. This smoke test runs real fs events against a real
 * chokidar watcher so a surprise API/event-name change shows up here first
 * rather than when a user opens a Vite dev server.
 *
 * Each test spins up a temp watcher, waits for the event, and closes. No
 * global state; safe to run in parallel.
 */

const workdirs: string[] = []

beforeEach(() => {
  // Fresh dir per test avoids cross-contamination from stale events.
  const dir = mkdtempSync(join(tmpdir(), 'polyq-chokidar-'))
  workdirs.push(dir)
})

afterEach(() => {
  while (workdirs.length > 0) {
    const dir = workdirs.pop()!
    rmSync(dir, { recursive: true, force: true })
  }
})

async function waitForEvent(
  w: ReturnType<typeof watch>,
  event: 'add' | 'change' | 'unlink',
  // 5s — chokidar's debounce is 100ms, but under parallel vitest load this
  // file had a flake at 2s. Generous timeout beats intermittent red CI.
  timeoutMs = 5000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`chokidar '${event}' timeout`)), timeoutMs)
    w.once(event, (path: string) => {
      clearTimeout(timer)
      resolve(path)
    })
  })
}

// Real fs-watch tests race with OS-level inotify/kqueue throttling under
// parallel vitest load — retry up to twice so a transient miss doesn't
// turn into a red CI build.
describe('chokidar@5 — surface smoke', { retry: 2 }, () => {
  it("emits 'add' when a new file appears", async () => {
    const dir = workdirs[workdirs.length - 1]!
    const w = watch(dir, { ignoreInitial: true })
    try {
      // Wait for chokidar to attach before mutating — otherwise the event can
      // fire before we subscribe.
      await new Promise<void>(r => {
        w.once('ready', () => r())
      })
      const addedPromise = waitForEvent(w, 'add')
      writeFileSync(join(dir, 'foo.json'), '{}', 'utf-8')
      const path = await addedPromise
      expect(path.endsWith('foo.json')).toBe(true)
    } finally {
      await w.close()
    }
  })

  it("emits 'change' when a watched file is modified", async () => {
    const dir = workdirs[workdirs.length - 1]!
    const target = join(dir, 'foo.json')
    writeFileSync(target, '{"v":1}', 'utf-8')

    // Watching the directory (not the single file) is how our schema-sync
    // plugin uses chokidar in src/adapters/vite/schema-sync.ts — this
    // matches that usage and is more reliable across platforms.
    const w = watch(dir, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 25 },
    })
    try {
      await new Promise<void>(r => {
        w.once('ready', () => r())
      })
      const changedPromise = waitForEvent(w, 'change', 4000)
      writeFileSync(target, '{"v":2}', 'utf-8')
      const path = await changedPromise
      expect(path.endsWith('foo.json')).toBe(true)
    } finally {
      await w.close()
    }
  })

  it('close() resolves and stops emitting', async () => {
    const dir = workdirs[workdirs.length - 1]!
    const w = watch(dir, { ignoreInitial: true })
    await w.close()
    // If close worked, subsequent file writes produce no events.
    let leaked = false
    w.on('add', () => {
      leaked = true
    })
    writeFileSync(join(dir, 'post-close.json'), '{}', 'utf-8')
    await new Promise(r => setTimeout(r, 200))
    expect(leaked).toBe(false)
  })
})
