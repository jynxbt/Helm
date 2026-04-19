import { defineCommand, runCommand } from 'citty'
import { describe, expect, it } from 'vitest'

/**
 * citty@0.2 is a major bump over 0.1 (ESM-only, `node:util.parseArgs`-based).
 * Our CLI commands use every arg shape citty exposes: positionals, booleans,
 * strings, and strings we later split on commas. This suite confirms each
 * shape still parses the way our commands expect so we don't have to wait for
 * a user bug to find out the parser changed.
 */

describe('citty@0.2 — arg-parsing surface', () => {
  it('parses a boolean flag with --flag', async () => {
    let captured: { quick?: boolean } = {}
    const cmd = defineCommand({
      meta: { name: 'test' },
      args: {
        quick: { type: 'boolean', description: 'skip', default: false },
      },
      run: ({ args }) => {
        captured = { quick: args.quick }
      },
    })
    await runCommand(cmd, { rawArgs: ['--quick'] })
    expect(captured.quick).toBe(true)
  })

  it('parses a negative boolean with --no-flag', async () => {
    let captured: { quick?: boolean } = {}
    const cmd = defineCommand({
      meta: { name: 'test' },
      args: {
        quick: { type: 'boolean', default: true },
      },
      run: ({ args }) => {
        captured = { quick: args.quick }
      },
    })
    await runCommand(cmd, { rawArgs: ['--no-quick'] })
    expect(captured.quick).toBe(false)
  })

  it('parses string args with equals and space separators', async () => {
    let captured: { out?: string | undefined; idl?: string | undefined } = {}
    const cmd = defineCommand({
      meta: { name: 'test' },
      args: {
        out: { type: 'string', default: 'generated' },
        idl: { type: 'string' },
      },
      run: ({ args }) => {
        captured = { out: args.out, idl: args.idl }
      },
    })
    await runCommand(cmd, { rawArgs: ['--out=dist', '--idl', 'target/idl/my.json'] })
    expect(captured.out).toBe('dist')
    expect(captured.idl).toBe('target/idl/my.json')
  })

  it('leaves optional string args undefined when not passed', async () => {
    let captured: { only?: string | undefined } = {}
    const cmd = defineCommand({
      meta: { name: 'test' },
      args: {
        only: { type: 'string' },
      },
      run: ({ args }) => {
        captured = { only: args.only }
      },
    })
    await runCommand(cmd, { rawArgs: [] })
    expect(captured.only).toBeUndefined()
  })

  it('subCommands definition typechecks the lazy-loaded module shape', () => {
    // Our CLI uses `{ subCommands: { dev: () => import('./dev').then(m => m.default) } }`.
    // Confirming the `defineCommand` accepts that shape without throwing is
    // enough — the real subcommand dispatch is exercised end-to-end by
    // `tests/cli/*.test.ts` against the built CLI binary.
    const inner = defineCommand({
      meta: { name: 'inner' },
      run: () => {},
    })
    const outer = defineCommand({
      meta: { name: 'outer' },
      subCommands: {
        inner: () => Promise.resolve(inner),
      },
    })
    expect(outer).toBeTruthy()
    expect(typeof outer.run).toBe('undefined') // no root handler
    expect(outer.subCommands).toBeDefined()
  })
})
