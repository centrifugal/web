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
} from '@mui/material'
import { styled } from '@mui/material/styles'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
import CameraAltIcon from '@mui/icons-material/CameraAlt'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'

import { globalUrlPrefix } from 'config/url'

const CHANNELS_PAGE_SIZE = 500

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': {
    backgroundColor: theme.palette.action.hover,
  },
  '& .MuiTableCell-root': {
    paddingTop: theme.spacing(0.75),
    paddingBottom: theme.spacing(0.75),
  },
}))

interface ChannelInfo {
  channel: string
  subscribers: number
  nodes_seen: number
}

interface ChannelsTableProps {
  snapshotId: string
  authorization: string
  signinSilent: () => void
  onCreateConnectionsSnapshot: (channelName: string) => void
}

export const ChannelsTable = ({
  snapshotId,
  authorization,
  signinSilent,
  onCreateConnectionsSnapshot,
}: ChannelsTableProps) => {
  const [channels, setChannels] = useState<ChannelInfo[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [currentCursor, setCurrentCursor] = useState<string>('')
  const [nextCursor, setNextCursor] = useState<string>('')
  const [prevCursors, setPrevCursors] = useState<string[]>([]) // Stack of previous cursors
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [searchApplied, setSearchApplied] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [total, setTotal] = useState<number | null>(null)

  const fetchChannels = useCallback(async (cursor?: string, query?: string, reset: boolean = false, direction: 'next' | 'prev' | 'first' = 'first') => {
    try {
      setLoading(true)
      const url = new URL(`${globalUrlPrefix}admin/api/snapshots/${snapshotId}/channels`, window.location.origin)
      url.searchParams.append('limit', CHANNELS_PAGE_SIZE.toString())

      if (cursor) {
        url.searchParams.append('cursor', cursor)
      }
      if (query) {
        url.searchParams.append('q', query)
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
      
      // Handle null channels response (might indicate end of data)
      if (data.channels === null) {
        // If we get null, there's no more data available
        setChannels([])
        setNextCursor('')
        setError('')
        setLoading(false)
        return
      }
      
      setChannels(data.channels || [])
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
      console.error('Failed to fetch channels:', error)
      setError('Failed to load channels data')
      setLoading(false)
    }
  }, [snapshotId, authorization, signinSilent]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchChannels()
  }, [snapshotId, authorization, signinSilent]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => {
    if (searchQuery !== searchApplied) {
      setSearchApplied(searchQuery)
      fetchChannels(undefined, searchQuery, true, 'first')
    }
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setSearchApplied('')
    fetchChannels(undefined, undefined, true, 'first')
  }

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSearch()
    }
  }

  const handleNext = () => {
    if (nextCursor && !loading) {
      fetchChannels(nextCursor, searchApplied, false, 'next')
    }
  }

  const handlePrev = () => {
    if (prevCursors.length > 0 && !loading) {
      const prevCursor = prevCursors[prevCursors.length - 1]
      fetchChannels(prevCursor, searchApplied, false, 'prev')
    }
  }

  const handleTraceChannel = (channelName: string) => {
    // Navigate to tracing page with pre-filled channel using hash routing
    const url = `#/tracing?channel=${encodeURIComponent(channelName)}`
    window.open(url, '_blank')
  }

  const PaginationControls = ({ position }: { position: 'top' | 'bottom' }) => {
    const currentPage = prevCursors.length + 1
    const pageSize = CHANNELS_PAGE_SIZE
    const currentPageSize = channels.length
    
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
            placeholder="Search channels..."
            variant="outlined"
            size="small"
            sx={{ minWidth: 300 }}
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
              {searchApplied ? 'Filtered results' : `${total.toLocaleString()} total channels`}
            </Typography>
          )}
        </Box>
        <PaginationControls position="top" />
      </Box>

      {/* Table */}
      {loading && channels.length === 0 ? (
        <Box textAlign="center" py={4}>
          <CircularProgress />
          <Typography variant="body2" sx={{ mt: 2 }}>
            Loading channels...
          </Typography>
        </Box>
      ) : channels.length === 0 ? (
        <Box textAlign="center" py={4}>
          <Typography variant="body2" color="text.secondary">
            No channels found.
          </Typography>
        </Box>
      ) : (
        <>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Channel</TableCell>
                  <TableCell align="right">Subscribers</TableCell>
                  <TableCell align="right">Nodes</TableCell>
                  <TableCell sx={{ width: '1%', whiteSpace: 'nowrap', padding: 0 }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {channels.map((channel) => (
                  <StyledTableRow key={channel.channel}>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {channel.channel}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        {channel.subscribers.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        {channel.nodes_seen}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ width: '1%', whiteSpace: 'nowrap', padding: '6px' }}>
                      <Box display="flex" gap={1}>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<CameraAltIcon />}
                          onClick={() => onCreateConnectionsSnapshot(channel.channel)}
                        >
                          Snapshot subscribers
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<OpenInNewIcon />}
                          onClick={() => handleTraceChannel(channel.channel)}
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
    </Box>
  )
}