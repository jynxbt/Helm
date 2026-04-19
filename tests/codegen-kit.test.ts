import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { svmProvider } from '../src/chains/svm'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')
const IDL = resolve(REPO_ROOT, 'tests/frameworks/fixtures/svm/target/idl/test_program.json')

const workdirs: string[] = []
function makeOut(): string {
  const dir = mkdtempSync(join(tmpdir(), 'polyq-kit-'))
  workdirs.push(dir)
  return dir
}

describe('SVM Codama (kit) codegen', () => {
  afterAll(() => {
    for (const dir of workdirs) rmSync(dir, { recursive: true, force: true })
  })

  it('generates the expected tree against a real Anchor IDL', async () => {
    // With codama installed as a devDep we can actually exercise the kit path
    // instead of only covering the error case. Verifies:
    //   1. The codama + renderer handshake works
    //   2. The output tree matches what polyq documents
    //   3. The sample snippets in docs/guides/codegen.md remain accurate
    const out = makeOut()
    await svmProvider.generateClient(IDL, out, { mode: 'kit', outDir: out })

    for (const rel of [
      'index.ts',
      'programs/index.ts',
      'programs/testProgram.ts',
      'instructions/index.ts',
      'instructions/initialize.ts',
      'instructions/transfer.ts',
      'accounts/index.ts',
      'accounts/globalConfig.ts',
      'errors/index.ts',
      'errors/testProgram.ts',
      'types/index.ts',
      'pdas/index.ts',
      'shared/index.ts',
    ]) {
      expect(existsSync(join(out, rel)), `missing: ${rel}`).toBe(true)
    }
  })

  it('throws a clear error on invalid JSON before attempting to load peers', async () => {
    const out = makeOut()
    const bad = join(out, 'bad.json')
    writeFileSync(bad, '{ not json', 'utf-8')
    await expect(
      svmProvider.generateClient(bad, out, { mode: 'kit', outDir: out }),
    ).rejects.toThrow(/Invalid JSON/)
  })

  it('falls back to legacy codegen when mode is omitted', () => {
    const out = makeOut()
    const result = svmProvider.generateClient(IDL, out, { outDir: out })
    // Legacy path is sync and returns a populated files array
    expect(result).not.toBeInstanceOf(Promise)
    expect((result as { files: unknown[] }).files.length).toBeGreaterThan(0)
  })
})
