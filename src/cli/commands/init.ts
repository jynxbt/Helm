import { defineCommand } from 'citty'
import { existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'pathe'
import consola from 'consola'
import { detectProgramsFromAnchor } from '../../config/resolve'

export default defineCommand({
  meta: {
    name: 'init',
    description: 'Initialize Helm configuration',
  },
  async run() {
    const cwd = process.cwd()
    const configPath = resolve(cwd, 'helm.config.ts')

    if (existsSync(configPath)) {
      consola.warn('helm.config.ts already exists')
      return
    }

    // Auto-detect programs
    const programs = detectProgramsFromAnchor(cwd)
    const programsStr = programs
      ? JSON.stringify(programs, null, 4).replace(/"(\w+)":/g, '$1:')
      : '// No Anchor.toml found — add programs manually'

    const template = `import { defineHelmConfig } from 'solana-helm'

export default defineHelmConfig({
  programs: ${programsStr},

  idlSync: {
    // Map IDL names to destination paths
    mapping: {
      // dynamic_bonding_curve: ['packages/ts-sdk/src/idl.json'],
    },
  },

  codegen: {
    outDir: 'generated',
  },
})
`

    writeFileSync(configPath, template, 'utf-8')
    consola.success(`Created ${configPath}`)
    consola.info('Edit the config to set up IDL sync mappings and codegen output')
  },
})
