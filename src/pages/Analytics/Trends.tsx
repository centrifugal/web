import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Link from '@mui/material/Link'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { Grid } from '@mui/material'

import { useAdminApi } from 'api/adminApi'
import { ShellContext } from 'contexts/ShellContext'

import { TimeSeriesChart } from './TimeSeriesChart'
import { TrendSeries } from './trendFormat'
import { LeaderboardTable } from './LeaderboardTable'

interface TrendsProps {
  signinSilent: () => void
  authorization: string
}

interface TrendFilterDef {
  key: string
  label: string
  placeholder: string
}

interface TrendCatalogEntry {
  id: string
  title: string
  description: string
  unit: string
  category: string
  chartType: 'line' | 'area' | 'bar'
  stacked: boolean
  filters?: TrendFilterDef[]
  groupByLabel?: boolean
  supportsLabels?: boolean
  leaderboard?: boolean
}

// Preferred category order for the grouped selector (anything else falls to the end).
const CATEGORY_ORDER = [
  'Connections',
  'Users',
  'Subscriptions',
  'Operations',
  'Errors & health',
  'Latency',
  'Messaging',
  'Push notifications',
]

interface TrendData {
  metric: string
  unit: string
  chartType: 'line' | 'area' | 'bar'
  stacked: boolean
  granularitySeconds: number
  buckets: number[]
  series: TrendSeries[]
  truncated?: boolean
  leaderboard?: boolean
}

// Relative range presets (seconds). Auto-refresh only applies to short relative ranges.
const RANGES: { label: string; seconds: number }[] = [
  { label: '15m', seconds: 15 * 60 },
  { label: '1h', seconds: 60 * 60 },
  { label: '6h', seconds: 6 * 60 * 60 },
  { label: '24h', seconds: 24 * 60 * 60 },
  { label: '7d', seconds: 7 * 24 * 60 * 60 },
  { label: '30d', seconds: 30 * 24 * 60 * 60 },
]

const AUTO_REFRESH_MAX_SECONDS = 6 * 60 * 60 // only auto-refresh ranges <= 6h
const REFRESH_INTERVAL_MS = 60000

// The trend shown by default when the Trends tab first opens.
const DEFAULT_METRIC = 'client_connections'
const VIEW_STORAGE_KEY = 'centrifugo_trends_view'
// Bump whenever the persisted TrendView shape changes incompatibly — a stored entry with a
// different version (or one that fails the shape check below) is discarded and the view resets.
const VIEW_STORAGE_VERSION = 1
const FILTER_DEBOUNCE_MS = 300

interface TrendView {
  metric: string
  range: number
  filters: Record<string, string>
  groupBy: string
  lfKey: string
  lfVal: string
  // null = use the trend's default stacking; true/false = explicit stacked/overlaid override.
  stack: boolean | null
}

// useDebounced returns value after it has stopped changing for `ms` — used to keep typing in the
// filter inputs responsive while avoiding a ClickHouse query (and URL update) per keystroke.
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

// readInitialView restores the view from the URL (shareable/bookmarkable) first, then from
// localStorage (last-viewed), then falls back to defaults.
function readInitialView(sp: URLSearchParams): TrendView {
  if (sp.get('metric')) {
    const filters: Record<string, string> = {}
    sp.forEach((v, k) => {
      if (k.startsWith('f_') && v) filters[k.slice(2)] = v
    })
    const stackParam = sp.get('stack')
    return {
      metric: sp.get('metric') || '',
      range: Number(sp.get('range')) || RANGES[1].seconds,
      filters,
      groupBy: sp.get('gbl') || '',
      lfKey: sp.get('lfk') || '',
      lfVal: sp.get('lfv') || '',
      stack: stackParam === null ? null : stackParam === '1',
    }
  }
  try {
    const saved = JSON.parse(localStorage.getItem(VIEW_STORAGE_KEY) || 'null')
    // Only restore state written by this exact version; a version bump (or malformed/old data)
    // discards it so a future shape change resets cleanly instead of loading a stale object.
    if (saved && saved.version === VIEW_STORAGE_VERSION && saved.metric) {
      return {
        metric: saved.metric,
        range: saved.range || RANGES[1].seconds,
        filters: saved.filters || {},
        groupBy: saved.groupBy || '',
        lfKey: saved.lfKey || '',
        lfVal: saved.lfVal || '',
        stack: saved.stack ?? null,
      }
    }
    localStorage.removeItem(VIEW_STORAGE_KEY)
  } catch {
    localStorage.removeItem(VIEW_STORAGE_KEY)
  }
  return {
    metric: '',
    range: RANGES[1].seconds,
    filters: {},
    groupBy: '',
    lfKey: '',
    lfVal: '',
    stack: null,
  }
}

