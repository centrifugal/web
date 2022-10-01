import { createContext } from 'react'

import { UserSettings } from 'models/settings'

interface SettingsContextProps {
  updateUserSettings: (settings: Partial<UserSettings>) => Promise<void>
  getUserSettings: () => UserSettings
}

export const SettingsContext = createContext<SettingsContextProps>({
  updateUserSettings: () => Promise.resolve(),
  getUserSettings: () => ({
    colorMode: 'light',
    playSoundOnNewMessage: false,
    showNotificationOnNewMessage: false,
  }),
})
