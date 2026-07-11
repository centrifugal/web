import { ReactNode, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'

// Wraps a destructive action in a confirmation dialog. The trigger is supplied via
// a render prop so callers can use any control (icon button, menu item, etc.).
export const ConfirmButton = ({
  title,
  body,
  confirmText = 'Confirm',
  confirmColor = 'error',
  onConfirm,
  children,
}: {
  title: string
  body?: ReactNode
  confirmText?: string
  confirmColor?: 'error' | 'primary' | 'warning'
  onConfirm: () => Promise<void> | void
  children: (open: () => void) => ReactNode
}) => {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const handleConfirm = async () => {
    setBusy(true)
    try {
      await onConfirm()
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {children(() => setOpen(true))}
      <Dialog open={open} onClose={() => !busy && setOpen(false)} maxWidth="xs">
        <DialogTitle>{title}</DialogTitle>
        {body && (
          <DialogContent>
            <DialogContentText>{body}</DialogContentText>
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={confirmColor}
            onClick={handleConfirm}
            disabled={busy}
            startIcon={busy ? <CircularProgress size={16} /> : undefined}
          >
            {confirmText}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
