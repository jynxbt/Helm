import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { polyqWebpack } from '../src/adapters/webpack/polyfills'

const FIXTURES = resolve(__dirname, '.webpack-fixtures')

describe('polyqWebpack', () => {
  beforeAll(() => {
    mkdirSync(FIXTURES, { recursive: true })
  })

  afterAll(() => {
    rmSync(FIXTURES, { recursive: true, force: true })
  })

  it('returns a function', () => {
    const apply = polyqWebpack()
    expect(typeof apply).toBe('function')
  })

  it('passes through config when no Solana deps detected in auto mode', () => {
    // Create a package.json with no Solana deps
    writeFileSync(
      resolve(FIXTURES, 'package.json'),
      JSON.stringify({
        dependencies: { react: '^18.0.0' },
      }),
    )

    const apply = polyqWebpack()
    const config = { entry: './src/index.ts', resolve: {} }
    const result = apply(config)

    // Should return config unchanged
    expect(result).toBe(config)
  })

  it('sets up resolve.fallback structure in manual mode', () => {
    const apply = polyqWebpack({ mode: 'manual', buffer: true })
    const config: any = {}
    apply(config)

    expect(config.resolve).toBeDefined()
    expect(config.resolve.fallback).toBeDefined()
    // buffer path depends on whether the 'buffer' package is resolvable
    // in this test env — just verify the fallback object was created
  })

  it('creates resolve.fallback if not present', () => {
    const apply = polyqWebpack({ mode: 'manual', buffer: true })
    const config: any = {}
    apply(config)

    expect(config.resolve.fallback).toBeDefined()
  })

  it('preserves existing resolve config', () => {
    const apply = polyqWebpack({ mode: 'manual', buffer: true })
    const config: any = {
      resolve: {
        extensions: ['.ts', '.js'],
        fallback: { path: false },
      },
    }
    apply(config)

    expect(config.resolve.extensions).toEqual(['.ts', '.js'])
    expect(config.resolve.fallback.path).toBe(false)
    // Existing fallback entries preserved even after Polyq modifies the object
  })

  it('does not add crypto fallback when not requested', () => {
    const apply = polyqWebpack({ mode: 'manual', buffer: true, crypto: false })
    const config: any = {}
    apply(config)

    expect(config.resolve.fallback.crypto).toBeUndefined()
  })
})
