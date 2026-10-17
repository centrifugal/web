// Server-side OIDC login sends the browser back with ?login_error=<code>
// when it fails (PRO). The codes are the server's loginError* constants.

// takeLoginError returns the login error of the page URL and removes it, so
// a reload doesn't show it again.
export const takeLoginError = (): string | null => {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('login_error')
  if (code === null) return null
  params.delete('login_error')
  const search = params.toString()
  window.history.replaceState(
    null,
    '',
    window.location.pathname +
      (search ? `?${search}` : '') +
      window.location.hash
  )
  return code
}

export const loginErrorMessage = (code: string): string => {
  switch (code) {
    case 'denied':
      return 'Your account has no access to Centrifugo admin. Ask your administrator for access.'
    case 'expired':
      return 'Login took too long. Please try again.'
    case 'unavailable':
      return 'Single sign-on is not available right now. Please try again in a minute.'
    default:
      return 'Login failed. Please try again.'
  }
}
