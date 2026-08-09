import { TrainingFilter } from './api'

// Small, self-contained formatters for the Compression pages. Kept local (a
// little copy is fine) so the page has no fragile cross-page imports — same
// rationale as pages/Inspector/format.ts.

export const fmtInt = (n: number | undefined | null): string =>
  Number(n ?? 0).toLocaleString()

export const fmtRatio = (n: number | undefined | null): string =>
  `${Number(n ?? 0).toFixed(2)}x`

export const fmtPct = (n: number | undefined | null): string =>
  `${(Number(n ?? 0) * 100).toFixed(1)}%`

export const fmtDateTime = (s: string | undefined | null): string => {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

// Compact "time ago" / "time left" — negative diff (past) reads as "ago",
// positive as "left". Used for deadlines and approval timestamps alike.
export const fmtRelative = (s: string | undefined | null): string => {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  const diffMs = d.getTime() - Date.now()
  const past = diffMs <= 0
  const abs = Math.abs(diffMs)
  const sec = Math.floor(abs / 1000)
  const unit = (value: number, name: string) =>
    `${value}${name}${past ? ' ago' : ' left'}`
  if (sec < 60) return unit(sec, 's')
  const min = Math.floor(sec / 60)
  if (min < 60) return unit(min, 'm')
  const hr = Math.floor(min / 60)
  if (hr < 24) return unit(hr, 'h')
  const day = Math.floor(hr / 24)
  return unit(day, 'd')
}

// fmtFilter renders a session's connection filter as one line - the only thing
// that says what a session was about. Two sessions in the same mode are
// otherwise identical on a list except for their timestamps.
export const fmtFilter = (filter: TrainingFilter): string => {
  const parts: string[] = []
  if (filter.user) parts.push(`user: ${filter.user}`)
  if (filter.anonymous) parts.push('anonymous')
  if (filter.channel) parts.push(`channel: ${filter.channel}`)
  if (filter.profile) parts.push(`profile: ${filter.profile}`)
  if (filter.unclassified) parts.push('unclassified')
  return parts.length > 0 ? parts.join(' · ') : 'all connections'
}
