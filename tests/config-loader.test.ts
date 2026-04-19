import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { findProjectRoot } from '../src/chains'
import { loadConfig } from '../src/config/loader'
import { resolveConfig } from '../src/config/resolve'

const FIXTURES = resolve(__dirname, '.config-fixtures')

describe('loadConfig', () => {
  beforeAll(() => {
    mkdirSync(FIXTURES, { recursive: true })
  })

  afterAll(() => {
    rmSync(FIXTURES, { recursive: true, force: true })
  })

  it('returns a resolved config even with no config file', async () => {
    const config = await loadConfig(FIXTURES)
    expect(config).toBeDefined()
    expect(config.root).toBe(FIXTURES)
  })

  it('auto-detects chain as svm fallback when no markers', async () => {
    const config = await loadConfig(FIXTURES)
    expect(config.resolvedChain).toBe('svm')
  })

  it('loads polyq.config.ts when present', async () => {
    const configDir = resolve(FIXTURES, 'with-config')
    mkdirSync(configDir, { recursive: true })
    writeFileSync(
      resolve(configDir, 'polyq.config.ts'),
      `
      export default {
        codegen: { outDir: 'custom-generated' },
      }
    `,
    )

    const config = await loadConfig(configDir)
    expect(config.codegen?.outDir).toBe('custom-generated')
  })

  it('detects svm chain from Anchor.toml', async () => {
    const svmDir = resolve(FIXTURES, 'svm-project')
    mkdirSync(svmDir, { recursive: true })
    writeFileSync(resolve(svmDir, 'Anchor.toml'), '[workspace]\nmembers = []')

    const config = await loadConfig(svmDir)
    expect(config.resolvedChain).toBe('svm')
  })

  it('detects evm chain from foundry.toml', async () => {
    const evmDir = resolve(FIXTURES, 'evm-project')
    mkdirSync(evmDir, { recursive: true })
    writeFileSync(resolve(evmDir, 'foundry.toml'), '[profile.default]\nsrc = "src"')

    const config = await loadConfig(evmDir)
    expect(config.resolvedChain).toBe('evm')
  })
})

describe('resolveConfig', () => {
  it('accepts explicit schemaSync mapping', () => {
    const config = resolveConfig(
      {
        schemaSync: { mapping: { my_program: ['dest/idl.json'] } },
      },
      FIXTURES,
    )
    expect(config.schemaSync?.mapping).toEqual({ my_program: ['dest/idl.json'] })
  })

  it('sets default watchDir from chain provider when schemaSync omitted', () => {
    const config = resolveConfig({}, FIXTURES)
    expect(config.schemaSync?.watchDir).toBeDefined()
  })
})

describe('findProjectRoot', () => {
  beforeAll(() => {
    mkdirSync(resolve(FIXTURES, 'nested/deep/path'), { recursive: true })
    writeFileSync(resolve(FIXTURES, 'nested/Anchor.toml'), '[workspace]\nmembers = []')
  })

  it('walks up to find Anchor.toml', () => {
    const root = findProjectRoot(resolve(FIXTURES, 'nested/deep/path'))
    expect(root).toBe(resolve(FIXTURES, 'nested'))
  })

  it('returns cwd when no marker found', () => {
    const noMarkerDir = resolve(FIXTURES, 'no-marker')
    mkdirSync(noMarkerDir, { recursive: true })
    const root = findProjectRoot(noMarkerDir)
    expect(root).toBe(noMarkerDir)
  })
})
