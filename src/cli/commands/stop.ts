import { defineCommand } from 'citty'
import consola from 'consola'

export default defineCommand({
  meta: {
    name: 'stop',
    description: 'Stop all running Solana development services',
  },
  async run() {
    consola.info('Stopping services...')
    // TODO: Phase 4
    consola.warn('Smart stop not yet implemented')
  },
})
