import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  findMigrationHits,
  MIGRATIONS,
  type MigrationEntry,
  migrateConfig,
  warnDeprecations,
} from '../src/config/migrations'

describe('migrateConfig & findMigrationHits', () => {
  it('finds a top-level removed key', () => {
    const hits = findMigrationHits({ idlSync: { mapping: {} } })
    expect(hits).toHaveLength(1)
    expect(hits[0]!.fromPath).toBe('idlSync')
    expect(hits[0]!.entry.replacement).toBe('schemaSync')
    expect(hits[0]!.entry.severity).toBe('removed')
    expect(hits[0]!.value).toEqual({ mapping: {} })
  })

  it('ignores configs with no hits', () => {
    expect(findMigrationHits({ chain: 'svm' })).toEqual([])
  })

  it('ignores null / non-objects / arrays', () => {
    expect(findMigrationHits(null)).toEqual([])
    expect(findMigrationHits('hello')).toEqual([])
    expect(findMigrationHits([1, 2, 3])).toEqual([])
  })

  it('migrateConfig surfaces removed entries but does NOT rewrite them', () => {
    const raw = { idlSync: { mapping: { a: ['x'] } } }
    const { migrated, changes } = migrateConfig(raw)
    expect(changes).toHaveLength(1)
    // Removed = caller should throw. Auto-rewriting would silently paper
    // over a breaking rename, so the migrated copy is unchanged.
    expect(migrated).toEqual(raw)
  })

  it('migrateConfig does not mutate the input object', () => {
    const raw = { idlSync: { mapping: { a: ['x'] } } }
    const { migrated } = migrateConfig(raw)
    expect(migrated).not.toBe(raw)
  })
})

// Push a synthetic entry into MIGRATIONS for this block so we exercise
// the nested-path + deprecated-severity paths without baking a fake
// entry into the production table.
describe('migrations — nested + deprecated paths', () => {
  const synthetic: MigrationEntry = {
    path: ['workspace', 'validator', 'oldField'],
    replacement: 'newField',
    since: '0.5.0',
    severity: 'deprecated',
  }
  const originalLength = MIGRATIONS.length

  beforeAll(() => {
    MIGRATIONS.push(synthetic)
  })
  afterAll(() => {
    MIGRATIONS.length = originalLength
  })

  it('finds a nested-path entry', () => {
    const raw = { workspace: { validator: { oldField: 42, tool: 'anvil' } } }
    const hits = findMigrationHits(raw)
    expect(hits).toHaveLength(1)
    expect(hits[0]!.fromPath).toBe('workspace.validator.oldField')
    expect(hits[0]!.value).toBe(42)
  })

  it('migrateConfig auto-rewrites deprecated entries', () => {
    const raw = { workspace: { validator: { oldField: 42, tool: 'anvil' } } }
    const { migrated, changes } = migrateConfig(raw)
    expect(changes).toHaveLength(1)
    expect(migrated).toEqual({ workspace: { validator: { newField: 42, tool: 'anvil' } } })
  })

  it('wildcard path matches every record key (programs.*.idl)', () => {
    const raw = {
      programs: {
        counter: { type: 'anchor', path: 'programs/counter', idl: 'target/idl/counter.json' },
        other: { type: 'anchor', path: 'programs/other', idl: 'target/idl/other.json' },
        good: { type: 'anchor', path: 'programs/good', schema: 'target/idl/good.json' },
      },
    }
    const hits = findMigrationHits(raw).filter(h => h.entry.replacement === 'schema')
    expect(hits).toHaveLength(2)
    const paths = hits.map(h => h.fromPath).sort()
    expect(paths).toEqual(['programs.counter.idl', 'programs.other.idl'])
  })

  it('wildcard migrateConfig (deprecated severity) auto-rewrites every match', () => {
    // Push a synthetic *deprecated* wildcard entry for this test; the
    // shipped `programs.*.idl` is severity=removed so it isn't rewritten.
    const synth: MigrationEntry = {
      path: ['programs', '*', 'legacyField'],
      replacement: 'newField',
      since: '0.5.0',
      severity: 'deprecated',
    }
    const before = MIGRATIONS.length
    MIGRATIONS.push(synth)
    try {
      const raw = {
        programs: {
          a: { legacyField: 1, keep: 'yes' },
          b: { legacyField: 2, keep: 'yes' },
        },
      }
      const { migrated, changes } = migrateConfig(raw)
      expect(changes).toHaveLength(2)
      expect(migrated).toEqual({
        programs: {
          a: { newField: 1, keep: 'yes' },
          b: { newField: 2, keep: 'yes' },
        },
      })
    } finally {
      MIGRATIONS.length = before
    }
  })

  it('warnDeprecations logs once per deprecated hit, ignores removed', () => {
    const raw = {
      idlSync: { mapping: {} },
      workspace: { validator: { oldField: 1 } },
    }
    // consola writes through stderr. Spy on process.stderr.write to
    // capture what lands there without relying on consola internals.
    const stderr = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true as unknown as boolean)
    try {
      warnDeprecations(findMigrationHits(raw))
      const all = stderr.mock.calls
        .map(c => (typeof c[0] === 'string' ? c[0] : (c[0] as Buffer).toString()))
        .join(' ')
      expect(all).toContain('workspace.validator.oldField')
      expect(all).not.toContain('idlSync')
    } finally {
      stderr.mockRestore()
    }
  })
})
