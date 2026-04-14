import { existsSync } from 'node:fs'
import { resolve } from 'pathe'
import consola from 'consola'
import type { PolyqConfig, ResolvedPolyqConfig } from './types'
import { resolveConfig } from './resolve'

const CONFIG_FILES = [
  'polyq.config.ts',
  'polyq.config.js',
  'polyq.config.mjs',
]

const logger = consola.withTag('polyq:config')

/**
 * Load and resolve the Polyq config from the project root.
 * Tries polyq.config.ts, polyq.config.js, polyq.config.mjs in order.
 * Falls back to auto-detection if no config file exists.
 */
export async function loadConfig(cwd?: string): Promise<ResolvedPolyqConfig> {
  const root = cwd ?? process.cwd()

  for (const file of CONFIG_FILES) {
    const configPath = resolve(root, file)
    if (existsSync(configPath)) {
      logger.debug(`Loading config from ${file}`)

      const { createJiti } = await import('jiti')
      const jiti = createJiti(root, {
        interopDefault: true,
      })

      const loaded = await jiti.import(configPath) as PolyqConfig | { default: PolyqConfig }
      const config = 'default' in loaded ? loaded.default : loaded
      return resolveConfig(config, root)
    }
  }

  // No config file — use auto-detection only
  logger.debug('No config file found, using auto-detection')
  return resolveConfig({}, root)
}
