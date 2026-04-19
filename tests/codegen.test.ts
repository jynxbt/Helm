import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { generateFromIdl } from '../src/chains/svm/codegen'

const FIXTURES_DIR = resolve(__dirname, '.fixtures')
const OUT_DIR = resolve(FIXTURES_DIR, 'generated')

// Minimal Anchor IDL for testing
const MINIMAL_IDL = {
  address: '11111111111111111111111111111111',
  metadata: { name: 'test_program', version: '0.1.0', spec: '0.1.0' },
  instructions: [
    {
      name: 'initialize',
      discriminator: [175, 175, 109, 31, 13, 152, 155, 237],
      accounts: [
        { name: 'authority', writable: true, signer: true },
        {
          name: 'config',
          writable: true,
          pda: {
            seeds: [{ kind: 'const', value: [99, 111, 110, 102, 105, 103] }],
          },
        },
        { name: 'system_program', address: '11111111111111111111111111111111' },
      ],
      args: [
        { name: 'max_supply', type: 'u64' },
        { name: 'name', type: 'string' },
      ],
    },
  ],
  accounts: [{ name: 'GlobalConfig', discriminator: [149, 8, 156, 202, 160, 252, 176, 217] }],
  types: [
    {
      name: 'GlobalConfig',
      type: {
        kind: 'struct',
        fields: [
          { name: 'authority', type: 'pubkey' },
          { name: 'max_supply', type: 'u64' },
          { name: 'name', type: 'string' },
          { name: 'is_active', type: 'bool' },
        ],
      },
    },
    {
      name: 'Status',
      type: {
        kind: 'enum',
        variants: [{ name: 'Active' }, { name: 'Paused' }, { name: 'Closed' }],
      },
    },
  ],
  errors: [
    { code: 6000, name: 'Unauthorized', msg: 'Not authorized' },
    { code: 6001, name: 'InvalidSupply', msg: 'Invalid supply amount' },
  ],
}

describe('codegen', () => {
  beforeAll(() => {
    mkdirSync(FIXTURES_DIR, { recursive: true })
    writeFileSync(resolve(FIXTURES_DIR, 'test_program.json'), JSON.stringify(MINIMAL_IDL, null, 2))
  })

  afterAll(() => {
    rmSync(FIXTURES_DIR, { recursive: true, force: true })
  })

  it('generates all expected files', () => {
    const result = generateFromIdl(resolve(FIXTURES_DIR, 'test_program.json'), OUT_DIR)

    expect(result.files.map(f => f.path)).toEqual([
      'types.ts',
      'pda.ts',
      'instructions.ts',
      'accounts.ts',
      'errors.ts',
      'index.ts',
    ])
  })

  it('generates valid type definitions', () => {
    const typesPath = resolve(OUT_DIR, 'test-program', 'types.ts')
    expect(existsSync(typesPath)).toBe(true)

    const content = readFileSync(typesPath, 'utf-8')
    expect(content).toContain('export interface GlobalConfig')
    expect(content).toContain('authority: PublicKey')
    expect(content).toContain('maxSupply: bigint')
    expect(content).toContain('isActive: boolean')
    expect(content).toContain('export type Status =')
  })

  it('generates PDA helpers', () => {
    const pdaPath = resolve(OUT_DIR, 'test-program', 'pda.ts')
    const content = readFileSync(pdaPath, 'utf-8')
    expect(content).toContain('deriveConfig')
    expect(content).toContain("Buffer.from('config')")
    expect(content).toContain('PublicKey.findProgramAddressSync')
  })

  it('generates instruction builders', () => {
    const ixPath = resolve(OUT_DIR, 'test-program', 'instructions.ts')
    const content = readFileSync(ixPath, 'utf-8')
    expect(content).toContain('createInitializeInstruction')
    expect(content).toContain('InitializeAccounts')
    expect(content).toContain('InitializeArgs')
    expect(content).toContain('maxSupply: bigint')
  })

  it('generates error enum', () => {
    const errPath = resolve(OUT_DIR, 'test-program', 'errors.ts')
    const content = readFileSync(errPath, 'utf-8')
    expect(content).toContain('Unauthorized = 6000')
    expect(content).toContain('InvalidSupply = 6001')
    expect(content).toContain('getProgramError')
  })

  it('generates barrel export', () => {
    const indexPath = resolve(OUT_DIR, 'test-program', 'index.ts')
    const content = readFileSync(indexPath, 'utf-8')
    expect(content).toContain("export * from './types'")
    expect(content).toContain("export * from './pda'")
    expect(content).toContain("export * from './instructions'")
    expect(content).toContain("export * from './errors'")
  })
})
