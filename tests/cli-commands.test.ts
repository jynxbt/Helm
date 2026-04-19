import { runCommand } from 'citty'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Error-path coverage for the CLI command surface. Before the Phase C
 * refactor these commands called `process.exit(1)` inline, which meant
 * they couldn't be driven in-process — the test runner itself would
 * exit. They now throw, so we can assert the exact user-visible error
 * shape here instead of crossing fingers.
 *
 * loadConfig is stubbed per test. The real loader would read the test
 * harness's own polyq.config.ts (or lack thereof), which is both
 * irrelevant and unstable — we're testing the CLI's contract, not the
 * loader's.
 */

vi.mock('../src/config/loader', () => ({
  loadConfig: vi.fn(),
}))

const loader = await import('../src/config/loader')
const loadConfigMock = loader.loadConfig as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  loadConfigMock.mockReset()
})

describe('polyq build', () => {
  it('throws when `programs` is empty', async () => {
    loadConfigMock.mockResolvedValue({ programs: {} })
    const mod = await import('../src/cli/commands/build')
    await expect(runCommand(mod.default, { rawArgs: [] })).rejects.toThrow(/No programs configured/)
  })

  it('throws when `programs` is missing entirely', async () => {
    loadConfigMock.mockResolvedValue({})
    const mod = await import('../src/cli/commands/build')
    await expect(runCommand(mod.default, { rawArgs: [] })).rejects.toThrow(/No programs configured/)
  })
})

describe('polyq dev', () => {
  it('throws when `workspace` is missing', async () => {
    loadConfigMock.mockResolvedValue({ programs: {} })
    const mod = await import('../src/cli/commands/dev')
    await expect(runCommand(mod.default, { rawArgs: [] })).rejects.toThrow(
      /No workspace config found/,
    )
  })

  it('error message hints at `polyq init`', async () => {
    loadConfigMock.mockResolvedValue({})
    const mod = await import('../src/cli/commands/dev')
    await expect(runCommand(mod.default, { rawArgs: [] })).rejects.toThrow(/polyq init/)
  })
})

describe('polyq stop', () => {
  it('throws when `workspace` is missing', async () => {
    loadConfigMock.mockResolvedValue({})
    const mod = await import('../src/cli/commands/stop')
    await expect(runCommand(mod.default, { rawArgs: [] })).rejects.toThrow(
      /No workspace config found/,
    )
  })
})

describe('polyq status', () => {
  it('throws when `workspace` is missing', async () => {
    loadConfigMock.mockResolvedValue({})
    const mod = await import('../src/cli/commands/status')
    await expect(runCommand(mod.default, { rawArgs: [] })).rejects.toThrow(
      /No workspace config found/,
    )
  })
})

describe('polyq codegen', () => {
  it('throws on invalid --chain value', async () => {
    const mod = await import('../src/cli/commands/codegen')
    await expect(runCommand(mod.default, { rawArgs: ['--chain', 'bogus'] })).rejects.toThrow(
      /Invalid chain: 'bogus'/,
    )
  })

  it('invalid-chain error lists the valid choices', async () => {
    const mod = await import('../src/cli/commands/codegen')
    await expect(runCommand(mod.default, { rawArgs: ['--chain', 'xxx'] })).rejects.toThrow(
      /svm, evm/,
    )
  })
})
