import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Chip,
  LinearProgress,
  Card,
  CardContent,
  Button,
  Alert,
} from '@mui/material'
import { styled } from '@mui/material/styles'
import RefreshIcon from '@mui/icons-material/Refresh'

import { useAdminApi } from 'api/adminApi'

import { ChannelsTable, ConnectionsTable } from './'

const StyledCard = styled(Card)(({ theme }) => ({
  marginBottom: theme.spacing(2),
}))

interface Snapshot {
  snapshot_id: string
  kind: string
  status: string
  filter: any
  parent_snapshot_id?: string
  created_at: string
  updated_at: string
  finished_at?: string
  expires_at?: string
  rows_inserted: number
  nodes_expected: number
  nodes_reported: number
  error_message?: string
  requested_by: string
}

interface SnapshotDetailProps {
  snapshot: Snapshot
  authorization: string
  signinSilent: () => void
  onCreateConnectionsSnapshot?: (
    channelName: string,
    parentSnapshotId: string
  ) => void
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'success'
    case 'running':
      return 'warning'
    case 'failed':
      return 'error'
    case 'queued':
      return 'info'
    default:
      return 'default'
  }
}

const formatFilter = (filter: any, kind: string) => {
  if (kind === 'channels') {
    const pattern = filter.channels?.pattern
    return !pattern || pattern === '*' ? 'All channels' : `Pattern: ${pattern}`
  }
  if (kind === 'connections') {
    const c = filter.connections || {}
    const parts: string[] = []
    if (c.user) {
      parts.push(`User: ${c.user}`)
    } else if (c.anonymous) {
      parts.push('Anonymous')
    }
    if (c.channel) {
      parts.push(`Channel: ${c.channel}`)
    }
    return parts.length > 0 ? parts.join(', ') : 'All connections'
  }
  return JSON.stringify(filter)
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleString()
}

