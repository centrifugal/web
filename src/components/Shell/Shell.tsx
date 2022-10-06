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
import { ThemeProvider, createTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import { AlertColor } from '@mui/material/Alert'

import { ShellContext } from 'contexts/ShellContext'
import { SettingsContext } from 'contexts/SettingsContext'
import { AlertOptions } from 'models/shell'
import { Login } from 'pages/Login/Login'

// import { UpgradeDialog } from './UpgradeDialog'
import { ShellAppBar } from './ShellAppBar'
import { NotificationArea } from './NotificationArea'
import { RouteContent } from './RouteContent'

export interface ShellProps extends PropsWithChildren {
  // appNeedsUpdate: boolean
  handleLogin: (password: string) => void
  handleLogout: () => void
  authenticated: boolean
  insecure: boolean
  edition: 'oss' | 'pro'
}

export const Shell = ({
  // appNeedsUpdate,
  handleLogin,
  handleLogout,
  authenticated,
  insecure,
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

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: colorMode,
        },
      }),
    [colorMode]
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

  useEffect(() => {
    document.title = title
  }, [title])

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
        {/* <UpgradeDialog appNeedsUpdate={appNeedsUpdate} /> */}
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
            />
            <RouteContent>{children}</RouteContent>
          </Box>
        ) : (
          <Login handleLogin={handleLogin} />
        )}
      </ThemeProvider>
    </ShellContext.Provider>
  )
}
