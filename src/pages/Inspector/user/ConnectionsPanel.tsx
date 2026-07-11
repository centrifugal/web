import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableContainer from '@mui/material/TableContainer'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Link from '@mui/material/Link'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import RefreshIcon from '@mui/icons-material/Refresh'
import LanIcon from '@mui/icons-material/Lan'
import TimelineIcon from '@mui/icons-material/Timeline'
import QueryStatsIcon from '@mui/icons-material/QueryStats'
import { useTheme } from '@mui/material/styles'

import { Widget } from '../ui'
import { ConfirmButton } from '../components/ConfirmButton'
import { InspectorApi, GoToChannel } from '../types'
import {
  renderData,
  fmtAgo,
  fmtDateTime,
  subscriptionSourceName,
} from '../format'

interface TokenInfo {
  uid?: string
  issued_at?: number
}
interface ConnState {
  channels?: Record<string, { source?: number }>
  connection_token?: TokenInfo
  subscription_tokens?: Record<string, TokenInfo>
  meta?: unknown
}
export interface ConnectionInfo {
  app_name?: string
  app_version?: string
  transport?: string
  protocol?: string
  user?: string
  state?: ConnState
  connected_at_ms?: number
  ping_pong_latency_ms?: number
  labels?: Record<string, string>
}
type ConnEntry = ConnectionInfo & { client: string }

const latencyColor = (theme: any, ms?: number): string | undefined => {
  if (ms == null || ms < 0) return undefined
  if (ms < 50) return theme.palette.success.main
  if (ms < 100) return theme.palette.warning.main
  return theme.palette.error.main
}

