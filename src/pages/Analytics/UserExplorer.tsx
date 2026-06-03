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
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import PersonSearchIcon from '@mui/icons-material/PersonSearch'
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

import { globalUrlPrefix } from 'config/url'
import { ShellContext } from 'contexts/ShellContext'

import { TrendPanel } from './TrendPanel'

interface UserExplorerProps {
  signinSilent: () => void
  authorization: string
}

interface UserEvent {
  time: number
  op: string
  channel: string
  namespace: string
  method: string
  error: number
  disconnect: number
}

interface UserData {
  user: string
  found: boolean
  profile: {
    name: string
    version: string
    transport: string
    labels: Record<string, string>
    firstSeen: number
    lastSeen: number
  }
  summary: {
    connections: number
    operations: number
    errors: number
    disconnects: number
    publications: number
    channels: number
    latencyP95: number
    connLatencyP95: number
  }
  channels: string[]
  events: UserEvent[]
}

const RANGES: { label: string; seconds: number }[] = [
  { label: '1h', seconds: 60 * 60 },
  { label: '6h', seconds: 6 * 60 * 60 },
  { label: '24h', seconds: 24 * 60 * 60 },
  { label: '7d', seconds: 7 * 24 * 60 * 60 },
  { label: '30d', seconds: 30 * 24 * 60 * 60 },
]
const LAST_USER_KEY = 'centrifugo_user_explorer_v1'
const EVENTS_LIMIT = 100 // matches the backend LIMIT for key events

const fmtNum = (n: number) => n.toLocaleString()

