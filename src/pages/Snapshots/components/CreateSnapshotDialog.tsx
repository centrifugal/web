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
  IconButton,
} from '@mui/material'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'

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
  prefilledData
}: CreateSnapshotDialogProps) => {
  const [snapshotType, setSnapshotType] = useState<'channels' | 'connections'>('channels')
  const [channelPattern, setChannelPattern] = useState<string>('')
  const [connectionFilterType, setConnectionFilterType] = useState<'user' | 'channel'>('user')
  const [connectionValue, setConnectionValue] = useState<string>('')
  const [jsonPreview, setJsonPreview] = useState<string>('')

  // Pre-fill form when dialog opens with prefilled data
  useEffect(() => {
    if (open && prefilledData) {
      if (prefilledData.type) {
        setSnapshotType(prefilledData.type)
      }
      if (prefilledData.type === 'connections') {
        if (prefilledData.filterType) {
          setConnectionFilterType(prefilledData.filterType)
        }
        if (prefilledData.value) {
          setConnectionValue(prefilledData.value)
        }
      }
    }
  }, [open, prefilledData])

  useEffect(() => {
    updateJsonPreview()
  }, [snapshotType, channelPattern, connectionFilterType, connectionValue]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateJsonPreview = () => {
    let filter: any = {}

    if (snapshotType === 'channels') {
      filter.channels = {
        pattern: channelPattern || '*'
      }
    } else {
      filter.connections = {}
      if (connectionValue) {
        filter.connections[connectionFilterType] = connectionValue
      } else {
        filter.connections[connectionFilterType] = `example_${connectionFilterType}`
      }
    }

    setJsonPreview(JSON.stringify(filter, null, 2))
  }

  const handleSubmit = () => {
    let filter: any = {}

    if (snapshotType === 'channels') {
      filter.channels = {
        pattern: channelPattern || '*'
      }
    } else {
      filter.connections = {}
      if (connectionValue) {
        filter.connections[connectionFilterType] = connectionValue
      }
    }

    const data = {
      kind: snapshotType,
      filter,
      requested_by: 'admin',
      ...(parentSnapshotId && { parent_snapshot_id: parentSnapshotId })
    }

    onSubmit(data)
  }

  const handleClose = () => {
    // Reset form when closing
    setSnapshotType('channels')
    setChannelPattern('')
    setConnectionFilterType('user')
    setConnectionValue('')
    onClose()
  }

  const isValid = () => {
    if (snapshotType === 'channels') {
      return true // Channel pattern can be empty (defaults to '*')
    } else {
      return connectionValue.trim() !== ''
    }
  }

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          Create New Snapshot
          <Tooltip title="Channels: Take snapshot of all channels matching pattern. Connections: Take snapshot of connections for specific user or channel.">
            <IconButton size="small">
              <HelpOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <RadioGroup
            value={snapshotType}
            onChange={(e) => setSnapshotType(e.target.value as 'channels' | 'connections')}
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
        </Box>

        {snapshotType === 'channels' ? (
          <Box sx={{ mb: 3 }}>
            <FormControl fullWidth>
              <FormLabel sx={{ mb: 1 }}>Channel Pattern</FormLabel>
              <TextField
                value={channelPattern}
                onChange={(e) => setChannelPattern(e.target.value)}
                placeholder="e.g., game:*, chat:room*, * (for all channels)"
                helperText="Use glob patterns. Leave empty for all channels (*)"
                variant="outlined"
                fullWidth
              />
            </FormControl>
          </Box>
        ) : (
          <Box sx={{ mb: 3 }}>
            <FormControl fullWidth>
              <FormLabel sx={{ mb: 1 }}>Filter By</FormLabel>
              <Box display="flex" alignItems="center" gap={2}>
                <FormControl component="fieldset">
                  <RadioGroup
                    value={connectionFilterType}
                    onChange={(e) => setConnectionFilterType(e.target.value as 'user' | 'channel')}
                    row
                  >
                    <FormControlLabel value="user" control={<Radio />} label="User ID" />
                    <FormControlLabel value="channel" control={<Radio />} label="Channel" />
                  </RadioGroup>
                </FormControl>
                <TextField
                  value={connectionValue}
                  onChange={(e) => setConnectionValue(e.target.value)}
                  placeholder={connectionFilterType === 'user' ? 'Enter user ID' : 'Enter channel name'}
                  label={connectionFilterType === 'user' ? 'User ID' : 'Channel Name'}
                  variant="outlined"
                  sx={{ flex: 1 }}
                  required
                  helperText={connectionFilterType === 'user' ? 'Enter the specific user ID to filter connections' : 'Enter the channel name to filter connections'}
                />
              </Box>
            </FormControl>
          </Box>
        )}

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Filter Preview (JSON):
          </Typography>
          <Paper variant="outlined" sx={{ p: 2, backgroundColor: 'background.default' }}>
            <Typography
              component="pre"
              variant="body2"
              sx={{ 
                fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                fontSize: '0.875rem',
                whiteSpace: 'pre-wrap',
                margin: 0
              }}
            >
              {jsonPreview}
            </Typography>
          </Paper>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained"
          disabled={!isValid()}
        >
          Create Snapshot
        </Button>
      </DialogActions>
    </Dialog>
  )
}