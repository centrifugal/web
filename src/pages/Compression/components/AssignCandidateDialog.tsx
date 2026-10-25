import { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'

import { CompressionApiHook, Candidate, Profile } from '../api'
import { ProfileSizeFields } from './ProfileSizeFields'
import {
  ActivateNowField,
  activateCreated,
  CreatedVersion,
  validRolloutPercent,
} from './ActivateNowField'

interface AssignCandidateDialogProps {
  api: CompressionApiHook
  sessionId: string
  // The candidate to assign; dialog is open whenever this is non-null. Only
  // ever a `schema` candidate — it carries no values, so there's nothing to
  // review.
  candidate: Candidate | null
  // The profile the session was trained for, preselected. Empty when the
  // session named none.
  defaultProfileId?: string
  onClose: () => void
  // Called once the version exists, whether or not activating it succeeded.
  onAssigned: (created: CreatedVersion) => void
}

// AssignCandidateDialog: the schema shortcut. A schema candidate has no
// proposed values, so there's no review step — pick where it goes and how
// big, and it becomes a version directly.
export const AssignCandidateDialog = ({
  api,
  sessionId,
  candidate,
  defaultProfileId,
  onClose,
  onAssigned,
}: AssignCandidateDialogProps) => {
  const [profileId, setProfileId] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [sizeBytes, setSizeBytes] = useState(0)
  const [activateNow, setActivateNow] = useState(false)
  const [rolloutPercent, setRolloutPercent] = useState(100)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (candidate) {
      setProfileId(defaultProfileId ?? '')
      setActivateNow(false)
      setRolloutPercent(100)
      const largest = candidate.size_curve.reduce(
        (max, p) => (p.size_bytes > max ? p.size_bytes : max),
        candidate.size_curve[0]?.size_bytes ?? 4096
      )
      setSizeBytes(
        candidate.recommended_size > 0 ? candidate.recommended_size : largest
      )
    } else {
      setSubmitting(false)
    }
    // Preselect once per opening, not again when the parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate])

  if (!candidate) return null

  const valid =
    profileId !== '' &&
    sizeBytes > 0 &&
    (!activateNow || validRolloutPercent(rolloutPercent))

  const handleSubmit = async () => {
    if (!valid || submitting) return
    setSubmitting(true)
    try {
      const version = await api.assignSession(sessionId, {
        profile_id: profileId,
        size_bytes: sizeBytes,
      })
      const { activatedPercent, error } = await activateCreated(
        api,
        version.id,
        activateNow,
        rolloutPercent
      )
      onAssigned({ profileId, versionId: version.id, activatedPercent })
      if (error) api.handleError(error)
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
          curve={candidate.size_curve}
          recommendedSize={candidate.recommended_size}
          onProfileResolved={setProfile}
        />
        <ActivateNowField
          profile={profile}
          checked={activateNow}
          onCheckedChange={setActivateNow}
          percent={rolloutPercent}
          onPercentChange={setRolloutPercent}
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
