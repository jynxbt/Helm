import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterAll, describe, expect, it, vi } from 'vitest'

const workdirs: string[] = []
function makeProject(configSource: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'polyq-nuxt-'))
  workdirs.push(dir)
  writeFileSync(join(dir, 'polyq.config.ts'), configSource, 'utf-8')
  return dir
}

/**
 * Adapter test that uses the REAL `defineNuxtModule` from `@nuxt/kit` and
 * mocks only the two runtime-dependent side-effects the module needs:
 *   - `addVitePlugin` — records plugin registrations
 *   - `useNuxt` — returns a fake nuxt context with just the fields the
 *     adapter reads (`options.rootDir`, `hook`)
 *
 * If Nuxt ever changes what `defineNuxtModule` hands back, this test
 * fails — that's the whole point. A fully mocked `defineNuxtModule:
 * (def) => def` (the previous version) would silently continue to pass
 * in that scenario.
 */

type NuxtFake = { options: { rootDir: string }; hook: ReturnType<typeof vi.fn> }
const addVitePluginSpy = vi.fn()
const useNuxtMock = vi.fn<() => NuxtFake>()

vi.mock('@nuxt/kit', async () => {
  const actual = await vi.importActual<typeof import('@nuxt/kit')>('@nuxt/kit')
  return {
    ...actual,
    addVitePlugin: addVitePluginSpy,
    useNuxt: useNuxtMock,
  }
})

async function runSetup(rootDir: string) {
  addVitePluginSpy.mockClear()
  useNuxtMock.mockReturnValue({ options: { rootDir }, hook: vi.fn() })
  vi.resetModules()

  // The real `defineNuxtModule` returns a callable that Nuxt invokes as
  // `mod(inlineOptions, nuxt)` during bootstrap. We drive it with the same
  // shape, which also means our setup signature must match what kit
  // expects — any breaking change to that signature fails the call here.
  const adapter = await import('../src/adapters/nuxt/index')
  const mod = adapter.default as (
    inlineOptions: object,
    nuxt: NuxtFake,
  ) => Promise<{ meta: Record<string, unknown> } | undefined>
  await mod({}, { options: { rootDir }, hook: vi.fn() })
}

describe('nuxt adapter — config loading resilience (real @nuxt/kit)', () => {
  afterAll(() => {
    for (const dir of workdirs) rmSync(dir, { recursive: true, force: true })
  })

  it('silently proceeds when polyq.config.ts does not exist', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'polyq-nuxt-empty-'))
    workdirs.push(dir)
    // setup() returns void — we care that it doesn't throw.
    await expect(runSetup(dir)).resolves.not.toThrow?.()
  })

  it('rethrows when polyq.config.ts has invalid syntax', async () => {
    const dir = makeProject('export default { invalid-ts-syntax**: 1 }\n')
    await expect(runSetup(dir)).rejects.toThrow()
  })

  it('rethrows when polyq.config.ts fails validation (removed key)', async () => {
    const dir = makeProject(
      "import { definePolyqConfig } from 'polyq'\n" +
        'export default definePolyqConfig({ idlSync: { mapping: {} } } as any)\n',
    )
    // Swap the .ts for a .js literal — bypasses jiti's `polyq` import
    // resolution but still exercises loadConfig + validateConfig.
    rmSync(join(dir, 'polyq.config.ts'))
    writeFileSync(
      join(dir, 'polyq.config.js'),
      'module.exports = { idlSync: { mapping: {} } }\n',
      'utf-8',
    )
    await expect(runSetup(dir)).rejects.toThrow(/idlSync|schemaSync/)
  })

  it('registers the polyfills Vite plugin via addVitePlugin', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'polyq-nuxt-vp-'))
    workdirs.push(dir)
    await runSetup(dir)
    expect(addVitePluginSpy).toHaveBeenCalled()
    // The adapter registers polyfills always, and schema-sync when
    // loadConfig returned a schemaSync (default watchDir is set).
    const registered = addVitePluginSpy.mock.calls
      .map(call => (call[0] as { name: string }).name)
      .filter(Boolean)
    expect(registered).toContain('polyq:polyfills')
  })
})
