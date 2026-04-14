import { defineCommand } from 'citty'
import consola from 'consola'

export default defineCommand({
  meta: {
    name: 'status',
    description: 'Show status of development services',
  },
  async run() {
    consola.info('Checking services...')
    // TODO: Phase 4
    consola.warn('Smart status not yet implemented')
  },
})
