export interface UserSettings {
  colorMode: 'dark' | 'light'
}

export interface AdminSettings {
  insecure: boolean
  edition: 'oss' | 'pro'
  oidc?: OIDCSettings
}

export interface OIDCSettings {
  display_name: string
  authority: string
  client_id: string
  redirect_uri: string
  scope: string
}
