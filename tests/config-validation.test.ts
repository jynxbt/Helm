import { describe, expect, it } from 'vitest'
import { validateConfig } from '../src/config/schema'

describe('validateConfig', () => {
  it('accepts a valid minimal config', () => {
    expect(() => validateConfig({}, 'test')).not.toThrow()
  })

  it('accepts a valid full config', () => {
    validateConfig(
      {
        chain: 'svm',
        programs: {
          my_program: {
            type: 'anchor',
            path: 'programs/my-program',
            schema: 'target/idl/my_program.json',
            programId: { localnet: '11111111111111111111111111111111' },
          },
        },
        schemaSync: {
          watchDir: 'target/idl',
          mapping: { my_program: ['src/idl.json'] },
        },
        codegen: { outDir: 'generated' },
        polyfills: { mode: 'auto', buffer: true, global: true },
        workspace: {
          validator: { tool: 'solana-test-validator' },
          devServer: { command: 'bun run dev' },
          database: {
            url: 'postgres://dev@localhost:5432/app',
            seed: { script: 'seed:dev' },
          },
        },
      },
      'test',
    )
  })

  it('rejects an unknown top-level key (typo catch)', () => {
    expect(() => validateConfig({ idlsync: { mapping: {} } }, 'polyq.config.ts')).toThrowError(
      /polyq\.config\.ts/,
    )
  })

  it('rejects a wrong-type value', () => {
    expect(() => validateConfig({ chain: 'solana' }, 'test')).toThrowError(/chain/)
  })

  it('rejects missing required field within nested object', () => {
    expect(() =>
      validateConfig(
        {
          programs: {
            // Missing required `path`
            my_program: { type: 'anchor' },
          },
        },
        'test',
      ),
    ).toThrowError(/path/)
  })

  it('rejects invalid chain value', () => {
    expect(() => validateConfig({ chain: 'eth' }, 'test')).toThrowError(/chain/)
  })

  it('rejects non-string workspace.devServer.command', () => {
    expect(() =>
      validateConfig({ workspace: { devServer: { command: 42 } } }, 'test'),
    ).toThrowError()
  })

  it('includes the source file name in the error', () => {
    try {
      validateConfig({ chain: 'bad' }, 'polyq.config.ts')
      expect.fail('should have thrown')
    } catch (e) {
      expect((e as Error).message).toContain('polyq.config.ts')
    }
  })

  it('suggests the replacement when a removed key (idlSync) is used', () => {
    try {
      validateConfig({ idlSync: { mapping: {} } }, 'polyq.config.ts')
      expect.fail('should have thrown')
    } catch (e) {
      const msg = (e as Error).message
      expect(msg).toContain('idlSync')
      expect(msg).toContain('schemaSync')
      expect(msg).toContain('0.4.0')
    }
  })

  it('still rejects the lowercase typo via the strict-object path', () => {
    // `idlsync` (lowercase) is not in the REMOVED_KEYS map so it falls through
    // to valibot's generic unknown-key error — the pre-flight only catches
    // actual renames, not arbitrary typos.
    expect(() => validateConfig({ idlsync: { mapping: {} } }, 'polyq.config.ts')).toThrowError(
      /idlsync/,
    )
  })

  it('suggests `schema` when a program config uses the removed `idl` field', () => {
    try {
      validateConfig(
        {
          programs: {
            counter: {
              type: 'anchor',
              path: 'programs/counter',
              idl: 'target/idl/counter.json',
            },
          },
        },
        'polyq.config.ts',
      )
      expect.fail('should have thrown')
    } catch (e) {
      const msg = (e as Error).message
      expect(msg).toContain('programs.counter.idl')
      expect(msg).toContain('schema')
      expect(msg).toContain('0.4.0')
    }
  })

  it('per-program config is now strict — typos at that level also error', () => {
    // With programConfigSchema flipped to strictObject, an unknown field
    // in a program entry (not in the MIGRATIONS table) surfaces as a
    // generic valibot error rather than being silently accepted.
    expect(() =>
      validateConfig(
        {
          programs: {
            counter: {
              type: 'anchor',
              path: 'programs/counter',
              schema: 'target/idl/counter.json',
              // not a real field
              someTypo: 'oops',
            },
          },
        },
        'polyq.config.ts',
      ),
    ).toThrowError()
  })
})
