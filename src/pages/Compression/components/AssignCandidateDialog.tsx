import { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'

import { CompressionApiHook, Candidate } from '../api'
import { ProfileSizeFields } from './ProfileSizeFields'

interface AssignCandidateDialogProps {
  api: CompressionApiHook
  sessionId: string
  // The candidate to assign; dialog is open whenever this is non-null. Only
  // ever a `schema` candidate — it carries no values, so there's nothing to
  // review.
  candidate: Candidate | null
  onClose: () => void
  onAssigned: () => void
}

// AssignCandidateDialog: the schema shortcut. A schema candidate has no
// proposed values, so there's no review step — pick where it goes and how
// big, and it becomes a version directly.
export const AssignCandidateDialog = ({
  api,
  sessionId,
  candidate,
  onClose,
  onAssigned,
}: AssignCandidateDialogProps) => {
  const [profileId, setProfileId] = useState('')
  const [sizeBytes, setSizeBytes] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (candidate) {
      setProfileId('')
      const largest = candidate.size_curve.reduce(
        (max, p) => (p.size_bytes > max ? p.size_bytes : max),
        candidate.size_curve[0]?.size_bytes ?? 4096
      )
      setSizeBytes(largest)
    } else {
      setSubmitting(false)
    }
  }, [candidate])

  if (!candidate) return null

  const valid = profileId !== '' && sizeBytes > 0

  const handleSubmit = async () => {
    if (!valid || submitting) return
    setSubmitting(true)
    try {
      await api.assignSession(sessionId, {
        profile_id: profileId,
        size_bytes: sizeBytes,
      })
      onAssigned()
    } catch (err) {
      api.handleError(err)
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
      <DialogTitle>Assign schema candidate</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Creates a version from the schema candidate — field names and shapes
          only, no application values.
        </Typography>
        <ProfileSizeFields
          api={api}
          profileId={profileId}
          onProfileChange={setProfileId}
          sizeBytes={sizeBytes}
          onSizeChange={setSizeBytes}
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
          {submitting ? 'Assigning…' : 'Assign'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
