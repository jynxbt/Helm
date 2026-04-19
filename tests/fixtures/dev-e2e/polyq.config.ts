import { definePolyqConfig } from 'polyq'

export default definePolyqConfig({
  chain: 'svm',

  workspace: {
    // Docker disabled — we're orchestrating validator + programs only.
    docker: { enabled: false },
    validator: {
      tool: 'solana-test-validator',
      rpcUrl: 'http://127.0.0.1:8899',
      // Keep the genesis lean so the validator boots fast.
      flags: ['--quiet', '--reset'],
    },
    // `polyq dev --quick` skips this, but the stage is defined so the
    // orchestrator's log shows "Dev Server" in sequence — that's what
    // the e2e greps for.
    devServer: {
      command: 'true',
    },
    healthChecks: {
      pollInterval: 2000,
      maxWait: 90_000,
      requestTimeout: 5000,
    },
  },
})
