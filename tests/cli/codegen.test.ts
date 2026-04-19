import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { execa } from 'execa'
import { join, resolve } from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CLI_PATH, ensureCliBuilt, REPO_ROOT } from './setup'

const workdirs: string[] = []

function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'polyq-codegen-'))
  workdirs.push(dir)
  return dir
}

const FIXTURE_IDL = resolve(REPO_ROOT, 'tests/frameworks/fixtures/svm/target/idl/test_program.json')

describe('polyq CLI — codegen', () => {
  beforeAll(ensureCliBuilt)

  afterAll(() => {
    for (const dir of workdirs) rmSync(dir, { recursive: true, force: true })
  })

  it('generates a typed client from an explicit --idl path', async () => {
    const cwd = makeTmpDir()
    const out = join(cwd, 'generated')
    const idlCopy = join(cwd, 'my.json')
    copyFileSync(FIXTURE_IDL, idlCopy)

    const { exitCode } = await execa(
      'node',
      [CLI_PATH, 'codegen', '--idl', idlCopy, '--out', out, '--chain', 'svm'],
      { cwd },
    )
    expect(exitCode).toBe(0)
    // test_program → test-program
    expect(existsSync(join(out, 'test-program', 'index.ts'))).toBe(true)
    expect(existsSync(join(out, 'test-program', 'types.ts'))).toBe(true)
  })

  it('exits non-zero when --chain is invalid', async () => {
    const cwd = makeTmpDir()
    const result = await execa(
      'node',
      [CLI_PATH, 'codegen', '--idl', FIXTURE_IDL, '--chain', 'bogus'],
      { cwd, reject: false },
    )
    expect(result.exitCode).toBe(1)
  })

  it('exits non-zero when no IDL is found and no --idl flag provided', async () => {
    const cwd = makeTmpDir()
    // Create an empty target/idl to force auto-detection to find nothing
    mkdirSync(join(cwd, 'target', 'idl'), { recursive: true })

    const result = await execa('node', [CLI_PATH, 'codegen'], { cwd, reject: false })
    expect(result.exitCode).toBe(1)
  })
})
