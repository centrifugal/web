// The last account logged in through SSO (PRO), remembered in this browser
// so the login page can offer switching from it: with the identity
// provider's session alive, a plain login brings the same account back.

const key = 'centrifugo_sso_last_user'

export const rememberSSOUser = (name: string | undefined | null) => {
  if (!name) return
  try {
    localStorage.setItem(key, name)
  } catch {
    // Storage unavailable - the login page just won't name the account.
  }
}

export const lastSSOUser = (): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
