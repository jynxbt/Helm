import { mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { polyqSchemaSync } from '../src/adapters/vite/schema-sync'

const HERE = dirname(fileURLToPath(import.meta.url))
const FIXTURES = resolve(HERE, '.schema-sync-fixtures')
const WATCH_DIR = resolve(FIXTURES, 'target/idl')
const DEST_DIR = resolve(FIXTURES, 'dest')

describe('polyqSchemaSync', () => {
  beforeAll(() => {
    mkdirSync(WATCH_DIR, { recursive: true })
    mkdirSync(DEST_DIR, { recursive: true })
  })

  afterAll(() => {
    rmSync(FIXTURES, { recursive: true, force: true })
  })

  it('returns a plugin with correct name', () => {
    const plugin = polyqSchemaSync({ watchDir: 'target/idl', mapping: {} })
    expect(plugin.name).toBe('polyq:schema-sync')
  })

  it('has configureServer and closeBundle hooks', () => {
    const plugin = polyqSchemaSync({ watchDir: 'target/idl', mapping: {} })
    expect(plugin.configureServer).toBeDefined()
    expect(plugin.closeBundle).toBeDefined()
  })

  it('has configResolved hook', () => {
    const plugin = polyqSchemaSync({ watchDir: 'target/idl', mapping: {} })
    expect(plugin.configResolved).toBeDefined()
  })
})

describe('Schema sync file operations', () => {
  beforeAll(() => {
    mkdirSync(WATCH_DIR, { recursive: true })
    mkdirSync(DEST_DIR, { recursive: true })
  })

  afterAll(() => {
    rmSync(FIXTURES, { recursive: true, force: true })
  })

  it('accepts a mapping config', () => {
    const plugin = polyqSchemaSync({
      watchDir: WATCH_DIR,
      mapping: {
        test_program: [resolve(DEST_DIR, 'test.json')],
      },
    })
    expect(plugin).toBeDefined()
    expect(plugin.name).toBe('polyq:schema-sync')
  })

  it('accepts empty mapping without errors', () => {
    const plugin = polyqSchemaSync({ watchDir: WATCH_DIR, mapping: {} })
    expect(plugin).toBeDefined()
  })

  it('accepts undefined mapping without errors', () => {
    const plugin = polyqSchemaSync({ watchDir: WATCH_DIR })
    expect(plugin).toBeDefined()
  })

  it('defaults watchDir when not provided', () => {
    const plugin = polyqSchemaSync()
    expect(plugin).toBeDefined()
  })
})
