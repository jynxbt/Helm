#!/usr/bin/env node
import { createRequire } from 'node:module'
import { defineCommand, runMain } from 'citty'
import consola from 'consola'

// Read the version from package.json at runtime so `polyq --version`
// doesn't silently drift on every Changesets bump. createRequire resolves
// relative to this file whether we're in `src/` during dev or
// `dist/cli/` after publish — both are two levels below the package root.
const { version } = createRequire(import.meta.url)('../../package.json') as {
  version: string
}

// When stdout is piped (CI, shell redirects, subprocess tests), replace
// consola's default reporter with a plain stdout writer. The fancy reporter
// uses its own stream management that doesn't reliably reach non-TTY pipes
// (see vitest + execa). Leaves interactive TTYs untouched.
if (!process.stdout.isTTY) {
  consola.setReporters([
    {
      log: entry => {
        const line = entry.args.map(a => (typeof a === 'string' ? a : String(a))).join(' ')
        process.stdout.write(`${line}\n`)
      },
    },
  ])
}

const main = defineCommand({
  meta: {
    name: 'polyq',
    version,
    description:
      'DX toolkit for Solana and EVM — schema sync, polyfills, codegen, and workspace orchestration',
  },
  subCommands: {
    dev: () => import('./commands/dev').then(m => m.default),
    build: () => import('./commands/build').then(m => m.default),
    codegen: () => import('./commands/codegen').then(m => m.default),
    stop: () => import('./commands/stop').then(m => m.default),
    status: () => import('./commands/status').then(m => m.default),
    init: () => import('./commands/init').then(m => m.default),
  },
})

runMain(main)
