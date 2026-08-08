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

import { CreateProfileRequest } from '../api'

interface CreateProfileDialogProps {
  open: boolean
  onClose: () => void
  // Must not throw — errors are shown by the caller via showAlert. The caller
  // controls `open`, so it only flips it closed once the create succeeded.
  onSubmit: (req: CreateProfileRequest) => Promise<void>
}

// CreateProfileDialog: name a new dictionary audience. client_declarable and
// serve_as_default start off — a fresh profile has no approved version yet, so
// there is nothing to widen the audience of; the operator opts in later once
// a version exists.
export const CreateProfileDialog = ({
  open,
  onClose,
  onSubmit,
}: CreateProfileDialogProps) => {
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [clientDeclarable, setClientDeclarable] = useState(false)
  const [serveAsDefault, setServeAsDefault] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setName('')
      setNotes('')
      setClientDeclarable(false)
      setServeAsDefault(false)
      setSubmitting(false)
    }
  }, [open])

  const valid = name.trim() !== ''

  const handleSubmit = async () => {
    if (!valid || submitting) return
    setSubmitting(true)
    try {
      await onSubmit({
        name: name.trim(),
        notes: notes.trim(),
        client_declarable: clientDeclarable,
        serve_as_default: serveAsDefault,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => !submitting && onClose()}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Create profile</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          margin="normal"
          label="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. odds-board"
          helperText="Matched against what a connection resolves to. This is also the name a client declares to request the profile directly, and the name rejections stay keyed to if this profile is later deleted and recreated."
        />
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
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="solid"
          color="primary"
          onClick={handleSubmit}
          disabled={!valid || submitting}
          startIcon={
            submitting ? (
              <CircularProgress size={16} color="inherit" />
            ) : undefined
          }
        >
          {submitting ? 'Creating…' : 'Create profile'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
