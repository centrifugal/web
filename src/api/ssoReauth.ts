import { globalUrlPrefix } from 'config/url'

// When a server-side OIDC session expires (PRO: the session lasts as long as
// the identity provider's ID token, often an hour), the UI goes back to the
// identity provider instead of showing the login page: with its session
// still alive the user is back in a second, on the page they were on. An
// explicit logout never does this, and a failing attempt stops after one try.

// ssoLoginURL starts a server-side OIDC login: the server ties it to this
// browser and redirects to the identity provider.
export const ssoLoginURL = `${globalUrlPrefix}admin/oidc/login`

const returnToKey = 'centrifugo_sso_return_to'
const attemptKey = 'centrifugo_sso_reauth_at'

// Don't try again within this time: the last attempt did not help.
const retryAfterMs = 60 * 1000

// reauthenticate starts a new login at the identity provider. It returns
// false when it can't - then the caller shows the login page.
export const reauthenticate = async (): Promise<boolean> => {
  try {
    const last = Number(sessionStorage.getItem(attemptKey) || 0)
    if (Date.now() - last < retryAfterMs) return false
    const response = await fetch(`${globalUrlPrefix}admin/init`, {
      credentials: 'include',
    })
    if (!response.ok) return false
    const data = await response.json()
    if (!data.oidc || data.oidc.available === false) return false
    sessionStorage.setItem(attemptKey, String(Date.now()))
    sessionStorage.setItem(returnToKey, window.location.hash)
    window.location.assign(ssoLoginURL)
    return true
  } catch {
    return false
  }
}

// takeReturnTo returns the page to go back to after a new login, once.
export const takeReturnTo = (): string | null => {
  try {
    const hash = sessionStorage.getItem(returnToKey)
    sessionStorage.removeItem(returnToKey)
    return hash || null
  } catch {
    return null
  }
}
