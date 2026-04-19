import { beforeEach, describe, expect, it, vi } from 'vitest'

// Stub the whole process module so we capture both the synchronous `runSync`
// shell commands AND the async `run` spawns, without actually talking to the
// Docker daemon. Every test reads from these two arrays to assert command
// construction.
type RunSyncCall = { cmd: string; options?: unknown }
type RunCall = { command: string; args: string[]; options?: unknown }

const runSyncCalls: RunSyncCall[] = []
const runCalls: RunCall[] = []

// Each test sets this to control what `runSync` returns for the next call.
// Ordered queue — pop from the front.
const runSyncResponses: Array<{ ok: boolean; output?: string }> = []

vi.mock('../src/workspace/process', () => ({
  runSync: vi.fn((cmd: string, options?: unknown) => {
    runSyncCalls.push({ cmd, options })
    return runSyncResponses.shift() ?? { ok: true, output: '' }
  }),
  run: vi.fn(async (command: string, args: string[], options?: unknown) => {
    runCalls.push({ command, args, options })
    return { exitCode: 0, stdout: '', stderr: '' }
  }),
}))

// waitUntilReady resolves against portCheck which requires real networking.
// Stub both so `start()` doesn't hang waiting for a real port to open.
// Exporting the full surface the module under test consumes — anything that
// isn't mocked here would become undefined at runtime.
vi.mock('../src/workspace/health', () => ({
  portCheck: vi.fn(async () => true),
  httpHealthCheck: vi.fn(async () => true),
  waitUntilReady: vi.fn(async () => {}),
}))

beforeEach(async () => {
  runSyncCalls.length = 0
  runCalls.length = 0
  runSyncResponses.length = 0
  const health = await import('../src/workspace/health')
  ;(health.waitUntilReady as unknown as ReturnType<typeof vi.fn>).mockClear?.()
})

// Single import — vi.mock is hoisted so mocks are already in place by the
// time this resolves. We deliberately do NOT vi.resetModules between tests
// because that would re-import fresh copies of `health` without the mock.
const loadModule = import('../src/workspace/stages/docker')
async function load() {
  return loadModule
}

describe('docker stage — shell construction', () => {
  describe('check()', () => {
    it('returns false when `docker info` fails', async () => {
      const { createDockerStage } = await load()
      runSyncResponses.push({ ok: false, output: 'Cannot connect' })
      const stage = createDockerStage({ root: '/tmp' })
      expect(await stage.check()).toBe(false)
      expect(runSyncCalls[0]!.cmd).toBe('docker info')
    })

    it('returns false when compose ps omits a required service', async () => {
      const { createDockerStage } = await load()
      // 1st call: docker info → ok
      runSyncResponses.push({ ok: true, output: '' })
      // 2nd call: docker compose ps → lists only `redis`, we wanted `postgres`
      runSyncResponses.push({ ok: true, output: 'redis\n' })
      const stage = createDockerStage({ root: '/tmp', services: ['postgres'] })
      expect(await stage.check()).toBe(false)
    })

    it('returns true when every required service is in the running set', async () => {
      const { createDockerStage } = await load()
      runSyncResponses.push({ ok: true, output: '' })
      runSyncResponses.push({ ok: true, output: 'postgres\nredis\n' })
      const stage = createDockerStage({ root: '/tmp', services: ['postgres', 'redis'] })
      expect(await stage.check()).toBe(true)
    })

    it('defaults the required service list to ["postgres"] when omitted', async () => {
      const { createDockerStage } = await load()
      runSyncResponses.push({ ok: true, output: '' })
      runSyncResponses.push({ ok: true, output: 'postgres\n' })
      const stage = createDockerStage({ root: '/tmp' })
      expect(await stage.check()).toBe(true)
    })

    it('uses the configured compose file path in the ps command', async () => {
      const { createDockerStage } = await load()
      runSyncResponses.push({ ok: true, output: '' })
      runSyncResponses.push({ ok: true, output: 'postgres\n' })
      const stage = createDockerStage({
        root: '/my/project',
        compose: 'infra/docker-compose.dev.yml',
      })
      await stage.check()
      expect(runSyncCalls[1]!.cmd).toContain('infra/docker-compose.dev.yml')
      expect((runSyncCalls[1]!.options as { cwd?: string }).cwd).toBe('/my/project')
    })
  })

  describe('start()', () => {
    it('throws a human error when `docker info` fails', async () => {
      const { createDockerStage } = await load()
      runSyncResponses.push({ ok: false, output: '' })
      const stage = createDockerStage({ root: '/tmp' })
      await expect(stage.start()).rejects.toThrow(/Docker daemon is not running/)
    })

    it('constructs `docker compose -f <file> up -d <services>` with configured services', async () => {
      const { createDockerStage } = await load()
      runSyncResponses.push({ ok: true, output: '' }) // docker info
      const stage = createDockerStage({
        root: '/tmp',
        compose: 'docker-compose.yml',
        services: ['postgres', 'redis'],
      })
      await stage.start()

      expect(runCalls.length).toBe(1)
      const call = runCalls[0]!
      expect(call.command).toBe('docker')
      expect(call.args).toEqual([
        'compose',
        '-f',
        'docker-compose.yml',
        'up',
        '-d',
        'postgres',
        'redis',
      ])
    })

    it('defaults compose path to `docker-compose.yml`', async () => {
      const { createDockerStage } = await load()
      runSyncResponses.push({ ok: true, output: '' })
      const stage = createDockerStage({ root: '/tmp' })
      await stage.start()
      expect(runCalls[0]!.args).toContain('docker-compose.yml')
    })

    it('omits explicit service args when services is empty/undefined', async () => {
      const { createDockerStage } = await load()
      runSyncResponses.push({ ok: true, output: '' })
      const stage = createDockerStage({ root: '/tmp' })
      await stage.start()
      // `up -d` with no trailing service names → compose starts everything.
      expect(runCalls[0]!.args).toEqual(['compose', '-f', 'docker-compose.yml', 'up', '-d'])
    })

    it('threads healthChecks through to waitUntilReady', async () => {
      const health = await import('../src/workspace/health')
      const { createDockerStage } = await load()
      runSyncResponses.push({ ok: true, output: '' })
      const stage = createDockerStage({
        root: '/tmp',
        healthChecks: { pollInterval: 1234, maxWait: 56_000 },
      })
      await stage.start()
      const lastCall = (health.waitUntilReady as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!
      expect(lastCall[1]).toMatchObject({ interval: 1234, timeout: 56_000 })
    })
  })

  describe('stop()', () => {
    it('issues `docker compose -f <file> down`', async () => {
      const { createDockerStage } = await load()
      const stage = createDockerStage({
        root: '/tmp',
        compose: 'docker-compose.yml',
      })
      await stage.stop()
      expect(runCalls.length).toBe(1)
      const call = runCalls[0]!
      expect(call.command).toBe('docker')
      expect(call.args).toEqual(['compose', '-f', 'docker-compose.yml', 'down'])
    })
  })
})
