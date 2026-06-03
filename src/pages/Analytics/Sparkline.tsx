import { useId, useMemo } from 'react'
import { useTheme } from '@mui/material/styles'

interface SparklineProps {
  data: Array<number | null>
  width?: number
  height?: number
}

// Sparkline draws a tiny filled area chart of a series for a leaderboard row. Nulls are treated as
// 0 for the shape (leaderboard series only have leading/trailing gaps); an empty series renders
// nothing.
export const Sparkline = ({
  data,
  width = 130,
  height = 28,
}: SparklineProps) => {
  const theme = useTheme()
  const rawId = useId()
  const paths = useMemo(() => {
    const n = data.length
    if (n === 0) return null
    const vals = data.map(v => (v == null || Number.isNaN(v) ? 0 : v))
    const max = Math.max(...vals)
    const min = Math.min(...vals, 0)
    const range = max - min || 1
    const pad = 2
    const h = height - pad * 2
    const pts = vals.map((v, i) => {
      const x = n > 1 ? (i * width) / (n - 1) : width / 2
      const y = pad + h - ((v - min) / range) * h
      return [x, y] as const
    })
    const line = pts
      .map(
        ([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      )
      .join(' ')
    const area = `${line} L${pts[n - 1][0].toFixed(
      1
    )},${height} L${pts[0][0].toFixed(1)},${height} Z`
    return { line, area, end: pts[n - 1] }
  }, [data, width, height])

  if (!paths) return null
  const color = theme.palette.primary.main
  // Unique per instance — a shared id would make every sparkline inherit the first one's gradient
  // if the fill is ever made per-row. Strip ":" from useId so it's a valid url(#...) reference.
  const gradId = `spark${rawId.replace(/:/g, '')}`
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <path d={paths.area} fill={`url(#${gradId})`} stroke="none" />
      <path
        d={paths.line}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinejoin="round"
      />
      <circle cx={paths.end[0]} cy={paths.end[1]} r={2} fill={color} />
    </svg>
  )
}

export default Sparkline
