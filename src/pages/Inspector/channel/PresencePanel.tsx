import { useCallback, useEffect, useState } from 'react'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableContainer from '@mui/material/TableContainer'
import Typography from '@mui/material/Typography'
import Link from '@mui/material/Link'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import RefreshIcon from '@mui/icons-material/Refresh'
import PeopleAltIcon from '@mui/icons-material/PeopleAlt'

import { Widget } from '../ui'
import { InspectorApi, GoToUser } from '../types'
import { renderData } from '../format'

interface ClientInfo {
  user?: string
  client?: string
  conn_info?: unknown
  chan_info?: unknown
}

// Live presence for a channel. Counts (presence_stats) load automatically and show
// inline; the per-client list loads only when the operator expands it.
export const PresencePanel = ({
  channel,
  api,
  onGoToUser,
  refreshKey,
}: {
  channel: string
  api: InspectorApi
  onGoToUser: GoToUser
  refreshKey?: number
}) => {
  const [loading, setLoading] = useState(false)
  const [clientsLoading, setClientsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<{
    num_clients: number
    num_users: number
  } | null>(null)
  const [clients, setClients] = useState<ClientInfo[] | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setClients(null)
    try {
      const s = await api.call<{ num_clients: number; num_users: number }>(
        'presence_stats',
        { channel }
      )
      setStats(s)
    } catch (e: any) {
      setError(e?.message || 'Failed to load presence')
    } finally {
      setLoading(false)
    }
  }, [api, channel])

  const loadClients = useCallback(async () => {
    setClientsLoading(true)
    setError(null)
    try {
      const p = await api.call<{ presence?: Record<string, ClientInfo> }>(
        'presence',
        { channel }
      )
      setClients(Object.values(p.presence ?? {}))
    } catch (e: any) {
      setError(e?.message || 'Failed to load connections')
    } finally {
      setClientsLoading(false)
    }
  }, [api, channel])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const statsNode = error ? (
    <Typography variant="body2" color="error">
      {error}
    </Typography>
  ) : stats ? (
    <Typography variant="body2" color="text.secondary">
      {stats.num_clients.toLocaleString()} clients ·{' '}
      {stats.num_users.toLocaleString()} users
    </Typography>
  ) : loading ? (
    <Typography variant="body2" color="text.secondary">
      loading…
    </Typography>
  ) : null

  const controls = (
    <>
      {clients === null && stats && stats.num_clients > 0 && (
        <Button
          variant="tonal"
          color="secondary"
          size="small"
          onClick={loadClients}
          disabled={clientsLoading}
          startIcon={
            clientsLoading ? <CircularProgress size={14} /> : undefined
          }
        >
          Show connections
        </Button>
      )}
      <Tooltip title="Refresh presence" arrow>
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
    </>
  )

  return (
    <Widget
      icon={<PeopleAltIcon fontSize="small" />}
      title="Presence"
      stats={statsNode}
      controls={controls}
    >
      {clients &&
        (clients.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No clients currently subscribed.
          </Typography>
        ) : (
          <TableContainer sx={{ maxHeight: 320 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Client ID</TableCell>
                  <TableCell>Info</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {clients.map((c, i) => {
                  const info = renderData(c.conn_info)
                  return (
                    <TableRow key={c.client ?? i} hover>
                      <TableCell>
                        {c.user ? (
                          <Link
                            component="button"
                            type="button"
                            onClick={() => onGoToUser(c.user!)}
                            sx={{ fontFamily: 'monospace' }}
                          >
                            {c.user}
                          </Link>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            (anonymous)
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                        {c.client}
                      </TableCell>
                      <TableCell
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: 12,
                          color: 'text.secondary',
                          maxWidth: 280,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {info ?? '—'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        ))}
    </Widget>
  )
}
