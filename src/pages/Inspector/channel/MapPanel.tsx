import { useCallback, useEffect, useState } from 'react'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableContainer from '@mui/material/TableContainer'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import RefreshIcon from '@mui/icons-material/Refresh'
import GridViewIcon from '@mui/icons-material/GridView'

import { Widget } from '../ui'
import { InspectorApi } from '../types'
import { renderData, fmtAgo } from '../format'

interface MapEntry {
  key?: string
  data?: unknown
  tags?: Record<string, string>
  offset?: number
  score?: number
  removed?: boolean
  time?: number
}

// Keyed map state for map-type channels. The key count (map_stats) loads
// automatically and shows inline; the keys load only when the operator expands.
export const MapPanel = ({
  channel,
  api,
  refreshKey,
}: {
  channel: string
  api: InspectorApi
  refreshKey?: number
}) => {
  const [loading, setLoading] = useState(false)
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [numKeys, setNumKeys] = useState<number | null>(null)
  const [entries, setEntries] = useState<MapEntry[] | null>(null)
  const [cursor, setCursor] = useState<string>('')
  const [done, setDone] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setEntries(null)
    setCursor('')
    setDone(false)
    try {
      const s = await api.call<{ num_keys: number }>('map_stats', { channel })
      setNumKeys(s.num_keys)
    } catch (e: any) {
      setError(e?.message || 'Failed to load map state')
    } finally {
      setLoading(false)
    }
  }, [api, channel])

  const loadEntries = useCallback(
    async (reset: boolean) => {
      setEntriesLoading(true)
      setError(null)
      try {
        const res = await api.call<{ entries?: MapEntry[]; cursor?: string }>(
          'map_read_state',
          { channel, limit: 50, cursor: reset ? '' : cursor }
        )
        const page = res.entries ?? []
        setEntries(prev => (reset || !prev ? page : [...prev, ...page]))
        setCursor(res.cursor ?? '')
        setDone(!res.cursor)
      } catch (e: any) {
        setError(e?.message || 'Failed to load keys')
      } finally {
        setEntriesLoading(false)
      }
    },
    [api, channel, cursor]
  )

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const busy = loading || entriesLoading

  const statsNode = error ? (
    <Typography variant="body2" color="error">
      {error}
    </Typography>
  ) : numKeys != null ? (
    <Typography variant="body2" color="text.secondary">
      {numKeys.toLocaleString()} keys
    </Typography>
  ) : loading ? (
    <Typography variant="body2" color="text.secondary">
      loading…
    </Typography>
  ) : null

  const controls = (
    <>
      {entries === null && numKeys != null && numKeys > 0 && (
        <Button
          variant="tonal"
          color="secondary"
          size="small"
          onClick={() => loadEntries(true)}
          disabled={entriesLoading}
          startIcon={
            entriesLoading ? <CircularProgress size={14} /> : undefined
          }
        >
          Show keys
        </Button>
      )}
      <Tooltip title="Reload" arrow>
        <span>
          <IconButton
            size="small"
            onClick={() => (entries ? loadEntries(true) : load())}
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
    </>
  )

  return (
    <Widget
      icon={<GridViewIcon fontSize="small" />}
      title="Map state"
      stats={statsNode}
      controls={controls}
    >
      {entries &&
        (entries.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Map has no keys.
          </Typography>
        ) : (
          <>
            <TableContainer sx={{ maxHeight: 340 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Key</TableCell>
                    <TableCell>Value</TableCell>
                    <TableCell align="right">Score</TableCell>
                    <TableCell align="right">Updated</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {entries.map((e, i) => (
                    <TableRow key={e.key ?? i} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                        {e.key}
                        {e.removed && (
                          <Chip
                            size="small"
                            label="removed"
                            color="warning"
                            sx={{ ml: 1, height: 18, fontSize: 10 }}
                          />
                        )}
                      </TableCell>
                      <TableCell
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: 12,
                          color: 'text.secondary',
                          maxWidth: 260,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {renderData(e.data) ?? '—'}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontFamily: 'monospace', fontSize: 12 }}
                      >
                        {e.score ?? '—'}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontSize: 12, color: 'text.secondary' }}
                      >
                        {e.time ? fmtAgo(e.time) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {!done && (
              <Button
                variant="tonal"
                color="secondary"
                size="small"
                onClick={() => loadEntries(false)}
                disabled={entriesLoading}
                sx={{ mt: 1 }}
              >
                Load more
              </Button>
            )}
          </>
        ))}
    </Widget>
  )
}
