import { describe, expect, it } from 'vitest'

/**
 * Real `@nuxt/kit` surface check. The existing `nuxt-adapter.test.ts`
 * mocks the kit entirely, so type drift (a renamed export, a dropped
 * function) would fail at runtime against a real Nuxt but silently pass
 * our mocked tests. This suite imports the genuine kit and asserts the
 * three functions our adapter uses still exist with the expected
 * callable shapes. No Nuxt app or dev server required.
 *
 * If Nuxt ships a breaking change here, this test is the first place
 * you see it in CI — not a user report.
 */
describe('@nuxt/kit surface — real import, no mocks', () => {
  it('exposes defineNuxtModule, addVitePlugin, useNuxt as callable functions', async () => {
    const kit = await import('@nuxt/kit')
    expect(typeof kit.defineNuxtModule).toBe('function')
    expect(typeof kit.addVitePlugin).toBe('function')
    expect(typeof kit.useNuxt).toBe('function')
  })

  it('defineNuxtModule wraps our adapter definition and returns a callable module', async () => {
    const kit = await import('@nuxt/kit')
    const definition = {
      meta: { name: 'polyq-surface-check', configKey: 'polyq' },
      defaults: {},
      async setup() {},
    }
    // Cast-free: defineNuxtModule's generic expects the shape we pass.
    const mod = kit.defineNuxtModule(definition)
    // Nuxt modules are callable — either directly or via `.getOptions()` /
    // `.getMeta()` helpers depending on kit version. Shape assertion,
    // not invocation — running it requires a nuxt context we don't have.
    expect(mod).toBeTruthy()
    // Most kit versions: the result is a function OR an object with a
    // callable identity. Either works for our adapter's usage.
    const usable = typeof mod === 'function' || (typeof mod === 'object' && mod !== null)
    expect(usable).toBe(true)
  })

  it('our adapter module can be imported (proves defineNuxtModule returned a valid value)', async () => {
    // Importing the adapter runs `defineNuxtModule({...})` at module scope.
    // If kit ever made that throw (wrong arg type, missing required fields,
    // etc.) we'd crash on import — the test would fail loud here.
    const adapter = await import('../src/adapters/nuxt/index')
    expect(adapter.default).toBeTruthy()
  })
})
