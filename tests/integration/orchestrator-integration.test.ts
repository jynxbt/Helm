import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ResolvedPolyqConfig } from '../../src/config/types'
import { buildStages, checkStages, runStages, stopStages } from '../../src/workspace/orchestrator'

/**
 * Full-orchestrator e2e against a real Postgres service container.
 *
 * Scoped to the database + optional devServer path — full
 * `polyq dev` with validator + programs requires the Solana/Anchor
 * toolchain installed on the runner, which doubles CI minutes for
 * marginal extra coverage. If a regression in `buildStages` /
 * `runStages` / `stopStages` slips through, it shows up here before
 * a user sees `polyq dev` hang in the wild.
 *
 * Local run (same as tests/integration/database-integration.test.ts):
 *   docker run --rm -d --name polyq-pg \
 *     -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=dev \
 *     -e POSTGRES_DB=polyq_test -p 5432:5432 postgres:16
 *   POLYQ_INTEGRATION=1 bun run test tests/integration
 */
const ENABLED = process.env.POLYQ_INTEGRATION === '1'
const DB_URL = process.env.POLYQ_PG_URL ?? 'postgresql://postgres:dev@127.0.0.1:5432/polyq_test'

const workdirs: string[] = []
function makeTmp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'polyq-orch-'))
  workdirs.push(dir)
  return dir
}

function minimalConfig(overrides?: Partial<ResolvedPolyqConfig>): ResolvedPolyqConfig {
  return {
    root: workdirs[workdirs.length - 1] ?? '/tmp',
    resolvedChain: 'svm',
    schemaSync: { watchDir: 'target/idl' },
    ...overrides,
    workspace: {
      // Docker + validator + devServer omitted so only the database stage
      // runs. `workspace.docker.enabled: false` keeps the stage list lean.
      docker: { enabled: false },
      database: { url: DB_URL },
      ...overrides?.workspace,
    },
  } as ResolvedPolyqConfig
}

describe.skipIf(!ENABLED)('orchestrator — real Postgres e2e', () => {
  beforeAll(() => {
    const root = makeTmp()
    // Seed a minimal migration so `database.start()` has something to apply.
    writeFileSync(
      join(root, 'init.sql'),
      'CREATE TABLE IF NOT EXISTS zenids (id SERIAL PRIMARY KEY, handle TEXT);\n',
      'utf-8',
    )
  })

  afterAll(() => {
    for (const dir of workdirs) rmSync(dir, { recursive: true, force: true })
  })

  it('buildStages produces the expected sequence for db-only config', () => {
    const stages = buildStages(minimalConfig(), {})
    const names = stages.map(s => s.name)
    // With docker disabled and no validator/programs/init/devServer, only
    // the validator (default, always added) and database stages should show.
    expect(names).toContain('Database')
    expect(names).not.toContain('Docker')
    expect(names).not.toContain('Dev Server')
  })

  it('runStages(only: database) executes and database.check() reports ready', async () => {
    const cfg = minimalConfig({
      workspace: {
        docker: { enabled: false },
        database: { url: DB_URL, migrationsDir: workdirs[workdirs.length - 1] },
      },
    } as Partial<ResolvedPolyqConfig>)
    const stages = buildStages(cfg, { only: ['database'] })
    expect(stages).toHaveLength(1)

    await runStages(stages)
    const status = await checkStages(stages)
    expect(status[0]!.running).toBe(true)
  }, 30_000)

  it('stopStages is a no-op for the database stage and does not throw', async () => {
    const stages = buildStages(minimalConfig(), { only: ['database'] })
    await expect(stopStages(stages)).resolves.toBeUndefined()
  })
})
