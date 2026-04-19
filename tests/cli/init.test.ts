import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { execa } from 'execa'
import { join } from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CLI_PATH, ensureCliBuilt } from './setup'

const workdirs: string[] = []

function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'polyq-init-'))
  workdirs.push(dir)
  return dir
}

describe('polyq CLI — init', () => {
  beforeAll(ensureCliBuilt)

  afterAll(() => {
    for (const dir of workdirs) rmSync(dir, { recursive: true, force: true })
  })

  it('scaffolds a polyq.config.ts with schemaSync (not idlSync) for SVM projects', async () => {
    const cwd = makeTmpDir()
    // Seed an Anchor.toml to force SVM detection so init picks a chain
    writeFileSync(
      join(cwd, 'Anchor.toml'),
      `[programs.localnet]\nmy_program = "11111111111111111111111111111111"\n[workspace]\nmembers = ["programs/my-program"]\n`,
    )

    const { exitCode } = await execa('node', [CLI_PATH, 'init'], { cwd })
    expect(exitCode).toBe(0)

    const configPath = join(cwd, 'polyq.config.ts')
    expect(existsSync(configPath)).toBe(true)

    const content = readFileSync(configPath, 'utf-8')
    expect(content).toContain('schemaSync:')
    expect(content).not.toMatch(/idlSync:/)
    expect(content).toContain('definePolyqConfig')
  })

  it('scaffolds a polyq.config.ts with schemaSync for EVM projects', async () => {
    const cwd = makeTmpDir()
    writeFileSync(join(cwd, 'foundry.toml'), `[profile.default]\n`)

    const { exitCode } = await execa('node', [CLI_PATH, 'init'], { cwd })
    expect(exitCode).toBe(0)

    const content = readFileSync(join(cwd, 'polyq.config.ts'), 'utf-8')
    expect(content).toContain('schemaSync:')
    expect(content).toContain('anvil')
  })

  it('refuses to overwrite an existing polyq.config.ts', async () => {
    const cwd = makeTmpDir()
    writeFileSync(join(cwd, 'polyq.config.ts'), '// existing\n')
    const { exitCode, stdout, stderr } = await execa('node', [CLI_PATH, 'init'], { cwd })
    expect(exitCode).toBe(0)
    expect(`${stdout}\n${stderr}`).toMatch(/already exists/i)
    expect(readFileSync(join(cwd, 'polyq.config.ts'), 'utf-8')).toBe('// existing\n')
  })
})
