/**
 * Framework integration tests for PolyQ.
 *
 * Tests every adapter (Vite, Next.js, Nuxt, SvelteKit, Remix, webpack)
 * against both SVM and EVM fixtures without requiring actual framework installs.
 * Verifies: chain detection, config resolution, schema discovery, codegen,
 * adapter config generation, and polyfill correctness.
 */

import { readFileSync, rmSync } from 'node:fs'
import { resolve } from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { withPolyq } from '../../src/adapters/next/index'
import { polyqRemix } from '../../src/adapters/remix/index'
import { polyqSvelteKit } from '../../src/adapters/sveltekit/index'
// Adapters
import { polyqVite } from '../../src/adapters/vite/index'
import { polyqPolyfills } from '../../src/adapters/vite/polyfills'
import { polyqSchemaSync } from '../../src/adapters/vite/schema-sync'
import { polyqWebpack } from '../../src/adapters/webpack/polyfills'
// Core
import { detectChain, findProjectRoot, getChainProvider } from '../../src/chains'
import type { CodegenOutput } from '../../src/chains/types'
import { generateFromSchema } from '../../src/codegen/generate'
import { resolveConfig } from '../../src/config/resolve'

// `generateFromSchema` returns `CodegenOutput | Promise<CodegenOutput>` (kit
// mode is async). Legacy paths are sync; tests assert on `.files` directly.
function syncResult(r: CodegenOutput | Promise<CodegenOutput>): CodegenOutput {
  if (r instanceof Promise) throw new Error('expected sync codegen result')
  return r
}

const SVM_ROOT = resolve(__dirname, 'fixtures/svm')
const EVM_ROOT = resolve(__dirname, 'fixtures/evm')
const SVM_IDL = resolve(SVM_ROOT, 'target/idl/test_program.json')
const EVM_ABI = resolve(EVM_ROOT, 'out/TestToken.sol/TestToken.json')
const OUT_DIR = resolve(__dirname, '.framework-codegen-output')

afterAll(() => {
  rmSync(OUT_DIR, { recursive: true, force: true })
})

// ─── SVM Chain Detection ────────────────────────────────────────────

describe('SVM chain detection (all frameworks)', () => {
  it('detects svm from Anchor.toml', () => {
    expect(detectChain(SVM_ROOT)).toBe('svm')
  })

  it('detects project with definite confidence', () => {
    const provider = getChainProvider('svm')
    const result = provider.detectProject(SVM_ROOT)
    expect(result?.chain).toBe('svm')
    expect(result?.confidence).toBe('definite')
  })

  it('discovers programs from Anchor.toml', () => {
    const provider = getChainProvider('svm')
    const programs = provider.detectPrograms(SVM_ROOT)
    expect(programs).toBeDefined()
    expect(programs!.testProgram).toBeDefined()
    expect(programs!.testProgram!.type).toBe('anchor')
    expect(programs!.testProgram!.programId?.localnet).toBe('11111111111111111111111111111111')
  })

  it('resolves config with correct chain and programs', () => {
    const config = resolveConfig({}, SVM_ROOT)
    expect(config.resolvedChain).toBe('svm')
    expect(config.programs?.testProgram).toBeDefined()
  })

  it('finds schema files in target/idl/', () => {
    const provider = getChainProvider('svm')
    const files = provider.findSchemaFiles(SVM_ROOT)
    expect(files.length).toBeGreaterThan(0)
    expect(files.some(f => f.endsWith('test_program.json'))).toBe(true)
  })

  it('findProjectRoot walks up to Anchor.toml', () => {
    const root = findProjectRoot(resolve(SVM_ROOT, 'target/idl'))
    expect(root).toBe(SVM_ROOT)
  })
})

// ─── EVM Chain Detection ────────────────────────────────────────────

