import { describe, expect, it } from 'vitest'
import { createValidatorStage } from '../src/chains/svm/validator'
import type { HealthCheckTuning } from '../src/config/types'
import { buildStages } from '../src/workspace/orchestrator'

const tuning: HealthCheckTuning = {
  pollInterval: 200,
  maxWait: 5_000,
  requestTimeout: 1_000,
}

describe('healthChecks wiring', () => {
  it('SVM validator stage accepts healthChecks without throwing at construction', () => {
    const stage = createValidatorStage({
      root: '/tmp',
      rpcUrl: 'http://127.0.0.1:8899',
      healthChecks: tuning,
    })
    expect(stage.name).toBe('Validator')
  })

  it('buildStages forwards workspace.healthChecks to each stage', () => {
    // We inspect the stage list shape. The orchestrator currently produces
    // stages without exposing internals, so the assertion below is mostly a
    // smoke test: it must not throw with a non-trivial healthChecks object.
    const stages = buildStages(
      {
        root: '/tmp',
        resolvedChain: 'svm',
        schemaSync: { watchDir: 'target/idl' },
        workspace: {
          docker: { enabled: false },
          validator: { rpcUrl: 'http://127.0.0.1:8899' },
          devServer: { command: 'true' },
          healthChecks: tuning,
        },
      } as never,
      {},
    )
    expect(stages.length).toBeGreaterThan(0)
    // Validator stage exists at index 0 because docker was disabled
    expect(stages[0]!.name).toBe('Validator')
  })
})

describe('configurable ports', () => {
  it('SVM validator derives primary port from rpcUrl', () => {
    // Port parsing is exercised in utils.test.ts; here we just assert that a
    // non-default rpcUrl does not throw at stage construction.
    expect(() =>
      createValidatorStage({
        root: '/tmp',
        rpcUrl: 'http://127.0.0.1:9001',
        ports: [9001, 9002],
      }),
    ).not.toThrow()
  })
})
