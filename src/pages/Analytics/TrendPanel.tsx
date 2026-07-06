import { ReactNode, useEffect, useState } from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'

import { adminRawFetch } from 'api/adminApi'

import { TimeSeriesChart } from './TimeSeriesChart'
import { TrendSeries } from './trendFormat'

export interface TrendPanelData {
  unit: string
  chartType: 'line' | 'area' | 'bar'
  stacked: boolean
  granularitySeconds: number
  buckets: number[]
  series: TrendSeries[]
}

interface TrendPanelProps {
  title: string
  metric: string
  filters: Record<string, string>
  rangeSeconds: number
  headers: Record<string, string>
  height?: number
  group?: string
  // footer renders below the chart. A function form receives the fetched data so callers can
  // derive summary stats (totals, averages) from the same series the chart draws.
  footer?: ReactNode | ((data: TrendPanelData | null) => ReactNode)
}

// TrendPanel fetches a single trend (with fixed filters, e.g. a user) and renders it as a small
// titled chart. Used to compose entity dashboards from the existing trends engine.
export const TrendPanel = ({
  title,
  metric,
  filters,
  rangeSeconds,
  headers,
  height = 220,
  group,
  footer,
}: TrendPanelProps) => {
  const [data, setData] = useState<TrendPanelData | null>(null)
  const [loading, setLoading] = useState(true)
  const filtersKey = JSON.stringify(filters)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const now = Math.floor(Date.now() / 1000)
    adminRawFetch('admin/analytics/trends', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        metric,
        from: now - rangeSeconds,
        to: now,
        granularitySeconds: 0,
        filters,
      }),
    })
      .then(r => (r.ok ? r.json() : null))
      .then(p => {
        if (cancelled) return
        setData(p?.result ?? null)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric, filtersKey, rangeSeconds, headers])

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="subtitle2" gutterBottom>
          {title}
        </Typography>
        {loading && !data ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height,
            }}
          >
            <CircularProgress size={24} />
          </Box>
        ) : data && data.series.length > 0 ? (
          <TimeSeriesChart
            buckets={data.buckets}
            series={data.series}
            unit={data.unit}
            chartType={data.chartType}
            stacked={data.stacked}
            height={height}
            group={group}
          />
        ) : (
          <Box
            sx={{
              height,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'text.secondary',
            }}
          >
            No data
          </Box>
        )}
        {typeof footer === 'function' ? footer(data) : footer}
      </CardContent>
    </Card>
  )
}

export default TrendPanel
