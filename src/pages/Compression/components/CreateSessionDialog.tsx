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
import CircularProgress from '@mui/material/CircularProgress'

import { CreateSessionRequest, TrainingFilter, TrainingMode } from '../api'

type Identity = 'any' | 'user' | 'anonymous'
type Classification = 'any' | 'profile' | 'unclassified'

interface CreateSessionDialogProps {
  open: boolean
  onClose: () => void
  // Must not throw — errors are shown by the caller via showAlert.
  onSubmit: (req: CreateSessionRequest) => Promise<void>
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
}: CreateSessionDialogProps) => {
  const [identity, setIdentity] = useState<Identity>('any')
  const [user, setUser] = useState('')
  const [channel, setChannel] = useState('')
  const [classification, setClassification] = useState<Classification>('any')
  const [profileName, setProfileName] = useState('')
  const [trainingMode, setTrainingMode] = useState<TrainingMode>('values')
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setIdentity('any')
      setUser('')
      setChannel('')
      setClassification('any')
      setProfileName('')
      setTrainingMode('values')
      setDurationMinutes(60)
      setSubmitting(false)
    }
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

  const jsonPreview = JSON.stringify(
    {
      filter: buildFilter(),
      training_mode: trainingMode,
      duration_seconds: Math.round(durationMinutes * 60),
    },
    null,
    2
  )

  const valid =
    (identity !== 'user' || user.trim() !== '') &&
    (classification !== 'profile' || profileName.trim() !== '') &&
    durationMinutes > 0

  const handleSubmit = async () => {
    if (!valid || submitting) return
    setSubmitting(true)
    try {
      await onSubmit({
        filter: buildFilter(),
        training_mode: trainingMode,
        duration_seconds: Math.round(durationMinutes * 60),
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
      <DialogTitle>Start a training session</DialogTitle>
      <DialogContent>
        <FormControl component="fieldset" sx={{ mt: 1, mb: 1 }}>
          <FormLabel sx={{ mb: 1 }}>Identity</FormLabel>
          <RadioGroup
            value={identity}
            onChange={e => setIdentity(e.target.value as Identity)}
            row
          >
            <FormControlLabel value="any" control={<Radio />} label="Any" />
            <FormControlLabel
              value="user"
              control={<Radio />}
              label="Specific user"
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

        <TextField
          value={channel}
          onChange={e => setChannel(e.target.value)}
          label="Channel (optional)"
          placeholder="e.g., odds:*"
          fullWidth
          helperText="Only connections subscribed to a channel matching this pattern."
          sx={{ mb: 2 }}
        />

        <FormControl component="fieldset" sx={{ mb: 1 }}>
          <FormLabel sx={{ mb: 1 }}>Classification</FormLabel>
          <RadioGroup
            value={classification}
            onChange={e => setClassification(e.target.value as Classification)}
            row
          >
            <FormControlLabel value="any" control={<Radio />} label="Any" />
            <FormControlLabel
              value="profile"
              control={<Radio />}
              label="By profile"
            />
            <FormControlLabel
              value="unclassified"
              control={<Radio />}
              label="Unclassified"
            />
          </RadioGroup>
          <Typography variant="caption" color="text.secondary">
            By profile samples what a profile's own audience is sending — use it
            to train that profile's dictionary. Unclassified samples connections
            that match no profile at all.
          </Typography>
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

        <FormControl component="fieldset" sx={{ mt: 1, mb: 2 }}>
          <FormLabel sx={{ mb: 1 }}>Training mode</FormLabel>
          <RadioGroup
            value={trainingMode}
            onChange={e => setTrainingMode(e.target.value as TrainingMode)}
            row
          >
            <FormControlLabel
              value="schema"
              control={<Radio />}
              label="Schema"
            />
            <FormControlLabel
              value="values"
              control={<Radio />}
              label="Values"
            />
          </RadioGroup>
          <Typography variant="caption" color="text.secondary">
            Schema learns field names and shapes only — no review needed. Values
            also proposes concrete field values for you to review and approve,
            which compresses better but needs a look before it ships.
          </Typography>
        </FormControl>

        <TextField
          type="number"
          value={durationMinutes}
          onChange={e => setDurationMinutes(Number(e.target.value))}
          label="Duration (minutes)"
          fullWidth
          inputProps={{ min: 1 }}
          helperText="Collection stops automatically at the deadline. It can be extended or stopped early from the session detail."
          sx={{ mb: 2 }}
        />

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Filter preview (JSON):
        </Typography>
        <Paper
          variant="outlined"
          sx={{ p: 2, backgroundColor: 'background.default' }}
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
