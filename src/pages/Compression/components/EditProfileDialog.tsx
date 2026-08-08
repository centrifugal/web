import { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'

import { ConfirmButton } from 'components/ConfirmButton'

import { ProfileDetail, ProfilePatch } from '../api'

interface EditProfileDialogProps {
  open: boolean
  profile: ProfileDetail | null
  onClose: () => void
  // Must not throw — errors are shown by the caller via showAlert. The caller
  // controls `open`, so it only flips it closed once the save succeeded (or on
  // a 409, where it also reloads).
  onSubmit: (patch: ProfilePatch) => Promise<void>
}

// EditProfileDialog: notes are free to change any time. client_declarable and
// serve_as_default are not — turning either one on, when this profile already
// has an active version, widens who that version is served to. The bytes
// don't change, but the audience the approval covered does, so the server
// deactivates the active version. This dialog surfaces that consequence
// before it happens rather than after, via a confirm step that only appears
// when it's actually going to fire.
export const EditProfileDialog = ({
  open,
  profile,
  onClose,
  onSubmit,
}: EditProfileDialogProps) => {
  const [notes, setNotes] = useState('')
  const [clientDeclarable, setClientDeclarable] = useState(false)
  const [serveAsDefault, setServeAsDefault] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && profile) {
      setNotes(profile.notes)
      setClientDeclarable(profile.client_declarable)
      setServeAsDefault(profile.serve_as_default)
    }
    if (!open) setSubmitting(false)
  }, [open, profile])

  if (!profile) return null

  const widens =
    (!profile.client_declarable && clientDeclarable) ||
    (!profile.serve_as_default && serveAsDefault)
  const needsConfirm = widens && profile.active_version !== null

  const doSubmit = async () => {
    setSubmitting(true)
    try {
      await onSubmit({
        notes,
        client_declarable: clientDeclarable,
        serve_as_default: serveAsDefault,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const widenWarning = (
    <>
      Turning this on doesn&apos;t change the dictionary itself — same bytes —
      but it widens who receives it. A dictionary approved for a narrower
      audience can&apos;t be assumed safe for a wider one, so saving this will
      deactivate the active version. It will need to be re-approved (or
      reactivated) before it serves again.
    </>
  )

  return (
    <Dialog
      open={open}
      onClose={() => !submitting && onClose()}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Edit {profile.name}</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          margin="normal"
          label="Notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          multiline
          minRows={2}
        />
        <Box sx={{ mt: 1.5 }}>
          <FormControlLabel
            control={
              <Switch
                checked={clientDeclarable}
                onChange={(_, c) => setClientDeclarable(c)}
              />
            }
            label="Client declarable"
          />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', ml: 4.5, mt: -0.5 }}
          >
            Clients may request this profile by name in their subscription.
          </Typography>
        </Box>
        <Box sx={{ mt: 1 }}>
          <FormControlLabel
            control={
              <Switch
                checked={serveAsDefault}
                onChange={(_, c) => setServeAsDefault(c)}
              />
            }
            label="Serve as default"
          />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', ml: 4.5, mt: -0.5 }}
          >
            Connections that match no more specific profile receive this one
            automatically.
          </Typography>
        </Box>

        {needsConfirm && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {widenWarning}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        {needsConfirm ? (
          <ConfirmButton
            title="Widen this profile's audience?"
            body={widenWarning}
            confirmText="Save and deactivate"
            confirmColor="warning"
            onConfirm={doSubmit}
          >
            {openConfirm => (
              <Button
                variant="solid"
                color="primary"
                onClick={openConfirm}
                disabled={submitting}
                startIcon={
                  submitting ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : undefined
                }
              >
                Save
              </Button>
            )}
          </ConfirmButton>
        ) : (
          <Button
            variant="solid"
            color="primary"
            onClick={doSubmit}
            disabled={submitting}
            startIcon={
              submitting ? (
                <CircularProgress size={16} color="inherit" />
              ) : undefined
            }
          >
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
