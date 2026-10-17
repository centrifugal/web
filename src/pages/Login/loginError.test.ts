import { describe, test, expect } from 'vitest'

import { loginErrorMessage, takeLoginError } from './loginError'

describe('login error', () => {
  test('is taken from the URL once, keeping the rest of it', () => {
    window.history.replaceState(
      null,
      '',
      '/admin/?login_error=denied&x=1#/status'
    )
    expect(takeLoginError()).toBe('denied')
    expect(window.location.search).toBe('?x=1')
    expect(window.location.hash).toBe('#/status')
    expect(takeLoginError()).toBeNull()
  })

  test('has a message for every code, and a generic one otherwise', () => {
    expect(loginErrorMessage('denied')).toMatch(/no access/)
    expect(loginErrorMessage('expired')).toMatch(/too long/)
    expect(loginErrorMessage('unavailable')).toMatch(/not available/)
    expect(loginErrorMessage('failed')).toMatch(/Login failed/)
    expect(loginErrorMessage('something-new')).toMatch(/Login failed/)
  })
})
