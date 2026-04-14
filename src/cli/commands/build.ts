import { defineCommand } from 'citty'
import consola from 'consola'

export default defineCommand({
  meta: {
    name: 'build',
    description: 'Build Solana programs',
  },
  args: {
    features: {
      type: 'string',
      description: 'Cargo features to enable (e.g., "local")',
    },
    parallel: {
      type: 'boolean',
      description: 'Build programs in parallel',
      default: true,
    },
  },
  async run({ args }) {
    consola.info('Building Solana programs...')

    // TODO: Phase 4 — workspace orchestration
    consola.warn('Smart build not yet implemented — use `anchor build` directly')
  },
})
