import { spawn } from 'node:child_process'
import { afterAll, describe, expect, it } from 'vitest'
import { gracefulKill, isProcessRunning, runSync } from '../src/workspace/process'

describe('runSync', () => {
  it('captures stdout from a successful command', () => {
    const result = runSync('echo hello')
    expect(result.ok).toBe(true)
    expect(result.output).toBe('hello')
  })

  it('returns ok=false for failing commands', () => {
    const result = runSync('false')
    expect(result.ok).toBe(false)
  })

  it('respects timeout', () => {
    const result = runSync('sleep 10', { timeout: 100 })
    expect(result.ok).toBe(false)
  })
})

describe('gracefulKill', () => {
  // Uniquely-named command so pgrep can find it without collision with other
  // shell tasks on the runner.
  const TAG = `polyq-test-gracefulkill-${process.pid}-${Date.now()}`
  const toCleanUp: Array<() => void> = []

  afterAll(() => {
    for (const c of toCleanUp) {
      try {
        c()
      } catch {
        /* already dead */
      }
    }
  })

  function spawnSleeper(trapBehaviour: 'cooperate' | 'ignore-term'): void {
    // A shell loop we can find via pgrep -f <TAG>. Either exits cleanly on
    // SIGTERM (cooperate) or ignores it so the SIGKILL escalation kicks in.
    const trap = trapBehaviour === 'ignore-term' ? 'trap "" TERM; ' : 'trap "exit 0" TERM; '
    const cmd = `${trap} echo ${TAG}; while true; do sleep 1; done`
    const child = spawn('bash', ['-c', cmd], { detached: true, stdio: 'ignore' })
    child.unref()
    toCleanUp.push(() => {
      try {
        process.kill(child.pid!, 'SIGKILL')
      } catch {
        /* already dead */
      }
    })
  }

  it('returns false when nothing matches the pattern', async () => {
    const result = await gracefulKill('definitely-not-a-process-xyz-nope')
    expect(result).toBe(false)
  })

  it('stops a cooperating process with SIGTERM alone', async () => {
    spawnSleeper('cooperate')
    // Give the shell a moment to register the trap
    await new Promise(r => setTimeout(r, 150))
    expect(isProcessRunning(TAG)).toBe(true)

    const start = Date.now()
    const result = await gracefulKill(TAG, { timeoutMs: 2000, pollIntervalMs: 100 })
    const elapsed = Date.now() - start

    expect(result).toBe(true)
    expect(isProcessRunning(TAG)).toBe(false)
    // Should exit well before the 2s timeout, since SIGTERM was honoured.
    expect(elapsed).toBeLessThan(1500)
  })

  it('escalates to SIGKILL when SIGTERM is ignored', async () => {
    spawnSleeper('ignore-term')
    await new Promise(r => setTimeout(r, 150))
    expect(isProcessRunning(TAG)).toBe(true)

    const result = await gracefulKill(TAG, { timeoutMs: 400, pollIntervalMs: 100 })
    expect(result).toBe(true)
    expect(isProcessRunning(TAG)).toBe(false)
  })
})
