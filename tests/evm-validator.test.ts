import { describe, expect, it } from 'vitest'
import { createEvmValidatorStage } from '../src/chains/evm/validator'

describe('EVM validator — configurability', () => {
  it('accepts a built-in tool with defaults', () => {
    const stage = createEvmValidatorStage({ tool: 'anvil', root: '/tmp' })
    expect(stage.name).toBe('EVM Node (anvil)')
  })

  it('throws a helpful error for an unknown tool without `command`', () => {
    expect(() => createEvmValidatorStage({ tool: 'reth-dev', root: '/tmp' })).toThrowError(
      /Unknown EVM tool "reth-dev"/,
    )
  })

  it('accepts an unknown tool when a custom `command` is provided', () => {
    const stage = createEvmValidatorStage({
      tool: 'reth-dev',
      command: '/usr/local/bin/reth',
      processName: 'reth',
      root: '/tmp',
    })
    expect(stage.name).toBe('EVM Node (reth-dev)')
    expect(stage.check).toBeDefined()
    expect(stage.start).toBeDefined()
    expect(stage.stop).toBeDefined()
  })

  it('lists known built-ins in the error message', () => {
    expect(() => createEvmValidatorStage({ tool: 'bogus', root: '/tmp' })).toThrowError(
      /anvil.*hardhat.*ganache/,
    )
  })
})
