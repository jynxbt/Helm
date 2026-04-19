import { describe, expect, it } from 'vitest'
import { errorMessage, parseRpcPort } from '../src/utils/error'

describe('errorMessage', () => {
  it('reads .message off an Error instance', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
  })

  it('returns the string as-is when given a string', () => {
    expect(errorMessage('nope')).toBe('nope')
  })

  it('stringifies plain objects', () => {
    expect(errorMessage({ code: 42 })).toBe('{"code":42}')
  })

  it('falls back to String() for un-serializable values', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(errorMessage(cyclic)).toBe('[object Object]')
  })

  it('handles null and undefined', () => {
    expect(errorMessage(null)).toBe('null')
    expect(errorMessage(undefined)).toBe('undefined')
  })
})

describe('parseRpcPort', () => {
  it('returns the port from a standard URL', () => {
    expect(parseRpcPort('http://127.0.0.1:8899', 1)).toBe(8899)
  })

  it('defaults to scheme default when port is omitted', () => {
    expect(parseRpcPort('http://example.com', 9999)).toBe(80)
    expect(parseRpcPort('https://example.com', 9999)).toBe(443)
  })

  it('returns the fallback for malformed URLs', () => {
    expect(parseRpcPort('not-a-url', 8545)).toBe(8545)
  })

  it('parses non-standard ports on localhost', () => {
    expect(parseRpcPort('http://127.0.0.1:31337', 8545)).toBe(31337)
  })
})
