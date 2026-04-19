import { describe, expect, it } from 'vitest'
import { buildStages, checkStages, runStages, stopStages } from '../src/workspace/orchestrator'
import type { Stage } from '../src/workspace/stage'

/**
 * Fake stage that records every `check` / `start` / `stop` call against a shared log.
 * The orchestrator treats any Stage-shaped object uniformly, so we can exercise
 * its sequencing without touching Docker, validators, or the network.
 */
function fakeStage(
  name: string,
  log: string[],
  opts: { alreadyReady?: boolean; startThrows?: boolean } = {},
): Stage {
  return {
    name,
    async check() {
      log.push(`${name}:check`)
      return opts.alreadyReady ?? false
    },
    async start() {
      log.push(`${name}:start`)
      if (opts.startThrows) throw new Error(`${name} boom`)
    },
    async stop() {
      log.push(`${name}:stop`)
    },
  }
}

describe('buildStages — ordering', () => {
  it('produces stages in a stable order for a given config', () => {
    const cfg = {
      root: '/tmp',
      resolvedChain: 'svm',
      schemaSync: { watchDir: 'target/idl' },
      workspace: {
        docker: { enabled: true },
        validator: { rpcUrl: 'http://127.0.0.1:8899' },
        devServer: { command: 'true' },
        database: { url: 'postgres://x@127.0.0.1/x' },
      },
    } as never
    const a = buildStages(cfg, {}).map(s => s.name)
    const b = buildStages(cfg, {}).map(s => s.name)
    expect(a).toEqual(b)
    // Docker must precede validator; database must precede devServer.
    expect(a.indexOf('Docker')).toBeLessThan(a.indexOf('Validator'))
    expect(a.indexOf('Database')).toBeLessThan(a.indexOf('Dev Server'))
  })

  it('drops docker when workspace.docker.enabled is false', () => {
    const stages = buildStages(
      {
        root: '/tmp',
        resolvedChain: 'svm',
        _chain: 'svm',
        schemaSync: { watchDir: 'target/idl' },
        workspace: {
          docker: { enabled: false },
          validator: { rpcUrl: 'http://127.0.0.1:8899' },
          devServer: { command: 'true' },
        },
      } as never,
      {},
    )
    expect(stages.map(s => s.name)).not.toContain('Docker')
  })
})

describe('runStages — check-then-start sequencing', () => {
  it('skips a stage whose check() returns true without calling start()', async () => {
    const log: string[] = []
    await runStages([fakeStage('Already', log, { alreadyReady: true })])
    expect(log).toEqual(['Already:check'])
  })

  it('calls check then start when the stage is not ready', async () => {
    const log: string[] = []
    await runStages([fakeStage('Fresh', log)])
    expect(log).toEqual(['Fresh:check', 'Fresh:start'])
  })

  it('propagates the first error and halts before subsequent stages', async () => {
    const log: string[] = []
    await expect(
      runStages([
        fakeStage('One', log),
        fakeStage('Two', log, { startThrows: true }),
        fakeStage('Three', log),
      ]),
    ).rejects.toThrow(/Two boom/)
    expect(log).toEqual(['One:check', 'One:start', 'Two:check', 'Two:start'])
    expect(log).not.toContain('Three:check')
  })
})

describe('stopStages — reverse-order shutdown', () => {
  it('stops stages in reverse order of the input array', async () => {
    const log: string[] = []
    const stages = [fakeStage('A', log), fakeStage('B', log), fakeStage('C', log)]
    await stopStages(stages)
    const stopCalls = log.filter(e => e.endsWith(':stop'))
    expect(stopCalls).toEqual(['C:stop', 'B:stop', 'A:stop'])
  })

  it('continues stopping later stages even if an earlier stop() throws', async () => {
    const log: string[] = []
    const throwing: Stage = {
      name: 'Bad',
      async check() {
        return false
      },
      async start() {},
      async stop() {
        log.push('Bad:stop')
        throw new Error('bad stop')
      },
    }
    await stopStages([fakeStage('A', log), throwing, fakeStage('C', log)])
    // C (reverse order: C, Bad, A) stops first; Bad throws; A still stops.
    expect(log).toContain('C:stop')
    expect(log).toContain('Bad:stop')
    expect(log).toContain('A:stop')
  })
})

describe('checkStages — non-throwing status report', () => {
  it('returns { name, running } for every stage', async () => {
    const log: string[] = []
    const result = await checkStages([
      fakeStage('Up', log, { alreadyReady: true }),
      fakeStage('Down', log, { alreadyReady: false }),
    ])
    expect(result).toEqual([
      { name: 'Up', running: true },
      { name: 'Down', running: false },
    ])
  })

  it('treats a throwing check() as `running: false` instead of propagating', async () => {
    const throwing: Stage = {
      name: 'Crash',
      async check() {
        throw new Error('boom')
      },
      async start() {},
      async stop() {},
    }
    const result = await checkStages([throwing])
    expect(result).toEqual([{ name: 'Crash', running: false }])
  })
})
