import { useCallback, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'

import { Panel, CapabilityChip } from 'pages/Inspector/ui'
import { EmptyState } from 'components/EmptyState'

import { CompressionApiHook, UnclaimedEntry } from '../api'

interface UnclaimedPanelProps {
  api: CompressionApiHook
}

// UnclaimedPanel: profile names clients asked for that the server did not
// grant. `permitted: true` means the profile exists but isn't
// client_declarable (a config answer, not a typo) — `false` means no such
// profile exists at all, which is where a misconfigured client or a profile
// worth creating usually shows up.
export const UnclaimedPanel = ({ api }: UnclaimedPanelProps) => {
  const [entries, setEntries] = useState<UnclaimedEntry[] | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await api.getUnclaimed()
      setEntries(data.entries || [])
    } catch (err) {
      api.handleError(err)
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    load()
  }, [load])

  return (
    <Panel
      title="Unclaimed"
      subtitle="Profile names clients declared that the server did not grant."
    >
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress disableShrink size={24} />
        </Box>
      ) : !entries || entries.length === 0 ? (
        <EmptyState
          title="Nothing unclaimed"
          hint="No client has declared a profile name the server refused."
        />
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell align="right">Connections</TableCell>
                <TableCell align="right">Distinct users</TableCell>
                <TableCell>Reason</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map(e => (
                <TableRow key={e.name}>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: 'monospace' }}
                    >
                      {e.name}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{e.connections}</TableCell>
                  <TableCell align="right">{e.distinct_users}</TableCell>
                  <TableCell>
                    <CapabilityChip
                      label={
                        e.permitted
                          ? 'Exists, not client_declarable'
                          : 'No such profile'
                      }
                      tone={e.permitted ? 'info' : 'warn'}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Panel>
  )
}
