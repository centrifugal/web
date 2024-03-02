import { PropsWithChildren, useContext, useEffect, useState } from 'react'
import { HashRouter as Router, Routes, Route, Link } from 'react-router-dom'
import localforage from 'localforage'
import Box from '@mui/material/Box'
import UILink from '@mui/material/Link'

import { StorageContext } from 'contexts/StorageContext'
import { SettingsContext } from 'contexts/SettingsContext'
import { globalUrlPrefix } from 'config/url'
import { routes } from 'config/routes'
import { Status } from 'pages/Status/index'
import { Settings } from 'pages/Settings'
import { Actions } from 'pages/Actions'
import { Tracing } from 'pages/Tracing'
import { Analytics } from 'pages/Analytics'
import { PushNotification } from 'pages/PushNotification'
import { AdminSettings, UserSettings } from 'models/settings'
import { PersistedStorageKeys } from 'models/storage'
import { Shell } from 'components/Shell'
import { Typography } from '@mui/material'
import { AdminSettingsContext } from 'contexts/AdminSettingsContext'

import { useAuth } from 'react-oidc-context'

import { AuthProvider } from 'react-oidc-context'
import { User, WebStorageStateStore } from 'oidc-client-ts'

export interface AppProps {
  persistedStorage?: typeof localforage
}

async function fetchAdminSettings() {
  try {
    const response = await fetch(`${globalUrlPrefix}admin/settings`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    return data
  } catch (error) {
    console.error('There was a problem fetching the data: ', error)
    return {}
  }
}

function App({
  persistedStorage: persistedStorageProp = localforage.createInstance({
    name: 'centrifugo',
    description: 'Persisted settings data for centrifugo',
  }),
}: AppProps) {
  const [persistedStorage] = useState(persistedStorageProp)
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false)
  const [hasLoadedAdminSettings, setHasLoadedAdminSettings] = useState(false)
  const [userSettings, setUserSettings] = useState<UserSettings>({
    colorMode: 'light',
  })
  const [adminSettings, setAdminSettings] = useState<AdminSettings>({
    insecure: false,
    edition: 'oss',
  })
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem('token') ? true : false
  )
  const edition = adminSettings.edition
  let useIDP = false
  let oidcConfig: any = null
  if (adminSettings.oidc) {
    useIDP = true
    oidcConfig = {
      authority: adminSettings.oidc.authority,
      client_id: adminSettings.oidc.client_id,
      redirect_uri: adminSettings.oidc.redirect_uri,
      onSigninCallback: (_user: User | void): void => {
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        ) // Clear state from URL.
      },
      accessTokenExpiringNotificationTimeInSeconds: 30,
      userStore: new WebStorageStateStore({ store: window.localStorage }),
    }
    if (adminSettings.oidc.scope !== '') {
      oidcConfig.scope = adminSettings.oidc.scope
    }
  }

  useEffect(() => {
    ;(async () => {
      if (hasLoadedSettings) return

      const persistedUserSettings =
        await persistedStorageProp.getItem<UserSettings>(
          PersistedStorageKeys.USER_SETTINGS
        )

      if (persistedUserSettings) {
        setUserSettings({ ...userSettings, ...persistedUserSettings })
      } else {
        await persistedStorageProp.setItem(
          PersistedStorageKeys.USER_SETTINGS,
          userSettings
        )
      }

      setHasLoadedSettings(true)
    })()
  }, [hasLoadedSettings, persistedStorageProp, userSettings])

  useEffect(() => {
    ;(async () => {
      if (hasLoadedSettings) return

      const adminSettings = await fetchAdminSettings()
      setAdminSettings(adminSettings)
      setHasLoadedAdminSettings(true)
    })()
  }, [hasLoadedSettings])

  const settingsContextValue = {
    updateUserSettings: async (changedSettings: Partial<UserSettings>) => {
      const newSettings = {
        ...userSettings,
        ...changedSettings,
      }

      await persistedStorageProp.setItem(
        PersistedStorageKeys.USER_SETTINGS,
        newSettings
      )

      setUserSettings(newSettings)
    },
    getUserSettings: () => ({ ...userSettings }),
  }

  const adminSettingsContextValue = {
    updateAdminSettings: async (newSettings: AdminSettings) => {
      setAdminSettings(newSettings)
    },
    getAdminSettings: () => ({ ...adminSettings }),
  }

  const storageContextValue = {
    getPersistedStorage: () => persistedStorage,
  }

  const handlePasswordLogout = function () {
    delete localStorage.token
    setIsAuthenticated(false)
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
      mode: 'same-origin',
    })
      .then(response => {
        if (!response.ok) {
          throw Error(response.status.toString())
        }
        return response.json()
      })
      .then(data => {
        localStorage.setItem('token', data.token)
        setIsAuthenticated(true)
      })
      .catch(e => {})
  }

  return (
    <Router>
      <StorageContext.Provider value={storageContextValue}>
        <AdminSettingsContext.Provider value={adminSettingsContextValue}>
          <SettingsContext.Provider value={settingsContextValue}>
            {hasLoadedSettings && hasLoadedAdminSettings ? (
              useIDP ? (
                <AuthProvider {...oidcConfig}>
                  <ShellWrapper
                    handleLogin={handleLogin}
                    handlePasswordLogout={handlePasswordLogout}
                    passwordAuthenticated={false}
                    edition={edition}
                  />
                </AuthProvider>
              ) : (
                <AuthProvider>
                  <ShellWrapper
                    handleLogin={handleLogin}
                    handlePasswordLogout={handlePasswordLogout}
                    passwordAuthenticated={isAuthenticated}
                    edition={edition}
                  />
                </AuthProvider>
              )
            ) : (
              <></>
            )}
          </SettingsContext.Provider>
        </AdminSettingsContext.Provider>
      </StorageContext.Provider>
    </Router>
  )
}

