import { describe, expect, it } from 'vitest'
import { waitUntilReady } from '../src/workspace/health'

describe('waitUntilReady', () => {
  it('resolves immediately when check passes', async () => {
    let calls = 0
    await waitUntilReady(
      async () => {
        calls++
        return true
      },
      { label: 'test', interval: 10, timeout: 1000, quiet: true },
    )
    expect(calls).toBe(1)
  })

  it('polls until check passes', async () => {
    let calls = 0
    await waitUntilReady(
      async () => {
        calls++
        return calls >= 3
      },
      { label: 'test', interval: 10, timeout: 1000, quiet: true },
    )
    expect(calls).toBe(3)
  })

  it('throws when timeout expires', async () => {
    await expect(
      waitUntilReady(async () => false, { label: 'test', interval: 10, timeout: 50, quiet: true }),
    ).rejects.toThrow('did not become ready')
  })

  it('keeps polling when check throws', async () => {
    let calls = 0
    await waitUntilReady(
      async () => {
        calls++
        if (calls < 3) throw new Error('not yet')
        return true
      },
      { label: 'test', interval: 10, timeout: 1000, quiet: true },
    )
    expect(calls).toBe(3)
  })
})
