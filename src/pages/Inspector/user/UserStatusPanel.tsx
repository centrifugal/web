import { useCallback, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import RefreshIcon from '@mui/icons-material/Refresh'
import CircleIcon from '@mui/icons-material/Circle'

import { Panel, FieldRow } from '../ui'
import { InspectorApi } from '../types'
import { fmtAgo, fmtDateTime } from '../format'

interface UserStatus {
  user?: string
  active?: number
  online?: number
  state?: string
}

// User online/active status (get_user_status). Rendered only when the user_status
// feature is enabled server-side.
export const UserStatusPanel = ({
  user,
  api,
  refreshKey,
}: {
  user: string
  api: InspectorApi
  refreshKey?: number
}) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<UserStatus | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.call<{ statuses?: UserStatus[] }>(
        'get_user_status',
        {
          users: [user],
        }
      )
      setStatus(res.statuses?.[0] ?? {})
    } catch (e: any) {
      setError(e?.message || 'Failed to load user status')
    } finally {
      setLoading(false)
    }
  }, [api, user])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  // Online within the last minute is a reasonable "online now" heuristic.
  const onlineMs = status?.online ? status.online * 1000 : 0
  const isOnline = onlineMs > 0 && Date.now() - onlineMs < 60_000

  return (
    <Panel
      title="Status"
      icon={
        <CircleIcon
          sx={{ fontSize: 12 }}
          color={isOnline ? 'success' : 'disabled'}
        />
      }
      action={
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
      {error ? (
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      ) : status ? (
        <Box>
          <FieldRow label="Online">
            {status.online ? (
              <>
                <Chip
                  size="small"
                  label={isOnline ? 'online' : 'offline'}
                  color={isOnline ? 'success' : 'default'}
                  sx={{ height: 20, mr: 1 }}
                />
                <Typography
                  component="span"
                  variant="body2"
                  color="text.secondary"
                >
                  last seen {fmtAgo(onlineMs)}
                </Typography>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                never
              </Typography>
            )}
          </FieldRow>
          <FieldRow label="Active">
            {status.active ? fmtDateTime(status.active * 1000) : '—'}
          </FieldRow>
          {status.state && (
            <FieldRow label="State">
              <Chip size="small" label={status.state} sx={{ height: 20 }} />
            </FieldRow>
          )}
        </Box>
      ) : (
        <CircularProgress size={20} />
      )}
    </Panel>
  )
}
