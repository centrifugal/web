import { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import RadioGroup from '@mui/material/RadioGroup'
import Radio from '@mui/material/Radio'
import FormControlLabel from '@mui/material/FormControlLabel'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import MenuItem from '@mui/material/MenuItem'
import CircularProgress from '@mui/material/CircularProgress'

import { CreateSessionRequest, TrainingFilter, TrainingMode } from '../api'

type Identity = 'any' | 'user' | 'anonymous'
type Classification = 'any' | 'profile' | 'unclassified'

interface CreateSessionDialogProps {
  open: boolean
  onClose: () => void
  // Must not throw — errors are shown by the caller via showAlert.
  onSubmit: (req: CreateSessionRequest) => Promise<void>
  // Profiles this session can be trained FOR. Empty is fine: binding one is
  // optional and only matters when retraining.
  profiles?: { id: string; name: string }[]
  // Pre-bind the session to this profile. Set when the operator arrived from a
  // profile that has nothing trained yet, so the one field that matters for
  // that journey is already filled in.
  defaultProfileId?: string
  // A session to start from, when retraining: the same connections, mode and
  // duration, so a retrain is one confirmation rather than a form.
  initial?: CreateSessionRequest
}

// CreateSessionDialog: the connection filter is the same shape the Inspector
// builds (user / anonymous / channel), plus `profile` and `unclassified` —
// two ways to ask "what is this profile's audience actually sending" and
// "what is nobody's audience sending" respectively. They're mutually
// exclusive by construction here: picking one clears the other's field.
export const CreateSessionDialog = ({
  open,
  onClose,
  onSubmit,
  profiles = [],
  defaultProfileId,
  initial,
}: CreateSessionDialogProps) => {
  const [identity, setIdentity] = useState<Identity>('any')
  const [user, setUser] = useState('')
  const [channel, setChannel] = useState('')
  const [classification, setClassification] = useState<Classification>('any')
  const [profileName, setProfileName] = useState('')
  // Shapes only by default: nothing to review, nothing of anyone's data.
  const [trainingMode, setTrainingMode] = useState<TrainingMode>('schema')
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [trainForProfileId, setTrainForProfileId] = useState(
    defaultProfileId ?? ''
  )
  const [submitting, setSubmitting] = useState(false)
  // The request as sent, for whoever wants to see it; folded away so it does
  // not read as part of the form.
  const [showRequest, setShowRequest] = useState(false)

  useEffect(() => {
    if (!open) {
      setIdentity('any')
      setTrainForProfileId('')
      setUser('')
      setChannel('')
      setClassification('any')
      setProfileName('')
      setTrainingMode('schema')
      setDurationMinutes(60)
      setSubmitting(false)
      return
    }
    if (!initial) return
    const f = initial.filter
    setIdentity(f.user ? 'user' : f.anonymous ? 'anonymous' : 'any')
    setUser(f.user ?? '')
    setChannel(f.channel ?? '')
    setClassification(
      f.profile ? 'profile' : f.unclassified ? 'unclassified' : 'any'
    )
    setProfileName(f.profile ?? '')
    setTrainingMode(initial.training_mode)
    setDurationMinutes(Math.max(1, Math.round(initial.duration_seconds / 60)))
    setTrainForProfileId(initial.profile_id ?? defaultProfileId ?? '')
    // Applied once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const buildFilter = (): TrainingFilter => {
    const filter: TrainingFilter = {}
    if (identity === 'user' && user.trim()) filter.user = user.trim()
    else if (identity === 'anonymous') filter.anonymous = true
    if (channel.trim()) filter.channel = channel.trim()
    if (classification === 'profile' && profileName.trim())
      filter.profile = profileName.trim()
    else if (classification === 'unclassified') filter.unclassified = true
    return filter
  }

  // Built once and used for both the preview and the submit, so the panel
  // showing what will be sent cannot drift from what is sent. It already had:
  // the preview carried profile_id while the request quietly did not, so an
  // operator who chose "train for profile" got a session bound to nothing and
  // was shown otherwise.
  const buildRequest = (): CreateSessionRequest => ({
    filter: buildFilter(),
    training_mode: trainingMode,
    duration_seconds: Math.round(durationMinutes * 60),
    ...(trainForProfileId ? { profile_id: trainForProfileId } : {}),
  })

  const jsonPreview = JSON.stringify(buildRequest(), null, 2)

  const valid =
    (identity !== 'user' || user.trim() !== '') &&
    (classification !== 'profile' || profileName.trim() !== '') &&
    durationMinutes > 0

  const handleSubmit = async () => {
    if (!valid || submitting) return
    setSubmitting(true)
    try {
      await onSubmit(buildRequest())
    } finally {
      setSubmitting(false)
    }
  }

  const trainFor = profiles.find(p => p.id === trainForProfileId)

  return (
    <Dialog
      open={open}
      onClose={() => !submitting && onClose()}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        {initial && trainFor
          ? `Retrain ${trainFor.name}`
          : 'Start a training session'}
      </DialogTitle>
      <DialogContent>
        <FormControl component="fieldset" sx={{ mt: 1, mb: 2 }}>
          <FormLabel sx={{ mb: 1 }}>What to learn</FormLabel>
          <RadioGroup
            value={trainingMode}
            onChange={e => setTrainingMode(e.target.value as TrainingMode)}
          >
            <FormControlLabel
              value="schema"
              control={<Radio />}
              label="Shapes only: field names and message structure, nothing to review"
            />
            <FormControlLabel
              value="values"
              control={<Radio />}
              label="Shapes and values: compresses better, needs your review"
            />
          </RadioGroup>
          {trainingMode === 'values' && (
            <Typography variant="caption" color="text.secondary">
              The session proposes values seen in your traffic. Every value you
              approve is sent to every client this profile reaches.
            </Typography>
          )}
        </FormControl>

        <FormLabel component="legend" sx={{ mb: 1 }}>
          Which connections to sample
        </FormLabel>
        <FormControl component="fieldset" sx={{ mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Users
          </Typography>
          <RadioGroup
            value={identity}
            onChange={e => setIdentity(e.target.value as Identity)}
            row
          >
            <FormControlLabel value="any" control={<Radio />} label="All" />
            <FormControlLabel
              value="user"
              control={<Radio />}
              label="One user"
            />
            <FormControlLabel
              value="anonymous"
              control={<Radio />}
              label="Anonymous"
            />
          </RadioGroup>
        </FormControl>
        {identity === 'user' && (
          <TextField
            value={user}
            onChange={e => setUser(e.target.value)}
            label="User ID"
            fullWidth
            required
            sx={{ mb: 2 }}
          />
        )}
        <FormControl component="fieldset" sx={{ mb: 1, display: 'block' }}>
          <Typography variant="body2" color="text.secondary">
            Profile
          </Typography>
          <RadioGroup
            value={classification}
            onChange={e => setClassification(e.target.value as Classification)}
            row
          >
            <FormControlLabel value="any" control={<Radio />} label="Any" />
            <FormControlLabel
              value="profile"
              control={<Radio />}
              label="Of one profile"
            />
            <FormControlLabel
              value="unclassified"
              control={<Radio />}
              label="Without a profile"
            />
          </RadioGroup>
        </FormControl>
        {classification === 'profile' && (
          <TextField
            value={profileName}
            onChange={e => setProfileName(e.target.value)}
            label="Profile name"
            fullWidth
            required
            sx={{ mb: 2 }}
          />
        )}
        <TextField
          value={channel}
          onChange={e => setChannel(e.target.value)}
          label="Subscribed to channel (optional)"
          placeholder="e.g., odds:*"
          fullWidth
          sx={{ mt: 1, mb: 2 }}
        />

        {profiles.length > 0 && (
          <TextField
            select
            value={trainForProfileId}
            onChange={e => setTrainForProfileId(e.target.value)}
            label="Dictionary for profile"
            fullWidth
            helperText="Values already rejected for this profile are not proposed again. Leave it open to decide when you create the dictionary."
            sx={{ mb: 2 }}
          >
            <MenuItem value="">
              <em>Decide later</em>
            </MenuItem>
            {profiles.map(p => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </TextField>
        )}

        <TextField
          type="number"
          value={durationMinutes}
          onChange={e => setDurationMinutes(Number(e.target.value))}
          label="Duration (minutes)"
          fullWidth
          inputProps={{ min: 1 }}
          helperText="You can stop it early or extend it."
          sx={{ mb: 1 }}
        />

        <Button
          variant="text"
          size="small"
          color="inherit"
          onClick={() => setShowRequest(v => !v)}
          sx={{ px: 0 }}
        >
          {showRequest ? 'Hide request' : 'Show request'}
        </Button>
        {showRequest && (
          <Paper
            variant="outlined"
            sx={{ p: 2, mt: 1, backgroundColor: 'background.default' }}
          >
            <Typography
              component="pre"
              variant="body2"
              sx={{
                fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                fontSize: '0.8rem',
                whiteSpace: 'pre-wrap',
                margin: 0,
              }}
            >
              {jsonPreview}
            </Typography>
          </Paper>
        )}
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
          {submitting ? 'Starting…' : 'Start session'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
