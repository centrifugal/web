import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'

import { Profile } from '../api'

interface AudienceConfirmDialogProps {
  open: boolean
  profile: Pick<Profile, 'client_declarable' | 'serve_as_default'>
  onClose: () => void
  // Resends the activation or rollback with confirm_audience. Must not throw.
  onConfirm: () => Promise<void>
}

// Who a profile's dictionary reaches beyond its own classified connections,
// said as a sentence rather than as flag names: the decision is about people.
export const wideAudience = (
  p: Pick<Profile, 'client_declarable' | 'serve_as_default'>
): string[] => {
  const out: string[] = []
  if (p.serve_as_default) {
    out.push(
      'every connection this deployment accepts that no profile claims — including connections belonging to other tenants'
    )
  }
  if (p.client_declarable) {
    out.push('anyone who can connect to this deployment and asks for it')
  }
  return out
}

// AudienceConfirmDialog: the version was approved before its profile was made
// default or client-declarable, which deactivated it. Serving it again is a new
// approval of its values for the wider audience, recorded under the caller's
// name - so it is asked as one, not passed off as an undo.
export const AudienceConfirmDialog = ({
  open,
  profile,
  onClose,
  onConfirm,
}: AudienceConfirmDialogProps) => {
  const [submitting, setSubmitting] = useState(false)
  const audience = wideAudience(profile)

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      await onConfirm()
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
      <DialogTitle>Approve this version for a wider audience?</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          This version was approved for this profile&apos;s own connections. The
          profile now also reaches:
        </Typography>
        <Typography component="ul" variant="body2" sx={{ mt: 0, pl: 3 }}>
          {audience.map(a => (
            <li key={a}>{a}</li>
          ))}
        </Typography>
        <Typography variant="body2" sx={{ mt: 1.5 }}>
          Serving it shows every value it holds to all of them. Approving
          records that decision under your name.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="solid"
          color="warning"
          onClick={handleConfirm}
          disabled={submitting}
          startIcon={
            submitting ? <CircularProgress size={16} color="inherit" /> : null
          }
        >
          Approve and serve
        </Button>
      </DialogActions>
    </Dialog>
  )
}
