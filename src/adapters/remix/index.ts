import type { Plugin } from 'vite'
import type { PolyfillConfig, IdlSyncConfig } from '../../config/types'
import { polyqPolyfills } from '../vite/polyfills'
import { polyqIdlSync } from '../vite/idl-sync'

interface PolyqRemixOptions {
  polyfills?: PolyfillConfig
  idlSync?: IdlSyncConfig
}

/**
 * Remix Vite plugin helper.
 *
 * Remix uses Vite, so this returns the right Vite plugins.
 *
 * Usage:
 * ```ts
 * // vite.config.ts
 * import { vitePlugin as remix } from '@remix-run/dev'
 * import { polyqRemix } from 'polyq/remix'
 *
 * export default defineConfig({
 *   plugins: [remix(), ...polyqRemix()],
 * })
 * ```
 */
export function polyqRemix(options?: PolyqRemixOptions): Plugin[] {
  const plugins: Plugin[] = [polyqPolyfills(options?.polyfills)]

  if (options?.idlSync) {
    plugins.push(polyqIdlSync(options.idlSync))
  }

  return plugins
}
