import { useCallback, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import TextField from '@mui/material/TextField'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import RefreshIcon from '@mui/icons-material/Refresh'
import HistoryIcon from '@mui/icons-material/History'
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'

import { Widget } from '../ui'
import { ConfirmButton } from '../components/ConfirmButton'
import { InspectorApi } from '../types'
import { renderData } from '../format'

interface Publication {
  data?: unknown
  offset?: number
  tags?: Record<string, string>
  info?: { user?: string; client?: string }
}

// Channel history. The stream position (epoch/offset) loads automatically and
// shows inline; publications load only when the operator expands.
export const HistoryPanel = ({
  channel,
  api,
  cacheMode,
  onPurged,
  refreshKey,
}: {
  channel: string
  api: InspectorApi
  cacheMode: boolean
  onPurged?: () => void
  refreshKey?: number
}) => {
  const [limit, setLimit] = useState('5')
  const [loading, setLoading] = useState(false)
  const [pubsLoading, setPubsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<{ epoch?: string; offset?: number } | null>(
    null
  )
  const [pubs, setPubs] = useState<Publication[] | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setPubs(null)
    try {
      const res = await api.call<{ epoch?: string; offset?: number }>(
        'history',
        { channel, limit: 0 }
      )
      setMeta({ epoch: res.epoch, offset: res.offset })
    } catch (e: any) {
      setError(e?.message || 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [api, channel])

  const loadPubs = useCallback(async () => {
    setPubsLoading(true)
    setError(null)
    try {
      const n = parseInt(limit)
      const res = await api.call<{
        publications?: Publication[]
        epoch?: string
        offset?: number
      }>('history', {
        channel,
        limit: Number.isFinite(n) ? n : 5,
        reverse: true,
      })
      setPubs(res.publications ?? [])
      setMeta({ epoch: res.epoch, offset: res.offset })
    } catch (e: any) {
      setError(e?.message || 'Failed to load publications')
    } finally {
      setPubsLoading(false)
    }
  }, [api, channel, limit])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const purge = async () => {
    try {
      await api.call('history_remove', { channel })
      api.showAlert('History purged', { severity: 'success' })
      onPurged?.()
      load()
    } catch (e: any) {
      api.showAlert(e?.message || 'Failed to purge history', {
        severity: 'error',
      })
    }
  }

  const busy = loading || pubsLoading

  const statsNode = error ? (
    <Typography variant="body2" color="error">
      {error}
    </Typography>
  ) : cacheMode ? (
    <Typography variant="body2" color="text.secondary">
      cache recovery · latest only
    </Typography>
  ) : meta?.epoch != null ? (
    <Typography variant="body2" color="text.secondary">
      epoch {meta.epoch} · top offset {meta.offset ?? '—'}
    </Typography>
  ) : loading ? (
    <Typography variant="body2" color="text.secondary">
      loading…
    </Typography>
  ) : null

  const controls = (
    <>
      <TextField
        size="small"
        type="number"
        label="Limit"
        value={limit}
        onChange={e => setLimit(e.target.value)}
        sx={{ width: 84 }}
      />
      {pubs === null && (
        <Button
          variant="outlined"
          size="small"
          onClick={loadPubs}
          disabled={pubsLoading}
          startIcon={pubsLoading ? <CircularProgress size={14} /> : undefined}
        >
          Show publications
        </Button>
      )}
      <Tooltip title="Reload" arrow>
        <span>
          <IconButton
            size="small"
            onClick={() => (pubs ? loadPubs() : load())}
            disabled={busy}
          >
            {busy ? (
              <CircularProgress size={18} />
            ) : (
              <RefreshIcon fontSize="small" />
            )}
          </IconButton>
        </span>
      </Tooltip>
      <ConfirmButton
        title="Purge history?"
        body={`This permanently removes all history for "${channel}".`}
        confirmText="Purge"
        onConfirm={purge}
      >
        {open => (
          <Tooltip title="Purge history" arrow>
            <IconButton size="small" color="error" onClick={open}>
              <DeleteSweepIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </ConfirmButton>
    </>
  )

  return (
    <Widget
      icon={<HistoryIcon fontSize="small" />}
      title="History"
      stats={statsNode}
      controls={controls}
    >
      {pubs &&
        (pubs.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No publications in history.
          </Typography>
        ) : (
          <Box sx={{ maxHeight: 340, overflow: 'auto' }}>
            {pubs.map((p, i) => (
              <Box
                key={p.offset ?? i}
                sx={{
                  py: 1,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  '&:last-child': { borderBottom: 'none' },
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mb: 0.5,
                  }}
                >
                  <Chip
                    size="small"
                    label={`offset: ${p.offset ?? '—'}`}
                    variant="outlined"
                    sx={{ height: 20, fontFamily: 'monospace', fontSize: 11 }}
                  />
                  {p.info?.user && (
                    <Typography variant="caption" color="text.secondary">
                      by {p.info.user}
                    </Typography>
                  )}
                  {p.tags &&
                    Object.entries(p.tags).map(([k, v]) => (
                      <Chip
                        key={k}
                        size="small"
                        label={`${k}=${v}`}
                        sx={{ height: 20, fontSize: 11 }}
                      />
                    ))}
                </Box>
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    fontFamily: 'monospace',
                    fontSize: 12,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: 'text.secondary',
                  }}
                >
                  {renderData(p.data) ?? '(empty)'}
                </Box>
              </Box>
            ))}
          </Box>
        ))}
    </Widget>
  )
}
