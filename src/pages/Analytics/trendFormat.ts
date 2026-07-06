// Pure formatting helpers and shared types for trend charts. Kept out of the
// component modules so those can export only React components — otherwise Vite's
// Fast Refresh falls back to a full reload ("incompatible export") on edit.

export interface TrendSeries {
  name: string
  data: Array<number | null>
}

const isByteUnit = (unit?: string): boolean =>
  unit === 'bytes' || unit === 'B' || (unit?.endsWith('B/s') ?? false)

// inlineUnit means the unit is rendered as part of each value (so the axis name is dropped to
// avoid redundancy); byte/ms/% scale or carry the unit per value.
export const isInlineUnit = (unit?: string): boolean =>
  isByteUnit(unit) || unit === 'ms' || unit === '%'

const formatBytes = (v: number, suffix: string): string => {
  const a = Math.abs(v)
  if (a >= 1024 ** 3) return `${(v / 1024 ** 3).toFixed(2)} GB${suffix}`
  if (a >= 1024 ** 2) return `${(v / 1024 ** 2).toFixed(2)} MB${suffix}`
  if (a >= 1024) return `${(v / 1024).toFixed(2)} KB${suffix}`
  return `${Math.round(v)} B${suffix}`
}

const formatSI = (v: number): string => {
  const a = Math.abs(v)
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)}G`
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (a >= 1e3) return `${(v / 1e3).toFixed(2)}k`
  if (a >= 10 || Number.isInteger(v)) return String(Math.round(v))
  if (a >= 1) return v.toFixed(2)
  // Sub-1 values (e.g. low per-second rates): show 2 significant figures, trailing zeros trimmed,
  // so adjacent axis ticks stay distinct instead of all collapsing to "0.00".
  return String(parseFloat(v.toPrecision(2)))
}

// formatTrendValue renders a numeric value according to the trend's unit (bytes scaled to
// KB/MB/GB, ms→s when large, % as-is, everything else SI-abbreviated).
export const formatTrendValue = (
  v: number | null | undefined,
  unit?: string
): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return ''
  if (isByteUnit(unit)) return formatBytes(v, unit?.endsWith('/s') ? '/s' : '')
  if (unit === 'ms') {
    const a = Math.abs(v)
    if (a >= 1000) return `${(v / 1000).toFixed(2)} s`
    return `${a >= 10 ? Math.round(v) : v.toFixed(1)} ms`
  }
  if (unit === '%') return `${Math.round(v * 10) / 10}%`
  return formatSI(v)
}
