import { describe, test, expect, beforeEach, vi } from 'vitest'

import { lastSSOUser, rememberSSOUser } from './lastUser'

describe('last SSO user', () => {
  beforeEach(() => {
    // Node's own experimental localStorage shadows jsdom's in this setup.
    const items = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => items.get(k) ?? null,
      setItem: (k: string, v: string) => items.set(k, v),
      removeItem: (k: string) => items.delete(k),
    })
  })

  test('is remembered, and an empty name keeps the last one', () => {
    expect(lastSSOUser()).toBeNull()
    rememberSSOUser('alice@example.com')
    rememberSSOUser(undefined)
    rememberSSOUser('')
    expect(lastSSOUser()).toBe('alice@example.com')
  })

  test('works without storage', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(() => rememberSSOUser('alice@example.com')).not.toThrow()
    expect(lastSSOUser()).toBeNull()
  })
})
