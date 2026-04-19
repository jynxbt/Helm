import type { Plugin, UserConfig } from 'vite'
import { describe, expect, it } from 'vitest'
import { polyqPolyfills } from '../src/adapters/vite/polyfills'

// Vite's Plugin.config type binds `this` to a plugin context that only exists
// at runtime inside the dev server. Tests call it as a bare function, so we
// cast the method to a plain callable shape.
type ConfigHook = (
  this: unknown,
  userConfig: UserConfig,
  env: { mode: string; command: string; isSsrBuild: boolean },
) => unknown

function callConfigHook(
  plugin: Plugin,
  userConfig: UserConfig = {},
  env: { isSsrBuild?: boolean } = {},
) {
  if (typeof plugin.config !== 'function') return undefined
  const hook = plugin.config as unknown as ConfigHook
  return hook.call(
    null,
    { root: process.cwd(), ...userConfig },
    { mode: 'development', command: 'serve', isSsrBuild: env.isSsrBuild ?? false },
  )
}

describe('polyqPolyfills', () => {
  it('returns a plugin with correct name', () => {
    const plugin = polyqPolyfills()
    expect(plugin.name).toBe('polyq:polyfills')
  })

  it('sets global to globalThis in manual mode', () => {
    const plugin = polyqPolyfills({ mode: 'manual', global: true, buffer: true })
    const config = callConfigHook(plugin) as any
    expect(config?.define?.global).toBe('globalThis')
  })

  it('aliases buffer in manual mode', () => {
    const plugin = polyqPolyfills({ mode: 'manual', buffer: true })
    const config = callConfigHook(plugin) as any
    expect(config?.resolve?.alias?.buffer).toBe('buffer/')
  })

  it('includes buffer in optimizeDeps', () => {
    const plugin = polyqPolyfills({ mode: 'manual', buffer: true })
    const config = callConfigHook(plugin) as any
    expect(config?.optimizeDeps?.include).toContain('buffer')
  })

  it('skips polyfills for SSR builds', () => {
    const plugin = polyqPolyfills({ mode: 'manual', buffer: true })
    const config = callConfigHook(plugin, {}, { isSsrBuild: true })
    expect(config).toBeUndefined()
  })

  it('enforces pre order', () => {
    const plugin = polyqPolyfills()
    expect(plugin.enforce).toBe('pre')
  })
})
