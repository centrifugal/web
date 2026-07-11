// Small, self-contained formatters for the Inspector. Kept local (a little copy is
// fine) so the page has no fragile cross-page imports.

// Wall-clock time from unix milliseconds.
export const fmtDateTime = (ms: number | undefined | null): string => {
  if (!ms) return '—'
  return new Date(ms).toLocaleString()
}

// Compact "time ago" from unix milliseconds.
export const fmtAgo = (ms: number | undefined | null): string => {
  if (!ms) return '—'
  const diff = Date.now() - ms
  if (diff < 0) return 'just now'
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

// Human name for a subscription source code (centrifuge subscription sources).
const SUBSCRIPTION_SOURCES: Record<number, string> = {
  0: 'unknown',
  1: 'connection token',
  2: 'connect proxy',
  3: 'subscription token',
  4: 'subscribe proxy',
  5: 'user limited',
  6: 'client allowed',
  7: 'client insecure',
  8: 'uni connect',
  9: 'user personal',
  10: 'server api',
  11: 'connection cap',
  12: 'expression',
  13: 'stream proxy',
}

export const subscriptionSourceName = (source?: number): string =>
  source == null ? '—' : (SUBSCRIPTION_SOURCES[source] ?? `source ${source}`)

// Render an API byte field (publication data / conn_info / chan_info / meta) for
// display. Centrifugo returns these as raw JSON (Go json.RawMessage), so the value
// is already a decoded object/array/scalar — never base64. Pretty-print objects and
// arrays; show strings and scalars as-is. Returns null when empty.
export const renderData = (v: unknown): string | null => {
  if (v == null || v === '') return null
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}
