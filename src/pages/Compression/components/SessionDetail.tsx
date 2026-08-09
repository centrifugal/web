import { useCallback, useContext, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import Chip from '@mui/material/Chip'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'

import { ShellContext } from 'contexts/ShellContext'
import { Panel, FieldRow, CapabilityChip } from 'pages/Inspector/ui'
import { EmptyState } from 'components/EmptyState'
import { ConfirmButton } from 'components/ConfirmButton'
import { HumanSize } from 'utils/Functions'

import { CompressionApiHook, Session, Candidate } from '../api'
import { useUrlSelection } from '../useUrlSelection'
import {
  fmtDateTime,
  fmtFilter,
  fmtInt,
  fmtPct,
  fmtRatio,
  fmtRelative,
} from '../format'
import { AssignCandidateDialog } from './AssignCandidateDialog'
import { ReviewScreen } from './ReviewScreen'

interface SessionDetailProps {
  api: CompressionApiHook
  sessionId: string
  onBack: () => void
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

// PARSE_RATE_WARN_BELOW: below this, payload_parse_rate gets called out — most
// non-JSON traffic can't be learned from, and this is the usual explanation
// for a disappointing candidate.
const PARSE_RATE_WARN_BELOW = 0.9

// SessionDetail: a single training session — live progress while it runs,
// then build/review/assign once it has something collected. Stopping a
// session early is not treated as a failure anywhere in this component: it
// simply moves to `collected` with whatever was gathered, same as reaching
// the deadline.
export const SessionDetail = ({
  api,
  sessionId,
  onBack,
}: SessionDetailProps) => {
  const { showAlert } = useContext(ShellContext)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [extendOpen, setExtendOpen] = useState(false)

  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [buildReason, setBuildReason] = useState<string | null>(null)
  const [building, setBuilding] = useState(false)
  const [assignTarget, setAssignTarget] = useState<Candidate | null>(null)
  const [reviewId, setReviewId] = useUrlSelection('candidate')
  const reviewCandidate = candidates?.find(c => c.id === reviewId) ?? null

  const load = useCallback(async () => {
    try {
      const data = await api.getSession(sessionId)
      setSession(data)
    } catch (err) {
      api.handleError(err)
    } finally {
      setLoading(false)
    }
  }, [api, sessionId])

  useEffect(() => {
    load()
  }, [load])

  // Candidates already built for this session, read rather than rebuilt.
  // Without this the page could only offer to build again after a reload, and
  // building is not idempotent - a second click leaves two sets of candidates
  // from one session, with the half-finished review on the set you can no
  // longer see.
  useEffect(() => {
    let cancelled = false
    api
      .listCandidates(sessionId)
      .then(res => {
        if (!cancelled && res.candidates && res.candidates.length > 0) {
          setCandidates(res.candidates)
        }
      })
      .catch(() => {
        // A session with nothing built yet is the ordinary case, and the Build
        // button below is the answer either way.
      })
    return () => {
      cancelled = true
    }
  }, [api, sessionId])

  // Poll while (and only while) the session is running; the interval is torn
  // down both on unmount and the instant status stops being 'running'.
  useEffect(() => {
    if (!session || session.status !== 'running') return
    const id = setInterval(load, 1000)
    return () => clearInterval(id)
  }, [session, load])

  const handleExtend = async (extendSeconds: number) => {
    try {
      const updated = await api.extendSession(sessionId, extendSeconds)
      setSession(updated)
      setExtendOpen(false)
      showAlert('Session extended', { severity: 'success' })
    } catch (err) {
      api.handleError(err)
    }
  }

  const handleStop = async () => {
    try {
      await api.stopSession(sessionId)
      showAlert(
        'Session stopped. What was collected before now is kept and usable.',
        { severity: 'success' }
      )
      load()
    } catch (err) {
      api.handleError(err)
    }
  }

  const handleBuild = async () => {
    setBuilding(true)
    try {
      const res = await api.buildCandidates(sessionId)
      setCandidates(res.candidates)
      setBuildReason(res.reason || null)
    } catch (err) {
      api.handleError(err)
    } finally {
      setBuilding(false)
    }
  }

  if (reviewCandidate) {
    return (
      <ReviewScreen
        api={api}
        candidate={reviewCandidate}
        onBack={() => setReviewId(null)}
        // The open screen is derived from this list by id, so refreshing the
        // list refreshes what it is rendering. It used to be a separate copy
        // that had to be updated in step, and did not always get updated -
        // leaving the screen showing a draft count and total from before the
        // save.
        onCandidateUpdated={updated =>
          setCandidates(prev =>
            prev ? prev.map(c => (c.id === updated.id ? updated : c)) : prev
          )
        }
        onApproved={() => setReviewId(null)}
      />
    )
  }

  if (loading && !session) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress disableShrink />
      </Box>
    )
  }

  if (!session) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Alert severity="error">Failed to load this session.</Alert>
        <Button
          variant="tonal"
          color="inherit"
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
          sx={{ alignSelf: 'flex-start' }}
        >
          Back to sessions
        </Button>
      </Box>
    )
  }

  const p = session.progress
  const parseRateLow = p != null && p.payload_parse_rate < PARSE_RATE_WARN_BELOW
  const hasHoldoutLeaks = (p?.holdout_leaks ?? 0) > 0
  const holdoutUnscanned = p != null && !p.holdout_scanned

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexWrap: 'wrap',
        }}
      >
        <Button
          variant="tonal"
          color="inherit"
          size="small"
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
        >
          Back to sessions
        </Button>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Session
        </Typography>
        <CapabilityChip
          label={session.status}
          tone={statusTone(session.status)}
        />
        <Box sx={{ flexGrow: 1 }} />
        {session.status === 'running' && (
          <>
            <Button
              variant="tonal"
              color="inherit"
              size="small"
              onClick={() => setExtendOpen(true)}
            >
              Extend
            </Button>
            <ConfirmButton
              title="Stop this session?"
              body="Stopping early is not a failure — the session moves to collected and everything gathered so far stays usable for building candidates."
              confirmText="Stop"
              confirmColor="warning"
              onConfirm={handleStop}
            >
              {open => (
                <Button
                  variant="tonal"
                  color="warning"
                  size="small"
                  onClick={open}
                >
                  Stop
                </Button>
              )}
            </ConfirmButton>
          </>
        )}
      </Box>

      <Panel title="Overview">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <FieldRow label="Training mode">
            <Typography variant="body2">{session.training_mode}</Typography>
          </FieldRow>
          <FieldRow label="Filter">
            <Typography variant="body2">{fmtFilter(session.filter)}</Typography>
          </FieldRow>
          <FieldRow label="Started">
            <Typography variant="body2">
              {fmtDateTime(session.started_at)}
            </Typography>
          </FieldRow>
          <FieldRow label="Deadline">
            <Typography variant="body2">
              {fmtDateTime(session.deadline)} ({fmtRelative(session.deadline)})
            </Typography>
          </FieldRow>
          {session.stopped_at && (
            <FieldRow label="Stopped">
              <Typography variant="body2">
                {fmtDateTime(session.stopped_at)}
              </Typography>
            </FieldRow>
          )}
          <FieldRow label="Nodes reported">
            <Typography variant="body2">
              {session.nodes_reported} of {session.nodes_expected}
            </Typography>
          </FieldRow>
          {session.status === 'failed' && session.error_message && (
            <FieldRow label="Error">
              <Typography variant="body2" color="error.main">
                {session.error_message}
              </Typography>
            </FieldRow>
          )}
        </Box>
      </Panel>

      {p && (
        <Panel
          title="Collection progress"
          subtitle={
            session.status === 'running'
              ? 'Refreshing about once a second while the session runs.'
              : undefined
          }
        >
          {holdoutUnscanned && !hasHoldoutLeaks && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <strong>Holdout scan did not run for this session.</strong> No
              leak was reported, but nothing checked either — treat this as
              unverified rather than clear, and review the proposed values on
              their own merits.
            </Alert>
          )}

          {hasHoldoutLeaks && (
            <Alert severity="error" icon={<WarningAmberIcon />} sx={{ mb: 2 }}>
              <strong>
                {fmtInt(p.holdout_leaks)} holdout leak(s) detected.
              </strong>{' '}
              A live payload fragment made it past the value stripper. Building
              candidates from this session is blocked until this reads zero.
            </Alert>
          )}

          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
              mb: 2,
            }}
          >
            <Box
              sx={{
                p: 1.5,
                borderRadius: 1.5,
                border: 1,
                borderColor: parseRateLow ? 'warning.main' : 'divider',
                bgcolor: parseRateLow ? 'warning.50' : 'transparent',
                minWidth: 220,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Payload parse rate
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  color: parseRateLow ? 'warning.main' : 'text.primary',
                }}
              >
                {fmtPct(p.payload_parse_rate)}
              </Typography>
              {parseRateLow && (
                <Typography variant="caption" color="warning.main">
                  Traffic that isn&apos;t JSON can&apos;t be learned from — this
                  is the usual reason a session's candidates disappoint.
                </Typography>
              )}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <FieldRow label="Frames / bytes observed">
              <Typography variant="body2">
                {fmtInt(p.frames_observed)} frames ·{' '}
                {HumanSize(p.bytes_observed)}
              </Typography>
            </FieldRow>
            <FieldRow label="Connections sampled / matched">
              <Typography variant="body2">
                {fmtInt(p.connections_sampled)} sampled of{' '}
                {fmtInt(p.connections_matched)} matched (cap{' '}
                {fmtInt(p.effective_cap)})
              </Typography>
            </FieldRow>
            <FieldRow label="Distinct shapes / keys / values">
              <Typography variant="body2">
                {fmtInt(p.distinct_shapes)} shapes · {fmtInt(p.distinct_keys)}{' '}
                keys · {fmtInt(p.distinct_values)} values
              </Typography>
            </FieldRow>
            <FieldRow label="By protocol">
              <Typography variant="body2">
                {Object.entries(p.by_protocol)
                  .map(([k, v]) => `${k}: ${fmtInt(v)}`)
                  .join(' · ') || '—'}
              </Typography>
            </FieldRow>
            <FieldRow label="By frame type">
              <Typography variant="body2">
                {Object.entries(p.by_frame_type)
                  .map(([k, v]) => `${k}: ${fmtInt(v)}`)
                  .join(' · ') || '—'}
              </Typography>
            </FieldRow>
          </Box>
        </Panel>
      )}

      {(session.status === 'collected' || candidates) && (
        <Panel
          title="Candidates"
          action={
            session.status === 'collected' ? (
              <Button
                variant="solid"
                color="primary"
                size="small"
                onClick={handleBuild}
                disabled={building || hasHoldoutLeaks}
                startIcon={
                  building ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : undefined
                }
              >
                {building
                  ? 'Building…'
                  : candidates
                    ? 'Rebuild'
                    : 'Build candidates'}
              </Button>
            ) : undefined
          }
        >
          {!candidates ? (
            <EmptyState
              title="Not built yet"
              hint="Build merges every node's observations into one candidate per fidelity — a schema candidate (no review needed) and, for values-mode sessions, a reviewed candidate."
            />
          ) : candidates.length === 0 ? (
            <EmptyState
              title="Nothing to build"
              hint={
                buildReason ||
                'Nothing was collected — an empty dictionary would occupy a version slot and compress nothing.'
              }
            />
          ) : (
            <Box
              sx={{
                display: 'grid',
                // Each card carries a four-column size curve, which a fixed
                // 340px column wrapped onto several lines per row. A grid that
                // gives each card an equal share of the panel - and drops to
                // one column when that share would fall below ~440px - lets the
                // table render as a table.
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'repeat(auto-fit, minmax(440px, 1fr))',
                },
                gap: 2,
                alignItems: 'start',
              }}
            >
              {candidates.map(c => (
                <Card key={c.id} variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        mb: 1,
                      }}
                    >
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {c.fidelity === 'schema'
                          ? 'Shapes only'
                          : 'Shapes and values'}
                      </Typography>
                      <Box sx={{ flexGrow: 1 }} />
                      <Typography variant="caption" color="text.secondary">
                        expires {fmtRelative(c.expires_at)}
                      </Typography>
                    </Box>

                    {/* Two candidates from one session differ in one thing -
                        whether values are in them - and that decides both what
                        they compress and what you have to do to ship them.
                        The fidelity name alone ("schema", "reviewed") does not
                        say either. */}
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 1 }}
                    >
                      {c.fidelity === 'schema'
                        ? 'Field names, nesting and key order. No values from your traffic, so there is nothing to read and you can activate it straight away.'
                        : 'The same shapes plus the values you approve, one at a time. Compresses harder, and every value you tick is a value served to everyone this profile reaches.'}
                    </Typography>

                    <Typography variant="body2" color="text.secondary">
                      {fmtInt(c.values_total)} value
                      {c.values_total === 1 ? '' : 's'}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {Object.entries(c.ratio_by_protocol)
                        .map(([proto, ratio]) => `${proto} ${fmtRatio(ratio)}`)
                        .join(' · ') || '—'}
                      {c.projected_ratio && (
                        <Typography
                          component="span"
                          variant="caption"
                          color="warning.main"
                          sx={{ display: 'block' }}
                        >
                          Projected — assumes full approval, will drop as values
                          are rejected.
                        </Typography>
                      )}
                    </Typography>

                    {c.size_curve.length > 0 && (
                      <TableContainer sx={{ mt: 1.5 }}>
                        {/* Which size to build at was the least-supported
                            decision in the whole flow: a free-form byte count
                            with no way to see what it bought. Every rung here
                            was built and scored, so the answer is on screen
                            rather than left to intuition. */}
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', mb: 0.5 }}
                        >
                          {c.size_curve.some(sp => sp.measured)
                            ? 'Each size built and measured on traffic held back from training.'
                            : 'Projected — this session had no control window, so ratios are optimistic.'}
                        </Typography>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Size</TableCell>
                              <TableCell align="right">Ratio</TableCell>
                              <TableCell align="right">Wire</TableCell>
                              <TableCell align="right">Covers</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {c.size_curve.map(sp => (
                              <TableRow
                                key={sp.size_bytes}
                                selected={sp.size_bytes === c.recommended_size}
                              >
                                <TableCell>
                                  {HumanSize(sp.size_bytes)}
                                  {sp.size_bytes === c.recommended_size && (
                                    <Chip
                                      size="small"
                                      color="primary"
                                      variant="outlined"
                                      label="Recommended"
                                      sx={{ ml: 1 }}
                                      title="The smallest size within a couple of percent of the best measured ratio. Bigger rungs cost every connection more for almost nothing."
                                    />
                                  )}
                                </TableCell>
                                <TableCell align="right">
                                  {fmtRatio(sp.ratio)}
                                  {sp.recommended_values > 0 && (
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      sx={{ display: 'block' }}
                                      title="How many of the ranked values were worth approving at this size. It differs down the ladder: a smaller dictionary fills up sooner, so extra values only push useful fragments out."
                                    >
                                      {sp.recommended_values} values
                                    </Typography>
                                  )}
                                </TableCell>
                                <TableCell align="right">
                                  {HumanSize(sp.delivery_bytes)}
                                </TableCell>
                                {/* A size that holds part of the vocabulary
                                    reports the same ratio shape as one that
                                    holds all of it. Without this an operator
                                    picking a small size cannot see that the
                                    dictionary covers little of their traffic. */}
                                <TableCell align="right">
                                  <Typography
                                    variant="body2"
                                    component="span"
                                    color={
                                      sp.shapes_held < sp.shapes_total
                                        ? 'warning.main'
                                        : 'text.secondary'
                                    }
                                    title={
                                      sp.shapes_held < sp.shapes_total
                                        ? `This size holds ${sp.shapes_held} of ${sp.shapes_total} learned message shapes. The ratio is real, but measured on the part that fit.`
                                        : 'This size holds everything the session learned.'
                                    }
                                  >
                                    {sp.shapes_held}/{sp.shapes_total} shapes
                                    {sp.values_total > 0 &&
                                      `, ${sp.values_held}/${sp.values_total} values`}
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}

                    <Box sx={{ mt: 1.5 }}>
                      {c.fidelity === 'schema' ? (
                        <Button
                          variant="solid"
                          color="primary"
                          size="small"
                          onClick={() => setAssignTarget(c)}
                        >
                          Assign
                        </Button>
                      ) : (
                        <Button
                          variant="solid"
                          color="primary"
                          size="small"
                          onClick={() => setReviewId(c.id)}
                        >
                          Review
                        </Button>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </Panel>
      )}

      <ExtendSessionDialog
        open={extendOpen}
        onClose={() => setExtendOpen(false)}
        onExtend={handleExtend}
      />
      <AssignCandidateDialog
        api={api}
        sessionId={sessionId}
        candidate={assignTarget}
        onClose={() => setAssignTarget(null)}
        onAssigned={() => {
          setAssignTarget(null)
          showAlert('Schema candidate assigned — new version created', {
            severity: 'success',
          })
        }}
      />
    </Box>
  )
}

const EXTEND_OPTIONS = [
  { label: '15 minutes', seconds: 900 },
  { label: '1 hour', seconds: 3600 },
  { label: '4 hours', seconds: 14400 },
  { label: '24 hours', seconds: 86400 },
]

const ExtendSessionDialog = ({
  open,
  onClose,
  onExtend,
}: {
  open: boolean
  onClose: () => void
  onExtend: (seconds: number) => Promise<void>
}) => {
  const [seconds, setSeconds] = useState(3600)
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Extend session</DialogTitle>
      <DialogContent>
        <TextField
          select
          fullWidth
          margin="normal"
          label="Extend by"
          value={seconds}
          onChange={e => setSeconds(Number(e.target.value))}
          SelectProps={{ native: true }}
        >
          {EXTEND_OPTIONS.map(o => (
            <option key={o.seconds} value={o.seconds}>
              {o.label}
            </option>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="solid"
          color="primary"
          onClick={() => onExtend(seconds)}
        >
          Extend
        </Button>
      </DialogActions>
    </Dialog>
  )
}
