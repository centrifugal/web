import {
  Fragment,
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
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import CircularProgress from '@mui/material/CircularProgress'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { Grid } from '@mui/material'

import { useAdminApi } from 'api/adminApi'
import { ShellContext } from 'contexts/ShellContext'

interface FlightRecorderProps {
  signinSilent: () => void
  authorization: string
}

interface RecorderEvent {
  time: number
  client: string
  user: string
  op: string
  channel: string
  namespace: string
  method: string
  error: number
  errorName?: string
  disconnect: number
  disconnectName?: string
  durationMs: number
}
interface ClientProfile {
  name: string
  version: string
  transport: string
  labels: Record<string, string>
  latencyP95: number
  connectedAt: number // unix ms when the connection was established, 0 if unknown
}
interface RecorderData {
  events: RecorderEvent[]
  profiles: Record<string, ClientProfile>
  truncated: boolean
}

// Canonical op ordering for the filter row (present ops only; unknown ops appended).
const OP_ORDER = [
  'connect',
  'subscribe',
  'unsubscribe',
  'publish',
  'history',
  'presence',
  'presence_stats',
  'rpc',
  'refresh',
  'sub_refresh',
  'disconnect',
]

// Max-events options (must stay within the backend's recorderMaxEventsHard ceiling).
const MAX_EVENTS_OPTIONS: { label: string; value: number }[] = [
  { label: '2k', value: 2000 },
  { label: '10k', value: 10000 },
  { label: '50k', value: 50000 },
]

// Per-operation accent colour (readable on light and dark) used for the timeline marker + label.
const OP_COLOR: Record<string, string> = {
  connect: '#2e7d32',
  disconnect: '#d32f2f',
  subscribe: '#1976d2',
  unsubscribe: '#ed6c02',
  publish: '#7b1fa2',
  history: '#6d4c41',
  presence: '#00897b',
  presence_stats: '#00897b',
  rpc: '#3949ab',
  refresh: '#757575',
  sub_refresh: '#757575',
}
const opColor = (op: string) => OP_COLOR[op] ?? '#9e9e9e'

// A disconnect is "abnormal" (worth flagging red) for any non-zero code. Code 0 is a clean close
// and stays neutral.
const isAbnormalDisconnect = (code: number) => code !== 0

const QUICK_RANGES: { label: string; seconds: number }[] = [
  { label: '15m', seconds: 15 * 60 },
  { label: '1h', seconds: 60 * 60 },
  { label: '6h', seconds: 6 * 60 * 60 },
  { label: '24h', seconds: 24 * 60 * 60 },
]

// Every datetime on this page — the From/To pickers, timeline clocks, date separators, minimap
// axis — is the viewer's LOCAL time. tzLabel is a short name for it (e.g. "GMT+3", "PST") so the
// page can say so explicitly. (CSV export, by contrast, writes UTC ISO-8601 with a trailing "Z".)
const tzLabel = (() => {
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZoneName: 'short',
    }).formatToParts(new Date())
    return parts.find(p => p.type === 'timeZoneName')?.value ?? ''
  } catch {
    return ''
  }
})()

// datetime-local <-> Date helpers (local time, second precision).
const pad = (n: number) => String(n).padStart(2, '0')
const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
const inputToUnix = (s: string) => Math.floor(new Date(s).getTime() / 1000)
const unixToInput = (u: number) => toLocalInput(new Date(u * 1000))

const fmtClock = (ms: number) => {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(
    d.getSeconds()
  )}.${String(d.getMilliseconds()).padStart(3, '0')}`
}
const fmtDur = (ms: number) =>
  ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms.toFixed(1)} ms`
