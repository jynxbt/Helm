// Mock-based coverage for the platform-branching parts of `process.ts`.
// Unlike `process.test.ts` (which spawns real shell processes), these tests
// stub `node:child_process.execSync` so we can verify the exact commands
// constructed for both POSIX and Windows paths. Gives us regression cover
// on the Windows branch without needing a Windows runner.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type ExecCall = { cmd: string }
const execCalls: ExecCall[] = []
const execResponses: Array<{ output?: string; throwErr?: boolean }> = []

// Only mock what `process.ts` imports from node:child_process. Leave the
// rest of the module alone — fresh `vi.fn` per call avoids closure-stale
// state between re-imports under `vi.resetModules()`.
const execSyncMock = vi.fn((cmd: string) => {
  execCalls.push({ cmd })
  const next = execResponses.shift()
  if (next?.throwErr) {
    const err = new Error('execSync fake failure') as Error & { stderr?: Buffer }
    err.stderr = Buffer.from('')
    throw err
  }
  // runSync calls execSync with `encoding: 'utf-8'`, so execSync returns a
  // string (not a Buffer). Returning a Buffer here would surface as a crash
  // when runSync calls `.trim()`.
  return next?.output ?? ''
})

// Plain factory — no `importActual`. Only exports what process.ts imports.
vi.mock('node:child_process', () => ({ execSync: execSyncMock }))

const originalPlatform = process.platform
function setPlatform(p: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: p, configurable: true })
}

beforeEach(() => {
  execCalls.length = 0
  execResponses.length = 0
})

afterEach(() => {
  setPlatform(originalPlatform)
})

// `isWindows()` in process.ts is evaluated per call, so tests just swap
// `process.platform` before each invocation — no `vi.resetModules()` needed.
const mod = import('../src/workspace/process')
async function loadFresh() {
  return mod
}

describe('killByPattern — platform branches', () => {
  it('POSIX: pkill -f "<pattern>" (default SIGTERM)', async () => {
    setPlatform('linux')
    const { killByPattern } = await loadFresh()
    execResponses.push({ output: '' })
    const ok = killByPattern('nuxt dev')
    expect(ok).toBe(true)
    // Note the double space: the template is `pkill ${flag} -f "${pattern}"`
    // which produces `pkill  -f ...` when flag is empty.
    expect(execCalls[0]!.cmd).toBe('pkill  -f "nuxt dev"')
  })

  it('POSIX: pkill -9 -f "<pattern>" for SIGKILL', async () => {
    setPlatform('darwin')
    const { killByPattern } = await loadFresh()
    execResponses.push({ output: '' })
    killByPattern('vite', 'SIGKILL')
    expect(execCalls[0]!.cmd).toBe('pkill -9 -f "vite"')
  })

  it('Windows: taskkill /FI "IMAGENAME eq X*"', async () => {
    setPlatform('win32')
    const { killByPattern } = await loadFresh()
    execResponses.push({ output: '' })
    killByPattern('solana-test-validator')
    expect(execCalls[0]!.cmd).toBe('taskkill  /FI "IMAGENAME eq solana-test-validator*"')
  })

  it('Windows: taskkill /F /FI ... for SIGKILL', async () => {
    setPlatform('win32')
    const { killByPattern } = await loadFresh()
    execResponses.push({ output: '' })
    killByPattern('anvil', 'SIGKILL')
    expect(execCalls[0]!.cmd).toBe('taskkill /F /FI "IMAGENAME eq anvil*"')
  })
})

describe('isProcessRunning — platform branches', () => {
  it('POSIX: pgrep -f "<pattern>" returns true when exit=0', async () => {
    setPlatform('linux')
    const { isProcessRunning } = await loadFresh()
    execResponses.push({ output: '12345' })
    expect(isProcessRunning('vite')).toBe(true)
    expect(execCalls[0]!.cmd).toBe('pgrep -f "vite"')
  })

  it('POSIX: returns false when pgrep exits non-zero', async () => {
    setPlatform('linux')
    const { isProcessRunning } = await loadFresh()
    execResponses.push({ throwErr: true })
    expect(isProcessRunning('absent')).toBe(false)
  })

  it('Windows: returns false for "INFO: No tasks..." stdout', async () => {
    setPlatform('win32')
    const { isProcessRunning } = await loadFresh()
    execResponses.push({ output: 'INFO: No tasks are running which match the specified criteria.' })
    expect(isProcessRunning('missing')).toBe(false)
  })

  it('Windows: returns true when tasklist lists a matching process', async () => {
    setPlatform('win32')
    const { isProcessRunning } = await loadFresh()
    execResponses.push({
      output: 'anvil.exe                  1234 Console                    1     25,000 K',
    })
    expect(isProcessRunning('anvil')).toBe(true)
  })
})