export interface ShellWrapperProps extends PropsWithChildren {
  handleLogin: (password: string) => void
  handlePasswordLogout: () => void
  passwordAuthenticated: boolean
  edition: 'oss' | 'pro'
}

function ShellWrapper({
  handleLogin,
  handlePasswordLogout,
  passwordAuthenticated,
  edition,
}: ShellWrapperProps) {
  const adminSettingsContext = useContext(AdminSettingsContext)
  const adminSettings = adminSettingsContext.getAdminSettings()
  const insecure = adminSettings.insecure
  const useIDP = adminSettings.oidc !== undefined
  let authorization = ''
  const auth = useAuth()
  if (!insecure) {
    if (useIDP) {
      authorization = `Bearer ${auth.user?.access_token}`
    } else {
      authorization = `token ${localStorage.getItem('token')}`
    }
  }

  const handleLogout = () => {
    if (auth) {
      auth.removeUser()
    }
    handlePasswordLogout()
  }

  const [lastSignIn, setLastSignIn] = useState(0)

  const signinSilent = () => {
    if (!useIDP) {
      handleLogout()
      return
    }
    if (!auth) {
      handleLogout()
      return
    }
    const now = Date.now()
    if (now - lastSignIn >= 10000) {
      // throttle to once in 10 seconds.
      auth.signinSilent()
      setLastSignIn(now)
    }
  }

  const [hasTriedSignin, setHasTriedSignin] = useState(false)

  // automatically sign-in
  useEffect(() => {
    if (
      auth.user &&
      !auth.isAuthenticated &&
      !auth.activeNavigator &&
      !auth.isLoading &&
      !hasTriedSignin
    ) {
      auth.signinRedirect()
      setHasTriedSignin(true)
    }
  }, [auth, hasTriedSignin])

  return (
    <Shell
      handleLogin={handleLogin}
      handleLogout={handleLogout}
      passwordAuthenticated={passwordAuthenticated}
      edition={edition}
    >
      <Routes>
        {[routes.ROOT, routes.INDEX_HTML].map(path => (
          <Route
            key={path}
            path={path}
            element={
              <Status
                signinSilent={signinSilent}
                authorization={authorization}
                edition={edition}
              />
            }
          />
        ))}
        <Route path={routes.SETTINGS} element={<Settings />} />
        <Route
          path={routes.ACTIONS}
          element={
            <Actions
              signinSilent={signinSilent}
              authorization={authorization}
              edition={edition}
            />
          }
        />
        {edition === 'pro' ? (
          <Route
            path={routes.TRACING}
            element={
              <Tracing
                signinSilent={signinSilent}
                authorization={authorization}
              />
            }
          />
        ) : (
          <></>
        )}
        {edition === 'pro' ? (
          <Route
            path={routes.ANALYTICS}
            element={
              <Analytics
                signinSilent={signinSilent}
                authorization={authorization}
              />
            }
          />
        ) : (
          <></>
        )}
        {edition === 'pro' ? (
          <Route
            path={routes.PUSH_NOTIFICATION}
            element={
              <PushNotification
                signinSilent={signinSilent}
                authorization={authorization}
                edition={edition}
              />
            }
          />
        ) : (
          <></>
        )}
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Shell>
  )
}

function PageNotFound() {
  return (
    <Box className="max-w-8xl mx-auto p-8">
      <Typography variant="h6">
        Page not found, go to{' '}
        <UILink to={'/'} component={Link}>
          home page
        </UILink>
      </Typography>
    </Box>
  )
}

export default App