export const Trends = ({ signinSilent, authorization }: TrendsProps) => {
  const { showAlert } = useContext(ShellContext)
  const [searchParams, setSearchParams] = useSearchParams()
  // Restore the initial view exactly once (URL → localStorage → defaults).
  const initialRef = useRef<TrendView | null>(null)
  if (initialRef.current === null)
    initialRef.current = readInitialView(searchParams)
  const initial = initialRef.current

  const [catalog, setCatalog] = useState<TrendCatalogEntry[] | null>(null)
  const [enabled, setEnabled] = useState(true)
  const [metricId, setMetricId] = useState<string>(initial.metric)
  const [rangeSeconds, setRangeSeconds] = useState<number>(initial.range)
  const [filters, setFilters] = useState<Record<string, string>>(
    initial.filters
  )
  const [data, setData] = useState<TrendData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  // Arbitrary client labels: discovered from the data; used for grouping and filtering.
  const [labelKeys, setLabelKeys] = useState<string[]>([])
  const [groupByLabelKey, setGroupByLabelKey] = useState<string>(
    initial.groupBy
  )
  const [labelFilterKey, setLabelFilterKey] = useState<string>(initial.lfKey)
  const [labelFilterValue, setLabelFilterValue] = useState<string>(
    initial.lfVal
  )
  // Leaderboard candidate ranking: by window total (default) or by peak bucket (transient leaders).
  const [rankBy, setRankBy] = useState<'total' | 'peak'>('total')
  // Stacked-view override for multi-series charts: null = use the trend's default, else force on/off.
  const [stackOverride, setStackOverride] = useState<boolean | null>(
    initial.stack
  )

  // Debounced copies of the free-text inputs drive fetching and URL persistence.
  const debouncedFilters = useDebounced(filters, FILTER_DEBOUNCE_MS)
  const debouncedLabelFilterValue = useDebounced(
    labelFilterValue,
    FILTER_DEBOUNCE_MS
  )

  const { rawRequest } = useAdminApi({ authorization, signinSilent })

  const handleHttpError = useCallback(
    (status: number): boolean => {
      if (status === 401) {
        showAlert('Unauthorized', { severity: 'error' })
        signinSilent()
        return true
      }
      if (status === 403) {
        showAlert('Permission denied', { severity: 'error' })
        return true
      }
      if (status === 404) {
        setEnabled(false)
        return true
      }
      return false
    },
    [showAlert, signinSilent]
  )

  // Load catalog once — the metric selector and per-metric filters are driven entirely by it,
  // so any trend registered on the backend appears here automatically.
  useEffect(() => {
    rawRequest('admin/analytics/trends', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: JSON.stringify({ catalog: true }),
    })
      .then(response => {
        if (!response.ok) {
          if (handleHttpError(response.status)) return null
          throw Error(response.status.toString())
        }
        return response.json()
      })
      .then(payload => {
        if (!payload) return
        const trends: TrendCatalogEntry[] = payload.result?.trends ?? []
        setCatalog(trends)
        if (trends.length > 0) {
          // Keep the restored metric if it's valid; otherwise default to "Active connections".
          const preferred = trends.find(t => t.id === DEFAULT_METRIC)
            ? DEFAULT_METRIC
            : trends[0].id
          setMetricId(prev =>
            prev && trends.some(t => t.id === prev) ? prev : preferred
          )
        }
      })
      .catch(e => {
        showAlert('Error connecting to server', { severity: 'error' })
        console.error(e)
      })
  }, [rawRequest, handleHttpError, showAlert])

  const activeEntry = useMemo(
    () => catalog?.find(e => e.id === metricId) ?? null,
    [catalog, metricId]
  )

  // Clicking a leaderboard entity opens its explorer — drill from "who's top" to "why".
  const goToEntity = useCallback(
    (name: string) => {
      const id = activeEntry?.id || ''
      if (id.endsWith('_by_channel'))
        setSearchParams(new URLSearchParams({ tab: 'channel', channel: name }))
      else if (id.endsWith('_by_user'))
        setSearchParams(new URLSearchParams({ tab: 'user', user: name }))
    },
    [activeEntry, setSearchParams]
  )

  // Options sorted by category (then title) so the grouped Autocomplete renders ordered sections.
  const sortedOptions = useMemo(() => {
    const rank = (c: string) => {
      const i = CATEGORY_ORDER.indexOf(c)
      return i < 0 ? CATEGORY_ORDER.length : i
    }
    return [...(catalog ?? [])].sort((a, b) => {
      const ra = rank(a.category)
      const rb = rank(b.category)
      if (ra !== rb) return ra - rb
      if (a.category !== b.category) return a.category.localeCompare(b.category)
      return a.title.localeCompare(b.title)
    })
  }, [catalog])

  // Reset filters when switching metric (filters are metric-specific) — but NOT on the first
  // render, so a restored view (from URL/localStorage) keeps its filters.
  const metricInitialized = useRef(false)
  useEffect(() => {
    if (!metricInitialized.current) {
      metricInitialized.current = true
      return
    }
    setFilters({})
    setLabelFilterKey('')
    setLabelFilterValue('')
    setGroupByLabelKey('')
    setRankBy('total')
    setStackOverride(null)
  }, [metricId])

  // Discover the client-label keys present in the data for label-aware trends, so the group-by
  // and label-filter controls offer the real keys (labels are arbitrary — nothing is hardcoded).
  useEffect(() => {
    if (
      !activeEntry ||
      !(activeEntry.supportsLabels || activeEntry.groupByLabel)
    ) {
      setLabelKeys([])
      return
    }
    const now = Math.floor(Date.now() / 1000)
    rawRequest('admin/analytics/trends', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: JSON.stringify({
        labelKeys: true,
        from: now - rangeSeconds,
        to: now,
      }),
    })
      .then(response => (response.ok ? response.json() : null))
      .then(payload => {
        if (!payload) return
        const keys: string[] = payload.result?.labelKeys ?? []
        setLabelKeys(keys)
        if (activeEntry.groupByLabel) {
          // Default the grouping key to the most common label if none chosen yet.
          setGroupByLabelKey(prev =>
            prev && keys.includes(prev) ? prev : (keys[0] ?? '')
          )
        }
      })
      .catch(() => {})
  }, [activeEntry, rangeSeconds, rawRequest])

  const fetchData = useCallback(() => {
    if (!metricId) return
    setLoading(true)
    setError('')
    const now = Math.floor(Date.now() / 1000)
    const activeFilters: Record<string, string> = {}
    Object.entries(debouncedFilters).forEach(([k, v]) => {
      if (v.trim() !== '') activeFilters[k] = v.trim()
    })
    const body: Record<string, any> = {
      metric: metricId,
      from: now - rangeSeconds,
      to: now,
      granularitySeconds: 0,
      filters: activeFilters,
    }
    if (activeEntry?.groupByLabel && groupByLabelKey) {
      body.groupByLabel = groupByLabelKey
    }
    if (
      activeEntry?.supportsLabels &&
      labelFilterKey &&
      debouncedLabelFilterValue.trim() !== ''
    ) {
      body.labelFilters = { [labelFilterKey]: debouncedLabelFilterValue.trim() }
    }
    if (activeEntry?.leaderboard && rankBy === 'peak') {
      body.rankBy = 'peak'
    }
    rawRequest('admin/analytics/trends', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: JSON.stringify(body),
    })
      .then(response => {
        if (!response.ok) {
          if (handleHttpError(response.status)) return null
          throw Error(response.status.toString())
        }
        setEnabled(true)
        return response.json()
      })
      .then(payload => {
        if (!payload) return
        setData(payload.result)
        setLoading(false)
      })
      .catch(e => {
        setError('Error loading trend')
        setLoading(false)
        console.error(e)
      })
  }, [
    metricId,
    rangeSeconds,
    debouncedFilters,
    activeEntry,
    groupByLabelKey,
    labelFilterKey,
    debouncedLabelFilterValue,
    rankBy,
    rawRequest,
    handleHttpError,
  ])

  // Persist the current view to the URL (shareable, survives reload) and localStorage (last view).
  // Uses the debounced free-text values so typing doesn't churn the URL on every keystroke.
  useEffect(() => {
    const next = new URLSearchParams()
    next.set('tab', 'trends')
    if (metricId) next.set('metric', metricId)
    next.set('range', String(rangeSeconds))
    Object.entries(debouncedFilters).forEach(([k, v]) => {
      if (v && v.trim() !== '') next.set('f_' + k, v.trim())
    })
    if (activeEntry?.groupByLabel && groupByLabelKey)
      next.set('gbl', groupByLabelKey)
    if (
      activeEntry?.supportsLabels &&
      labelFilterKey &&
      debouncedLabelFilterValue.trim() !== ''
    ) {
      next.set('lfk', labelFilterKey)
      next.set('lfv', debouncedLabelFilterValue.trim())
    }
    if (stackOverride !== null) next.set('stack', stackOverride ? '1' : '0')
    setSearchParams(next, { replace: true })
    localStorage.setItem(
      VIEW_STORAGE_KEY,
      JSON.stringify({
        version: VIEW_STORAGE_VERSION,
        metric: metricId,
        range: rangeSeconds,
        filters: debouncedFilters,
        groupBy: groupByLabelKey,
        lfKey: labelFilterKey,
        lfVal: debouncedLabelFilterValue,
        stack: stackOverride,
      })
    )
    // setSearchParams is stable; searchParams intentionally excluded to avoid a write/read loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    metricId,
    rangeSeconds,
    debouncedFilters,
    groupByLabelKey,
    labelFilterKey,
    debouncedLabelFilterValue,
    activeEntry,
    stackOverride,
  ])

  // Fetch on metric/range/filter change.
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh only for short ranges (avoid re-running wide scans every minute).
  useEffect(() => {
    if (rangeSeconds > AUTO_REFRESH_MAX_SECONDS) return
    const interval = setInterval(() => fetchData(), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [rangeSeconds, fetchData])

  if (catalog === null) {
    return (
      <Box
        className="max-w-8xl mx-auto p-8"
        sx={{ textAlign: 'center', mt: 8 }}
      >
        <CircularProgress />
      </Box>
    )
  }

  if (!enabled) {
    return (
      <Box className="max-w-8xl mx-auto p-8">
        <Alert severity="info">
          ClickHouse analytics is not enabled. Trends require{' '}
          <code>clickhouse_analytics</code> to be configured.
        </Alert>
      </Box>
    )
  }

  return (
    <Box className="max-w-8xl mx-auto p-8">
      <Grid container spacing={2} sx={{ mb: 2 }} alignItems="center">
        {activeEntry && (
          <Grid>
            <Autocomplete
              size="small"
              options={sortedOptions}
              groupBy={o => o.category}
              getOptionLabel={o => o.title}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              value={activeEntry}
              onChange={(_, v) => {
                if (v) setMetricId(v.id)
              }}
              disableClearable
              sx={{ minWidth: 320 }}
              renderInput={params => <TextField {...params} label="Trend" />}
            />
          </Grid>
        )}
        <Grid>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={rangeSeconds}
            onChange={(_, v) => {
              if (v !== null) setRangeSeconds(v)
            }}
          >
            {RANGES.map(r => (
              <ToggleButton key={r.label} value={r.seconds}>
                {r.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Grid>
        {(activeEntry?.filters ?? []).map(f => (
          <Grid key={f.key}>
            <TextField
              size="small"
              label={f.label}
              placeholder={f.placeholder}
              value={filters[f.key] ?? ''}
              onChange={e =>
                setFilters(prev => ({ ...prev, [f.key]: e.target.value }))
              }
              onKeyDown={e => {
                if (e.key === 'Enter') fetchData()
              }}
            />
          </Grid>
        ))}
        {activeEntry?.groupByLabel && (
          <Grid>
            <Autocomplete
              freeSolo
              size="small"
              options={labelKeys}
              value={groupByLabelKey}
              onChange={(_, v) => setGroupByLabelKey((v as string) ?? '')}
              sx={{ minWidth: 200 }}
              renderInput={params => (
                <TextField
                  {...params}
                  label="Group by label"
                  placeholder="label key"
                />
              )}
            />
          </Grid>
        )}
        {activeEntry?.supportsLabels && (
          <>
            <Grid>
              <Autocomplete
                freeSolo
                size="small"
                options={labelKeys}
                value={labelFilterKey}
                onChange={(_, v) => setLabelFilterKey((v as string) ?? '')}
                sx={{ minWidth: 170 }}
                renderInput={params => (
                  <TextField
                    {...params}
                    label="Label filter: key"
                    placeholder="label key"
                  />
                )}
              />
            </Grid>
            <Grid>
              <TextField
                size="small"
                label="Label filter: value"
                placeholder="label value"
                value={labelFilterValue}
                onChange={e => setLabelFilterValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') fetchData()
                }}
              />
            </Grid>
          </>
        )}
        <Grid>
          <Link component="button" type="button" onClick={() => fetchData()}>
            reload
          </Link>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <Typography variant="h6">{activeEntry?.title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {data ? `${data.granularitySeconds}s buckets · ${data.unit}` : ''}
              {loading ? ' · loading…' : ''}
            </Typography>
          </Box>
          {activeEntry?.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {activeEntry.description}
            </Typography>
          )}
          {error && <Alert severity="error">{error}</Alert>}
          {data?.leaderboard && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                order by
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={rankBy}
                onChange={(_, v) => {
                  if (v) setRankBy(v)
                }}
              >
                <ToggleButton value="total">total</ToggleButton>
                <ToggleButton value="peak">peak</ToggleButton>
              </ToggleButtonGroup>
              <Typography variant="caption" color="text.secondary">
                {rankBy === 'peak'
                  ? 'top 10 by busiest single bucket — catches transient leaders'
                  : 'top 10 by total over the window'}
              </Typography>
            </Box>
          )}
          {/* Stacked vs overlaid view toggle — only meaningful for multi-series stacked trends. */}
          {data &&
            !data.leaderboard &&
            data.stacked &&
            data.series.length > 1 && (
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
              >
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={
                    (stackOverride ?? data.stacked) ? 'stacked' : 'overlaid'
                  }
                  onChange={(_, v) => {
                    if (v) setStackOverride(v === 'stacked')
                  }}
                >
                  <ToggleButton value="stacked">stacked</ToggleButton>
                  <ToggleButton value="overlaid">overlaid</ToggleButton>
                </ToggleButtonGroup>
                <Typography variant="caption" color="text.secondary">
                  {(stackOverride ?? data.stacked)
                    ? 'series summed into a total'
                    : 'series overlaid for comparison'}
                </Typography>
              </Box>
            )}
          {data && data.series.length > 0 ? (
            data.leaderboard ? (
              <LeaderboardTable
                series={data.series}
                unit={data.unit}
                granularitySeconds={data.granularitySeconds}
                rankBy={rankBy}
                onEntityClick={goToEntity}
              />
            ) : (
              <TimeSeriesChart
                buckets={data.buckets}
                series={data.series}
                unit={data.unit}
                chartType={data.chartType}
                stacked={stackOverride ?? data.stacked}
              />
            )
          ) : (
            !loading && (
              <Box sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}>
                No data
              </Box>
            )
          )}
          {data?.truncated && (
            <Alert severity="info" sx={{ mt: 1 }}>
              Series were truncated to the top results; the rest are grouped as
              “other”.
            </Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}

export default Trends
