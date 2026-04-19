import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createJiti } from 'jiti'
import { dirname, resolve } from 'pathe'
import { beforeAll, describe, expect, it } from 'vitest'
import { validateConfig } from '../src/config/schema'
import type { PolyqConfig } from '../src/config/types'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')
const EXAMPLE = resolve(REPO_ROOT, 'examples/solana-next-starter')
const EXAMPLE_POLYQ = resolve(EXAMPLE, 'node_modules/polyq')
const DIST_ENTRY = resolve(REPO_ROOT, 'dist/index.mjs')

/**
 * Tests the *published* shape of the starter, not the in-repo source.
 *
 * The example's `package.json` uses `"polyq": "file:../.."`, so after a
 * `bun install` inside the example directory a symlink appears at
 * `examples/solana-next-starter/node_modules/polyq` pointing at the repo
 * root. Jiti resolves `polyq` through that symlink, which means it reads
 * the same `package.json.exports` entries real consumers use — so we end
 * up loading `dist/index.mjs`, not `src/index.ts`. If that dist isn't
 * built, fail loudly instead of silently importing source.
 */
describe('starter example', () => {
  beforeAll(() => {
    if (!existsSync(DIST_ENTRY)) {
      throw new Error(
        `Missing ${DIST_ENTRY} — run \`bun run build\` before this test ` +
          'suite so the example resolves against the published shape.',
      )
    }
    if (!existsSync(EXAMPLE_POLYQ)) {
      throw new Error(
        `Missing ${EXAMPLE_POLYQ} — run ` +
          '`(cd examples/solana-next-starter && bun install)` so the example ' +
          'links to the repo.',
      )
    }
  })

  it('polyq.config.ts loads via the example node_modules and passes validateConfig', async () => {
    const jiti = createJiti(EXAMPLE, { interopDefault: true })
    const loaded = (await jiti.import(resolve(EXAMPLE, 'polyq.config.ts'))) as
      | PolyqConfig
      | { default: PolyqConfig }
    const config = 'default' in loaded ? loaded.default : loaded
    expect(() => validateConfig(config, 'polyq.config.ts')).not.toThrow()
  })

  it('ships every wiring file a Next.js + Anchor app needs', () => {
    // `next-env.d.ts` is NOT listed here — Next.js regenerates it on first
    // `next dev`/`next build`, and committing it produces churn on first
    // real use of the starter (see `.gitignore`).
    const expected = [
      'package.json',
      'next.config.ts',
      'polyq.config.ts',
      'tsconfig.json',
      'Anchor.toml',
      'Cargo.toml',
      'programs/counter/Cargo.toml',
      'programs/counter/src/lib.rs',
      'app/layout.tsx',
      'app/page.tsx',
      '.gitignore',
      'README.md',
    ]
    for (const rel of expected) {
      const full = resolve(EXAMPLE, rel)
      const content = readFileSync(full, 'utf-8')
      expect(content.length, `${rel} is empty`).toBeGreaterThan(0)
    }
  })

  it('Anchor.toml and lib.rs agree on the program ID', () => {
    const toml = readFileSync(resolve(EXAMPLE, 'Anchor.toml'), 'utf-8')
    const rs = readFileSync(resolve(EXAMPLE, 'programs/counter/src/lib.rs'), 'utf-8')

    const tomlMatch = toml.match(/counter\s*=\s*"([^"]+)"/)
    const rsMatch = rs.match(/declare_id!\("([^"]+)"\)/)

    expect(tomlMatch?.[1]).toBeDefined()
    expect(rsMatch?.[1]).toBeDefined()
    expect(tomlMatch?.[1]).toBe(rsMatch?.[1])
    expect(tomlMatch?.[1]?.length).toBeGreaterThanOrEqual(43)
    expect(tomlMatch?.[1]?.length).toBeLessThanOrEqual(44)
  })

  it('next.config.ts wraps with withPolyq', () => {
    const content = readFileSync(resolve(EXAMPLE, 'next.config.ts'), 'utf-8')
    expect(content).toContain("from 'polyq/next'")
    expect(content).toContain('withPolyq')
  })

  it('package.json uses file:../.. so `bun install` resolves locally', () => {
    const pkg = JSON.parse(readFileSync(resolve(EXAMPLE, 'package.json'), 'utf-8'))
    expect(pkg.dependencies?.polyq).toBe('file:../..')
  })

  it('`bun install` linked the example polyq back to the repo (not a copy)', () => {
    // Bun's `file:../..` semantic is what lets the example resolve the
    // in-repo `dist/` via node_modules. Bun uses per-file symlinks
    // under an isolated-install directory, so `realpath` on the
    // directory itself is NOT the repo root — but `package.json`
    // inside must resolve to the repo's `package.json`. If Bun ever
    // switches to copying instead of linking, this fails and the
    // example would silently load a stale snapshot.
    const linkedPkg = realpathSync(resolve(EXAMPLE_POLYQ, 'package.json'))
    expect(linkedPkg).toBe(realpathSync(resolve(REPO_ROOT, 'package.json')))
  })
})