describe('EVM chain detection (all frameworks)', () => {
  it('detects evm from foundry.toml', () => {
    expect(detectChain(EVM_ROOT)).toBe('evm')
  })

  it('detects project with definite confidence', () => {
    const provider = getChainProvider('evm')
    const result = provider.detectProject(EVM_ROOT)
    expect(result?.chain).toBe('evm')
    expect(result?.confidence).toBe('definite')
  })

  it('finds ABI files in out/', () => {
    const provider = getChainProvider('evm')
    const files = provider.findSchemaFiles(EVM_ROOT)
    expect(files.length).toBe(1)
    expect(files[0]).toContain('TestToken.json')
  })

  it('resolves config with evm chain', () => {
    const config = resolveConfig({}, EVM_ROOT)
    expect(config.resolvedChain).toBe('evm')
  })
})

// ─── SVM Codegen ────────────────────────────────────────────────────

describe('SVM codegen (shared across frameworks)', () => {
  it('generates all 6 files from SVM IDL', () => {
    const result = syncResult(generateFromSchema(SVM_IDL, OUT_DIR, undefined, 'svm'))
    const paths = result.files.map(f => f.path)
    expect(paths).toContain('types.ts')
    expect(paths).toContain('pda.ts')
    expect(paths).toContain('instructions.ts')
    expect(paths).toContain('accounts.ts')
    expect(paths).toContain('errors.ts')
    expect(paths).toContain('index.ts')
  })

  it('types use correct TypeScript mappings', () => {
    const content = readFileSync(resolve(OUT_DIR, 'test-program/types.ts'), 'utf-8')
    expect(content).toContain('authority: PublicKey')
    expect(content).toContain('maxSupply: bigint')
    expect(content).toContain('isActive: boolean')
    expect(content).toContain('export type Status =')
  })

  it('instructions use types.* prefix for defined types', () => {
    const content = readFileSync(resolve(OUT_DIR, 'test-program/instructions.ts'), 'utf-8')
    expect(content).toContain('params: types.TransferParams')
    expect(content).not.toMatch(/params: TransferParams[^.]/)
  })

  it('instructions have Borsh serialization', () => {
    const content = readFileSync(resolve(OUT_DIR, 'test-program/instructions.ts'), 'utf-8')
    expect(content).toContain("import * as borsh from '@coral-xyz/borsh'")
    expect(content).toContain('Buffer.concat')
    expect(content).toContain('argsLayout.encode')
  })

  it('accounts have Borsh deserialization', () => {
    const content = readFileSync(resolve(OUT_DIR, 'test-program/accounts.ts'), 'utf-8')
    expect(content).toContain('.decode(accountInfo.data.subarray(8))')
    expect(content).not.toContain('TODO')
  })

  it('PDA helpers are generated', () => {
    const content = readFileSync(resolve(OUT_DIR, 'test-program/pda.ts'), 'utf-8')
    expect(content).toContain('deriveConfig')
    expect(content).toContain('PublicKey.findProgramAddressSync')
  })

  it('errors are generated', () => {
    const content = readFileSync(resolve(OUT_DIR, 'test-program/errors.ts'), 'utf-8')
    expect(content).toContain('Unauthorized = 6000')
    expect(content).toContain('InvalidSupply = 6001')
  })

  it('no dead imports in generated code', () => {
    const instructions = readFileSync(resolve(OUT_DIR, 'test-program/instructions.ts'), 'utf-8')
    // types.* prefix is used, so the import is not dead
    expect(instructions).toContain('types.TransferParams')
  })
})

// ─── EVM Codegen ────────────────────────────────────────────────────

