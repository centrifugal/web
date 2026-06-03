import { useMemo } from 'react'
import { alpha, useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'

import { Sparkline } from './Sparkline'
import { formatTrendValue, TrendSeries } from './TimeSeriesChart'

// Medal colors for the top three ranks (gold / silver / bronze); the rest stay muted.
const RANK_MEDALS = ['#d4af37', '#a8b1b8', '#c08457']

interface LeaderboardTableProps {
  series: TrendSeries[]
  unit: string
  granularitySeconds: number
  rankBy: 'total' | 'peak'
  onEntityClick?: (name: string) => void
}

// LeaderboardTable renders a top-N trend as a ranked table with a per-row sparkline.
//
// The magnitude shown is a COUNT, never a per-second rate: an entity's activity averaged over a
// long window collapses to ~0/s and reads as empty. For rate trends (ops/s, msg/s) we multiply the
// per-bucket rate back by the bucket duration to recover real counts — "total over window" and
// "busiest bucket". For the gauge trend (subscriptions) a sum would double-count, so we show
// "avg" and "peak" concurrent instead. The sparkline always shows the temporal pattern.
export const LeaderboardTable = ({
  series,
  unit,
  granularitySeconds,
  rankBy,
  onEntityClick,
}: LeaderboardTableProps) => {
  const theme = useTheme()
  const primary = theme.palette.primary.main
  const isRate = unit.endsWith('/s')
  const noun = isRate ? unit.slice(0, -2) : unit // "ops/s" → "ops", "msg/s" → "msg"

  const rows = useMemo(() => {
    const r = series.map(s => {
      const nums = s.data.filter(
        (v): v is number => v != null && !Number.isNaN(v)
      )
      const maxV = nums.length ? Math.max(...nums) : 0
      const sumV = nums.reduce((a, b) => a + b, 0)
      if (isRate) {
        // primary = total events over the window; secondary = events in the busiest bucket.
        return {
          name: s.name,
          data: s.data,
          primary: sumV * granularitySeconds,
          secondary: maxV * granularitySeconds,
        }
      }
      // gauge: primary = avg concurrent (≈ window total for ranking); secondary = peak concurrent.
      return {
        name: s.name,
        data: s.data,
        primary: s.data.length ? sumV / s.data.length : 0,
        secondary: maxV,
      }
    })
    r.sort((a, b) =>
      rankBy === 'peak' ? b.secondary - a.secondary : b.primary - a.primary
    )
    return r
  }, [series, isRate, granularitySeconds, rankBy])

  const col1Label = isRate ? 'total' : 'avg'
  const col2Label = isRate ? 'busiest bucket' : 'peak'
  const fmt = (v: number) =>
    isRate ? `${formatTrendValue(v)} ${noun}` : formatTrendValue(v, unit)
  const maxPrimary = Math.max(1, ...rows.map(r => r.primary))
  const maxSecondary = Math.max(1, ...rows.map(r => r.secondary))

  // A metric cell with a right-anchored data bar behind the value, so magnitudes rank at a glance.
  const metricCell = (value: number, max: number, active: boolean) => (
    <TableCell
      align="right"
      sx={{
        position: 'relative',
        whiteSpace: 'nowrap',
        fontWeight: active ? 700 : 400,
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 5,
          bottom: 5,
          right: 0,
          width: `${Math.max(2, (value / max) * 100)}%`,
          bgcolor: alpha(primary, active ? 0.24 : 0.1),
          borderRadius: 0.5,
        }}
      />
      <Box component="span" sx={{ position: 'relative' }}>
        {fmt(value)}
      </Box>
    </TableCell>
  )

  const head = (label: string, active: boolean) => (
    <TableCell
      align="right"
      sx={{ fontWeight: active ? 700 : 400, whiteSpace: 'nowrap' }}
    >
      {label}
    </TableCell>
  )

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={{ width: 28 }}>#</TableCell>
          <TableCell>Name</TableCell>
          {head(col1Label, rankBy === 'total')}
          {head(col2Label, rankBy === 'peak')}
          <TableCell align="right">trend</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={row.name} hover>
            <TableCell
              sx={{
                color: RANK_MEDALS[i] ?? 'text.secondary',
                fontWeight: i < 3 ? 700 : 400,
              }}
            >
              {i + 1}
            </TableCell>
            <TableCell
              sx={{
                fontFamily: 'monospace',
                wordBreak: 'break-all',
                cursor: onEntityClick ? 'pointer' : 'default',
                color: onEntityClick ? 'primary.main' : 'text.primary',
              }}
              onClick={
                onEntityClick ? () => onEntityClick(row.name) : undefined
              }
            >
              {row.name}
            </TableCell>
            {metricCell(row.primary, maxPrimary, rankBy === 'total')}
            {metricCell(row.secondary, maxSecondary, rankBy === 'peak')}
            <TableCell align="right">
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Sparkline data={row.data} />
              </Box>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export default LeaderboardTable
