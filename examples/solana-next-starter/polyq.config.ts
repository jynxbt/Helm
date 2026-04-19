import { definePolyqConfig } from 'polyq'

export default definePolyqConfig({
  chain: 'svm',

  schemaSync: {
    watchDir: 'target/idl',
    mapping: {
      counter: ['app/generated/counter-idl.json'],
    },
  },

  codegen: {
    outDir: 'generated',
  },

  workspace: {
    validator: {
      tool: 'solana-test-validator',
      rpcUrl: 'http://127.0.0.1:8899',
    },
    devServer: {
      command: 'bun run dev',
    },
  },
})