describe('EVM codegen (shared across frameworks)', () => {
  it('generates files from EVM ABI', () => {
    const result = syncResult(generateFromSchema(EVM_ABI, OUT_DIR, undefined, 'evm'))
    const paths = result.files.map(f => f.path)
    expect(paths).toContain('contract.ts')
    expect(paths).toContain('types.ts')
    expect(paths).toContain('events.ts')
    expect(paths).toContain('errors.ts')
    expect(paths).toContain('index.ts')
  })

  it('contract.ts exports ABI as const', () => {
    const content = readFileSync(resolve(OUT_DIR, 'test-token/contract.ts'), 'utf-8')
    expect(content).toContain('TEST_TOKEN_ABI')
    expect(content).toContain('as const')
  })

  it('types have function args + return types', () => {
    const content = readFileSync(resolve(OUT_DIR, 'test-token/types.ts'), 'utf-8')
    expect(content).toContain('TransferArgs')
    expect(content).toContain('to: `0x${string}`')
    expect(content).toContain('amount: bigint')
    expect(content).toContain('BalanceOfReturn')
  })

  it('events are typed correctly', () => {
    const content = readFileSync(resolve(OUT_DIR, 'test-token/events.ts'), 'utf-8')
    expect(content).toContain('TransferEvent')
    expect(content).toContain('ApprovalEvent')
  })

  it('custom errors are typed', () => {
    const content = readFileSync(resolve(OUT_DIR, 'test-token/errors.ts'), 'utf-8')
    expect(content).toContain('InsufficientBalanceError')
    expect(content).toContain('available: bigint')
  })
})

// ─── Vite + React Adapter ───────────────────────────────────────────

describe('Vite + React adapter', () => {
  it('polyqVite() returns Plugin array', () => {
    const plugins = polyqVite()
    expect(Array.isArray(plugins)).toBe(true)
    expect(plugins.length).toBeGreaterThanOrEqual(1)
    expect(plugins[0]!.name).toBe('polyq:polyfills')
  })

  it('polyqVite() with schemaSync returns 2 plugins', () => {
    const plugins = polyqVite({
      schemaSync: {
        watchDir: 'target/idl',
        mapping: { test_program: ['src/idl.json'] },
      },
    })
    expect(plugins.length).toBe(2)
    expect(plugins[1]!.name).toBe('polyq:schema-sync')
  })

  it('polyfill plugin sets global and buffer in manual mode', () => {
    const plugin = polyqPolyfills({ mode: 'manual', buffer: true, global: true })
    const config = (plugin.config as any)(
      { root: SVM_ROOT },
      { mode: 'development', command: 'serve', isSsrBuild: false },
    )
    expect(config?.define?.global).toBe('globalThis')
    expect(config?.resolve?.alias?.buffer).toBe('buffer/')
    expect(config?.optimizeDeps?.include).toContain('buffer')
  })

  it('polyfill plugin skips SSR builds', () => {
    const plugin = polyqPolyfills({ mode: 'manual', buffer: true })
    const config = (plugin.config as any)(
      { root: SVM_ROOT },
      { mode: 'development', command: 'serve', isSsrBuild: true },
    )
    expect(config).toBeUndefined()
  })
})

// ─── Next.js Adapter ────────────────────────────────────────────────

