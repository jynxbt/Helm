import { defineCommand } from 'citty'
import consola from 'consola'
import { loadConfig } from '../../config/loader'
import { createProgramsBuildStage } from '../../workspace/stages/programs'

export default defineCommand({
  meta: {
    name: 'build',
    description: 'Build Solana programs',
  },
  args: {
    features: {
      type: 'string',
      description: 'Cargo features to enable (comma-separated, e.g., "local")',
    },
    parallel: {
      type: 'boolean',
      description: 'Build programs in parallel',
      default: true,
    },
  },
  async run({ args }) {
    const config = await loadConfig()

    if (!config.programs || Object.keys(config.programs).length === 0) {
      consola.error('No programs configured. Check polyq.config.ts or Anchor.toml')
      process.exit(1)
    }

    const features = args.features?.split(',').map(s => s.trim()) ?? []

    const stage = createProgramsBuildStage({
      programs: config.programs,
      features,
      parallel: args.parallel,
      root: config.root,
    })

    try {
      await stage.start()
    } catch (err: any) {
      consola.error(err.message)
      process.exit(1)
    }
  },
})
