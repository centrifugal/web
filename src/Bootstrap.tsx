import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import localforage from 'localforage'

import * as serviceWorkerRegistration from 'serviceWorkerRegistration'
import { StorageContext } from 'contexts/StorageContext'
import { SettingsContext } from 'contexts/SettingsContext'
import { routes } from 'config/routes'
import { Status } from 'pages/Status/index'
import { About } from 'pages/About'
import { Settings } from 'pages/Settings'
import { Actions } from 'pages/Actions'
import { Tracing } from 'pages/Tracing'
import { UserSettings } from 'models/settings'
import { PersistedStorageKeys } from 'models/storage'
import { Shell } from 'components/Shell'

export interface BootstrapProps {
  persistedStorage?: typeof localforage
}

const globalUrlPrefix = 'http://localhost:8000/' // window.location.pathname

function Bootstrap({
  persistedStorage: persistedStorageProp = localforage.createInstance({
    name: 'centrifugo',
    description: 'Persisted settings data for centrifugo',
  }),
}: BootstrapProps) {
  const [persistedStorage] = useState(persistedStorageProp)
  const [appNeedsUpdate, setAppNeedsUpdate] = useState(false)
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false)
  const [userSettings, setUserSettings] = useState<UserSettings>({
    colorMode: 'light',
    playSoundOnNewMessage: true,
    showNotificationOnNewMessage: true,
  })
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem('token') ? true : false
  )
  const [isInsecure, setIsInsecure] = useState(
    localStorage.getItem('insecure') === 'true'
  )

  const handleServiceWorkerUpdate = () => {
    setAppNeedsUpdate(true)
  }

  useEffect(() => {
    serviceWorkerRegistration.register({ onUpdate: handleServiceWorkerUpdate })
  }, [])

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
      mode: 'cors',
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
      .catch(e => {
        console.log(e)
      })
  }

  return (
    <Router>
      <StorageContext.Provider value={storageContextValue}>
        <SettingsContext.Provider value={settingsContextValue}>
          {hasLoadedSettings ? (
            <Shell
              appNeedsUpdate={appNeedsUpdate}
              handleLogin={handleLogin}
              handleLogout={handleLogout}
              authenticated={isAuthenticated}
              insecure={isInsecure}
            >
              <Routes>
                {[routes.ROOT, routes.INDEX_HTML].map(path => (
                  <Route
                    key={path}
                    path={path}
                    element={<Status handleLogout={handleLogout} />}
                  />
                ))}
                <Route path={routes.SETTINGS} element={<Settings />} />
                <Route
                  path={routes.ACTIONS}
                  element={<Actions handleLogout={handleLogout} />}
                />
                <Route path={routes.TRACING} element={<Tracing />} />
                <Route path={routes.ABOUT} element={<About />} />
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

export default Bootstrap