describe('Next.js adapter (webpack + Turbopack)', () => {
  it('withPolyq() returns NextConfig with turbopack and webpack', () => {
    const result = withPolyq({}, { polyfills: { mode: 'manual', buffer: true } })
    expect(result.turbopack).toBeDefined()
    expect(result.turbopack!.resolveAlias).toBeDefined()
    expect(typeof result.webpack).toBe('function')
  })

  it('Turbopack gets fs/net/tls stubs', () => {
    const result = withPolyq({}, { polyfills: { mode: 'manual', buffer: true } })
    expect(result.turbopack!.resolveAlias!.fs).toBeDefined()
    expect(result.turbopack!.resolveAlias!.net).toBeDefined()
    expect(result.turbopack!.resolveAlias!.tls).toBeDefined()
  })

  it('Turbopack gets buffer alias', () => {
    const result = withPolyq({}, { polyfills: { mode: 'manual', buffer: true } })
    expect(result.turbopack!.resolveAlias!.buffer).toEqual({ browser: 'buffer/' })
  })

  it('preserves existing turbopack config', () => {
    const result = withPolyq(
      {
        turbopack: {
          root: '/my/root',
          resolveAlias: { custom: './custom.ts' },
        },
      },
      { polyfills: { mode: 'manual', buffer: true } },
    )
    expect(result.turbopack!.root).toBe('/my/root')
    expect(result.turbopack!.resolveAlias!.custom).toBe('./custom.ts')
    expect(result.turbopack!.resolveAlias!.fs).toBeDefined()
  })

  it('preserves existing webpack function', () => {
    let originalCalled = false
    const result = withPolyq(
      {
        webpack(config: any, _ctx: any) {
          originalCalled = true
          return config
        },
      },
      { polyfills: { mode: 'manual', buffer: true } },
    )
    result.webpack!({}, { isServer: true })
    expect(originalCalled).toBe(true)
  })

  it('applies polyfills to edge runtime', () => {
    const result = withPolyq({}, { polyfills: { mode: 'manual', buffer: true } })
    const config: any = { resolve: {}, plugins: [] }
    result.webpack!(config, { isServer: true, nextRuntime: 'edge' })
    expect(config.resolve.fallback).toBeDefined()
  })

  it('skips polyfills for Node.js server', () => {
    const result = withPolyq({}, { polyfills: { mode: 'manual', buffer: true } })
    const config: any = { resolve: {} }
    result.webpack!(config, { isServer: true })
    expect(config.resolve.fallback).toBeUndefined()
  })

  it('returns config unchanged when no Solana deps in auto mode', () => {
    const original = { images: { domains: ['example.com'] } }
    const result = withPolyq(original)
    // Auto mode with no Solana deps → return as-is
    expect(result).toBe(original)
  })
})

// ─── Nuxt Module ────────────────────────────────────────────────────

describe('Nuxt module (config shape)', () => {
  // Can't test the full Nuxt module without a Nuxt instance,
  // but we can verify the underlying plugins work correctly
  it('polyqPolyfills works for Nuxt (same as Vite)', () => {
    const plugin = polyqPolyfills({ mode: 'manual', buffer: true })
    expect(plugin.name).toBe('polyq:polyfills')
    expect(plugin.enforce).toBe('pre')
  })

  it('polyqSchemaSync works for Nuxt (same as Vite)', () => {
    const plugin = polyqSchemaSync({
      watchDir: 'target/idl',
      mapping: { test: ['dest.json'] },
    })
    expect(plugin.name).toBe('polyq:schema-sync')
    expect(plugin.configureServer).toBeDefined()
  })
})

// ─── SvelteKit Adapter ──────────────────────────────────────────────

describe('SvelteKit adapter', () => {
  it('returns Plugin[] with polyfills', () => {
    const plugins = polyqSvelteKit()
    expect(Array.isArray(plugins)).toBe(true)
    expect(plugins.length).toBe(1)
    expect(plugins[0]!.name).toBe('polyq:polyfills')
  })

  it('returns 2 plugins with schemaSync', () => {
    const plugins = polyqSvelteKit({
      schemaSync: { mapping: { test: ['dest.json'] } },
    })
    expect(plugins.length).toBe(2)
    expect(plugins[1]!.name).toBe('polyq:schema-sync')
  })

  it('accepts polyfill options', () => {
    const plugins = polyqSvelteKit({
      polyfills: { mode: 'manual', buffer: true },
    })
    expect(plugins[0]!.name).toBe('polyq:polyfills')
  })
})

// ─── Remix Adapter ──────────────────────────────────────────────────

describe('Remix adapter', () => {
  it('returns Plugin[] with polyfills', () => {
    const plugins = polyqRemix()
    expect(Array.isArray(plugins)).toBe(true)
    expect(plugins.length).toBe(1)
    expect(plugins[0]!.name).toBe('polyq:polyfills')
  })

  it('returns 2 plugins with schemaSync', () => {
    const plugins = polyqRemix({
      schemaSync: { mapping: { test: ['dest.json'] } },
    })
    expect(plugins.length).toBe(2)
  })
})

