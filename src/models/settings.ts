export interface UserSettings {
  colorMode: 'dark' | 'light'
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
