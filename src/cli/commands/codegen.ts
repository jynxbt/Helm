import { defineCommand } from 'citty'
import consola from 'consola'
import { resolve } from 'pathe'
import { detectChain, getChainProvider } from '../../chains'
import type { ChainFamily } from '../../chains/types'
import { generateFromSchema } from '../../codegen/generate'
import { createCodegenWatcher } from '../../codegen/watch'

const VALID_CHAINS: ChainFamily[] = ['svm', 'evm']

export default defineCommand({
  meta: {
    name: 'codegen',
    description: 'Generate TypeScript client from contract schemas (IDL/ABI)',
  },
  args: {
    idl: {
      type: 'string',
      description: 'Path to schema file (IDL or ABI JSON)',
    },
    out: {
      type: 'string',
      description: 'Output directory',
      default: 'generated',
    },
    chain: {
      type: 'string',
      description: 'Chain family: svm or evm (auto-detected)',
    },
    watch: {
      type: 'boolean',
      description: 'Watch source files, auto-build, and regenerate',
      default: false,
    },
  },
  async run({ args }) {
    const cwd = process.cwd()
    const outDir = resolve(cwd, args.out)

    // Validate --chain flag
    if (args.chain && !VALID_CHAINS.includes(args.chain as ChainFamily)) {
      throw new Error(`Invalid chain: '${args.chain}'. Must be one of: ${VALID_CHAINS.join(', ')}`)
    }

    const chain = (args.chain as ChainFamily) ?? detectChain(cwd)
    const provider = getChainProvider(chain)

    if (args.idl) {
      const schemaPath = resolve(cwd, args.idl)
      consola.info(`Generating from ${schemaPath} (${chain})...`)
      generateFromSchema(schemaPath, outDir, undefined, chain)
      consola.success('Done')
      return
    }

    // Auto-detect schema files using the chain provider
    const schemaFiles = provider.findSchemaFiles(cwd)

    if (schemaFiles.length === 0) {
      const artifactDir = provider.defaultArtifactDir
      const hint =
        chain === 'svm'
          ? 'Run `anchor build` to generate IDL files, then try again.'
          : 'Run `forge build` or `npx hardhat compile` to generate ABI files, then try again.'
      throw new Error(`No schema files found in ${artifactDir}/. ${hint}`)
    }

    runCodegen(schemaFiles, outDir, chain)

    if (args.watch) {
      // chokidar@5 doesn't expand glob patterns — pass directories and the
      // watch helper filters events by file extension.
      const sourceGlobs =
        chain === 'svm'
          ? [resolve(cwd, 'programs')]
          : [resolve(cwd, 'src'), resolve(cwd, 'contracts')]

      consola.info(`Watching source files + ${provider.defaultArtifactDir}/ for changes...`)

      const watcher = createCodegenWatcher({
        cwd,
        outDir,
        chain,
        artifactDir: provider.defaultArtifactDir,
        sourceGlobs,
      })
      await watcher.ready

      process.on('SIGINT', () => {
        void watcher.close().then(() => process.exit(0))
      })
    }
  },
})

function runCodegen(schemaFiles: string[], outDir: string, chain: ChainFamily) {
  for (const file of schemaFiles) {
    const fileName = file.split('/').pop()
    consola.info(`Generating from ${fileName}...`)
    generateFromSchema(file, outDir, undefined, chain)
  }
  consola.success(`Generated clients for ${schemaFiles.length} program(s)`)
}
