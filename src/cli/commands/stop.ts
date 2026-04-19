import { defineCommand } from 'citty'
import consola from 'consola'
import { loadConfig } from '../../config/loader'
import { buildStages, stopStages } from '../../workspace/orchestrator'

export default defineCommand({
  meta: {
    name: 'stop',
    description: 'Stop all running development services',
  },
  args: {
    all: {
      type: 'boolean',
      description: 'Also stop Docker services',
      default: false,
    },
  },
  async run({ args }) {
    const config = await loadConfig()

    if (!config.workspace) {
      throw new Error('No workspace config found. Add a `workspace` section to polyq.config.ts')
    }

    // Build stages just to get the stop() methods
    const stages = buildStages(config)

    // By default, skip Docker (like Zenned's localnet:stop)
    const toStop = args.all ? stages : stages.filter(s => s.name !== 'Docker')

    consola.info(`Stopping ${toStop.length} service(s)...`)
    await stopStages(toStop)
  },
})
