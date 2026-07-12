import { useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import WarningIcon from '@mui/icons-material/Warning'

interface ConfirmDialogProps {
  isOpen: boolean
  onCancel: () => void
  onConfirm: () => void
}

export const ConfirmDialog = ({
  isOpen,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) => {
  // Guard against a double-click firing an async onConfirm (e.g. sending a
  // push, deleting settings) twice before the dialog closes. The ref blocks a
  // second synchronous click even before the disabled re-render lands.
  const confirmingRef = useRef(false)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      confirmingRef.current = false
      setConfirming(false)
    }
  }, [isOpen])

  const handleConfirm = async () => {
    if (confirmingRef.current) return
    confirmingRef.current = true
    setConfirming(true)
    try {
      await onConfirm()
    } finally {
      // Re-enable on failure (dialog left open); the open-change effect resets
      // this anyway once the dialog closes on success.
      confirmingRef.current = false
      setConfirming(false)
    }
  }

  const handleDialogClose = () => {
    if (confirmingRef.current) return
    onCancel()
  }

  return (
    <Dialog
      open={isOpen}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      onClose={handleDialogClose}
    >
      <DialogTitle id="alert-dialog-title">
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <WarningIcon
            fontSize="medium"
            sx={theme => ({
              color: theme.palette.warning.main,
              mr: theme.spacing(1),
            })}
          />
          Are you sure?
        </Box>
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description">
          This action cannot be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} autoFocus disabled={confirming}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="tonal"
          color="error"
          disabled={confirming}
        >
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  )
}