const relTime = (ms: number): string => {
  if (!ms) return '—'
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

const fmtTime = (ms: number) => new Date(ms).toLocaleString()
const fmtMs = (ms: number) =>
  ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`

export const UserExplorer = ({
  signinSilent,
  authorization,
}: UserExplorerProps) => {
  const { showAlert } = useContext(ShellContext)
  const [searchParams, setSearchParams] = useSearchParams()

  const initialUser = useRef(
    searchParams.get('user') || localStorage.getItem(LAST_USER_KEY) || ''
  ).current
  const initialRange = useRef(
    Number(searchParams.get('range')) || RANGES[2].seconds
  ).current

  const [input, setInput] = useState(initialUser) // text box (immediate)
  const [user, setUser] = useState(initialUser) // committed (on Enter/click)
  const [rangeSeconds, setRangeSeconds] = useState(initialRange)
  const [data, setData] = useState<UserData | null>(null)
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

  // Fetch profile + summary + key events for the committed user.
  useEffect(() => {
    if (!user) {
      setData(null)
      return
    }
    setLoading(true)
    const now = Math.floor(Date.now() / 1000)
    fetch(`${globalUrlPrefix}admin/analytics/user`, {
      method: 'POST',
      headers,
      mode: 'same-origin',
      body: JSON.stringify({ user, from: now - rangeSeconds, to: now }),
    })
      .then(r => {
        if (!r.ok) {
          if (handleHttpError(r.status)) return null
          throw Error(r.status.toString())
        }
        setEnabled(true)
        return r.json()
      })
      .then(p => {
        if (!p) return
        setData(p.result)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [user, rangeSeconds, headers, handleHttpError])

  // Persist user + range to URL (shareable) and localStorage (last user).
  useEffect(() => {
    const next = new URLSearchParams()
    next.set('tab', 'user')
    if (user) next.set('user', user)
    next.set('range', String(rangeSeconds))
    setSearchParams(next, { replace: true })
    if (user) localStorage.setItem(LAST_USER_KEY, user)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, rangeSeconds])

  const commit = () => setUser(input.trim())
  const userFilter = useMemo(() => ({ user }), [user])
  const goToChannel = (ch: string) =>
    setSearchParams(new URLSearchParams({ tab: 'channel', channel: ch }))
  // Jump to the flight recorder for this user over the currently-selected window.
  const goToRecorder = () => {
    const now = Math.floor(Date.now() / 1000)
    setSearchParams(
      new URLSearchParams({
        tab: 'recorder',
        rmode: 'user',
        q: user,
        from: String(now - rangeSeconds),
        to: String(now),
      })
    )
  }
  const CHART_GROUP = 'user-explorer'

  if (!enabled) {
    return (
      <Box className="max-w-8xl mx-auto p-8">
        <Alert severity="info">
          ClickHouse analytics is not enabled. The User explorer requires{' '}
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
            label="User ID"
            placeholder="paste a user ID…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commit()
            }}
            sx={{ minWidth: 320 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonSearchIcon fontSize="small" />
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

      {!user ? (
        <Box sx={{ py: 10, textAlign: 'center', color: 'text.secondary' }}>
          <PersonSearchIcon sx={{ fontSize: 48, opacity: 0.4 }} />
          <Typography sx={{ mt: 1 }}>
            Enter a user ID to see everything that happened to them.
          </Typography>
        </Box>
      ) : data && !data.found ? (
        <Alert severity="warning">
          No analytics data for user <code>{user}</code> in this window. Try a
          wider range.
        </Alert>
      ) : data ? (
        <>
          {/* Header card */}
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
                  {user}
                </Typography>
                {Object.entries(data.profile.labels).map(([k, v]) => (
                  <Chip
                    key={k}
                    size="small"
                    label={`${k}: ${v}`}
                    variant="outlined"
                    color="primary"
                  />
                ))}
                {data.profile.name && (
                  <Chip
                    size="small"
                    label={`${data.profile.name}${
                      data.profile.version ? ' ' + data.profile.version : ''
                    }`}
                    variant="outlined"
                  />
                )}
                {data.profile.transport && (
                  <Chip
                    size="small"
                    label={data.profile.transport}
                    variant="outlined"
                  />
                )}
                <Box sx={{ flexGrow: 1 }} />
                <Button size="small" variant="outlined" onClick={goToRecorder}>
                  Flight recorder →
                </Button>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Stat
                  label="connections"
                  value={fmtNum(data.summary.connections)}
                />
                <Stat
                  label="operations"
                  value={fmtNum(data.summary.operations)}
                />
                <Stat
                  label="errors"
                  value={
                    data.summary.operations > 0
                      ? `${(
                          (100 * data.summary.errors) /
                          data.summary.operations
                        ).toFixed(1)}%`
                      : '0%'
                  }
                  severity={data.summary.errors > 0 ? 'error' : undefined}
                />
                <Stat
                  label="disconnects"
                  value={fmtNum(data.summary.disconnects)}
                  severity={
                    data.summary.disconnects > 0 ? 'warning' : undefined
                  }
                />
                <Stat
                  label="op latency p95"
                  value={fmtMs(data.summary.latencyP95)}
                />
                <Stat
                  label="conn latency p95"
                  value={
                    data.summary.connLatencyP95 > 0
                      ? fmtMs(data.summary.connLatencyP95)
                      : '—'
                  }
                />
                <Stat label="channels" value={fmtNum(data.summary.channels)} />
                <Stat
                  label="publications"
                  value={fmtNum(data.summary.publications)}
                />
                <Stat
                  label="last seen"
                  value={relTime(data.profile.lastSeen)}
                />
              </Box>
            </CardContent>
          </Card>

          {/* Charts, all scoped to this user and connected so the crosshair/zoom sync */}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TrendPanel
                title="Operations by type"
                metric="operations_by_type"
                filters={userFilter}
                rangeSeconds={rangeSeconds}
                headers={headers}
                group={CHART_GROUP}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TrendPanel
                title="Active connections"
                metric="client_connections"
                filters={userFilter}
                rangeSeconds={rangeSeconds}
                headers={headers}
                group={CHART_GROUP}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TrendPanel
                title="Disconnects by code"
                metric="disconnect_rate"
                filters={userFilter}
                rangeSeconds={rangeSeconds}
                headers={headers}
                group={CHART_GROUP}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TrendPanel
                title="Latency p95 by operation"
                metric="latency_by_op"
                filters={userFilter}
                rangeSeconds={rangeSeconds}
                headers={headers}
                group={CHART_GROUP}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TrendPanel
                title="Connection latency p95 (ping RTT)"
                metric="connection_latency"
                filters={userFilter}
                rangeSeconds={rangeSeconds}
                headers={headers}
                group={CHART_GROUP}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TrendPanel
                title="Active subscriptions"
                metric="active_subscriptions"
                filters={userFilter}
                rangeSeconds={rangeSeconds}
                headers={headers}
                group={CHART_GROUP}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TrendPanel
                title={`Subscriptions by channel (${data.summary.channels})`}
                metric="subscriptions_by_channel"
                filters={userFilter}
                rangeSeconds={rangeSeconds}
                headers={headers}
                group={CHART_GROUP}
                footer={
                  data.channels.length > 0 ? (
                    <Box
                      sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 0.5,
                        mt: 1,
                        maxHeight: 84,
                        overflow: 'auto',
                      }}
                    >
                      {data.channels.map(ch => (
                        <Chip
                          key={ch}
                          size="small"
                          label={ch}
                          variant="outlined"
                          clickable
                          onClick={() => goToChannel(ch)}
                        />
                      ))}
                    </Box>
                  ) : null
                }
              />
            </Grid>
          </Grid>

          {/* Key events */}
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Key events (errors & disconnects)
              </Typography>
              {data.events.length === 0 ? (
                <Box sx={{ py: 3, color: 'text.secondary' }}>
                  No errors or disconnects in this window 🎉
                </Box>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Time</TableCell>
                      <TableCell>Operation</TableCell>
                      <TableCell>Channel</TableCell>
                      <TableCell>Result</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.events.map((ev, i) => {
                      const isErr = ev.error > 0
                      const result = isErr
                        ? `error ${ev.error}`
                        : `disconnect${
                            ev.disconnect ? ' ' + ev.disconnect : ''
                          }`
                      return (
                        <TableRow key={i}>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {fmtTime(ev.time)}
                          </TableCell>
                          <TableCell>
                            {ev.op}
                            {ev.method ? ` · ${ev.method}` : ''}
                          </TableCell>
                          <TableCell sx={{ color: 'text.secondary' }}>
                            {ev.channel || '—'}
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={result}
                              color={isErr ? 'error' : 'warning'}
                              variant="outlined"
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
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
                  {fmtNum(data.summary.errors + data.summary.disconnects)} —
                  narrow the time range to see more.
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
      minWidth: 96,
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

export default UserExplorer
