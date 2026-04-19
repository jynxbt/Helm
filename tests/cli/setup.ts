import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'pathe'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(HERE, '..', '..')
export const CLI_PATH = resolve(REPO_ROOT, 'dist', 'cli', 'index.mjs')

/**
 * Build the CLI if `dist/cli/index.js` is missing. No-op if the CLI is already built.
 * Called from each CLI test file's top-level `beforeAll` so the suite stays self-contained.
 */
export function ensureCliBuilt(): void {
  if (existsSync(CLI_PATH)) return
  execSync('bun run build', { cwd: REPO_ROOT, stdio: 'inherit' })
}
