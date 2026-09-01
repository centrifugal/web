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
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import TagIcon from '@mui/icons-material/Tag'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import { Grid } from '@mui/material'

import { useAdminApi } from 'api/adminApi'
import { ShellContext } from 'contexts/ShellContext'

import { TrendPanel, TrendPanelData } from './TrendPanel'

interface ChannelExplorerProps {
  signinSilent: () => void
  authorization: string
}

interface ChannelEvent {
  time: number
  op: string
  user: string
  method: string
  error: number
}
interface UserCount {
  user: string
  count: number
}
interface ChannelData {
  channel: string
  found: boolean
  namespace: string
  summary: {
    subscribers: number
    publications: number
    publishers: number
    bytes: number
    errors: number
  }
  topPublishers: UserCount[]
  topSubscribers: UserCount[]
  events: ChannelEvent[]
}

const RANGES: { label: string; seconds: number }[] = [
  { label: '1h', seconds: 60 * 60 },
  { label: '6h', seconds: 6 * 60 * 60 },
  { label: '24h', seconds: 24 * 60 * 60 },
  { label: '7d', seconds: 7 * 24 * 60 * 60 },
  { label: '30d', seconds: 30 * 24 * 60 * 60 },
]
const LAST_CHANNEL_KEY = 'centrifugo_channel_explorer_v1'
const CHART_GROUP = 'channel-explorer'
const EVENTS_LIMIT = 100 // matches the backend LIMIT for channel error events

const fmtNum = (n: number) => n.toLocaleString()
const fmtBytes = (v: number): string => {
  if (v >= 1024 ** 3) return `${(v / 1024 ** 3).toFixed(1)} GB`
  if (v >= 1024 ** 2) return `${(v / 1024 ** 2).toFixed(1)} MB`
  if (v >= 1024) return `${(v / 1024).toFixed(1)} KB`
  return `${v} B`
}
const fmtTime = (ms: number) => new Date(ms).toLocaleString()
// fmtCompact renders a count SI-abbreviated (1_240_000 → "1.24M", 8320 → "8.3k", 121 → "121").
const fmtCompact = (v: number): string => {
  const a = Math.abs(v)
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)}B`
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)}k`
  if (a >= 10 || Number.isInteger(v)) return String(Math.round(v))
  return v.toFixed(1)
}

// deliveredSummary turns the per-bucket "delivered messages" series into rate framings the chart
// alone can't convey: total over the window, average per sec/min, and the peak per sec/min (the
// busiest bucket normalised by its duration, so it is a true rate, not a bucket-size-dependent count).
const deliveredSummary = (
  data: TrendPanelData | null,
  rangeSeconds: number
) => {
  const points = data?.series?.[0]?.data ?? []
  const values = points.filter(
    (v): v is number => v !== null && v !== undefined
  )
  if (values.length === 0) return null
  // Bucket duration: prefer the server-resolved granularity, else infer from bucket spacing.
  const bucketSeconds =
    data?.granularitySeconds ||
    (data && data.buckets.length > 1
      ? (data.buckets[1] - data.buckets[0]) / 1000
      : 0)
  const total = values.reduce((a, b) => a + b, 0)
  const avgPerSec = total / rangeSeconds
  const maxPerSec = bucketSeconds > 0 ? Math.max(...values) / bucketSeconds : 0
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
      <MiniStat label="delivered in window" value={fmtCompact(total)} />
      <MiniStat label="avg / sec" value={fmtCompact(avgPerSec)} />
      <MiniStat label="avg / min" value={fmtCompact(avgPerSec * 60)} />
      <MiniStat label="max / sec" value={fmtCompact(maxPerSec)} />
      <MiniStat label="max / min" value={fmtCompact(maxPerSec * 60)} />
    </Box>
  )
}

