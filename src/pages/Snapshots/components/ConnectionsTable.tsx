import React, { useState, useEffect, useCallback } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Box,
  Typography,
  CircularProgress,
  TextField,
  InputAdornment,
  IconButton,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import { styled } from '@mui/material/styles'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
import InfoIcon from '@mui/icons-material/Info'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'

import { globalUrlPrefix } from 'config/url'

const CONNECTIONS_PAGE_SIZE = 1000

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': {
    backgroundColor: theme.palette.action.hover,
  },
  '& .MuiTableCell-root': {
    paddingTop: theme.spacing(0.75),
    paddingBottom: theme.spacing(0.75),
  },
}))

interface ConnectionInfo {
  client: string
  user: string
  node: string
  name: string
  version: string
  transport: string
  protocol: string
  latency: number
  connected_at: number
  headers?: Record<string, string[]>
  metadata?: Record<string, string[]>
  info?: string
  channels?: Record<string, string>
  state?: string
}

interface ConnectionsTableProps {
  snapshotId: string
  authorization: string
  signinSilent: () => void
  filterType?: string
  filterValue?: string
}

export const ConnectionsTable = ({
  snapshotId,
  authorization,
  signinSilent,
  filterType,
  filterValue,
}: ConnectionsTableProps) => {
  const [connections, setConnections] = useState<ConnectionInfo[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [currentCursor, setCurrentCursor] = useState<string>('')
  const [nextCursor, setNextCursor] = useState<string>('')
  const [prevCursors, setPrevCursors] = useState<string[]>([]) // Stack of previous cursors
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [searchApplied, setSearchApplied] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [total, setTotal] = useState<number | null>(null)
  const [selectedConnection, setSelectedConnection] = useState<ConnectionInfo | null>(null)

  const fetchConnections = useCallback(async (cursor?: string, query?: string, reset: boolean = false, direction: 'next' | 'prev' | 'first' = 'first') => {
    try {
      setLoading(true)
      const url = new URL(`${globalUrlPrefix}admin/api/snapshots/${snapshotId}/connections`, window.location.origin)
      url.searchParams.append('limit', CONNECTIONS_PAGE_SIZE.toString())
      
      if (cursor) {
        url.searchParams.append('cursor', cursor)
      }
      if (query) {
        url.searchParams.append('q', query)
      }
      if (filterType && filterValue) {
        url.searchParams.append(filterType, filterValue)
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: authorization,
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          signinSilent()
          return
        }
        if (response.status === 404) {
          setError('Snapshot not found')
          return
        }
        if (response.status === 409) {
          setError('Snapshot not completed yet')
          return
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      // Handle null connections response (might indicate end of data or error)
      if (data.connections === null && direction === 'next') {
        // If we get null on next, there might be no more data
        setNextCursor('')
        setError('')
        setLoading(false)
        return
      }
      
      setConnections(data.connections || [])
      setNextCursor(data.next_cursor || '')
      
      // Update cursor tracking based on direction
      if (direction === 'next') {
        // Always save current position when going next (including empty string for first page)
        setPrevCursors(prev => [...prev, currentCursor])
      } else if (direction === 'prev') {
        setPrevCursors(prev => prev.slice(0, -1))
      } else if (direction === 'first' || reset) {
        setPrevCursors([])
      }
      
      setCurrentCursor(cursor || '')
      
      // Total is only included in first page
      if (data.total !== undefined) {
        setTotal(data.total)
      }
      
      setError('')
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch connections:', error)
      setError('Failed to load connections data')
      setLoading(false)
    }
  }, [snapshotId, authorization, signinSilent, filterType, filterValue])

  useEffect(() => {
    fetchConnections()
  }, [snapshotId, authorization, signinSilent, filterType, filterValue])

  const handleSearch = () => {
    if (searchQuery !== searchApplied) {
      setSearchApplied(searchQuery)
      fetchConnections(undefined, searchQuery, true, 'first')
    }
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setSearchApplied('')
    fetchConnections(undefined, undefined, true, 'first')
  }

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSearch()
    }
  }

  const handleNext = () => {
    if (nextCursor && !loading) {
      fetchConnections(nextCursor, searchApplied, false, 'next')
    }
  }

  const handlePrev = () => {
    if (prevCursors.length > 0 && !loading) {
      const prevCursor = prevCursors[prevCursors.length - 1]
      fetchConnections(prevCursor, searchApplied, false, 'prev')
    }
  }

  const handleTraceConnection = (clientId: string) => {
    // Navigate to tracing page with pre-filled client ID
    const url = `/tracing?client=${encodeURIComponent(clientId)}`
    window.open(url, '_blank')
  }

  const getLatencyColor = (latency: number) => {
    if (latency < 50) return 'success'
    if (latency < 100) return 'warning'
    return 'error'
  }

  const formatConnectedAt = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  const formatChannels = (channels?: Record<string, string>) => {
    if (!channels || Object.keys(channels).length === 0) {
      return 'None'
    }
    const channelNames = Object.keys(channels)
    if (channelNames.length <= 3) {
      return channelNames.join(', ')
    }
    return `${channelNames.slice(0, 3).join(', ')} +${channelNames.length - 3} more`
  }

  const PaginationControls = ({ position }: { position: 'top' | 'bottom' }) => {
    const currentPage = prevCursors.length + 1
    const pageSize = CONNECTIONS_PAGE_SIZE
    const currentPageSize = connections.length
    
    // Calculate range of items being shown
    const startItem = (currentPage - 1) * pageSize + 1
    const endItem = (currentPage - 1) * pageSize + currentPageSize
    
    return (
      <Box display="flex" gap={2} alignItems="center">
        <Typography variant="body2" color="text.secondary">
          {currentPageSize > 0 ? `${startItem.toLocaleString()}-${endItem.toLocaleString()}` : '0'}
          {total !== null && ` of ${total.toLocaleString()}`}
        </Typography>
        <Box display="flex" gap={1} alignItems="center">
          <Button
            size="small"
            startIcon={<NavigateBeforeIcon />}
            onClick={handlePrev}
            disabled={loading || prevCursors.length === 0}
            variant="outlined"
          >
            Previous
          </Button>
          <Button
            size="small"
            endIcon={<NavigateNextIcon />}
            onClick={handleNext}
            disabled={loading || !nextCursor}
            variant="outlined"
          >
            Next
          </Button>
        </Box>
      </Box>
    )
  }

  if (error) {
    return (
      <Alert severity="error">
        {error}
      </Alert>
    )
  }

  return (
    <Box>
      {/* Search and Pagination */}
      <Box mb={2} display="flex" alignItems="center" justifyContent="space-between">
        <Box display="flex" alignItems="center" gap={1}>
          <TextField
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Search connections by user, client, node, or name..."
            variant="outlined"
            size="small"
            sx={{ minWidth: 400 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  {searchApplied && (
                    <IconButton size="small" onClick={handleClearSearch}>
                      <ClearIcon />
                    </IconButton>
                  )}
                  <IconButton size="small" onClick={handleSearch} disabled={loading}>
                    <SearchIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          {total !== null && (
            <Typography variant="body2" color="text.secondary">
              {searchApplied ? 'Filtered results' : `${total.toLocaleString()} total connections`}
            </Typography>
          )}
        </Box>
        <PaginationControls position="top" />
      </Box>

      {/* Table */}
      {loading && connections.length === 0 ? (
        <Box textAlign="center" py={4}>
          <CircularProgress />
          <Typography variant="body2" sx={{ mt: 2 }}>
            Loading connections...
          </Typography>
        </Box>
      ) : connections.length === 0 ? (
        <Box textAlign="center" py={4}>
          <Typography variant="body2" color="text.secondary">
            No connections found.
          </Typography>
        </Box>
      ) : (
        <>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Client ID</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Client Name</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell>Transport</TableCell>
                  <TableCell>Latency</TableCell>
                  <TableCell sx={{ width: '1%', whiteSpace: 'nowrap', padding: 0 }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {connections.map((connection) => (
                  <StyledTableRow key={connection.client}>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {connection.client}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {connection.user || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {connection.name || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {connection.version || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={connection.transport || 'unknown'} 
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {connection.latency < 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          n/a
                        </Typography>
                      ) : (
                        <Chip
                          label={`${connection.latency}ms`}
                          size="small"
                          color={getLatencyColor(connection.latency) as any}
                        />
                      )}
                    </TableCell>
                    <TableCell sx={{ width: '1%', whiteSpace: 'nowrap', padding: '6px' }}>
                      <Box display="flex" gap={1}>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<InfoIcon />}
                          onClick={() => setSelectedConnection(connection)}
                        >
                          Details
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<OpenInNewIcon />}
                          onClick={() => handleTraceConnection(connection.client)}
                        >
                          Trace
                        </Button>
                      </Box>
                    </TableCell>
                  </StyledTableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box display="flex" justifyContent="flex-end" mt={2}>
            <PaginationControls position="bottom" />
          </Box>
        </>
      )}

      {/* Connection Details Dialog */}
      <Dialog
        open={!!selectedConnection}
        onClose={() => setSelectedConnection(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Connection Details</DialogTitle>
        <DialogContent>
          {selectedConnection && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Basic Information
              </Typography>
              <Box mb={2}>
                <Typography variant="body2"><strong>Client ID:</strong> {selectedConnection.client}</Typography>
                <Typography variant="body2"><strong>User:</strong> {selectedConnection.user || 'None'}</Typography>
                <Typography variant="body2"><strong>Node:</strong> {selectedConnection.node}</Typography>
                <Typography variant="body2"><strong>Client Name:</strong> {selectedConnection.name || 'Unknown'}</Typography>
                <Typography variant="body2"><strong>Version:</strong> {selectedConnection.version || 'Unknown'}</Typography>
                <Typography variant="body2"><strong>Transport:</strong> {selectedConnection.transport}</Typography>
                <Typography variant="body2"><strong>Protocol:</strong> {selectedConnection.protocol || 'Unknown'}</Typography>
                <Typography variant="body2"><strong>Latency:</strong> {selectedConnection.latency}ms</Typography>
                <Typography variant="body2"><strong>Connected At:</strong> {formatConnectedAt(selectedConnection.connected_at)}</Typography>
              </Box>

              {selectedConnection.channels && Object.keys(selectedConnection.channels).length > 0 && (
                <Box mb={2}>
                  <Typography variant="h6" gutterBottom>
                    Subscribed Channels ({Object.keys(selectedConnection.channels).length})
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {Object.keys(selectedConnection.channels).map((channel) => (
                      <Chip 
                        key={channel} 
                        label={channel} 
                        size="small" 
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {selectedConnection.info && (
                <Box mb={2}>
                  <Typography variant="h6" gutterBottom>
                    Additional Info
                  </Typography>
                  <Typography variant="body2" component="pre" sx={{ 
                    whiteSpace: 'pre-wrap', 
                    backgroundColor: '#f5f5f5', 
                    padding: 1, 
                    borderRadius: 1 
                  }}>
                    {selectedConnection.info}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedConnection(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}