describe('killPort — platform branches', () => {
  it('POSIX: parses lsof -t newline-separated PIDs', async () => {
    setPlatform('linux')
    const { killPort } = await loadFresh()
    execResponses.push({ output: '4321\n9876\n' })
    // process.kill is called per pid — stub it so the test doesn't
    // accidentally signal a real process.
    const origKill = process.kill
    const killed: number[] = []
    process.kill = ((pid: number) => {
      killed.push(pid)
      return true
    }) as typeof process.kill
    try {
      expect(killPort(5432)).toBe(true)
      expect(killed).toEqual([4321, 9876])
    } finally {
      process.kill = origKill
    }
  })

  it('POSIX: returns false when lsof outputs nothing', async () => {
    setPlatform('linux')
    const { killPort } = await loadFresh()
    execResponses.push({ throwErr: true })
    expect(killPort(5432)).toBe(false)
  })

  it('Windows: parses TCP rows of `netstat -ano` ending with :<port>', async () => {
    setPlatform('win32')
    const { killPort } = await loadFresh()
    const netstat = [
      '',
      'Active Connections',
      '',
      '  Proto  Local Address          Foreign Address        State           PID',
      '  TCP    0.0.0.0:5432           0.0.0.0:0              LISTENING       1111',
      '  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING       2222',
      '  TCP    [::]:5432              [::]:0                 LISTENING       3333',
      '',
    ].join('\r\n')
    execResponses.push({ output: netstat })

    const killed: number[] = []
    const origKill = process.kill
    process.kill = ((pid: number) => {
      killed.push(pid)
      return true
    }) as typeof process.kill
    try {
      expect(killPort(5432)).toBe(true)
      // Both v4 and v6 listeners on :5432 picked up, :8080 ignored.
      expect(killed.sort()).toEqual([1111, 3333])
    } finally {
      process.kill = origKill
    }
  })
})

describe('gracefulKill — Windows happy/escalation paths', () => {
  // Programmable mock: each `execSync` call runs through a router function
  // that decides what to return based on the command content. Avoids the
  // count-the-polls fragility of a fixed response queue — the polling loop
  // can iterate any number of times and we still respond correctly.
  function installRouter(route: (cmd: string) => { output?: string; throwErr?: boolean }) {
    execSyncMock.mockImplementation((cmd: string) => {
      execCalls.push({ cmd })
      const res = route(cmd)
      if (res.throwErr) throw Object.assign(new Error('mock fail'), { stderr: Buffer.from('') })
      return res.output ?? ''
    })
  }

  // Matches `taskkill /F ...` (SIGKILL) exactly — `taskkill /FI` (SIGTERM)
  // also starts with `/F` because `/FI` shares the prefix, so the lexical
  // check needs a trailing space or a word boundary.
  const isTaskkillForce = (cmd: string) => /^taskkill\s+\/F\s/.test(cmd)

  it('Windows: returns true when tasklist reports the process gone after SIGTERM', async () => {
    setPlatform('win32')
    const { gracefulKill } = await loadFresh()
    let taskkillCalled = false
    installRouter(cmd => {
      if (cmd.startsWith('taskkill')) {
        taskkillCalled = true
        return { output: '' }
      }
      if (cmd.startsWith('tasklist')) {
        // Alive until SIGTERM lands, then gone.
        return taskkillCalled
          ? { output: 'INFO: No tasks are running which match the specified criteria.' }
          : { output: 'vite.exe  1234 Console 1 25,000 K' }
      }
      return { output: '' }
    })

    const result = await gracefulKill('vite', { timeoutMs: 500, pollIntervalMs: 25 })
    expect(result).toBe(true)

    // The taskkill that ran must have been the SIGTERM variant, not /F.
    const kills = execCalls.filter(c => c.cmd.startsWith('taskkill'))
    expect(kills).toHaveLength(1)
    expect(isTaskkillForce(kills[0]!.cmd)).toBe(false)
  })

  it('Windows: escalates to /F (SIGKILL) when SIGTERM is ignored', async () => {
    setPlatform('win32')
    const { gracefulKill } = await loadFresh()
    let forceSeen = false
    installRouter(cmd => {
      if (isTaskkillForce(cmd)) {
        forceSeen = true
        return { output: '' }
      }
      if (cmd.startsWith('taskkill')) {
        // SIGTERM is silently ignored by this fake — the process stays up.
        return { output: '' }
      }
      if (cmd.startsWith('tasklist')) {
        // Alive until we see /F, then gone.
        return forceSeen
          ? { output: 'INFO: No tasks are running which match the specified criteria.' }
          : { output: 'anvil.exe 2222 Console 1 10,000 K' }
      }
      return { output: '' }
    })

    const result = await gracefulKill('anvil', { timeoutMs: 150, pollIntervalMs: 30 })
    expect(result).toBe(true)

    const kills = execCalls.filter(c => c.cmd.startsWith('taskkill'))
    expect(kills.length).toBeGreaterThanOrEqual(2)
    expect(isTaskkillForce(kills[kills.length - 1]!.cmd)).toBe(true)
  })
})