export const ChannelExplorer = ({
  signinSilent,
  authorization,
}: ChannelExplorerProps) => {
  const { showAlert } = useContext(ShellContext)
  const { rawRequest } = useAdminApi({ authorization, signinSilent })
  const [searchParams, setSearchParams] = useSearchParams()

  const initialChannel = useRef(
    searchParams.get('channel') || localStorage.getItem(LAST_CHANNEL_KEY) || ''
  ).current
  const initialRange = useRef(
    Number(searchParams.get('range')) || RANGES[2].seconds
  ).current

  const [input, setInput] = useState(initialChannel)
  const [channel, setChannel] = useState(initialChannel)
  const [rangeSeconds, setRangeSeconds] = useState(initialRange)
  const [data, setData] = useState<ChannelData | null>(null)
  const [loading, setLoading] = useState(false)
  const [enabled, setEnabled] = useState(true)

  const headers = useMemo(
    () => ({ Accept: 'application/json', Authorization: authorization }),
    [authorization]
  )

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

  useEffect(() => {
    if (!channel) {
      setData(null)
      return
    }
    let cancelled = false
    setLoading(true)
    const now = Math.floor(Date.now() / 1000)
    rawRequest(`admin/analytics/channel`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: JSON.stringify({ channel, from: now - rangeSeconds, to: now }),
    })
      .then(r => {
        if (!r.ok) {
          if (handleHttpError(r.status)) return null
          throw Error(r.status.toString())
        }
        if (!cancelled) setEnabled(true)
        return r.json()
      })
      .then(p => {
        if (!p || cancelled) return
        setData(p.result)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [channel, rangeSeconds, rawRequest, handleHttpError])

  useEffect(() => {
    const next = new URLSearchParams()
    next.set('tab', 'channel')
    if (channel) next.set('channel', channel)
    next.set('range', String(rangeSeconds))
    setSearchParams(next, { replace: true })
    if (channel) localStorage.setItem(LAST_CHANNEL_KEY, channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, rangeSeconds])

  const commit = () => setChannel(input.trim())
  const channelFilter = useMemo(() => ({ channel }), [channel])
  const goToUser = (user: string) =>
    setSearchParams(new URLSearchParams({ tab: 'user', user }))

  if (!enabled) {
    return (
      <Box className="max-w-8xl mx-auto p-8">
        <Alert severity="info">
          ClickHouse analytics is not enabled. The Channel explorer requires{' '}
          <code>clickhouse_analytics</code>.
        </Alert>
      </Box>
    )
  }

  return (
    <Box className="max-w-8xl mx-auto p-8">
      <Grid container spacing={2} sx={{ mb: 2 }} alignItems="center">
        <Grid>
          <TextField
            size="small"
            label="Channel"
            placeholder="exact channel name…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commit()
            }}
            sx={{ minWidth: 320 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <TagIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
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
        {loading && (
          <Grid>
            <CircularProgress size={20} />
          </Grid>
        )}
      </Grid>

      {!channel ? (
        <Box sx={{ py: 10, textAlign: 'center', color: 'text.secondary' }}>
          <TagIcon sx={{ fontSize: 48, opacity: 0.4 }} />
          <Typography sx={{ mt: 1 }}>
            Enter a channel to see who's on it and what's flowing through.
          </Typography>
        </Box>
      ) : data && !data.found ? (
        <Alert severity="warning">
          No analytics data for channel <code>{channel}</code> in this window.
          Try a wider range.
        </Alert>
      ) : data ? (
        <>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 1,
                  mb: 1.5,
                }}
              >
                <Typography variant="h6" sx={{ mr: 1 }}>
                  {channel}
                </Typography>
                {data.namespace && (
                  <Chip
                    size="small"
                    label={`namespace: ${data.namespace}`}
                    variant="outlined"
                    color="primary"
                  />
                )}
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Stat
                  label="subscribers"
                  value={fmtNum(data.summary.subscribers)}
                />
                <Stat
                  label="publications"
                  value={fmtNum(data.summary.publications)}
                />
                <Stat
                  label="publishers"
                  value={fmtNum(data.summary.publishers)}
                />
                <Stat label="bytes" value={fmtBytes(data.summary.bytes)} />
                <Stat
                  label="errors"
                  value={fmtNum(data.summary.errors)}
                  severity={data.summary.errors > 0 ? 'error' : undefined}
                />
              </Box>
            </CardContent>
          </Card>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <TrendPanel
                title="Delivered messages (fan-out)"
                metric="delivered_messages"
                filters={channelFilter}
                rangeSeconds={rangeSeconds}
                headers={headers}
                group={CHART_GROUP}
                height={260}
                footer={(data: TrendPanelData | null) => (
                  <>
                    {deliveredSummary(data, rangeSeconds)}
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mt: 1 }}
                    >
                      Estimated delivery = publications × concurrent
                      subscribers. The real cost a channel imposes — a few
                      publishes to a large audience can dwarf a busy channel
                      with few subscribers. Each bar is the volume in one bucket
                      (height scales with the range's bucket size); the stats
                      above normalise it to the whole window. Subscribers are
                      sampled periodically, so treat this as an estimate.
                    </Typography>
                  </>
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TrendPanel
                title="Subscribers"
                metric="active_subscriptions"
                filters={channelFilter}
                rangeSeconds={rangeSeconds}
                headers={headers}
                group={CHART_GROUP}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TrendPanel
                title="Subscribe vs unsubscribe (churn)"
                metric="subscribe_unsubscribe_rate"
                filters={channelFilter}
                rangeSeconds={rangeSeconds}
                headers={headers}
                group={CHART_GROUP}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TrendPanel
                title="Publications by source"
                metric="publications_rate"
                filters={channelFilter}
                rangeSeconds={rangeSeconds}
                headers={headers}
                group={CHART_GROUP}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TrendPanel
                title="Throughput"
                metric="publications_throughput"
                filters={channelFilter}
                rangeSeconds={rangeSeconds}
                headers={headers}
                group={CHART_GROUP}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TrendPanel
                title="Operations by type"
                metric="operations_by_type"
                filters={channelFilter}
                rangeSeconds={rangeSeconds}
                headers={headers}
                group={CHART_GROUP}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TrendPanel
                title="Errors by code"
                metric="errors_by_code"
                filters={channelFilter}
                rangeSeconds={rangeSeconds}
                headers={headers}
                group={CHART_GROUP}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <UserListCard
                title="Top publishers"
                users={data.topPublishers}
                unit="pubs"
                onUser={goToUser}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <UserListCard
                title="Top subscribers"
                users={data.topSubscribers}
                unit="connections"
                onUser={goToUser}
              />
            </Grid>
          </Grid>

          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Errors on this channel
              </Typography>
              {data.events.length === 0 ? (
                <Box sx={{ py: 3, color: 'text.secondary' }}>
                  No errors in this window 🎉
                </Box>
              ) : (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Time</TableCell>
                      <TableCell>Operation</TableCell>
                      <TableCell>User</TableCell>
                      <TableCell>Error</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.events.map((ev, i) => (
                      <TableRow key={i}>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {fmtTime(ev.time)}
                        </TableCell>
                        <TableCell>
                          {ev.op}
                          {ev.method ? ` · ${ev.method}` : ''}
                        </TableCell>
                        <TableCell>
                          {ev.user ? (
                            <Link onUser={goToUser} user={ev.user} />
                          ) : (
                            <Box
                              component="span"
                              sx={{ color: 'text.secondary' }}
                            >
                              —
                            </Box>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={`error ${ev.error}`}
                            color="error"
                            variant="outlined"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {data.events.length >= EVENTS_LIMIT && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 1 }}
                >
                  Showing the {EVENTS_LIMIT} most recent of{' '}
                  {data.summary.errors.toLocaleString()} errors — narrow the
                  time range to see more.
                </Typography>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </Box>
  )
}

const Stat = ({
  label,
  value,
  severity,
}: {
  label: string
  value: string
  severity?: 'error' | 'warning'
}) => (
  <Box
    sx={{
      px: 1.5,
      py: 0.75,
      borderRadius: 1,
      bgcolor: 'action.hover',
      minWidth: 92,
    }}
  >
    <Typography
      variant="h6"
      sx={{
        lineHeight: 1.1,
        color: severity ? `${severity}.main` : 'text.primary',
      }}
    >
      {value}
    </Typography>
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
  </Box>
)

const MiniStat = ({ label, value }: { label: string; value: string }) => (
  <Box
    sx={{
      px: 1.25,
      py: 0.5,
      borderRadius: 1,
      bgcolor: 'action.hover',
      minWidth: 84,
    }}
  >
    <Typography variant="subtitle1" sx={{ lineHeight: 1.1, fontWeight: 600 }}>
      {value}
    </Typography>
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
  </Box>
)

const UserListCard = ({
  title,
  users,
  unit,
  onUser,
}: {
  title: string
  users: UserCount[]
  unit: string
  onUser: (u: string) => void
}) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Typography variant="subtitle2" gutterBottom>
        {title}
      </Typography>
      {users.length === 0 ? (
        <Box sx={{ py: 3, color: 'text.secondary' }}>None in this window.</Box>
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
            maxHeight: 200,
            overflow: 'auto',
          }}
        >
          {users.map(u => (
            <Box
              key={u.user}
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Chip
                size="small"
                label={u.user}
                variant="outlined"
                clickable
                onClick={() => onUser(u.user)}
              />
              <Typography variant="caption" color="text.secondary">
                {u.count.toLocaleString()} {unit}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </CardContent>
  </Card>
)

const Link = ({
  user,
  onUser,
}: {
  user: string
  onUser: (u: string) => void
}) => (
  <Chip
    size="small"
    label={user}
    variant="outlined"
    clickable
    onClick={() => onUser(user)}
  />
)

export default ChannelExplorer
