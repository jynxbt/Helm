import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'pathe'
import { beforeAll, describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')
const PKG = JSON.parse(readFileSync(resolve(REPO, 'package.json'), 'utf-8')) as {
  exports: Record<string, string | { types?: string; import?: string }>
  bin?: Record<string, string>
  types?: string
}

/**
 * Contract test over the built artifacts in `dist/`. Runs after every build
 * (including the TS canary, tsdown Dependabot bumps, and regular CI) and
 * asserts:
 *   - every `package.json.exports` subpath resolves to a real file
 *   - each adapter's `.d.mts` exports the public symbol we advertise
 *   - the CLI binary has a shebang so `npm i -g` actually works
 *
 * A regression in declaration emission or export wiring shows up here
 * before `npm pack` ships broken types to consumers.
 */

beforeAll(() => {
  // Build lazily so `bun run test` works on a cold checkout. Rebuild is
  // idempotent — tsdown's `clean: true` handles the dist wipe itself.
  if (!existsSync(resolve(REPO, 'dist/index.mjs'))) {
    execSync('bun run build', { cwd: REPO, stdio: 'inherit' })
  }
})

describe('dist shape — exports', () => {
  it('every exports entry resolves to a real file', () => {
    for (const [key, value] of Object.entries(PKG.exports)) {
      const paths: string[] = []
      if (typeof value === 'string') {
        paths.push(value)
      } else {
        if (value.types) paths.push(value.types)
        if (value.import) paths.push(value.import)
      }
      for (const rel of paths) {
        const abs = resolve(REPO, rel)
        expect(existsSync(abs), `exports["${key}"] points at missing file: ${rel}`).toBe(true)
      }
    }
  })

  it('top-level `types` field resolves', () => {
    if (!PKG.types) return
    expect(existsSync(resolve(REPO, PKG.types))).toBe(true)
  })

  it('bin entry resolves', () => {
    for (const rel of Object.values(PKG.bin ?? {})) {
      expect(existsSync(resolve(REPO, rel))).toBe(true)
    }
  })
})

describe('dist shape — declaration contents', () => {
  // Name → file where it must appear. Keep this list small and targeted;
  // it's the *public contract* we promise consumers, not an inventory.
  const adapters: Array<{ name: string; file: string }> = [
    { name: 'polyqVite', file: 'dist/vite/index.d.mts' },
    { name: 'polyqPolyfills', file: 'dist/vite/index.d.mts' },
    { name: 'polyqSchemaSync', file: 'dist/vite/index.d.mts' },
    { name: 'withPolyq', file: 'dist/next/index.d.mts' },
    { name: 'polyqSvelteKit', file: 'dist/sveltekit/index.d.mts' },
    { name: 'polyqRemix', file: 'dist/remix/index.d.mts' },
    { name: 'polyqWebpack', file: 'dist/webpack/index.d.mts' },
    { name: 'generateFromSchema', file: 'dist/codegen/index.d.mts' },
    { name: 'generateFromIdl', file: 'dist/chains/svm/index.d.mts' },
    { name: 'generateFromAbi', file: 'dist/chains/evm/index.d.mts' },
    { name: 'buildStages', file: 'dist/workspace/index.d.mts' },
    { name: 'runStages', file: 'dist/workspace/index.d.mts' },
  ]

  for (const { name, file } of adapters) {
    it(`${file} exports \`${name}\``, () => {
      const abs = resolve(REPO, file)
      expect(existsSync(abs)).toBe(true)
      const content = readFileSync(abs, 'utf-8')
      // Declarations can export directly or re-export; both show up as
      // `<name>` in the emitted .d.mts. A loose `\b<name>\b` match is
      // good enough for a contract signal.
      const re = new RegExp(`\\b${name}\\b`)
      expect(re.test(content), `${file} is missing export \`${name}\``).toBe(true)
    })
  }
})

describe('dist shape — CLI', () => {
  it('has #!/usr/bin/env node shebang', () => {
    const cli = resolve(REPO, 'dist/cli/index.mjs')
    const content = readFileSync(cli, 'utf-8')
    expect(content.startsWith('#!/usr/bin/env node')).toBe(true)
  })
})
