// License of the node serving the admin UI, as returned by the PRO endpoint
// admin/api/license. Texts, labels and severities are built on the server;
// the UI only formats dates in the viewer's locale and picks colors.
export type LicenseSeverity = 'ok' | 'warning' | 'error'

export interface LicenseDate {
  label: string
  // Unix seconds.
  at: number
  note?: string
  severity: LicenseSeverity
  hint: string
}

export interface LicenseStatus {
  sandbox: boolean
  text: string
  // Tooltip for the main text; absent for a license without limits.
  hint?: string
  dates?: LicenseDate[]
}

export const formatLicenseDate = (at: number): string =>
  new Date(at * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

// formatLicenseDateTime is the full date and time for a tooltip, in the
// viewer's time zone with the zone named.
export const formatLicenseDateTime = (at: number): string =>
  new Date(at * 1000).toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })

// licenseDateText renders a date as "<label> <date>[ · <note>]".
export const licenseDateText = (d: LicenseDate): string =>
  `${d.label} ${formatLicenseDate(d.at)}${d.note ? ` · ${d.note}` : ''}`

export const licenseTextColor = (s: LicenseSeverity): string =>
  s === 'error'
    ? 'error.main'
    : s === 'warning'
      ? 'warning.main'
      : 'text.secondary'