const formatDuration = (startDate: string, endDate?: string) => {
  const start = new Date(startDate)
  const end = endDate ? new Date(endDate) : new Date()
  const diffMs = end.getTime() - start.getTime()
  const diffSecs = Math.floor(diffMs / 1000)

  if (diffSecs < 60) {
    return `${diffSecs} second${diffSecs === 1 ? '' : 's'}`
  }

  const diffMins = Math.floor(diffSecs / 60)
  if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? '' : 's'}`
  }

  const diffHours = Math.floor(diffMins / 60)
  return `${diffHours} hour${diffHours === 1 ? '' : 's'} ${
    diffMins % 60
  } minute${diffMins % 60 === 1 ? '' : 's'}`
}

export const SnapshotDetail = ({
  snapshot: initialSnapshot,
  authorization,
  signinSilent,
  onCreateConnectionsSnapshot,
}: SnapshotDetailProps) => {
  const [snapshot, setSnapshot] = useState<Snapshot>(initialSnapshot)
  const [pollingActive, setPollingActive] = useState<boolean>(false)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const navigate = useNavigate()
  const { rawRequest } = useAdminApi({ authorization, signinSilent })

  const fetchSnapshotUpdate = useCallback(async () => {
    try {
      const response = await rawRequest(
        `admin/api/snapshots/${snapshot.snapshot_id}`
      )

      if (!response.ok) {
        if (response.status === 401) {
          signinSilent()
          return
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setSnapshot(data)

      // Stop polling if snapshot is no longer running
      if (data.status !== 'running' && data.status !== 'queued') {
        setPollingActive(false)
      }
    } catch (error) {
      console.error('Failed to fetch snapshot update:', error)
      setPollingActive(false)
    }
  }, [snapshot.snapshot_id, rawRequest, signinSilent])

  // Manual refresh guard so a rapid double-click doesn't stack fetches. Kept
  // separate from the polling loop, which calls fetchSnapshotUpdate directly.
  const handleManualRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await fetchSnapshotUpdate()
    } finally {
      setRefreshing(false)
    }
  }

  const handleCreateConnectionsSnapshot = (channelName: string) => {
    if (onCreateConnectionsSnapshot) {
      onCreateConnectionsSnapshot(channelName, snapshot.snapshot_id)
    } else {
      // Fallback to navigation if callback not provided
      navigate('/snapshots', {
        state: {
          openCreateDialog: true,
          prefilledData: {
            type: 'connections',
            filterType: 'channel',
            value: channelName,
            parentSnapshotId: snapshot.snapshot_id,
          },
        },
      })
    }
  }

  // Start polling if snapshot is running or queued
  useEffect(() => {
    if (snapshot.status === 'running' || snapshot.status === 'queued') {
      setPollingActive(true)
    }
  }, [snapshot.status])

  // Polling effect
  useEffect(() => {
    let intervalId: NodeJS.Timeout

    if (pollingActive) {
      intervalId = setInterval(fetchSnapshotUpdate, 1000) // 1 second as specified
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [pollingActive, fetchSnapshotUpdate])

  const getProgressPercentage = () => {
    if (snapshot.nodes_expected === 0) return 0
    return Math.min(
      (snapshot.nodes_reported / snapshot.nodes_expected) * 100,
      100
    )
  }

  const isRunning =
    snapshot.status === 'running' || snapshot.status === 'queued'
  const isCompleted = snapshot.status === 'completed'
  const isFailed = snapshot.status === 'failed'

  return (
    <Box>
      {/* Snapshot Overview */}
      <StyledCard>
        <CardContent>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="flex-start"
            mb={2}
          >
            <Box display="flex" flexWrap="wrap" gap={1}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  px: 1.5,
                  py: 0.5,
                  minHeight: '32px',
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mr: 1 }}
                >
                  Filter:
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  {formatFilter(snapshot.filter, snapshot.kind)}
                </Typography>
              </Box>

              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  px: 1.5,
                  py: 0.5,
                  minHeight: '32px',
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mr: 1 }}
                >
                  By:
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  {snapshot.requested_by}
                </Typography>
              </Box>

              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  px: 1.5,
                  py: 0.5,
                  minHeight: '32px',
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mr: 1 }}
                >
                  Created:
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  {formatDate(snapshot.created_at)}
                </Typography>
              </Box>

              {(isCompleted || isFailed) && snapshot.finished_at && (
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    bgcolor: 'success.50',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    px: 1.5,
                    py: 0.5,
                    minHeight: '32px',
                  }}
                >
                  <Typography
                    variant="caption"
                    color="success.main"
                    sx={{ mr: 1 }}
                  >
                    Duration:
                  </Typography>
                  <Typography
                    variant="body2"
                    fontWeight="medium"
                    color="success.main"
                  >
                    {formatDuration(snapshot.created_at, snapshot.finished_at)}
                  </Typography>
                </Box>
              )}

              {isRunning && (
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    bgcolor: 'warning.50',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    px: 1.5,
                    py: 0.5,
                    minHeight: '32px',
                  }}
                >
                  <Typography
                    variant="caption"
                    color="warning.main"
                    sx={{ mr: 1 }}
                  >
                    Running for:
                  </Typography>
                  <Typography
                    variant="body2"
                    fontWeight="medium"
                    color="warning.main"
                  >
                    {formatDuration(snapshot.created_at)}
                  </Typography>
                </Box>
              )}

              {isCompleted && (
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    px: 1.5,
                    py: 0.5,
                    minHeight: '32px',
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mr: 1 }}
                  >
                    Nodes reported:
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {snapshot.nodes_reported.toLocaleString()} of{' '}
                    {snapshot.nodes_expected.toLocaleString()}
                  </Typography>
                </Box>
              )}

              {isCompleted && (
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    px: 1.5,
                    py: 0.5,
                    minHeight: '32px',
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mr: 1 }}
                  >
                    Rows:
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {snapshot.rows_inserted.toLocaleString()}
                  </Typography>
                </Box>
              )}
            </Box>

            <Box display="flex" gap={1} alignItems="center">
              <Chip
                label={
                  snapshot.status.charAt(0).toUpperCase() +
                  snapshot.status.slice(1)
                }
                color={getStatusColor(snapshot.status) as any}
              />
              {isRunning && (
                <Button
                  variant="tonal"
                  color="inherit"
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={handleManualRefresh}
                  disabled={refreshing}
                >
                  Refresh
                </Button>
              )}
            </Box>
          </Box>

          {isRunning && (
            <Box mb={2}>
              <Typography variant="body2" gutterBottom>
                Progress: {snapshot.nodes_reported} of {snapshot.nodes_expected}{' '}
                nodes responded
              </Typography>
              <LinearProgress
                variant="determinate"
                value={getProgressPercentage()}
                sx={{ mb: 1 }}
              />
              <Typography variant="body2" color="text.secondary">
                {Math.round(getProgressPercentage())}% complete
              </Typography>
            </Box>
          )}

          {isFailed && snapshot.error_message && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Error:</strong> {snapshot.error_message}
              </Typography>
            </Alert>
          )}
        </CardContent>
      </StyledCard>

      {/* Data Tables */}
      {isCompleted && (
        <StyledCard>
          <CardContent>
            {snapshot.kind === 'channels' ? (
              <ChannelsTable
                snapshotId={snapshot.snapshot_id}
                authorization={authorization}
                signinSilent={signinSilent}
                onCreateConnectionsSnapshot={handleCreateConnectionsSnapshot}
              />
            ) : (
              <ConnectionsTable
                snapshotId={snapshot.snapshot_id}
                authorization={authorization}
                signinSilent={signinSilent}
              />
            )}
          </CardContent>
        </StyledCard>
      )}

      {isRunning && (
        <StyledCard>
          <CardContent>
            <Typography variant="body1" color="text.secondary" align="center">
              Snapshot is in progress. Data will be available once collection is
              complete.
            </Typography>
          </CardContent>
        </StyledCard>
      )}
    </Box>
  )
}
