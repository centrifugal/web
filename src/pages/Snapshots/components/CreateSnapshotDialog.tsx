import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Typography,
  Box,
  Paper,
  Tooltip,
  Alert,
  CircularProgress,
} from '@mui/material'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'

type ConnectionIdentity = 'any' | 'user' | 'anonymous'

interface CreateSnapshotDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: any) => void
  parentSnapshotId?: string
  prefilledData?: {
    type?: 'channels' | 'connections'
    filterType?: 'user' | 'channel'
    value?: string
  }
}

export const CreateSnapshotDialog = ({
  open,
  onClose,
  onSubmit,
  parentSnapshotId,
  prefilledData,
}: CreateSnapshotDialogProps) => {
  const [snapshotType, setSnapshotType] = useState<'channels' | 'connections'>(
    'channels'
  )
  const [channelPattern, setChannelPattern] = useState<string>('')
  // Connections filters compose (AND): an identity (any / specific user /
  // anonymous) optionally narrowed to connections subscribed to a channel.
  const [connectionIdentity, setConnectionIdentity] =
    useState<ConnectionIdentity>('any')
  const [connectionUser, setConnectionUser] = useState<string>('')
  const [connectionChannel, setConnectionChannel] = useState<string>('')
  const [submitting, setSubmitting] = useState<boolean>(false)

  // Reset the form whenever the dialog closes, so a subsequent open from the
  // top "Create Snapshot" button (which carries no prefilled data) starts
  // clean instead of showing the previously submitted values.
  useEffect(() => {
    if (!open) {
      setSnapshotType('channels')
      setChannelPattern('')
      setConnectionIdentity('any')
      setConnectionUser('')
      setConnectionChannel('')
      setSubmitting(false)
    }
  }, [open])

  // Pre-fill form when dialog opens with prefilled data (drill-downs).
  useEffect(() => {
    if (open && prefilledData) {
      if (prefilledData.type) {
        setSnapshotType(prefilledData.type)
      }
      if (prefilledData.type === 'connections' && prefilledData.value) {
        if (prefilledData.filterType === 'user') {
          setConnectionIdentity('user')
          setConnectionUser(prefilledData.value)
        } else if (prefilledData.filterType === 'channel') {
          // Channel drill-down: snapshot connections subscribed to this channel,
          // for any user, unless the operator narrows the identity.
          setConnectionChannel(prefilledData.value)
        }
      }
    }
  }, [open, prefilledData])

  const buildFilter = () => {
    if (snapshotType === 'channels') {
      return { channels: { pattern: channelPattern || '*' } }
    }
    const connections: any = {}
    if (connectionIdentity === 'user' && connectionUser.trim()) {
      connections.user = connectionUser.trim()
    } else if (connectionIdentity === 'anonymous') {
      connections.anonymous = true
    }
    if (connectionChannel.trim()) {
      connections.channel = connectionChannel.trim()
    }
    return { connections }
  }

  // Derived directly from form state on each render — no effect/state to sync.
  const jsonPreview = JSON.stringify(buildFilter(), null, 2)

  const isValid = () => {
    if (snapshotType === 'channels') {
      return true // Channel pattern can be empty (defaults to '*')
    }
    // A specific user needs a user ID; "any" and "anonymous" are always valid
    // (an optional channel just narrows them further).
    if (connectionIdentity === 'user') {
      return connectionUser.trim() !== ''
    }
    return true
  }

  // "All connections" — no identity narrowing and no channel — can be heavy.
  const isUnbounded =
    snapshotType === 'connections' &&
    connectionIdentity === 'any' &&
    connectionChannel.trim() === ''

  const handleSubmit = async () => {
    if (submitting) return

    const data = {
      kind: snapshotType,
      filter: buildFilter(),
      requested_by: 'admin',
      ...(parentSnapshotId && { parent_snapshot_id: parentSnapshotId }),
    }

    // Guard against a double click firing a second POST before the parent
    // closes the dialog on success.
    setSubmitting(true)
    try {
      await onSubmit(data)
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    // Form state is reset by the open-change effect above.
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          Create New Snapshot
          <Tooltip title="Channels: per-channel aggregate (subscriber counts). Connections: per-connection detail, optionally filtered by user, anonymous, and/or subscribed channel.">
            <HelpOutlineIcon
              fontSize="small"
              sx={{ cursor: 'help', color: 'action.active' }}
            />
          </Tooltip>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <RadioGroup
            value={snapshotType}
            onChange={e =>
              setSnapshotType(e.target.value as 'channels' | 'connections')
            }
            row
          >
            <FormControlLabel
              value="channels"
              control={<Radio />}
              label="Channels"
            />
            <FormControlLabel
              value="connections"
              control={<Radio />}
              label="Connections"
            />
          </RadioGroup>
          <Typography variant="body2" color="text.secondary">
            {snapshotType === 'channels'
              ? 'Per-channel aggregate — active channels and their subscriber counts.'
              : 'Per-connection detail — individual clients and their metadata.'}
          </Typography>
        </Box>

        {snapshotType === 'channels' ? (
          <Box sx={{ mb: 3 }}>
            <FormControl fullWidth>
              <FormLabel sx={{ mb: 1 }}>Channel pattern</FormLabel>
              <TextField
                value={channelPattern}
                onChange={e => setChannelPattern(e.target.value)}
                placeholder="e.g., chat:*, game:room*"
                helperText="Glob pattern over channel names. Leave empty to match all channels (*)."
                variant="outlined"
                fullWidth
              />
            </FormControl>
          </Box>
        ) : (
          <Box sx={{ mb: 3 }}>
            <FormControl component="fieldset" sx={{ mb: 1 }}>
              <FormLabel sx={{ mb: 1 }}>Client identity</FormLabel>
              <RadioGroup
                value={connectionIdentity}
                onChange={e =>
                  setConnectionIdentity(e.target.value as ConnectionIdentity)
                }
                row
              >
                <FormControlLabel
                  value="any"
                  control={<Radio />}
                  label="Any user"
                />
                <FormControlLabel
                  value="user"
                  control={<Radio />}
                  label="Specific user"
                />
                <FormControlLabel
                  value="anonymous"
                  control={<Radio />}
                  label="Anonymous (no user ID)"
                />
              </RadioGroup>
            </FormControl>

            {connectionIdentity === 'user' && (
              <TextField
                value={connectionUser}
                onChange={e => setConnectionUser(e.target.value)}
                placeholder="Enter user ID"
                label="User ID"
                variant="outlined"
                fullWidth
                required
                helperText="The specific user ID to snapshot connections for."
                sx={{ mb: 2 }}
              />
            )}

            <TextField
              value={connectionChannel}
              onChange={e => setConnectionChannel(e.target.value)}
              placeholder="e.g., chat:room42"
              label="Subscribed to channel (optional)"
              variant="outlined"
              fullWidth
              helperText="Only connections currently subscribed to this channel. Leave empty for any channel."
            />

            {isUnbounded && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Snapshots every active connection across all nodes. On large
                deployments this can be resource-intensive and produce a very
                large snapshot — narrow by user, anonymous, or channel when you
                can.
              </Alert>
            )}
          </Box>
        )}

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Filter Preview (JSON):
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
                fontSize: '0.875rem',
                whiteSpace: 'pre-wrap',
                margin: 0,
              }}
            >
              {jsonPreview}
            </Typography>
          </Paper>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="tonal"
          color="primary"
          disabled={!isValid() || submitting}
          startIcon={
            submitting ? (
              <CircularProgress size={16} color="inherit" />
            ) : undefined
          }
        >
          {submitting ? 'Creating…' : 'Create Snapshot'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
