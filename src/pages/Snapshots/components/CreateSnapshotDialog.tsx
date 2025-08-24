import React, { useState, useEffect } from 'react'
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
} from '@mui/material'

interface CreateSnapshotDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: any) => void
}

export const CreateSnapshotDialog = ({ 
  open, 
  onClose, 
  onSubmit 
}: CreateSnapshotDialogProps) => {
  const [snapshotType, setSnapshotType] = useState<'channels' | 'connections'>('channels')
  const [channelPattern, setChannelPattern] = useState<string>('')
  const [connectionFilterType, setConnectionFilterType] = useState<'user' | 'channel'>('user')
  const [connectionValue, setConnectionValue] = useState<string>('')
  const [jsonPreview, setJsonPreview] = useState<string>('')

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
      requested_by: 'admin'
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
      <DialogTitle>Create New Snapshot</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <FormControl component="fieldset">
            <FormLabel component="legend" sx={{ mb: 2 }}>
              Snapshot Type
            </FormLabel>
            <RadioGroup
              value={snapshotType}
              onChange={(e) => setSnapshotType(e.target.value as 'channels' | 'connections')}
            >
              <FormControlLabel 
                value="channels" 
                control={<Radio />} 
                label="Channels - Take snapshot of all channels matching pattern" 
              />
              <FormControlLabel 
                value="connections" 
                control={<Radio />} 
                label="Connections - Take snapshot of connections for specific user or channel" 
              />
            </RadioGroup>
          </FormControl>
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
            <FormControl component="fieldset" sx={{ mb: 2 }}>
              <FormLabel component="legend">Filter By</FormLabel>
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
              fullWidth
              required
            />
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