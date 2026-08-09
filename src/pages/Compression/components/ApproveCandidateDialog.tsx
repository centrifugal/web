import { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'

import { CompressionApiHook, SizeCurvePoint } from '../api'
import { ProfileSizeFields } from './ProfileSizeFields'

interface ApproveCandidateDialogProps {
  api: CompressionApiHook
  open: boolean
  candidateId: string
  // The exact set the operator has checked, and nothing else — computed by
  // the caller from what was actually reviewed, never from a server-side
  // "everything matching a filter" selection.
  approvedHashes: string[]
  totalValues: number
  // The measured size ladder and the rung the build recommends. The dialog
  // defaults to that rung: the recommended selection was measured at it, and
  // moving to another size makes the selection no longer the one that was
  // searched for.
  sizeCurve: SizeCurvePoint[]
  recommendedSize: number
  onClose: () => void
  onApproved: () => void
}

// ApproveCandidateDialog: the request carries only `approved` — the wire
// contract is explicit that anything left out is recorded as a rejection.
// That is what makes the summary below load-bearing rather than decorative:
// it is the last chance to notice that most of the candidate is about to be
// rejected because it was never looked at.
export const ApproveCandidateDialog = ({
  api,
  open,
  candidateId,
  approvedHashes,
  totalValues,
  sizeCurve,
  recommendedSize,
  onClose,
  onApproved,
}: ApproveCandidateDialogProps) => {
  const [profileId, setProfileId] = useState('')
  const [sizeBytes, setSizeBytes] = useState(0)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setProfileId('')
      setNotes('')
      setSubmitting(false)
      return
    }
    // Fall back to the largest rung when nothing was measured - the old
    // behaviour, and still the safest guess when there is no evidence.
    const largest = sizeCurve.reduce((max, p) => Math.max(max, p.size_bytes), 0)
    setSizeBytes(recommendedSize > 0 ? recommendedSize : largest || 4096)
  }, [open, recommendedSize, sizeCurve])

  const rejected = Math.max(totalValues - approvedHashes.length, 0)
  const valid = profileId !== '' && sizeBytes > 0

  const handleSubmit = async () => {
    if (!valid || submitting) return
    setSubmitting(true)
    try {
      await api.approveCandidate(candidateId, {
        approved: approvedHashes,
        profile_id: profileId,
        size_bytes: sizeBytes,
        notes: notes || undefined,
      })
      onApproved()
    } catch (err) {
      api.handleError(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => !submitting && onClose()}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>Approve candidate</DialogTitle>
      <DialogContent>
        <Alert severity={rejected > 0 ? 'warning' : 'success'} sx={{ mb: 1 }}>
          <strong>
            {approvedHashes.length.toLocaleString()} approved,{' '}
            {rejected.toLocaleString()} rejected
          </strong>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            Only checked values go in. Every other value — including any page
            never opened — is recorded as rejected. This can&apos;t be undone by
            resubmitting; use undo on the resulting decisions if needed.
          </Typography>
        </Alert>
        <ProfileSizeFields
          api={api}
          profileId={profileId}
          onProfileChange={setProfileId}
          sizeBytes={sizeBytes}
          curve={sizeCurve}
          recommendedSize={recommendedSize}
          onSizeChange={setSizeBytes}
        />
        <TextField
          fullWidth
          margin="normal"
          label="Notes (optional)"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          multiline
          minRows={2}
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
          {submitting ? 'Approving…' : 'Approve'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
