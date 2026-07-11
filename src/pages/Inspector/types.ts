import { ServerConfig } from './useServerConfig'

// The server-API command function (POST {method, params} → result), as returned by
// useAdminApi().command. Panels receive it so they stay free of auth concerns.
export type CommandFn = <T = any>(
  method: string,
  params?: unknown
) => Promise<T>

export interface AlertFn {
  (
    message: string,
    options?: { severity?: 'error' | 'warning' | 'info' | 'success' }
  ): void
}

export interface ApiError {
  code?: number
  message?: string
}

// Everything a panel needs to talk to the server and report outcomes. `call`
// unwraps the server-API {result|error} envelope; `adminGet` fetches an admin-only
// JSON endpoint (e.g. channel_options, user_blocked).
export interface InspectorApi {
  call: <T = any>(method: string, params?: unknown) => Promise<T>
  adminGet: <T = any>(path: string) => Promise<T>
  showAlert: AlertFn
}

// Props shared by the Channel and User tab components.
export interface TabProps {
  authorization: string
  signinSilent: () => void
  server: ServerConfig
}

// Navigate to the User tab focused on a user (used by cross-links).
export type GoToUser = (user: string) => void
// Navigate to the Channel tab focused on a channel.
export type GoToChannel = (channel: string) => void
