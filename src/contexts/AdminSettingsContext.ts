import { createContext } from 'react'

import { AdminSettings } from 'models/settings'

interface AdminSettingsContextProps {
  updateAdminSettings: (settings: AdminSettings) => Promise<void>
  getAdminSettings: () => AdminSettings
}

export const AdminSettingsContext = createContext<AdminSettingsContextProps>({
  updateAdminSettings: () => Promise.resolve(),
  getAdminSettings: () => ({
    edition: 'oss',
  }),
})