// ─── Webpack Adapter ────────────────────────────────────────────────

describe('Webpack adapter', () => {
  it('returns a function', () => {
    const apply = polyqWebpack({ mode: 'manual', buffer: true })
    expect(typeof apply).toBe('function')
  })

  it('creates resolve.fallback in manual mode', () => {
    const apply = polyqWebpack({ mode: 'manual', buffer: true })
    const config: any = {}
    apply(config)
    expect(config.resolve).toBeDefined()
    expect(config.resolve.fallback).toBeDefined()
  })

  it('preserves existing webpack config', () => {
    const apply = polyqWebpack({ mode: 'manual', buffer: true })
    const config: any = {
      resolve: { extensions: ['.ts'], fallback: { path: false } },
    }
    apply(config)
    expect(config.resolve.extensions).toEqual(['.ts'])
    expect(config.resolve.fallback.path).toBe(false)
  })
})

// ─── Cross-Framework: Path Traversal Protection ─────────────────────

describe('Security: path traversal protection', () => {
  it('SVM codegen blocks path traversal in program name', () => {
    const maliciousIdl = resolve(__dirname, '.framework-codegen-output/malicious.json')
    const { writeFileSync, mkdirSync } = require('node:fs')
    mkdirSync(resolve(__dirname, '.framework-codegen-output'), { recursive: true })
    writeFileSync(
      maliciousIdl,
      JSON.stringify({
        address: '11111111111111111111111111111111',
        metadata: { name: '../../../etc/evil', version: '0.1.0', spec: '0.1.0' },
        instructions: [],
        accounts: [],
        types: [],
      }),
    )

    expect(() => {
      generateFromSchema(maliciousIdl, OUT_DIR, undefined, 'svm')
    }).toThrow('Path traversal')
  })

  it('EVM codegen blocks path traversal in contract name', () => {
    const maliciousAbi = resolve(__dirname, '.framework-codegen-output/evil.json')
    const { writeFileSync } = require('node:fs')
    writeFileSync(
      maliciousAbi,
      JSON.stringify({
        contractName: '../../../etc/evil',
        abi: [],
      }),
    )

    expect(() => {
      generateFromSchema(maliciousAbi, OUT_DIR, undefined, 'evm')
    }).toThrow('Path traversal')
  })
})

// ─── Cross-Framework: JSON Validation ───────────────────────────────

describe('Security: JSON schema validation', () => {
  it('SVM codegen rejects IDL without metadata.name', () => {
    const bad = resolve(OUT_DIR, 'bad-idl.json')
    const { writeFileSync, mkdirSync } = require('node:fs')
    mkdirSync(OUT_DIR, { recursive: true })
    writeFileSync(bad, JSON.stringify({ instructions: [] }))
    expect(() => generateFromSchema(bad, OUT_DIR, undefined, 'svm')).toThrow('metadata.name')
  })

  it('SVM codegen rejects IDL without instructions array', () => {
    const bad = resolve(OUT_DIR, 'bad-idl2.json')
    const { writeFileSync } = require('node:fs')
    writeFileSync(bad, JSON.stringify({ metadata: { name: 'test' } }))
    expect(() => generateFromSchema(bad, OUT_DIR, undefined, 'svm')).toThrow('instructions')
  })

  it('EVM codegen rejects ABI without abi array', () => {
    const bad = resolve(OUT_DIR, 'bad-abi.json')
    const { writeFileSync } = require('node:fs')
    writeFileSync(bad, JSON.stringify({ contractName: 'Test' }))
    expect(() => generateFromSchema(bad, OUT_DIR, undefined, 'evm')).toThrow('abi')
  })

  it('rejects invalid JSON', () => {
    const bad = resolve(OUT_DIR, 'invalid.json')
    const { writeFileSync } = require('node:fs')
    writeFileSync(bad, 'not json at all')
    expect(() => generateFromSchema(bad, OUT_DIR, undefined, 'svm')).toThrow('Invalid JSON')
  })
})
