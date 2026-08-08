import { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'

import { Version } from '../api'

interface ActivateVersionDialogProps {
  // The version to activate; dialog is open whenever this is non-null.
  version: Version | null
  onClose: () => void
  // Must not throw — errors are shown by the caller via showAlert.
  onActivate: (versionId: string, rolloutPercent: number) => Promise<void>
}

// ActivateVersionDialog: rollout percent controls what share of matching
// connections receive this version; the remainder keeps falling back to
// whatever lower tier they'd otherwise get (structure, default profile, or
// nothing) until the operator raises it.
export const ActivateVersionDialog = ({
  version,
  onClose,
  onActivate,
}: ActivateVersionDialogProps) => {
  const [percent, setPercent] = useState(100)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (version) setPercent(version.rollout_percent || 100)
    else setSubmitting(false)
  }, [version])

  if (!version) return null

  const valid = Number.isFinite(percent) && percent >= 1 && percent <= 100

  const handleSubmit = async () => {
    if (!valid || submitting) return
    setSubmitting(true)
    try {
      await onActivate(version.id, percent)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open
      onClose={() => !submitting && onClose()}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>Activate version</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          margin="normal"
          type="number"
          label="Rollout percent"
          value={percent}
          onChange={e => setPercent(Number(e.target.value))}
          inputProps={{ min: 1, max: 100 }}
          helperText="Share of matching connections that receive this version. Start low to watch it before raising it to 100."
        />
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
          {submitting ? 'Activating…' : 'Activate'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
