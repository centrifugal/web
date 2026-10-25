import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

import { FieldRow } from 'pages/Inspector/ui'
import { HumanSize } from 'utils/Functions'

import { Session, SessionProgress } from '../api'
import { fmtDateTime, fmtRelative } from '../format'

const fmtInt = (n: number) => Number(n ?? 0).toLocaleString()
const fmtPct = (r: number) => `${((r ?? 0) * 100).toFixed(1)}%`
const fmtTime = (ms: number) =>
  new Date(ms).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })

// How long the training set must go without a new message shape before it
// reads as covering the traffic's message types.
const COVERED_AFTER_MS = 2 * 60 * 1000

const DENIED: Record<string, string> = {
  name: 'field name on the denylist',
  shape: 'looks like an id, token or address',
  channel: 'a channel name',
  length: 'too long or too short',
}

interface TrainingProgressProps {
  session: Session
  progress: SessionProgress
}

// TrainingProgress: what a session has collected, in the two parts it works
// in - the training set the dictionary is built from, then the last quarter,
// held back to measure it - with the one signal that says it has seen enough,
// and the raw counters folded away.
export const TrainingProgress = ({
  session,
  progress: p,
}: TrainingProgressProps) => {
  const [details, setDetails] = useState(false)
  const start = Date.parse(session.started_at)
  const end = Date.parse(session.deadline)
  const controlFrom = start + 0.75 * (end - start)
  const stoppedAt = session.stopped_at ? Date.parse(session.stopped_at) : null
  const running = session.status === 'running'
  const reached = Math.min(stoppedAt ?? Date.now(), end)
  const filled = Math.max(0, Math.min(1, (reached - start) / (end - start)))
  const stoppedEarly = stoppedAt !== null && stoppedAt < controlFrom

  const lastNewShape = p.last_new_shape_at
    ? Date.parse(p.last_new_shape_at)
    : null
  // Quiet only counts once enough traffic has come: a session over idle
  // connections gains no new shape simply because nothing arrives.
  const covered =
    running &&
    p.warmup_complete &&
    lastNewShape !== null &&
    Date.now() - lastNewShape >= COVERED_AFTER_MS
  const elapsed = (reached - start) / (end - start)
  const thin =
    !p.warmup_complete && p.frames_observed > 0 && (!running || elapsed >= 0.5)
  const refused = Object.entries(p.denied ?? {}).filter(([, n]) => n > 0)
  const refusedTotal = refused.reduce((sum, [, n]) => sum + n, 0)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        {/* The bar is time: how far the session is from its start to its
            deadline. Its last quarter is the measuring part. */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '3fr 1fr',
            gap: 2,
            mb: 0.5,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {fmtTime(start)}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'flex', justifyContent: 'space-between' }}
          >
            <span>{fmtTime(controlFrom)}</span>
            <span>{fmtTime(end)}</span>
          </Typography>
        </Box>
        <Box
          sx={{
            position: 'relative',
            height: 10,
            borderRadius: 5,
            overflow: 'hidden',
            display: 'flex',
            bgcolor: 'action.hover',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              width: `${filled * 100}%`,
              bgcolor: 'primary.main',
              opacity: 0.8,
            }}
          />
          {/* The boundary between the two parts. */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: '75%',
              width: 2,
              bgcolor: 'background.paper',
            }}
          />
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '3fr 1fr',
            gap: 2,
            mt: 1,
          }}
        >
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Training set
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {p.connections_matched === 0 && p.frames_observed === 0 ? (
                running ? (
                  'No connection matches yet. Sampling starts as soon as one does.'
                ) : (
                  'No connection matched.'
                )
              ) : (
                <>
                  {fmtInt(p.frames_observed)} frames from{' '}
                  {p.connections_sampled < p.connections_matched
                    ? `${fmtInt(p.connections_sampled)} of ${fmtInt(p.connections_matched)}`
                    : fmtInt(p.connections_sampled)}{' '}
                  connection{p.connections_matched === 1 ? '' : 's'}
                  {running &&
                    reached < controlFrom &&
                    `, until ${fmtTime(controlFrom)}`}
                </>
              )}
            </Typography>
          </Box>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Held back to measure
            </Typography>
            <Typography
              variant="body2"
              color={stoppedEarly ? 'warning.main' : 'text.secondary'}
            >
              {stoppedEarly
                ? 'not reached: stopped early'
                : reached < controlFrom
                  ? `from ${fmtTime(controlFrom)}`
                  : `${fmtInt(p.held_back_frames)} frames`}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Typography variant="body2">
        {p.distinct_shapes === 0 ? (
          'No message shapes yet.'
        ) : (
          <>
            <b>
              {fmtInt(p.distinct_shapes)} message shape
              {p.distinct_shapes === 1 ? '' : 's'}
            </b>
            {lastNewShape !== null &&
              `, the last new one ${fmtRelative(p.last_new_shape_at)}`}
            {covered && ': the traffic’s message types look covered.'}
          </>
        )}
      </Typography>

      {thin && (
        <Typography variant="body2" color="warning.main">
          Only {fmtInt(p.frames_observed)} frames so far: too little traffic for
          a dictionary to be sure of its message types.{' '}
          {running
            ? 'Extend the session if your traffic is slow.'
            : 'Train again for longer, or when traffic is higher.'}
        </Typography>
      )}

      {session.training_mode === 'values' && (
        <Typography variant="body2">
          <b>{fmtInt(p.distinct_values)} values</b> from{' '}
          {fmtInt(p.distinct_keys)} fields
          {refusedTotal > 0 && (
            <>
              {', '}
              <Tooltip
                arrow
                title={refused
                  .map(
                    ([reason, n]) => `${fmtInt(n)}: ${DENIED[reason] ?? reason}`
                  )
                  .join(' · ')}
              >
                <span style={{ textDecoration: 'underline dotted' }}>
                  refused {fmtInt(refusedTotal)} times
                </span>
              </Tooltip>{' '}
              before collection
            </>
          )}
          . You review them once the session ends.
        </Typography>
      )}

      <Box>
        <Button
          variant="text"
          size="small"
          color="inherit"
          onClick={() => setDetails(v => !v)}
          sx={{ px: 0 }}
        >
          {details ? 'Hide details' : 'Details'}
        </Button>
        {details && (
          <Box
            sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1 }}
          >
            <FieldRow label="Bytes observed">
              <Typography variant="body2">
                {HumanSize(p.bytes_observed)}
              </Typography>
            </FieldRow>
            <FieldRow label="Payload parse rate">
              <Typography variant="body2">
                {p.frames_observed > 0 ? fmtPct(p.payload_parse_rate) : '—'}
              </Typography>
            </FieldRow>
            <FieldRow label="Users">
              <Typography variant="body2">
                {fmtInt(p.distinct_users)}
              </Typography>
            </FieldRow>
            <FieldRow label="Sampling cap">
              <Typography variant="body2">
                {fmtInt(p.effective_cap)} connections
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
            <FieldRow label="Measuring from">
              <Typography variant="body2">
                {fmtDateTime(new Date(controlFrom).toISOString())}
              </Typography>
            </FieldRow>
          </Box>
        )}
      </Box>
    </Box>
  )
}
