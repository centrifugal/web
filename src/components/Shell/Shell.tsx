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

import { UpgradeDialog } from './UpgradeDialog'
import { ShellAppBar } from './ShellAppBar'
import { NotificationArea } from './NotificationArea'
import { RouteContent } from './RouteContent'

export interface ShellProps extends PropsWithChildren {
  appNeedsUpdate: boolean
}

const globalUrlPrefix = window.location.pathname

export const Shell = ({ appNeedsUpdate, children }: ShellProps) => {
  const settingsContext = useContext(SettingsContext)
  const [isAlertShowing, setIsAlertShowing] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(true)
  const [isInsecure, setIsInsecure] = useState(false)
  const [doShowPeers, setDoShowPeers] = useState(false)
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
      setDoShowPeers,
      setNumberOfPeers,
      setTitle,
      showAlert,
    }),
    [
      numberOfPeers,
      tabHasFocus,
      setDoShowPeers,
      setNumberOfPeers,
      setTitle,
      showAlert,
    ]
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

  const handleDrawerOpen = () => {
    setIsDrawerOpen(true)
  }

  const handleLinkButtonClick = async () => {
    await navigator.clipboard.writeText(window.location.href)

    shellContextValue.showAlert('Current URL copied to clipboard', {
      severity: 'success',
    })
  }

  const handleDrawerClose = () => {
    setIsDrawerOpen(false)
  }

  const handleHomeLinkClick = () => {
    setIsDrawerOpen(false)
  }

  const handleAboutLinkClick = () => {
    setIsDrawerOpen(false)
  }

  const handleSettingsLinkClick = () => {
    setIsDrawerOpen(false)
  }

  const handleLogin = function (password: string) {
    const formData = new FormData()
    formData.append('password', password)
    fetch(`${globalUrlPrefix}admin/auth`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      body: formData,
    })
      .then(response => {
        if (!response.ok) {
          throw Error(response.status.toString())
        }
        return response.json()
      })
      .then(data => {
        localStorage.setItem('token', data.token)
        const insecure = data.token === 'insecure'
        if (insecure) {
          localStorage.setItem('insecure', 'true')
        }
        setIsInsecure(insecure)
        setIsAuthenticated(true)
      })
      .catch(() => {})
  }

  const handleLogout = function () {
    delete localStorage.token
    delete localStorage.insecure
    setIsAuthenticated(false)
    setIsInsecure(false)
  }

  return (
    <ShellContext.Provider value={shellContextValue}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <UpgradeDialog appNeedsUpdate={appNeedsUpdate} />
        {isAuthenticated ? (
          <Box>
            <NotificationArea
              alertSeverity={alertSeverity}
              alertText={alertText}
              isAlertShowing={isAlertShowing}
              onAlertClose={handleAlertClose}
            />
            <ShellAppBar
              doShowPeers={doShowPeers}
              handleDrawerOpen={handleDrawerOpen}
              handleLinkButtonClick={handleLinkButtonClick}
              handleLogout={handleLogout}
              isDrawerOpen={isDrawerOpen}
              numberOfPeers={numberOfPeers}
              title={title}
            />
            {/* <Drawer
              isDrawerOpen={isDrawerOpen}
              onAboutLinkClick={handleAboutLinkClick}
              onDrawerClose={handleDrawerClose}
              onHomeLinkClick={handleHomeLinkClick}
              onSettingsLinkClick={handleSettingsLinkClick}
              theme={theme}
              userId={userId}
            /> */}
            <RouteContent isDrawerOpen={false}>{children}</RouteContent>
          </Box>
        ) : (
          <Login handleLogin={handleLogin} />
        )}
      </ThemeProvider>
    </ShellContext.Provider>
  )
}
