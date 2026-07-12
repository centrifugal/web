export interface UserSettings {
  colorMode: 'dark' | 'light'
  // Optional custom accent (hex) driving the primary button, highlights and
  // focus. When unset, the built-in green is used.
  accentColor?: string
}

export interface AdminSettings {
  insecure: boolean
  edition: 'oss' | 'pro'
  authenticated?: boolean
  oidc?: OIDCSettings
  user?: UserInfo
}

export interface OIDCSettings {
  pkce: boolean
  display_name: string
  authority?: string
  client_id?: string
  redirect_uri?: string
  scope?: string
  auth_url?: string
}

export interface UserInfo {
  sub?: string
  email?: string
  name?: string
}
