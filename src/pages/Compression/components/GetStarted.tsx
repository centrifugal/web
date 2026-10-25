import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'

import { CompressionApiHook, CompressionOverview } from '../api'

const DEFAULT_PROFILE = 'default'
// How long the first session trains. The last quarter of it measures the
// result, so shorter still works, it just sees less of the traffic.
const TRAINING_MINUTES = [10, 30, 60]
const DEFAULT_TRAINING_MINUTES = 30

interface GetStartedProps {
  api: CompressionApiHook
  overview: CompressionOverview
  // Called with the training session started, to open it.
  onStarted: (sessionId: string) => void
  onChanged: () => void
}

// GetStarted: the first setup in one confirmed step, for a deployment with no
// profiles. Each step is an ordinary action the operator could take by hand,
// listed before anything runs. None of them puts application values into a
// dictionary, and nothing trained serves until the operator activates it.
export const GetStarted = ({
  api,
  overview,
  onStarted,
  onChanged,
}: GetStartedProps) => {
  const [open, setOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [minutes, setMinutes] = useState(DEFAULT_TRAINING_MINUTES)

  const run = async () => {
    setRunning(true)
    try {
      if (!overview.enabled) await api.setCompressionEnabled(true)
      if (!overview.structure_active) await api.setStructureActive(true)
      const profile = await api.createProfile({
        name: DEFAULT_PROFILE,
        notes: 'Created by Get started for every connection without a profile.',
        client_declarable: false,
        serve_as_default: true,
      })
      const session = await api.createSession({
        filter: {},
        training_mode: 'schema',
        duration_seconds: minutes * 60,
        profile_id: profile.id,
      })
      setOpen(false)
      onStarted(session.id)
    } catch (err) {
      // What succeeded stays done, and running this again only repeats what
      // did not: the switches are idempotent, and the card stays until a
      // profile exists.
      api.handleError(err)
      onChanged()
    } finally {
      setRunning(false)
    }
  }

  return (
    <>
      <Alert
        severity="info"
        action={
          <Button color="inherit" size="small" onClick={() => setOpen(true)}>
            Set up
          </Button>
        }
      >
        <AlertTitle>Get started</AlertTitle>
        One step serves a ready-made dictionary right away and starts training
        one on your traffic. Training learns field names and message shapes
        only, so there is nothing to review: you activate the result when it is
        ready.
      </Alert>
      <Dialog
        open={open}
        onClose={() => !running && setOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Set up dictionary compression</DialogTitle>
        <DialogContent>
          <Typography variant="body2">This will:</Typography>
          <Box
            component="ol"
            sx={{
              listStyle: 'decimal',
              pl: 2.5,
              my: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
            }}
          >
            {!overview.enabled && (
              <Typography component="li" variant="body2">
                Turn on serving dictionaries.
              </Typography>
            )}
            {!overview.structure_active && (
              <Typography component="li" variant="body2">
                Serve the structure dictionary, built from the Centrifugo
                protocol, to JSON connections from now on.
              </Typography>
            )}
            <Typography component="li" variant="body2">
              Create the profile <code>{DEFAULT_PROFILE}</code>, given to every
              connection that has no profile.
            </Typography>
            <Typography component="li" variant="body2">
              Start a training session over all connections that learns field
              names and message shapes only. You can extend it.
            </Typography>
          </Box>
          <TextField
            select
            fullWidth
            margin="dense"
            label="Train for"
            value={minutes}
            onChange={e => setMinutes(Number(e.target.value))}
            helperText="The last quarter measures the result. Longer sees more of your traffic."
            sx={{ mb: 1 }}
          >
            {TRAINING_MINUTES.map(m => (
              <MenuItem key={m} value={m}>
                {m < 60 ? `${m} minutes` : '1 hour'}
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="body2">
            When training finishes, the profile shows the dictionary it made. It
            serves nothing until you activate it.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            variant="text"
            onClick={() => setOpen(false)}
            disabled={running}
          >
            Cancel
          </Button>
          <Button
            variant="solid"
            color="primary"
            onClick={run}
            disabled={running}
            startIcon={
              running ? (
                <CircularProgress size={16} color="inherit" />
              ) : undefined
            }
          >
            {running ? 'Setting up…' : 'Set up'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
