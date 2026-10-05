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
  // Tooltip for the main text.
  hint: string
  dates?: LicenseDate[]
}

export const formatLicenseDate = (at: number): string =>
  new Date(at * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

// licenseDateText renders a date as "<label> <date>[ · <note>]".
export const licenseDateText = (d: LicenseDate): string =>
  `${d.label} ${formatLicenseDate(d.at)}${d.note ? ` · ${d.note}` : ''}`

export const licenseChipColor = (
  s: LicenseSeverity
): 'default' | 'warning' | 'error' =>
  s === 'error' ? 'error' : s === 'warning' ? 'warning' : 'default'
