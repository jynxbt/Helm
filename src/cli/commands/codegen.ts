import { defineCommand } from 'citty'
import { resolve } from 'pathe'
import consola from 'consola'
import { generateFromIdl } from '../../codegen/generate'

export default defineCommand({
  meta: {
    name: 'codegen',
    description: 'Generate TypeScript client from Anchor IDLs',
  },
  args: {
    idl: {
      type: 'string',
      description: 'Path to IDL JSON file',
    },
    out: {
      type: 'string',
      description: 'Output directory',
      default: 'generated',
    },
    watch: {
      type: 'boolean',
      description: 'Watch IDL files and regenerate on change',
      default: false,
    },
  },
  async run({ args }) {
    const cwd = process.cwd()
    const outDir = resolve(cwd, args.out)

    if (args.idl) {
      const idlPath = resolve(cwd, args.idl)
      consola.info(`Generating from ${idlPath}...`)
      generateFromIdl(idlPath, outDir)
      consola.success('Done')
      return
    }

    // Auto-detect IDLs from target/idl/
    const { existsSync, readdirSync } = await import('node:fs')
    const idlDir = resolve(cwd, 'target/idl')

    if (!existsSync(idlDir)) {
      consola.error('No IDL directory found at target/idl/. Run `anchor build` first.')
      process.exit(1)
    }

    const idlFiles = readdirSync(idlDir).filter(f => f.endsWith('.json'))
    if (idlFiles.length === 0) {
      consola.error('No IDL files found in target/idl/')
      process.exit(1)
    }

    for (const file of idlFiles) {
      const idlPath = resolve(idlDir, file)
      consola.info(`Generating from ${file}...`)
      generateFromIdl(idlPath, outDir)
    }

    consola.success(`Generated clients for ${idlFiles.length} program(s)`)

    if (args.watch) {
      const { watch } = await import('chokidar')
      consola.info(`Watching ${idlDir} for changes...`)

      const watcher = watch(idlDir, { ignoreInitial: true })
      watcher.on('change', (filePath) => {
        const fileName = filePath.split('/').pop()
        consola.info(`IDL changed: ${fileName}`)
        generateFromIdl(filePath, outDir)
      })

      // Keep process alive
      process.on('SIGINT', () => {
        watcher.close()
        process.exit(0)
      })
    }
  },
})
