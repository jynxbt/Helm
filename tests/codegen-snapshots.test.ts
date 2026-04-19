import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve } from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { generateFromAbi } from '../src/chains/evm/codegen'
import { generateFromAbiViem } from '../src/chains/evm/codegen-viem'
import { generateFromIdl } from '../src/chains/svm/codegen'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')
const SVM_IDL = resolve(REPO_ROOT, 'tests/frameworks/fixtures/svm/target/idl/test_program.json')
const EVM_ABI = resolve(REPO_ROOT, 'tests/frameworks/fixtures/evm/out/TestToken.sol/TestToken.json')

const workdirs: string[] = []
function makeOut(): string {
  const dir = mkdtempSync(join(tmpdir(), 'polyq-snap-'))
  workdirs.push(dir)
  return dir
}

/**
 * Walk an output directory and return a { relativePath: contents } map. Snapshot-friendly.
 */
function snapshotTree(root: string): Record<string, string> {
  const out: Record<string, string> = {}
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        walk(full)
      } else {
        out[relative(root, full)] = readFileSync(full, 'utf-8')
      }
    }
  }
  walk(root)
  return out
}

describe('codegen output — snapshots', () => {
  afterAll(() => {
    for (const dir of workdirs) rmSync(dir, { recursive: true, force: true })
  })

  it('SVM legacy codegen produces stable output', () => {
    const out = makeOut()
    generateFromIdl(SVM_IDL, out)
    expect(snapshotTree(out)).toMatchSnapshot()
  })

  it('EVM legacy codegen produces stable output', () => {
    const out = makeOut()
    generateFromAbi(EVM_ABI, out)
    expect(snapshotTree(out)).toMatchSnapshot()
  })

  it('EVM viem codegen produces stable output', () => {
    const out = makeOut()
    generateFromAbiViem(EVM_ABI, out)
    expect(snapshotTree(out)).toMatchSnapshot()
  })
})
