import { describe, test, expect, vi, beforeEach } from 'vitest'

import { reauthenticate, ssoLoginURL, takeReturnTo } from './ssoReauth'

const init = (body: unknown) =>
  vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))

describe('SSO re-authentication', () => {
  let assign: ReturnType<typeof vi.fn>
  beforeEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
    assign = vi.fn()
    vi.stubGlobal('location', {
      ...window.location,
      hash: '#/analytics?tab=trends',
      assign,
    })
  })

  test('goes to the identity provider and remembers the page', async () => {
    init({ oidc: { pkce: false, available: true } })
    expect(await reauthenticate()).toBe(true)
    expect(assign).toHaveBeenCalledWith(ssoLoginURL)
    expect(takeReturnTo()).toBe('#/analytics?tab=trends')
    expect(takeReturnTo()).toBeNull()
  })

  test('tries once - a second expiry soon after shows the login page', async () => {
    init({ oidc: { pkce: false, available: true } })
    expect(await reauthenticate()).toBe(true)
    expect(await reauthenticate()).toBe(false)
    expect(assign).toHaveBeenCalledTimes(1)
  })

  test('does not try while the identity provider is unavailable', async () => {
    init({ oidc: { pkce: false, available: false } })
    expect(await reauthenticate()).toBe(false)
    expect(assign).not.toHaveBeenCalled()
    expect(takeReturnTo()).toBeNull()
  })
})
