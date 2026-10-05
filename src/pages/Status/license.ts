// License of the node serving the admin UI, as returned by the PRO endpoint
// admin/api/license. Dates are Unix seconds; absent when not set.
export interface LicenseStatus {
  sandbox: boolean
  // Owner; an email arrives with its local part already masked by the server.
  owner?: string
  trial?: boolean
  // After this date Centrifugo PRO does not start with the key (trial key
  // expiration or enforced expiration).
  no_start_at?: number
  // After this date versions released later do not start with the key;
  // versions released before keep working (non-trial key expiration).
  no_updates_at?: number
  max_connections?: number
  max_nodes?: number
  max_api_rps?: number
  server_time: number
}

export type LicenseSeverity = 'ok' | 'warning' | 'error'

export interface LicenseDate {
  kind: 'no_start' | 'no_updates'
  label: string
  at: number
  severity: LicenseSeverity
}

const DAY = 24 * 60 * 60
// Less than this before a date turns it yellow.
export const LICENSE_WARNING_PERIOD = 30 * DAY

export const licenseSeverity = (at: number, now: number): LicenseSeverity => {
  if (now >= at) return 'error'
  if (at - now < LICENSE_WARNING_PERIOD) return 'warning'
  return 'ok'
}

export const formatLicenseDate = (at: number): string =>
  new Date(at * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

// licenseDates lists the dates that apply to the license, most important
// first, with a label saying what happens at that date.
export const licenseDates = (st: LicenseStatus): LicenseDate[] => {
  const now = st.server_time
  const dates: LicenseDate[] = []
  if (st.no_start_at) {
    const passed = now >= st.no_start_at
    let label = passed ? 'Expired' : 'Valid until'
    if (st.trial) label = passed ? 'Trial expired' : 'Trial expires'
    dates.push({
      kind: 'no_start',
      label,
      at: st.no_start_at,
      severity: licenseSeverity(st.no_start_at, now),
    })
  }
  if (st.no_updates_at) {
    const passed = now >= st.no_updates_at
    dates.push({
      kind: 'no_updates',
      label: passed ? 'Updates ended' : 'Updates until',
      at: st.no_updates_at,
      severity: licenseSeverity(st.no_updates_at, now),
    })
  }
  return dates
}

// licenseDateHint explains what a date means, for a tooltip.
export const licenseDateHint = (d: LicenseDate): string => {
  if (d.kind === 'no_start') {
    return d.severity === 'error'
      ? 'Centrifugo PRO does not start with this license key anymore. Running nodes keep working until restart.'
      : 'After this date Centrifugo PRO does not start with this license key.'
  }
  return 'Centrifugo PRO versions released after this date do not start with this license key. Versions released before keep working.'
}

export const licenseLimits = (st: LicenseStatus): string => {
  const parts: string[] = []
  if (st.max_connections)
    parts.push(`${st.max_connections.toLocaleString()} connections`)
  if (st.max_nodes) parts.push(`${st.max_nodes.toLocaleString()} nodes`)
  if (st.max_api_rps) parts.push(`${st.max_api_rps.toLocaleString()} API rps`)
  return parts.length ? parts.join(', ') : 'no limits'
}
