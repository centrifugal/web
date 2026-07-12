import {
  PropsWithChildren,
  SyntheticEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import Box from '@mui/material/Box'
import { AlertColor } from '@mui/material/Alert'

import { createAppTheme } from 'theme'
import { ShellContext } from 'contexts/ShellContext'
import { SettingsContext } from 'contexts/SettingsContext'
import { AlertOptions } from 'models/shell'
import { Login } from 'pages/Login/Login'
import { AdminSettingsContext } from 'contexts/AdminSettingsContext'

import { useAuth } from 'react-oidc-context'

import { ShellAppBar } from './ShellAppBar'
import { NotificationArea } from './NotificationArea'
import { RouteContent } from './RouteContent'

export interface ShellProps extends PropsWithChildren {
  handleLogin: (password: string) => Promise<void>
  handleLogout: () => void
  passwordAuthenticated: boolean
  edition: 'oss' | 'pro'
}

export const Shell = ({
  handleLogin,
  handleLogout,
  passwordAuthenticated,
  edition,
  children,
}: ShellProps) => {
  const settingsContext = useContext(SettingsContext)
  const [isAlertShowing, setIsAlertShowing] = useState(false)
  const [alertSeverity, setAlertSeverity] = useState<AlertColor>('info')
  const [title, setTitle] = useState('')
  const [alertText, setAlertText] = useState('')
  const [numberOfPeers, setNumberOfPeers] = useState(1)
  const [tabHasFocus, setTabHasFocus] = useState(true)

  let authenticated = false
  const adminSettingsContext = useContext(AdminSettingsContext)
  const adminSettings = adminSettingsContext.getAdminSettings()
  const insecure = adminSettings.insecure
  const useIDP = adminSettings.oidc !== undefined
  const usePKCE = adminSettings.oidc?.pkce === true
  const auth = useAuth()
  let username = ''

  // Check PKCE flow first (uses react-oidc-context)
  if (useIDP && usePKCE) {
    // PKCE flow: check auth from react-oidc-context
    authenticated = auth.isAuthenticated || adminSettings.insecure
    if (auth.user?.profile.preferred_username) {
      username = auth.user?.profile.preferred_username
    }
  } else if (useIDP && !usePKCE) {
    // Server-side OIDC: trust backend's authenticated flag
    authenticated = adminSettings.authenticated || adminSettings.insecure
    if (adminSettings.user?.name) {
      username = adminSettings.user.name
    } else if (adminSettings.user?.email) {
      username = adminSettings.user.email
    }
  } else {
    // Password auth
    authenticated = passwordAuthenticated || adminSettings.insecure
  }

  const showAlert = useCallback<
    (message: string, options?: AlertOptions) => void
  >((message, options) => {
    setAlertText(message)
    setAlertSeverity(options?.severity ?? 'info')
    setIsAlertShowing(true)
  }, [])

  const shellContextValue = useMemo(
    () => ({
      numberOfPeers,
      tabHasFocus,
      setNumberOfPeers,
      setTitle,
      showAlert,
    }),
    [numberOfPeers, tabHasFocus, setNumberOfPeers, setTitle, showAlert]
  )

  const colorMode = settingsContext.getUserSettings().colorMode
  const accentColor = settingsContext.getUserSettings().accentColor
  const accentColor2 = settingsContext.getUserSettings().accentColor2

  const theme = useMemo(
    () => createAppTheme(colorMode, accentColor, accentColor2),
    [colorMode, accentColor, accentColor2]
  )

  const handleAlertClose = (
    _event?: SyntheticEvent | Event,
    reason?: string
  ) => {
    if (reason === 'clickaway') {
      return
    }

    setIsAlertShowing(false)
  }

  // Clear any pending alert when logging out. The Snackbar only renders while
  // authenticated, so an error alert shown right before logout (e.g. the 401
  // that triggered it) would otherwise stay frozen and re-surface on the next
  // successful login.
  useEffect(() => {
    if (!authenticated) {
      setIsAlertShowing(false)
    }
  }, [authenticated])

  useEffect(() => {
    document.title = title
  }, [title])

  // Cross-tab logout for the OIDC (PKCE) flow: when the stored user is cleared
  // in another tab, log out here too. Registered in an effect (not in the render
  // body) so the listener is added once and cleaned up, rather than leaking a
  // new listener on every render.
  useEffect(() => {
    if (!(useIDP && usePKCE)) return
    const key = `oidc.user:${adminSettings.oidc?.authority}:${adminSettings.oidc?.client_id}`
    const onStorage = (e: StorageEvent) => {
      if (e.key === key && e.oldValue !== null && e.newValue === null) {
        handleLogout()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [
    useIDP,
    usePKCE,
    adminSettings.oidc?.authority,
    adminSettings.oidc?.client_id,
    handleLogout,
  ])

  useEffect(() => {
    const handleFocus = () => {
      setTabHasFocus(true)
    }
    const handleBlur = () => {
      setTabHasFocus(false)
    }
    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  return (
    <ShellContext.Provider value={shellContextValue}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {authenticated ? (
          <Box>
            <NotificationArea
              alertSeverity={alertSeverity}
              alertText={alertText}
              isAlertShowing={isAlertShowing}
              onAlertClose={handleAlertClose}
            />
            <ShellAppBar
              handleLogout={handleLogout}
              title={title}
              insecure={insecure}
              edition={edition}
              username={username}
            />
            <RouteContent>{children}</RouteContent>
          </Box>
        ) : auth && auth.isLoading === true ? (
          <></>
        ) : (
          <Login handleLogin={handleLogin} />
        )}
      </ThemeProvider>
    </ShellContext.Provider>
  )
}