const fmtRel = (ms: number) => {
  if (ms < 1000) return `+${Math.round(ms)}ms`
  if (ms < 60000) return `+${(ms / 1000).toFixed(1)}s`
  const s = Math.round(ms / 1000)
  return `+${Math.floor(s / 60)}m ${s % 60}s`
}
// dayKey identifies the calendar day (local) so the timeline can insert a separator when it rolls
// over; fmtDate is the separator label.
const dayKey = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}
const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
// fmtDateTime renders an absolute timestamp as day/month/year plus a locale-aware clock (so the
// 12h/24h style follows the viewer's locale, matching the From/To inputs).
const fmtDateTime = (ms: number) => {
  const d = new Date(ms)
  const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
  const time = d.toLocaleTimeString(navigator.language, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  return `${date}, ${time}`
}
// fmtAxisTick labels a minimap time axis: dates when the window spans days, times otherwise; the
// two ends always carry a time so the exact extent is readable.
const fmtAxisTick = (ms: number, spanMs: number, full: boolean) => {
  const d = new Date(ms)
  const date = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (full) return spanMs > 86400000 ? `${date} ${time}` : time
  return spanMs > 2 * 86400000 ? date : time
}
const fmtSpan = (ms: number) => {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

// sessionToText renders a session as a plain-text block for pasting into a ticket or bug report.
const sessionToText = (
  events: RecorderEvent[],
  profile?: ClientProfile
): string => {
  const first = events[0]
  const last = events[events.length - 1]
  const errors = events.filter(e => e.error > 0).length
  const ended = last.op === 'disconnect'
  const profileBits = [
    profile?.name
      ? `${profile.name}${profile.version ? ' ' + profile.version : ''}`
      : '',
    profile?.transport ?? '',
    profile
      ? Object.entries(profile.labels || {})
          .map(([k, v]) => `${k}:${v}`)
          .join(', ')
      : '',
    profile && profile.latencyP95 > 0
      ? `RTT p95 ${Math.round(profile.latencyP95)}ms`
      : '',
  ]
    .filter(Boolean)
    .join(' · ')
  const lines = [
    `Session ${first.client}${profileBits ? ' · ' + profileBits : ''}`,
    `${events.length} ops · ${errors} error(s) · span ${fmtSpan(
      last.time - first.time
    )}${
      ended
        ? ` · ended: ${
            last.disconnectName
              ? `${last.disconnect} (${last.disconnectName})`
              : `code ${last.disconnect}`
          }`
        : ' · active at window end'
    }`,
    '',
  ]
  for (const e of events) {
    const ch = e.channel
      ? e.namespace
        ? `${e.channel} · ${e.namespace}`
        : e.channel
      : ''
    let line = `${fmtClock(e.time).padEnd(13)}${e.op.padEnd(15)}${ch.padEnd(
      26
    )}${fmtDur(e.durationMs).padStart(9)}`
    if (e.method) line += `  ${e.method}`
    if (e.error > 0)
      line += `  ERROR ${e.error}${e.errorName ? ` (${e.errorName})` : ''}`
    if (e.op === 'disconnect')
      line += `  ${e.disconnect}${
        e.disconnectName ? ` (${e.disconnectName})` : ''
      }`
    lines.push(line)
  }
  return lines.join('\n')
}

// Minimap renders one lane per connection on a shared time axis spanning the full SELECTED window
// (fromMs..toMs), so a bar's position and length reflect where the connection sat in that window —
// overlapping bars reveal concurrency, error ticks + a disconnect cap make problem sessions pop,
// and clicking a lane jumps to that session's card.
const Minimap = ({
  sessions,
  fromMs,
  toMs,
  onJump,
}: {
  sessions: RecorderEvent[][]
  fromMs: number
  toMs: number
  onJump: (c: string) => void
}) => {
  const tMin = fromMs
  const tMax = toMs
  const span = Math.max(1, tMax - tMin)
  const pct = (t: number) =>
    Math.min(100, Math.max(0, ((t - tMin) / span) * 100))

  // Peak concurrency via a sweep over [start, end] spans (+1 at start, -1 at end).
  const pts: Array<[number, number]> = []
  for (const evs of sessions) {
    pts.push([evs[0].time, 1])
    pts.push([evs[evs.length - 1].time, -1])
  }
  pts.sort((a, b) => a[0] - b[0] || b[1] - a[1])
  let cur = 0
  let peak = 0
  for (const [, d] of pts) {
    cur += d
    if (cur > peak) peak = cur
  }

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            mb: 1,
          }}
        >
          <Typography variant="subtitle2">Connections overview</Typography>
          <Typography variant="caption" color="text.secondary">
            {sessions.length} connection{sessions.length === 1 ? '' : 's'} ·
            peak {peak} concurrent
          </Typography>
        </Box>
        <Box sx={{ maxHeight: 220, overflowY: 'auto', pr: 1 }}>
          {sessions.map(evs => {
            const client = evs[0].client
            const lastEv = evs[evs.length - 1]
            const left = pct(evs[0].time)
            const right = pct(lastEv.time)
            const width = Math.max(0.6, right - left)
            const ended = lastEv.op === 'disconnect'
            const badEnd = ended && isAbnormalDisconnect(lastEv.disconnect)
            return (
              <Box
                key={client}
                onClick={() => onJump(client)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  cursor: 'pointer',
                  borderRadius: 1,
                  px: 0.5,
                  py: 0.25,
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Typography
                  variant="caption"
                  title={client}
                  sx={{
                    fontFamily: 'monospace',
                    color: 'text.secondary',
                    width: 140,
                    flexShrink: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {client}
                </Typography>
                <Box
                  sx={{
                    position: 'relative',
                    flexGrow: 1,
                    height: 14,
                    bgcolor: 'action.hover',
                    borderRadius: 0.5,
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      left: `${left}%`,
                      width: `${width}%`,
                      top: 3,
                      height: 8,
                      borderRadius: 4,
                      bgcolor: 'primary.main',
                      opacity: 0.55,
                    }}
                  />
                  {evs
                    .filter(e => e.error > 0)
                    .map((e, i) => (
                      <Box
                        key={i}
                        sx={{
                          position: 'absolute',
                          left: `${pct(e.time)}%`,
                          top: 1,
                          width: '2px',
                          height: 12,
                          bgcolor: 'error.main',
                        }}
                      />
                    ))}
                  {ended && (
                    <Box
                      sx={{
                        position: 'absolute',
                        left: `${right}%`,
                        top: 0,
                        width: '3px',
                        height: 14,
                        bgcolor: badEnd ? 'error.dark' : 'text.disabled',
                        transform: 'translateX(-1px)',
                      }}
                    />
                  )}
                </Box>
              </Box>
            )
          })}
        </Box>
        <Box sx={{ display: 'flex', mt: 0.5 }}>
          <Box sx={{ width: 148, flexShrink: 0 }} />
          <Box sx={{ position: 'relative', flexGrow: 1, height: 14 }}>
            {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
              <Typography
                key={i}
                variant="caption"
                sx={{
                  position: 'absolute',
                  left: `${f * 100}%`,
                  transform:
                    i === 0
                      ? 'none'
                      : i === 4
                        ? 'translateX(-100%)'
                        : 'translateX(-50%)',
                  fontFamily: 'monospace',
                  fontSize: '0.65rem',
                  color: 'text.secondary',
                  whiteSpace: 'nowrap',
                }}
              >
                {fmtAxisTick(tMin + f * span, span, i === 0 || i === 4)}
              </Typography>
            ))}
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

export const FlightRecorder = ({
  signinSilent,
  authorization,
}: FlightRecorderProps) => {
  const { showAlert } = useContext(ShellContext)
  const { rawRequest } = useAdminApi({ authorization, signinSilent })
  const [searchParams, setSearchParams] = useSearchParams()

  const initial = useRef({
    mode: (searchParams.get('rmode') === 'client' ? 'client' : 'user') as
      'user' | 'client',
    q: searchParams.get('q') || '',
    from:
      Number(searchParams.get('from')) || Math.floor(Date.now() / 1000) - 3600,
    to: Number(searchParams.get('to')) || Math.floor(Date.now() / 1000),
  }).current

  const [mode, setMode] = useState<'user' | 'client'>(initial.mode)
  const [entity, setEntity] = useState(initial.q)
  const [fromStr, setFromStr] = useState(unixToInput(initial.from))
  const [toStr, setToStr] = useState(unixToInput(initial.to))
  const [data, setData] = useState<RecorderData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [enabled, setEnabled] = useState(true)
  // The query that produced the current data (so the header echoes what's shown). fromMs/toMs are
  // the selected window in ms — the minimap anchors its axis to this, not to the event extents.
  const [shown, setShown] = useState<{
    mode: string
    q: string
    fromMs: number
    toMs: number
  } | null>(null)
  // Timeline noise filters: hidden op types + an "errors & lifecycle only" toggle.
  const [hiddenOps, setHiddenOps] = useState<Set<string>>(new Set())
  const [errorsOnly, setErrorsOnly] = useState(false)
  // Show timestamps relative to each session's start ("+1.2s") instead of wall-clock.
  const [relativeTime, setRelativeTime] = useState(false)
  // Max events to fetch (admin can raise it for very busy users; clamped server-side).
  const [maxEvents, setMaxEvents] = useState(2000)
  const [downloading, setDownloading] = useState(false)

  const headers = useMemo(() => ({ Accept: 'application/json' }), [])

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

  const load = useCallback(
    (
      modeArg?: 'user' | 'client',
      entityArg?: string,
      limitArg?: number,
      fromArg?: number // unix seconds; overrides the From picker (used by "Move From back")
    ) => {
      const m = modeArg ?? mode
      const q = (entityArg ?? entity).trim()
      if (!q) return
      const from = fromArg ?? inputToUnix(fromStr)
      const to = inputToUnix(toStr)
      if (!from || !to || to <= from) {
        setError('Pick a valid time range (To must be after From).')
        return
      }
      setLoading(true)
      setError('')
      rawRequest('admin/analytics/recorder', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          [m]: q,
          from,
          to,
          limit: limitArg ?? maxEvents,
        }),
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
          setShown({ mode: m, q, fromMs: from * 1000, toMs: to * 1000 })
          setLoading(false)
          const next = new URLSearchParams(searchParams)
          next.set('tab', 'recorder')
          next.set('rmode', m)
          next.set('q', q)
          next.set('from', String(from))
          next.set('to', String(to))
          setSearchParams(next, { replace: true })
        })
        .catch(() => {
          setError('Error loading timeline')
          setLoading(false)
        })
    },
    // searchParams/setSearchParams intentionally excluded — setSearchParams is stable and we don't
    // want load() recreated on every URL change it makes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      entity,
      fromStr,
      toStr,
      mode,
      maxEvents,
      headers,
      handleHttpError,
      rawRequest,
    ]
  )

  // Auto-load once on mount if the URL already carried an entity (shareable timelines).
  const didInit = useRef(false)
  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    if (initial.q) load()
  }, [initial.q, load])

  const setQuick = (seconds: number) => {
    const now = Math.floor(Date.now() / 1000)
    setFromStr(unixToInput(now - seconds))
    setToStr(unixToInput(now))
  }

  // Group the time-ascending events into sessions (one connection = one client id).
  const sessions = useMemo(() => {
    const map = new Map<string, RecorderEvent[]>()
    for (const e of data?.events ?? []) {
      const arr = map.get(e.client)
      if (arr) arr.push(e)
      else map.set(e.client, [e])
    }
    return Array.from(map.values())
  }, [data])

  // Op types present in the loaded data, in canonical order (for the filter chips).
  const presentOps = useMemo(() => {
    const set = new Set((data?.events ?? []).map(e => e.op))
    const ordered = OP_ORDER.filter(o => set.has(o))
    const extra = Array.from(set)
      .filter(o => !OP_ORDER.includes(o))
      .sort()
    return [...ordered, ...extra]
  }, [data])

  const isVisible = useCallback(
    (e: RecorderEvent) => {
      if (errorsOnly && !(e.error > 0 || e.op === 'disconnect')) return false
      return !hiddenOps.has(e.op)
    },
    [errorsOnly, hiddenOps]
  )

  // Sessions that still have at least one visible event under the current filters.
  const filteredSessions = useMemo(
    () =>
      sessions
        .map(full => ({ full, vis: full.filter(isVisible) }))
        .filter(s => s.vis.length > 0),
    [sessions, isVisible]
  )

  const toggleOp = (op: string) =>
    setHiddenOps(prev => {
      const next = new Set(prev)
      if (next.has(op)) next.delete(op)
      else next.add(op)
      return next
    })

  // Cross-links: a channel jumps to the Channel explorer; a client id drills this recorder down to
  // that single connection (client mode) over the same window.
  const goToChannel = (ch: string) =>
    setSearchParams(new URLSearchParams({ tab: 'channel', channel: ch }))
  const drillClient = (client: string) => {
    setMode('client')
    setEntity(client)
    load('client', client)
  }

  // "Move From back" on a session whose connection predates the window: set From a few seconds
  // before the connection was established and re-run the same query so the whole session is in
  // range. State updates are async, so pass the new From to load() explicitly rather than relying
  // on the setFromStr above having landed.
  const moveFromBeforeConnect = (connectedAtMs: number) => {
    if (!shown) return
    const fromSec = Math.floor(connectedAtMs / 1000) - 5
    setFromStr(unixToInput(fromSec))
    load(shown.mode as 'user' | 'client', shown.q, undefined, fromSec)
  }

  // Minimap → card navigation: scroll the clicked connection's card into view.
  const cardRefs = useRef(new Map<string, HTMLDivElement>())
  const jumpToSession = (client: string) =>
    cardRefs.current
      .get(client)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  // Export the FULL window as CSV (a fresh export-mode fetch, not just the rendered slice), so the
  // admin can get everything even when the timeline is capped for rendering.
  const downloadCsv = async () => {
    if (!shown) return
    // Derive the range from the committed query (shown), not the live pickers.
    // shown.mode/shown.q already come from the last Replay; reading fromStr/toStr
    // here would export a different window than the one displayed if the admin
    // edited the pickers after replaying.
    const from = Math.floor(shown.fromMs / 1000)
    const to = Math.floor(shown.toMs / 1000)
    setDownloading(true)
    try {
      const r = await rawRequest('admin/analytics/recorder', {
        method: 'POST',
        headers,
        body: JSON.stringify({ [shown.mode]: shown.q, from, to, export: true }),
      })
      if (!r.ok) {
        showAlert('Export failed', { severity: 'error' })
        return
      }
      const p = await r.json()
      const events: RecorderEvent[] = p.result?.events ?? []
      const cols = [
        'time',
        'client',
        'user',
        'op',
        'channel',
        'namespace',
        'method',
        'error',
        'errorName',
        'disconnect',
        'disconnectName',
        'durationMs',
      ]
      // Field values (user IDs, channel names, error text) originate from
      // untrusted clients, so a leading =/+/-/@/tab/CR would be executed as a
      // formula when the CSV is opened in a spreadsheet. Prefix those with a
      // single quote (the standard neutralizer) before the usual CSV quoting.
      const esc = (v: unknown) => {
        let s = String(v ?? '')
        // Numbers are ours, so leave them intact (a negative duration must not
        // become text); only text fields need neutralizing.
        if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
      }
      const lines = [cols.join(',')]
      for (const e of events) {
        lines.push(
          [
            new Date(e.time).toISOString(),
            e.client,
            e.user,
            e.op,
            e.channel,
            e.namespace,
            e.method,
            e.error,
            e.errorName ?? '',
            e.disconnect,
            e.disconnectName ?? '',
            e.durationMs,
          ]
            .map(esc)
            .join(',')
        )
      }
      const safe = shown.q.replace(/[^a-zA-Z0-9_.-]/g, '_')
      const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `flight-recorder-${shown.mode}-${safe}.csv`
      a.click()
      URL.revokeObjectURL(url)
      if (p.result?.truncated) {
        showAlert(
          'Export hit the 200k-event cap — narrow the range to capture the full window.',
          {
            severity: 'info',
          }
        )
      }
    } catch {
      showAlert('Export failed', { severity: 'error' })
    } finally {
      setDownloading(false)
    }
  }

  if (!enabled) {
    return (
      <Box className="max-w-8xl mx-auto p-8">
        <Alert severity="info">
          ClickHouse analytics is not enabled. The Flight recorder requires{' '}
          <code>clickhouse_analytics</code> with operations export.
        </Alert>
      </Box>
    )
  }

  return (
    <Box className="max-w-8xl mx-auto p-8">
      <Grid container spacing={2} sx={{ mb: 2 }} alignItems="center">
        <Grid>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={mode}
            onChange={(_, v) => v && setMode(v)}
          >
            <ToggleButton value="user">User</ToggleButton>
            <ToggleButton value="client">Client</ToggleButton>
          </ToggleButtonGroup>
        </Grid>
        <Grid>
          <TextField
            size="small"
            label={mode === 'user' ? 'User ID' : 'Client ID'}
            placeholder={mode === 'user' ? 'user ID' : 'client connection ID'}
            value={entity}
            onChange={e => setEntity(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            sx={{ width: 200 }}
          />
        </Grid>
        <Grid>
          <TextField
            size="small"
            label={tzLabel ? `From (${tzLabel})` : 'From'}
            type="datetime-local"
            value={fromStr}
            onChange={e => setFromStr(e.target.value)}
            inputProps={{ step: 1 }}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 250 }}
          />
        </Grid>
        <Grid>
          <TextField
            size="small"
            label={tzLabel ? `To (${tzLabel})` : 'To'}
            type="datetime-local"
            value={toStr}
            onChange={e => setToStr(e.target.value)}
            inputProps={{ step: 1 }}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 250 }}
          />
        </Grid>
        <Grid>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={null}
            onChange={(_, v) => v && setQuick(v)}
          >
            {QUICK_RANGES.map(r => (
              <ToggleButton key={r.label} value={r.seconds} sx={{ px: 1 }}>
                {r.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Grid>
        <Grid>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={maxEvents}
            onChange={(_, v) => {
              if (!v) return
              setMaxEvents(v)
              if (shown) load(undefined, undefined, v) // re-fetch immediately with the new cap
            }}
          >
            {MAX_EVENTS_OPTIONS.map(o => (
              <ToggleButton
                key={o.value}
                value={o.value}
                sx={{ px: 1 }}
                title={`max ${o.value} events`}
              >
                {o.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Grid>
        <Grid>
          <Button
            variant="solid"
            color="primary"
            size="small"
            onClick={() => load()}
            disabled={loading}
            sx={{ minWidth: 92 }}
          >
            {loading ? (
              <CircularProgress size={18} color="inherit" />
            ) : (
              'Replay'
            )}
          </Button>
        </Grid>
      </Grid>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            py: 8,
            gap: 1.5,
            color: 'text.secondary',
          }}
        >
          <CircularProgress size={28} />
          <Typography>Loading timeline…</Typography>
        </Box>
      )}

      {!data && !loading && (
        <Box sx={{ py: 10, textAlign: 'center', color: 'text.secondary' }}>
          <Typography>
            Pick a user or client and an exact time range, then Replay to see
            the chronological operation timeline — connects, subscribes,
            publishes, errors and the disconnect reason.
          </Typography>
        </Box>
      )}

      {!loading && data && shown && data.events.length === 0 && (
        <Alert severity="warning">
          No operations for <code>{shown.q}</code> in this window. Widen the
          range or check the ID.
        </Alert>
      )}

      {!loading && data && shown && data.events.length > 0 && (
        <>
          {data.truncated && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Showing the first {data.events.length.toLocaleString()} operations
              (oldest first).{' '}
              {maxEvents < 50000 && <>Raise “max” above for more, or </>}
              narrow the time range or drill into a single connection (Client
              mode) to capture the end of busy sessions.{' '}
              <strong>Download CSV</strong> exports the full window (up to 200k
              events).
            </Alert>
          )}

          {/* Noise filter: hide routine ops, or show only errors + lifecycle. */}
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 0.75,
              mb: 2,
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mr: 0.5 }}
            >
              show:
            </Typography>
            {presentOps.map(op => {
              const on = !hiddenOps.has(op)
              return (
                <Chip
                  key={op}
                  size="small"
                  label={op}
                  onClick={() => toggleOp(op)}
                  variant={on ? 'filled' : 'outlined'}
                  sx={{
                    height: 22,
                    cursor: 'pointer',
                    bgcolor: on ? opColor(op) : 'transparent',
                    color: on ? '#fff' : 'text.disabled',
                    borderColor: opColor(op),
                    opacity: errorsOnly ? 0.5 : 1,
                    '&:hover': { bgcolor: on ? opColor(op) : 'action.hover' },
                  }}
                />
              )
            })}
            <Box sx={{ width: 12 }} />
            <ToggleButton
              value="errorsOnly"
              size="small"
              selected={errorsOnly}
              onChange={() => setErrorsOnly(v => !v)}
              sx={{ height: 24, px: 1, textTransform: 'none' }}
              color="error"
            >
              errors &amp; lifecycle only
            </ToggleButton>
            <ToggleButton
              value="relative"
              size="small"
              selected={relativeTime}
              onChange={() => setRelativeTime(v => !v)}
              sx={{ height: 24, px: 1, textTransform: 'none' }}
            >
              relative time
            </ToggleButton>
            <Box sx={{ flexGrow: 1 }} />
            <Button
              size="small"
              variant="tonal"
              color="info"
              onClick={downloadCsv}
              disabled={downloading}
              sx={{ textTransform: 'none' }}
            >
              {downloading ? 'Downloading…' : 'Download CSV'}
            </Button>
          </Box>

          {filteredSessions.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
              No events match the current filter.
            </Box>
          ) : (
            <>
              {filteredSessions.length > 1 && (
                <Minimap
                  sessions={filteredSessions.map(s => s.full)}
                  fromMs={shown.fromMs}
                  toMs={shown.toMs}
                  onJump={jumpToSession}
                />
              )}
              {filteredSessions.map(({ full, vis }) => (
                <Box
                  key={full[0].client}
                  ref={(el: HTMLDivElement | null) => {
                    if (el) cardRefs.current.set(full[0].client, el)
                  }}
                >
                  <SessionCard
                    events={full}
                    visible={vis}
                    profile={data.profiles[full[0].client]}
                    mode={shown?.mode ?? 'user'}
                    relative={relativeTime}
                    windowFromMs={shown.fromMs}
                    onChannel={goToChannel}
                    onDrill={shown?.mode === 'user' ? drillClient : undefined}
                    onMoveFrom={moveFromBeforeConnect}
                  />
                </Box>
              ))}
            </>
          )}
        </>
      )}
    </Box>
  )
}

