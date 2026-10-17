export interface UserSettings {
  colorMode: 'dark' | 'light'
  // Optional custom accents (hex). accentColor is the primary accent (primary
  // button, highlights, focus); accentColor2 is the secondary accent (links,
  // Trace, info). When unset, the built-in green / blue are used.
  accentColor?: string
  accentColor2?: string
}

export interface AdminSettings {
  insecure: boolean
  edition: 'oss' | 'pro'
  // admin.instance_name (PRO): tells environments apart, empty when not set.
  instance_name?: string
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
  // false while the server can't reach the identity provider.
  available: boolean
}

export interface UserInfo {
  sub?: string
  email?: string
  name?: string
}
