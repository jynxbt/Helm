import type { Plugin } from 'vite'
import type { PolyqConfig, PolyfillConfig, IdlSyncConfig } from '../../config/types'
import { polyqPolyfills } from '../vite/polyfills'
import { polyqIdlSync } from '../vite/idl-sync'

interface PolyqSvelteKitOptions {
  polyfills?: PolyfillConfig
  idlSync?: IdlSyncConfig
}

/**
 * SvelteKit Vite plugin helper.
 *
 * SvelteKit uses Vite natively, so this is a convenience wrapper that
 * returns the right Vite plugins for your svelte.config.js.
 *
 * Usage:
 * ```ts
 * // vite.config.ts
 * import { sveltekit } from '@sveltejs/kit/vite'
 * import { polyqSvelteKit } from 'polyq/sveltekit'
 *
 * export default defineConfig({
 *   plugins: [sveltekit(), ...polyqSvelteKit()],
 * })
 * ```
 *
 * With options:
 * ```ts
 * plugins: [sveltekit(), ...polyqSvelteKit({
 *   polyfills: { buffer: true },
 *   idlSync: {
 *     mapping: { my_program: ['src/lib/idl.json'] },
 *   },
 * })]
 * ```
 */
export function polyqSvelteKit(options?: PolyqSvelteKitOptions): Plugin[] {
  const plugins: Plugin[] = [polyqPolyfills(options?.polyfills)]

  if (options?.idlSync) {
    plugins.push(polyqIdlSync(options.idlSync))
  }

  return plugins
}