const SessionCard = ({
  events,
  visible,
  profile,
  mode,
  relative,
  windowFromMs,
  onChannel,
  onDrill,
  onMoveFrom,
}: {
  events: RecorderEvent[]
  visible: RecorderEvent[]
  profile?: ClientProfile
  mode: string
  relative: boolean
  windowFromMs: number
  onChannel?: (ch: string) => void
  onDrill?: (client: string) => void
  onMoveFrom?: (connectedAtMs: number) => void
}) => {
  const first = events[0]
  const last = events[events.length - 1]
  const base = first.time
  const errors = events.filter(e => e.error > 0).length
  const ended = last.op === 'disconnect'
  const endReason = ended
    ? last.disconnectName
      ? `${last.disconnect} (${last.disconnectName})`
      : `code ${last.disconnect}`
    : null
  // The connection was established before the selected window, so earlier operations exist outside
  // the range and the timeline below is only its tail.
  const startedBefore =
    !!profile && profile.connectedAt > 0 && profile.connectedAt < windowFromMs
  // Slowest op in the (visible) timeline, for scaling the per-row duration micro-bars.
  const maxDur = Math.max(1, ...visible.map(e => e.durationMs))
  // Left-border accent: red if the session had errors or an abnormal disconnect, green if still
  // active at window end, neutral for a clean disconnect.
  const statusColor =
    errors > 0 || (ended && isAbnormalDisconnect(last.disconnect))
      ? 'error.main'
      : !ended
        ? 'success.main'
        : 'divider'
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(sessionToText(events, profile)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <Card sx={{ mb: 2, borderLeft: 3, borderColor: statusColor }}>
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
          <Typography
            variant="subtitle2"
            onClick={onDrill ? () => onDrill(first.client) : undefined}
            sx={{
              fontFamily: 'monospace',
              mr: 0.5,
              cursor: onDrill ? 'pointer' : 'default',
              color: onDrill ? 'primary.main' : 'text.primary',
              '&:hover': onDrill ? { textDecoration: 'underline' } : undefined,
            }}
          >
            {first.client}
          </Typography>
          {/* connection profile (what the client was) */}
          {mode === 'client' && (
            <Chip
              size="small"
              variant="outlined"
              label={`user: ${first.user || '—'}`}
            />
          )}
          {profile?.name && (
            <Chip
              size="small"
              variant="outlined"
              label={`${profile.name}${
                profile.version ? ' ' + profile.version : ''
              }`}
            />
          )}
          {profile?.transport && (
            <Chip size="small" variant="outlined" label={profile.transport} />
          )}
          {profile &&
            Object.entries(profile.labels || {}).map(([k, v]) => (
              <Chip
                key={k}
                size="small"
                variant="outlined"
                color="primary"
                label={`${k}: ${v}`}
              />
            ))}
          {profile && profile.latencyP95 > 0 && (
            <Chip
              size="small"
              variant="outlined"
              label={`RTT p95 ${Math.round(profile.latencyP95)} ms`}
            />
          )}
          <Box sx={{ width: 8 }} />
          {/* session stats (what the connection did) */}
          <Chip
            size="small"
            variant="outlined"
            label={`${events.length} ops`}
          />
          <Chip
            size="small"
            variant="outlined"
            color={errors > 0 ? 'error' : 'default'}
            label={`${errors} error${errors === 1 ? '' : 's'}`}
          />
          <Chip
            size="small"
            variant="outlined"
            label={`span ${fmtSpan(last.time - first.time)}`}
          />
          {ended ? (
            <Chip
              size="small"
              color={
                isAbnormalDisconnect(last.disconnect) ? 'error' : 'default'
              }
              variant={
                isAbnormalDisconnect(last.disconnect) ? 'filled' : 'outlined'
              }
              label={`ended: ${endReason}`}
            />
          ) : (
            <Chip
              size="small"
              color="success"
              variant="outlined"
              label="active at window end"
            />
          )}
          {visible.length < events.length && (
            <Typography variant="caption" color="text.secondary">
              showing {visible.length} of {events.length}
            </Typography>
          )}
          <Box sx={{ flexGrow: 1 }} />
          <Button
            size="small"
            variant="tonal"
            color="inherit"
            onClick={copy}
            sx={{ textTransform: 'none' }}
          >
            {copied ? 'Copied ✓' : 'Copy'}
          </Button>
        </Box>

        {startedBefore && profile && (
          <Alert severity="info" variant="outlined" sx={{ mb: 1.5, py: 0.25 }}>
            Connection was established at{' '}
            <strong>{fmtDateTime(profile.connectedAt)}</strong>, before the
            selected window — earlier operations are outside this range.{' '}
            {onMoveFrom ? (
              <Link
                component="button"
                type="button"
                onClick={() => onMoveFrom(profile.connectedAt)}
                sx={{ verticalAlign: 'baseline' }}
              >
                Move From back
              </Link>
            ) : (
              <>
                Move <em>From</em> back
              </>
            )}{' '}
            to see the start of the session.
          </Alert>
        )}

        <Box>
          {visible.map((ev, i) => {
            const color = opColor(ev.op)
            const abnormal =
              ev.error > 0 ||
              (ev.op === 'disconnect' && isAbnormalDisconnect(ev.disconnect))
            const newDay =
              i === 0 || dayKey(ev.time) !== dayKey(visible[i - 1].time)
            return (
              <Fragment key={i}>
                {newDay && (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mt: i === 0 ? 0 : 1.5,
                      mb: 0.5,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 600,
                        color: 'text.secondary',
                        fontFamily: 'monospace',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {fmtDate(ev.time)}
                    </Typography>
                    <Box
                      sx={{ flexGrow: 1, height: '1px', bgcolor: 'divider' }}
                    />
                  </Box>
                )}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1.5,
                    borderRadius: 1,
                    px: 1,
                    py: 0.5,
                    bgcolor: abnormal ? 'rgba(211,47,47,0.08)' : undefined,
                    '&:hover': {
                      bgcolor: abnormal
                        ? 'rgba(211,47,47,0.12)'
                        : 'action.hover',
                    },
                  }}
                >
                  <Typography
                    variant="caption"
                    title={
                      relative ? new Date(ev.time).toLocaleString() : undefined
                    }
                    sx={{
                      fontFamily: 'monospace',
                      color: 'text.secondary',
                      minWidth: 96,
                      pt: 0.3,
                      textAlign: 'right',
                    }}
                  >
                    {relative ? fmtRel(ev.time - base) : fmtClock(ev.time)}
                  </Typography>
                  {/* connector + marker */}
                  <Box
                    sx={{
                      position: 'relative',
                      width: 16,
                      alignSelf: 'stretch',
                      flexShrink: 0,
                    }}
                  >
                    <Box
                      sx={{
                        position: 'absolute',
                        left: '50%',
                        top: 0,
                        bottom: 0,
                        width: '2px',
                        transform: 'translateX(-1px)',
                        bgcolor: 'divider',
                        display: i === visible.length - 1 ? 'none' : 'block',
                      }}
                    />
                    <Box
                      sx={{
                        position: 'relative',
                        width: 10,
                        height: 10,
                        mt: 0.5,
                        mx: 'auto',
                        borderRadius: '50%',
                        bgcolor: color,
                        boxShadow:
                          '0 0 0 2px var(--mui-palette-background-paper, #fff)',
                      }}
                    />
                  </Box>
                  <Box
                    sx={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 0.75,
                      flexGrow: 1,
                      pt: 0.1,
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600, color }}>
                      {ev.op}
                    </Typography>
                    {ev.channel && (
                      <Chip
                        size="small"
                        variant="outlined"
                        clickable={!!onChannel}
                        onClick={
                          onChannel ? () => onChannel(ev.channel) : undefined
                        }
                        sx={{ fontFamily: 'monospace', height: 20 }}
                        label={
                          ev.namespace
                            ? `${ev.channel} · ${ev.namespace}`
                            : ev.channel
                        }
                      />
                    )}
                    {ev.method && (
                      <Chip
                        size="small"
                        variant="outlined"
                        sx={{ height: 20 }}
                        label={ev.method}
                      />
                    )}
                    {ev.error > 0 && (
                      <Chip
                        size="small"
                        color="error"
                        variant="outlined"
                        sx={{ height: 20 }}
                        label={
                          ev.errorName
                            ? `error ${ev.error} (${ev.errorName})`
                            : `error ${ev.error}`
                        }
                      />
                    )}
                    {ev.op === 'disconnect' && (
                      <Chip
                        size="small"
                        color={
                          isAbnormalDisconnect(ev.disconnect)
                            ? 'error'
                            : 'default'
                        }
                        variant={
                          isAbnormalDisconnect(ev.disconnect)
                            ? 'filled'
                            : 'outlined'
                        }
                        sx={{ height: 20 }}
                        label={
                          ev.disconnectName
                            ? `${ev.disconnect} (${ev.disconnectName})`
                            : `code ${ev.disconnect}`
                        }
                      />
                    )}
                    <Box sx={{ flexGrow: 1 }} />
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}
                    >
                      <Box
                        sx={{
                          width: 40,
                          height: 4,
                          borderRadius: 2,
                          bgcolor: 'action.hover',
                          overflow: 'hidden',
                        }}
                      >
                        <Box
                          sx={{
                            width: `${Math.max(
                              4,
                              (ev.durationMs / maxDur) * 100
                            )}%`,
                            height: '100%',
                            bgcolor:
                              ev.durationMs >= 1000
                                ? 'error.main'
                                : ev.durationMs >= 100
                                  ? 'warning.main'
                                  : 'success.main',
                          }}
                        />
                      </Box>
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: 'monospace',
                          minWidth: 56,
                          textAlign: 'right',
                          color:
                            ev.durationMs >= 1000
                              ? 'error.main'
                              : ev.durationMs >= 100
                                ? 'warning.main'
                                : 'text.secondary',
                        }}
                      >
                        {fmtDur(ev.durationMs)}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Fragment>
            )
          })}
        </Box>
      </CardContent>
    </Card>
  )
}

export default FlightRecorder
