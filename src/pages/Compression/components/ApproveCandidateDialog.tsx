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

import { CandidatePreview, CompressionApiHook, SizeCurvePoint } from '../api'
import { HumanSize } from 'utils/Functions'
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
const jsonRatio = (p: CandidatePreview): number =>
  p.ratio_by_protocol?.json ?? 0

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
  // What this exact selection produces at this exact size. The candidate's
  // ratio and its size curve both describe selections the build chose; the
  // moment anything is unticked - the point of the review - neither describes
  // the artifact about to be created. So it is measured here, on what is
  // actually about to be approved.
  const [preview, setPreview] = useState<CandidatePreview | null>(null)
  const [previewing, setPreviewing] = useState(false)

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
    setPreview(null)
  }, [open, recommendedSize, sizeCurve])

  useEffect(() => {
    if (!open || sizeBytes <= 0) return
    let cancelled = false
    setPreviewing(true)
    api
      .previewCandidate(candidateId, {
        approved: approvedHashes,
        size_bytes: sizeBytes,
      })
      .then(p => {
        if (!cancelled) setPreview(p)
      })
      // A preview that fails must not block approving - it is information,
      // not a gate.
      .catch(() => {
        if (!cancelled) setPreview(null)
      })
      .finally(() => {
        if (!cancelled) setPreviewing(false)
      })
    return () => {
      cancelled = true
    }
    // approvedHashes is fixed for the lifetime of an open dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sizeBytes, candidateId])

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
        {(preview || previewing) && (
          <Alert
            severity={
              preview && preview.values_held < preview.values_offered
                ? 'warning'
                : 'info'
            }
            icon={previewing ? <CircularProgress size={18} /> : undefined}
            sx={{ mt: 1 }}
          >
            {preview ? (
              <>
                <strong>
                  You will get a {HumanSize(preview.artifact_bytes)} dictionary
                  {jsonRatio(preview) > 0 &&
                    `, ${jsonRatio(preview).toFixed(2)}x`}
                  .
                </strong>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {HumanSize(preview.delivery_bytes)} crosses the wire once per
                  cold connect. It holds {preview.shapes_held} of{' '}
                  {preview.shapes_total} message shapes and{' '}
                  {preview.values_held} of your {preview.values_offered}{' '}
                  approved values.
                  {preview.values_held < preview.values_offered && (
                    <>
                      {' '}
                      The{' '}
                      {(
                        preview.values_offered - preview.values_held
                      ).toLocaleString()}{' '}
                      that do not fit are still disclosed as approved decisions
                      while buying nothing — either pick a larger size or
                      approve fewer.
                    </>
                  )}
                  {!preview.measured &&
                    ' This session had no control window, so the ratio is scored against the dictionary’s own source and flatters.'}
                </Typography>
              </>
            ) : (
              'Measuring this selection…'
            )}
          </Alert>
        )}
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
