import type { ExecSyncOptions } from 'node:child_process'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Capture every psql call so we can assert the shell args + PG env vars
// without needing a running database. `psql` is invoked via `execSync` from
// `node:child_process` — we stub it before importing the stage module.
type ExecCall = { cmd: string; env: Record<string, string | undefined> }
const execCalls: ExecCall[] = []

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process')
  return {
    ...actual,
    execSync: vi.fn((cmd: string, options?: ExecSyncOptions) => {
      execCalls.push({
        cmd,
        env: (options?.env as Record<string, string | undefined>) ?? {},
      })
      // Pretend every invocation succeeded.
      return Buffer.from('')
    }),
  }
})

beforeEach(() => {
  execCalls.length = 0
})

async function load() {
  // Fresh import so the vi.mock definition is live.
  vi.resetModules()
  return import('../src/workspace/stages/database')
}

describe('database stage — shell construction', () => {
  it("passes the URL's host/port/db/user/password via PG* env vars (no shell interpolation)", async () => {
    const { createDatabaseStage } = await load()
    const stage = createDatabaseStage({
      url: 'postgresql://dev:pa%24%24word@db.example.com:6543/myapp',
      root: '/tmp',
    })
    await stage.check()

    expect(execCalls.length).toBeGreaterThan(0)
    const call = execCalls[execCalls.length - 1]!
    expect(call.env.PGHOST).toBe('db.example.com')
    expect(call.env.PGPORT).toBe('6543')
    expect(call.env.PGDATABASE).toBe('myapp')
    expect(call.env.PGUSER).toBe('dev')
    expect(call.env.PGPASSWORD).toBe('pa$$word')
    // The URL must NEVER be interpolated into the shell command itself.
    expect(call.cmd).not.toContain('pa$$word')
    expect(call.cmd).not.toContain('db.example.com')
  })

  it('defaults PGPORT to 5432 when the URL omits a port', async () => {
    const { createDatabaseStage } = await load()
    const stage = createDatabaseStage({
      url: 'postgresql://dev@localhost/myapp',
      root: '/tmp',
    })
    await stage.check()
    expect(execCalls[0]!.env.PGPORT).toBe('5432')
  })

  it('sanitises extension names against command injection', async () => {
    const { createDatabaseStage } = await load()
    const stage = createDatabaseStage({
      url: 'postgresql://dev@localhost/app',
      root: '/tmp',
      extensions: ['pgcrypto', 'pg_trgm; DROP DATABASE bad; --'],
    })
    await stage.start()

    const extensionCmds = execCalls.map(c => c.cmd).filter(c => c.includes('CREATE EXTENSION'))
    // Clean name is issued, malformed one is skipped.
    expect(extensionCmds.some(c => c.includes('"pgcrypto"'))).toBe(true)
    expect(extensionCmds.some(c => c.includes('DROP DATABASE'))).toBe(false)
  })

  it('reset stage refuses database names with shell metacharacters', async () => {
    const { createDatabaseResetStage } = await load()
    const stage = createDatabaseResetStage({
      url: 'postgresql://dev@localhost/app;DROP TABLE users',
      root: '/tmp',
    })
    await expect(stage.start()).rejects.toThrow(/Unsafe database name/)
  })

  it('respects healthChecks.requestTimeout on the probe', async () => {
    const { createDatabaseStage } = await load()
    const stage = createDatabaseStage({
      url: 'postgresql://dev@localhost/app',
      root: '/tmp',
      healthChecks: { requestTimeout: 12_345 },
    })
    await stage.check()
    // The execSync timeout option is passed through as part of options.
    const { execSync } = await import('node:child_process')
    const mockFn = execSync as unknown as ReturnType<typeof vi.fn>
    const lastOptions = mockFn.mock.calls[mockFn.mock.calls.length - 1]![1] as {
      timeout: number
    }
    expect(lastOptions.timeout).toBe(12_345)
  })
})
