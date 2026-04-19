import { execSync } from 'node:child_process'
import { beforeAll, describe, expect, it } from 'vitest'
import { CLI_PATH, ensureCliBuilt } from './setup'

/**
 * With the CLI's non-TTY reporter swap in place (`src/cli/index.ts`),
 * consola output is piped directly to `process.stdout` and visible to
 * execSync / spawn. Meta tests can now assert on actual content, not just
 * exit codes.
 */
function runCli(args: string[]): { out: string; code: number } {
  try {
    const out = execSync(`node ${CLI_PATH} ${args.join(' ')}`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { out, code: 0 }
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; status?: number }
    return { out: `${err.stdout ?? ''}\n${err.stderr ?? ''}`, code: err.status ?? 1 }
  }
}

// Strip ANSI escapes so tests don't have to match terminal-color sequences.
// Consola's fancy formatter emits them even through the piped reporter.
// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI-stripping inherently requires the ESC char
const ANSI_RE = /\u001b\[[0-9;]*m/g
function plain(s: string): string {
  return s.replace(ANSI_RE, '')
}

describe('polyq CLI — meta', () => {
  beforeAll(ensureCliBuilt)

  it('--help lists every subcommand', () => {
    const { out, code } = runCli(['--help'])
    expect(code).toBe(0)
    const text = plain(out)
    for (const cmd of ['init', 'dev', 'build', 'codegen', 'stop', 'status']) {
      expect(text).toContain(cmd)
    }
  })

  it('--version prints a semver string', () => {
    const { out, code } = runCli(['--version'])
    expect(code).toBe(0)
    expect(plain(out)).toMatch(/\d+\.\d+\.\d+/)
  })

  it('codegen --help documents --idl and --out', () => {
    const { out, code } = runCli(['codegen', '--help'])
    expect(code).toBe(0)
    const text = plain(out)
    expect(text).toContain('--idl')
    expect(text).toContain('--out')
  })

  it('init --help exits cleanly', () => {
    expect(runCli(['init', '--help']).code).toBe(0)
  })

  it('unknown subcommand exits non-zero', () => {
    expect(runCli(['bogus-subcommand']).code).not.toBe(0)
  })
})
