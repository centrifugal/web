import { useEffect, useState } from 'react'
import { HashRouter as Router, Routes, Route, Link } from 'react-router-dom'
import localforage from 'localforage'
import Box from '@mui/material/Box'
import UILink from '@mui/material/Link'

// import * as serviceWorkerRegistration from 'serviceWorkerRegistration'
import { StorageContext } from 'contexts/StorageContext'
import { SettingsContext } from 'contexts/SettingsContext'
import { globalUrlPrefix } from 'config/url'
import { routes } from 'config/routes'
import { Status } from 'pages/Status/index'
import { Settings } from 'pages/Settings'
import { Actions } from 'pages/Actions'
import { Tracing } from 'pages/Tracing'
import { Analytics } from 'pages/Analytics'
import { UserSettings } from 'models/settings'
import { PersistedStorageKeys } from 'models/storage'
import { Shell } from 'components/Shell'
import { Typography } from '@mui/material'

export interface AppProps {
  persistedStorage?: typeof localforage
}

function App({
  persistedStorage: persistedStorageProp = localforage.createInstance({
    name: 'centrifugo',
    description: 'Persisted settings data for centrifugo',
  }),
}: AppProps) {
  const [persistedStorage] = useState(persistedStorageProp)
  // const [appNeedsUpdate, setAppNeedsUpdate] = useState(false)
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false)
  const [userSettings, setUserSettings] = useState<UserSettings>({
    colorMode: 'light',
  })
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem('token') ? true : false
  )
  const [isInsecure, setIsInsecure] = useState(
    localStorage.getItem('insecure') === 'true'
  )
  const [edition, setEdition] = useState<'oss' | 'pro'>(
    localStorage.getItem('edition') === 'pro' ? 'pro' : 'oss'
  )

  // const handleServiceWorkerUpdate = () => {
  //   setAppNeedsUpdate(true)
  // }

  // useEffect(() => {
  //   serviceWorkerRegistration.register({ onUpdate: handleServiceWorkerUpdate })
  // }, [])

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

  const storageContextValue = {
    getPersistedStorage: () => persistedStorage,
  }

  const handleLogout = function () {
    delete localStorage.token
    delete localStorage.insecure
    delete localStorage.edition
    setIsAuthenticated(false)
    setIsInsecure(false)
    setEdition('oss')
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
        if (data.edition === 'pro') {
          setEdition('pro')
          localStorage.setItem('edition', 'pro')
        }
        setIsInsecure(insecure)
        setIsAuthenticated(true)
      })
      .catch(e => {})
  }

  return (
    <Router>
      <StorageContext.Provider value={storageContextValue}>
        <SettingsContext.Provider value={settingsContextValue}>
          {hasLoadedSettings ? (
            <Shell
              // appNeedsUpdate={appNeedsUpdate}
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
                <Route path="*" element={<PageNotFound />} />
              </Routes>
            </Shell>
          ) : (
            <></>
          )}
        </SettingsContext.Provider>
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
