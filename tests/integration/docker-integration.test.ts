import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDockerStage } from '../../src/workspace/stages/docker'

/**
 * Real docker-daemon integration. Gated on `POLYQ_INTEGRATION=1` so local
 * `bun run test` skips when Docker isn't running.
 *
 * Uses port **5433** to avoid colliding with the service container the
 * `integration.yml` workflow already owns on 5432.
 *
 * Local run (requires a running Docker daemon):
 *   POLYQ_INTEGRATION=1 bun run test tests/integration/docker-integration
 */
const ENABLED = process.env.POLYQ_INTEGRATION === '1'
const PORT = Number(process.env.POLYQ_DOCKER_PORT ?? '5433')

let workdir: string
let composeFile: string

describe.skipIf(!ENABLED)('docker stage — real daemon', () => {
  beforeAll(() => {
    workdir = mkdtempSync(join(tmpdir(), 'polyq-docker-it-'))
    composeFile = 'docker-compose.yml'
    writeFileSync(
      join(workdir, composeFile),
      [
        'services:',
        '  postgres:',
        '    image: postgres:16',
        '    environment:',
        '      POSTGRES_USER: postgres',
        '      POSTGRES_PASSWORD: dev',
        '      POSTGRES_DB: polyq_docker_it',
        '    ports:',
        `      - '${PORT}:5432'`,
        '    healthcheck:',
        '      test: ["CMD-SHELL", "pg_isready -U postgres"]',
        '      interval: 2s',
        '      timeout: 2s',
        '      retries: 10',
        '',
      ].join('\n'),
      'utf-8',
    )
  })

  afterAll(() => {
    // Belt-and-braces: force teardown even if a test failed before stop().
    try {
      execSync(`docker compose -f ${composeFile} down -v --remove-orphans`, {
        cwd: workdir,
        stdio: 'ignore',
        timeout: 30_000,
      })
    } catch {
      /* already down */
    }
    rmSync(workdir, { recursive: true, force: true })
  })

  it('start() → check()=true → stop() → check()=false', async () => {
    const stage = createDockerStage({
      compose: composeFile,
      services: ['postgres'],
      healthCheckPort: PORT,
      healthChecks: { pollInterval: 500, maxWait: 45_000 },
      root: workdir,
    })

    // Fresh state before start — nothing should be running.
    expect(await stage.check()).toBe(false)

    await stage.start()

    // After start, check() should confirm both the daemon responds and
    // the required service(s) are up + reachable on the port we asked for.
    expect(await stage.check()).toBe(true)

    await stage.stop()

    // After stop, the service is gone and check() reverts to false.
    expect(await stage.check()).toBe(false)
  }, 120_000)
})
