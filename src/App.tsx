import { useEffect, useState } from 'react'
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
    edition: 'oss',
  })
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem('token') ? true : false
  )
  const [isInsecure, setIsInsecure] = useState(
    localStorage.getItem('insecure') === 'true'
  )
  const edition = adminSettings.edition

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

  const handleLogout = function () {
    delete localStorage.token
    delete localStorage.insecure
    setIsAuthenticated(false)
    setIsInsecure(false)
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
        const insecure = data.token === 'insecure'
        if (insecure) {
          localStorage.setItem('insecure', 'true')
        }
        setIsInsecure(insecure)
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
              <Shell
                handleLogin={handleLogin}
                handleLogout={handleLogout}
                authenticated={isAuthenticated}
                insecure={isInsecure}
                edition={edition}
              >
                <Routes>
                  {[routes.ROOT, routes.INDEX_HTML].map(path => (
                    <Route
                      key={path}
                      path={path}
                      element={
                        <Status
                          handleLogout={handleLogout}
                          insecure={isInsecure}
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
                        handleLogout={handleLogout}
                        insecure={isInsecure}
                        edition={edition}
                      />
                    }
                  />
                  {edition === 'pro' ? (
                    <Route path={routes.TRACING} element={<Tracing />} />
                  ) : (
                    <></>
                  )}
                  {edition === 'pro' ? (
                    <Route
                      path={routes.ANALYTICS}
                      element={
                        <Analytics
                          handleLogout={handleLogout}
                          insecure={isInsecure}
                          edition={edition}
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
                          handleLogout={handleLogout}
                          insecure={isInsecure}
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
            ) : (
              <></>
            )}
          </SettingsContext.Provider>
        </AdminSettingsContext.Provider>
      </StorageContext.Provider>
    </Router>
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
