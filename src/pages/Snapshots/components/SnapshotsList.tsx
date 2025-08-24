import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  Box,
  Typography,
  CircularProgress,
} from '@mui/material'
import { styled } from '@mui/material/styles'
import VisibilityIcon from '@mui/icons-material/Visibility'

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': {
    backgroundColor: theme.palette.action.hover,
  },
  '& .MuiTableCell-root': {
    paddingTop: theme.spacing(0.75),
    paddingBottom: theme.spacing(0.75),
  },
}))

interface Snapshot {
  snapshot_id: string
  kind: string
  status: string
  filter: any
  created_at: string
  rows_inserted: number
  requested_by: string
}

interface SnapshotsListProps {
  snapshots: Snapshot[]
  loading: boolean
  nextCursor: string
  onLoadMore: () => void
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
  if (kind === 'channels' && filter.channels?.pattern) {
    return filter.channels.pattern
  }
  if (kind === 'connections') {
    if (filter.connections?.user) {
      return `user: ${filter.connections.user}`
    }
    if (filter.connections?.channel) {
      return `channel: ${filter.connections.channel}`
    }
  }
  return JSON.stringify(filter)
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMins = Math.floor(diffMs / (1000 * 60))

  if (diffMins < 1) {
    return 'just now'
  } else if (diffMins < 60) {
    return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  } else {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }
}

export const SnapshotsList = ({ 
  snapshots, 
  loading, 
  nextCursor, 
  onLoadMore 
}: SnapshotsListProps) => {
  const navigate = useNavigate()

  const handleViewSnapshot = (snapshotId: string) => {
    navigate(`/snapshots/${snapshotId}`)
  }

  if (snapshots.length === 0 && !loading) {
    return (
      <Box textAlign="center" py={4}>
        <Typography variant="body1" color="text.secondary">
          No snapshots found. Create your first snapshot to get started.
        </Typography>
      </Box>
    )
  }

  return (
    <>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>Filter</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Rows</TableCell>
              <TableCell sx={{ width: '1%', whiteSpace: 'nowrap', padding: 0 }}></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {snapshots.map((snapshot) => (
              <StyledTableRow key={snapshot.snapshot_id}>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {snapshot.kind.charAt(0).toUpperCase() + snapshot.kind.slice(1)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ maxWidth: 200 }}>
                    {formatFilter(snapshot.filter, snapshot.kind)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={snapshot.status.charAt(0).toUpperCase() + snapshot.status.slice(1)}
                    color={getStatusColor(snapshot.status) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <span title={new Date(snapshot.created_at).toLocaleString()}>
                    <Typography variant="body2">
                      {formatDate(snapshot.created_at)}
                    </Typography>
                  </span>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {snapshot.status === 'completed' ? snapshot.rows_inserted.toLocaleString() : '-'}
                  </Typography>
                </TableCell>
                <TableCell sx={{ width: '1%', whiteSpace: 'nowrap', padding: '6px' }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<VisibilityIcon />}
                    onClick={() => handleViewSnapshot(snapshot.snapshot_id)}
                  >
                    View
                  </Button>
                </TableCell>
              </StyledTableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {nextCursor && (
        <Box textAlign="center" mt={2}>
          <Button
            variant="outlined"
            onClick={onLoadMore}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : undefined}
          >
            {loading ? 'Loading...' : 'Load More'}
          </Button>
        </Box>
      )}
    </>
  )
}