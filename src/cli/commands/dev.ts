import { defineCommand } from 'citty'
import consola from 'consola'
import { loadConfig } from '../../config/loader'
import { buildStages, runStages, stopStages } from '../../workspace/orchestrator'

export default defineCommand({
  meta: {
    name: 'dev',
    description: 'Start development environment',
  },
  args: {
    quick: {
      type: 'boolean',
      description: 'Skip program builds',
      default: false,
    },
    reset: {
      type: 'boolean',
      description: 'Full reset before starting (drop DB, restart validator, rebuild)',
      default: false,
    },
    only: {
      type: 'string',
      description: 'Run only specific stages (comma-separated: docker,validator,programs,database)',
    },
  },
  async run({ args }) {
    const config = await loadConfig()

    if (!config.workspace) {
      throw new Error(
        'No workspace config found. Add a `workspace` section to polyq.config.ts ' +
          'or run `polyq init` to generate a config file.',
      )
    }

    const only = args.only?.split(',').map(s => s.trim())
    const stages = buildStages(config, {
      quick: args.quick,
      reset: args.reset,
      ...(only && { only }),
    })

    if (stages.length === 0) {
      consola.warn('No stages to run')
      return
    }

    consola.box(`Polyq Dev${args.quick ? ' (quick)' : ''}${args.reset ? ' (reset)' : ''}`)

    // Handle graceful shutdown — stop all running stages before exit
    let shuttingDown = false
    const cleanup = async () => {
      if (shuttingDown) return
      shuttingDown = true
      consola.info('\nShutting down services...')
      await stopStages(stages)
      process.exit(0)
    }
    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)

    try {
      await runStages(stages)
    } catch (err) {
      // Clean up stages that already started before re-throwing — citty
      // doesn't know about them, so we must stop them ourselves.
      consola.info('Stopping started services...')
      await stopStages(stages)
      throw err
    }
  },
})
