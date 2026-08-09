import { useCallback, useEffect, useState } from 'react'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import AddIcon from '@mui/icons-material/Add'
import PlayCircleIcon from '@mui/icons-material/PlayCircle'

import { EmptyState } from 'components/EmptyState'
import { Panel, CapabilityChip } from 'pages/Inspector/ui'

import { useUrlSelection } from '../useUrlSelection'
import { useCompressionApi, CreateSessionRequest, Session } from '../api'
import { fmtDateTime, fmtFilter, fmtRelative } from '../format'
import { CreateSessionDialog } from '../components/CreateSessionDialog'
import { SessionDetail } from '../components/SessionDetail'

interface SessionsTabProps {
  authorization: string
  signinSilent: () => void
}

const statusTone = (status: Session['status']) => {
  switch (status) {
    case 'running':
      return 'info' as const
    case 'collected':
      return 'on' as const
    case 'failed':
      return 'warn' as const
    default:
      return 'off' as const
  }
}

// Sessions: run training sessions against a traffic filter, watch collection
// progress, build candidates from a finished session, and review/approve the
// values a candidate wants to put in a dictionary.
export const SessionsTab = ({
  authorization,
  signinSilent,
}: SessionsTabProps) => {
  const api = useCompressionApi({ authorization, signinSilent })

  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  // Arriving from a profile that has nothing trained yet: open the dialog
  // already bound to it, so the step that journey exists for is not a field
  // the operator has to find.
  const [trainFor, setTrainFor] = useUrlSelection('train_for')
  useEffect(() => {
    if (trainFor) setCreateOpen(true)
  }, [trainFor])
  const [selectedId, setSelectedId] = useUrlSelection('session')
  // Offered as the optional "train for" binding when creating a session. A
  // failure here is not worth surfacing: the binding is optional, so an empty
  // list simply hides the field.
  const [profiles, setProfiles] = useState<{ id: string; name: string }[]>([])

  const load = useCallback(
    async (cursor?: string) => {
      setLoading(true)
      try {
        const data = await api.listSessions({ limit: 20, cursor })
        setSessions(prev =>
          cursor ? [...prev, ...(data.sessions || [])] : data.sessions || []
        )
        setNextCursor(data.next_cursor || '')
      } catch (err) {
        api.handleError(err)
      } finally {
        setLoading(false)
      }
    },
    [api]
  )

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    api
      .listProfiles()
      .then(data => {
        if (!cancelled) {
          setProfiles(
            (data.profiles || []).map(p => ({ id: p.id, name: p.name }))
          )
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreate = async (req: CreateSessionRequest) => {
    try {
      const created = await api.createSession(req)
      setCreateOpen(false)
      setSessions(prev => [created, ...prev])
      setSelectedId(created.id)
    } catch (err) {
      api.handleError(err)
    }
  }

  if (selectedId) {
    return (
      <SessionDetail
        api={api}
        sessionId={selectedId}
        onBack={() => {
          setSelectedId(null)
          load()
        }}
      />
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Panel
        title="Sessions"
        subtitle="Sample real traffic against a connection filter to learn what a dictionary should contain."
        action={
          <Button
            variant="solid"
            color="primary"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
          >
            Start session
          </Button>
        }
      >
        {loading && sessions.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress disableShrink />
          </Box>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={<PlayCircleIcon sx={{ fontSize: 40 }} />}
            title="No sessions yet"
            hint="Start a training session against a connection filter to begin learning what a dictionary should contain."
          />
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Status</TableCell>
                    <TableCell>Audience</TableCell>
                    <TableCell>Mode</TableCell>
                    <TableCell>Started</TableCell>
                    <TableCell>Deadline</TableCell>
                    <TableCell align="right">Nodes reported</TableCell>
                    <TableCell align="right"></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sessions.map(s => (
                    <TableRow
                      key={s.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => setSelectedId(s.id)}
                    >
                      <TableCell>
                        <CapabilityChip
                          label={s.status}
                          tone={statusTone(s.status)}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {fmtFilter(s.filter)}
                        </Typography>
                        {s.profile_id && (
                          <Typography variant="caption" color="text.secondary">
                            trains for{' '}
                            {profiles.find(p => p.id === s.profile_id)?.name ??
                              'a deleted profile'}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{s.training_mode}</TableCell>
                      <TableCell>{fmtDateTime(s.started_at)}</TableCell>
                      <TableCell>
                        {s.status === 'running'
                          ? fmtRelative(s.deadline)
                          : fmtDateTime(s.deadline)}
                      </TableCell>
                      <TableCell align="right">
                        {s.nodes_reported} of {s.nodes_expected}
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          variant="tonal"
                          color="inherit"
                          size="small"
                          onClick={e => {
                            e.stopPropagation()
                            setSelectedId(s.id)
                          }}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {nextCursor && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <Button
                  variant="tonal"
                  color="inherit"
                  onClick={() => load(nextCursor)}
                  disabled={loading}
                  startIcon={
                    loading ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : undefined
                  }
                >
                  Load more
                </Button>
              </Box>
            )}
          </>
        )}
      </Panel>

      <CreateSessionDialog
        key={trainFor ?? 'new'}
        defaultProfileId={trainFor ?? undefined}
        open={createOpen}
        onClose={() => {
          setCreateOpen(false)
          if (trainFor) setTrainFor(null)
        }}
        onSubmit={handleCreate}
        profiles={profiles}
      />
    </Box>
  )
}

export default SessionsTab
