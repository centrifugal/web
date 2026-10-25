import { useState } from 'react'
import Alert from '@mui/material/Alert'
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
const TRAINING_SECONDS = 30 * 60

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
        duration_seconds: TRAINING_SECONDS,
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
          <Typography variant="body2" component="div">
            This will:
            <ol style={{ marginTop: 8, paddingLeft: 20 }}>
              {!overview.enabled && <li>Turn on serving dictionaries.</li>}
              {!overview.structure_active && (
                <li>
                  Serve the structure dictionary, built from the Centrifugo
                  protocol, to JSON connections from now on.
                </li>
              )}
              <li>
                Create the profile <code>{DEFAULT_PROFILE}</code>, given to
                every connection that has no profile.
              </li>
              <li>
                Start a 30-minute training session over all connections that
                learns field names and message shapes only. You can stop it
                early or extend it.
              </li>
            </ol>
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