// Live connections for a user: every active connection with transport, app, latency
// and subscriptions; row opens details + per-connection operator actions.
export const ConnectionsPanel = ({
  user,
  api,
  onGoToChannel,
  analyticsEnabled,
  refreshKey,
}: {
  user: string
  api: InspectorApi
  onGoToChannel: GoToChannel
  analyticsEnabled?: boolean
  refreshKey?: number
}) => {
  const theme = useTheme()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<ConnEntry[] | null>(null)
  const [selected, setSelected] = useState<ConnEntry | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.call<{
        connections?: Record<string, ConnectionInfo>
      }>('connections', { user })
      const list = Object.entries(res.connections ?? {}).map(
        ([client, info]) => ({ ...info, client })
      )
      setRows(list)
    } catch (e: any) {
      setError(e?.message || 'Failed to load connections')
    } finally {
      setLoading(false)
    }
  }, [api, user])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const subCount = (c: ConnEntry) => Object.keys(c.state?.channels ?? {}).length

  const statsNode = error ? (
    <Typography variant="body2" color="error">
      {error}
    </Typography>
  ) : rows ? (
    <Typography variant="body2" color="text.secondary">
      {rows.length.toLocaleString()} active connection(s)
    </Typography>
  ) : loading ? (
    <Typography variant="body2" color="text.secondary">
      loading…
    </Typography>
  ) : null

  return (
    <Widget
      title="Connections"
      icon={<LanIcon fontSize="small" />}
      stats={statsNode}
      controls={
        <Tooltip title="Refresh" arrow>
          <span>
            <IconButton size="small" onClick={load} disabled={loading}>
              {loading ? (
                <CircularProgress size={18} />
              ) : (
                <RefreshIcon fontSize="small" />
              )}
            </IconButton>
          </span>
        </Tooltip>
      }
    >
      {error ? null : rows && rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No active connections for this user.
        </Typography>
      ) : rows ? (
        <TableContainer sx={{ maxHeight: 420 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Client ID</TableCell>
                <TableCell>Transport</TableCell>
                <TableCell>App</TableCell>
                <TableCell align="right">Latency</TableCell>
                <TableCell align="right">Subs</TableCell>
                <TableCell>Connected</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(c => (
                <TableRow
                  key={c.client}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => setSelected(c)}
                >
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                    {c.client}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={c.transport || '—'}
                      sx={{ height: 20 }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>
                    {c.app_name ? `${c.app_name} ${c.app_version ?? ''}` : '—'}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontSize: 12,
                      color: latencyColor(theme, c.ping_pong_latency_ms),
                    }}
                  >
                    {c.ping_pong_latency_ms != null &&
                    c.ping_pong_latency_ms >= 0
                      ? `${c.ping_pong_latency_ms}ms`
                      : '—'}
                  </TableCell>
                  <TableCell align="right">{subCount(c)}</TableCell>
                  <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>
                    {fmtAgo(c.connected_at_ms)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <CircularProgress size={20} />
      )}

      <ConnectionDetails
        conn={selected}
        api={api}
        onClose={() => setSelected(null)}
        onGoToChannel={onGoToChannel}
        onTrace={client =>
          navigate(`/tracing?client_id=${encodeURIComponent(client)}`)
        }
        onSessionHistory={
          analyticsEnabled
            ? client =>
                navigate(
                  `/analytics?tab=recorder&rmode=client&q=${encodeURIComponent(client)}`
                )
            : undefined
        }
        onActed={load}
      />
    </Widget>
  )
}

// ---- details dialog --------------------------------------------------------

const ConnectionDetails = ({
  conn,
  api,
  onClose,
  onGoToChannel,
  onTrace,
  onSessionHistory,
  onActed,
}: {
  conn: ConnEntry | null
  api: InspectorApi
  onClose: () => void
  onGoToChannel: GoToChannel
  onTrace: (client: string) => void
  onSessionHistory?: (client: string) => void
  onActed: () => void
}) => {
  if (!conn) return null
  const channels = Object.entries(conn.state?.channels ?? {})
  const subTokens = Object.entries(conn.state?.subscription_tokens ?? {})
  const connToken = conn.state?.connection_token
  const meta = renderData(conn.state?.meta)

  const disconnect = async (code: number, reason: string) => {
    try {
      await api.call('disconnect', {
        user: conn.user,
        client: conn.client,
        disconnect: { code, reason },
      })
      api.showAlert('Done', { severity: 'success' })
      onClose()
      onActed()
    } catch (e: any) {
      api.showAlert(e?.message || 'Action failed', { severity: 'error' })
    }
  }

  const revoke = async () => {
    if (!connToken?.uid) return
    // Keep the revocation record for 30 days — long enough to outlive typical
    // tokens without accumulating forever.
    const expireAt = Math.floor(Date.now() / 1000) + 30 * 24 * 3600
    try {
      await api.call('revoke_token', {
        uid: connToken.uid,
        expire_at: expireAt,
      })
      api.showAlert('Token revoked', { severity: 'success' })
    } catch (e: any) {
      api.showAlert(e?.message || 'Revoke failed', { severity: 'error' })
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontFamily: 'monospace', fontSize: 16 }}>
        {conn.client}
      </DialogTitle>
      <DialogContent dividers>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 1,
            mb: 2,
          }}
        >
          <Detail label="User" value={conn.user || '(anonymous)'} mono />
          <Detail
            label="Transport"
            value={`${conn.transport ?? '—'} · ${conn.protocol ?? ''}`}
          />
          <Detail
            label="App"
            value={
              conn.app_name ? `${conn.app_name} ${conn.app_version ?? ''}` : '—'
            }
          />
          <Detail
            label="Latency"
            value={
              conn.ping_pong_latency_ms != null &&
              conn.ping_pong_latency_ms >= 0
                ? `${conn.ping_pong_latency_ms}ms`
                : '—'
            }
          />
          <Detail label="Connected" value={fmtDateTime(conn.connected_at_ms)} />
          {connToken?.uid && (
            <Detail
              label="Token jti"
              value={connToken.uid}
              mono
              sub={
                connToken.issued_at
                  ? `issued ${fmtDateTime(connToken.issued_at * 1000)}`
                  : undefined
              }
            />
          )}
        </Box>

        {conn.labels && Object.keys(conn.labels).length > 0 && (
          <Section title="Labels">
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {Object.entries(conn.labels).map(([k, v]) => (
                <Chip
                  key={k}
                  size="small"
                  label={`${k}=${v}`}
                  sx={{ height: 20 }}
                />
              ))}
            </Box>
          </Section>
        )}

        <Section title={`Subscriptions (${channels.length})`}>
          {channels.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No channel subscriptions.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              {channels.map(([ch, ctx]) => (
                <Box
                  key={ch}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <Link
                    component="button"
                    type="button"
                    onClick={() => onGoToChannel(ch)}
                    sx={{ fontFamily: 'monospace', fontSize: 13 }}
                  >
                    {ch}
                  </Link>
                  <Typography variant="caption" color="text.secondary">
                    {subscriptionSourceName(ctx.source)}
                  </Typography>
                  {subTokens.find(([sc]) => sc === ch) && (
                    <Chip
                      size="small"
                      label="token"
                      sx={{ height: 16, fontSize: 10 }}
                    />
                  )}
                </Box>
              ))}
            </Box>
          )}
        </Section>

        {meta && (
          <Section title="Meta">
            <Box
              component="pre"
              sx={{
                m: 0,
                fontSize: 12,
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
              }}
            >
              {meta}
            </Box>
          </Section>
        )}
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, py: 2 }}>
        <Button
          size="small"
          startIcon={<TimelineIcon />}
          onClick={() => onTrace(conn.client)}
        >
          Trace
        </Button>
        {onSessionHistory && (
          <Button
            size="small"
            startIcon={<QueryStatsIcon />}
            onClick={() => onSessionHistory(conn.client)}
          >
            Session history
          </Button>
        )}
        <Box sx={{ flexGrow: 1 }} />
        {connToken?.uid && (
          <ConfirmButton
            title="Revoke this token?"
            body={`Revokes token ${connToken.uid}. Any connection using it is invalidated on next check. The revocation is kept for 30 days.`}
            confirmText="Revoke token"
            onConfirm={revoke}
          >
            {open => (
              <Button size="small" color="warning" onClick={open}>
                Revoke token
              </Button>
            )}
          </ConfirmButton>
        )}
        <ConfirmButton
          title="Force reconnect?"
          body="Disconnects this client with a reconnect advice — well-behaved SDKs reconnect automatically."
          confirmText="Reconnect"
          confirmColor="warning"
          onConfirm={() => disconnect(3011, 'force reconnect')}
        >
          {open => (
            <Button size="small" color="warning" onClick={open}>
              Reconnect
            </Button>
          )}
        </ConfirmButton>
        <ConfirmButton
          title="Disconnect this client?"
          body="Disconnects this client without reconnect advice."
          confirmText="Disconnect"
          onConfirm={() => disconnect(3503, 'force disconnect')}
        >
          {open => (
            <Button size="small" color="error" onClick={open}>
              Disconnect
            </Button>
          )}
        </ConfirmButton>
      </DialogActions>
    </Dialog>
  )
}

const Detail = ({
  label,
  value,
  sub,
  mono,
}: {
  label: string
  value: string
  sub?: string
  mono?: boolean
}) => (
  <Box>
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
    <Typography
      variant="body2"
      sx={{
        fontFamily: mono ? 'monospace' : undefined,
        wordBreak: 'break-all',
      }}
    >
      {value}
    </Typography>
    {sub && (
      <Typography variant="caption" color="text.secondary">
        {sub}
      </Typography>
    )}
  </Box>
)

const Section = ({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) => (
  <Box sx={{ mt: 2 }}>
    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
      {title}
    </Typography>
    {children}
  </Box>
)
