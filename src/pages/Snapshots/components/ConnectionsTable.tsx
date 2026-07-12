import React, {
  useState,
  useEffect,
  useCallback,
  useContext,
  useRef,
} from 'react'
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
  Card,
  CardContent,
  Divider,
  Avatar,
} from '@mui/material'
import { styled } from '@mui/material/styles'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
import InfoIcon from '@mui/icons-material/Info'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import PersonIcon from '@mui/icons-material/Person'
import DevicesIcon from '@mui/icons-material/Devices'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import SellIcon from '@mui/icons-material/Sell'

import { useAdminApi } from 'api/adminApi'
import { ShellContext } from 'contexts/ShellContext'

const CONNECTIONS_PAGE_SIZE = 500

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
  labels?: Record<string, string>
  info?: string
  channels?: Record<string, string>
  state?: string
}

interface ConnectionsTableProps {
  snapshotId: string
  authorization: string
  signinSilent: () => void
}

export const ConnectionsTable = ({
  snapshotId,
  authorization,
  signinSilent,
}: ConnectionsTableProps) => {
  const { showAlert } = useContext(ShellContext)
  const { command, rawRequest, handleError } = useAdminApi({
    authorization,
    signinSilent,
  })
  const [connections, setConnections] = useState<ConnectionInfo[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  // In-flight guard for the reconnect/disconnect action buttons so repeated
  // clicks don't fire duplicate disconnect commands.
  const [actionInFlight, setActionInFlight] = useState<boolean>(false)
  // fetchConnections is memoized without the cursor in its deps, so a plain
  // state read inside it would be the stale initial ''. Track the current cursor
  // in a ref so the "next" branch pushes the real page being left onto the stack.
  const currentCursorRef = useRef<string>('')
  const [nextCursor, setNextCursor] = useState<string>('')
  const [prevCursors, setPrevCursors] = useState<string[]>([]) // Stack of previous cursors
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [searchApplied, setSearchApplied] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [total, setTotal] = useState<number | null>(null)
  const [selectedConnection, setSelectedConnection] =
    useState<ConnectionInfo | null>(null)
  const [connectionTokenExpanded, setConnectionTokenExpanded] =
    useState<boolean>(false)
  const [subscriptionTokensExpanded, setSubscriptionTokensExpanded] =
    useState<boolean>(false)
  const [channelsExpanded, setChannelsExpanded] = useState<boolean>(false)
  const [metaExpanded, setMetaExpanded] = useState<boolean>(false)

  const fetchConnections = useCallback(
    async (
      cursor?: string,
      query?: string,
      reset: boolean = false,
      direction: 'next' | 'prev' | 'first' = 'first'
    ) => {
      try {
        setLoading(true)
        const params = new URLSearchParams({
          limit: CONNECTIONS_PAGE_SIZE.toString(),
        })
        if (cursor) {
          params.append('cursor', cursor)
        }
        if (query) {
          params.append('q', query)
        }

        const response = await rawRequest(
          `admin/api/snapshots/${snapshotId}/connections?${params.toString()}`
        )

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
          setPrevCursors(prev => [...prev, currentCursorRef.current])
        } else if (direction === 'prev') {
          setPrevCursors(prev => prev.slice(0, -1))
        } else if (direction === 'first' || reset) {
          setPrevCursors([])
        }

        currentCursorRef.current = cursor || ''

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
    },
    [snapshotId, rawRequest, signinSilent]
  )

  useEffect(() => {
    fetchConnections()
  }, [snapshotId, rawRequest, signinSilent]) // eslint-disable-line react-hooks/exhaustive-deps

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
    // Navigate to tracing page with pre-filled client ID using hash routing
    const url = `#/tracing?client_id=${encodeURIComponent(clientId)}`
    window.open(url, '_blank')
  }

  const getLatencyColor = (latency: number) => {
    if (latency < 50) return 'success'
    if (latency < 100) return 'warning'
    return 'error'
  }

  const formatConnectedAt = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  interface ConnectionState {
    channels?: Record<string, ChannelContext>
    connection_token?: ConnectionTokenInfo
    subscription_tokens?: Record<string, SubscriptionTokenInfo>
    meta?: any
  }

  interface ChannelContext {
    source?: number
  }

  interface ConnectionTokenInfo {
    uid?: string
    issued_at?: number
  }

  interface SubscriptionTokenInfo {
    uid?: string
    issued_at?: number
  }

  const parseConnectionState = (stateJson?: string): ConnectionState | null => {
    if (!stateJson) return null
    try {
      return JSON.parse(stateJson) as ConnectionState
    } catch (error) {
      console.error('Failed to parse connection state:', error)
      return null
    }
  }

  const getSourceName = (source?: number): string => {
    switch (source) {
      case 0:
        return 'unknown'
      case 1:
        return 'connection token'
      case 2:
        return 'connect proxy'
      case 3:
        return 'subscription token'
      case 4:
        return 'subscribe proxy'
      case 5:
        return 'user limited'
      case 6:
        return 'client allowed'
      case 7:
        return 'client insecure'
      case 8:
        return 'uni connect'
      case 9:
        return 'user personal'
      case 10:
        return 'server api'
      case 11:
        return 'connection cap'
      case 12:
        return 'expression'
      case 13:
        return 'stream proxy'
      default:
        return `unknown (${source})`
    }
  }

  const getChannelSubscriptions = (connection: ConnectionInfo) => {
    const state = parseConnectionState(connection.state)

    if (state?.channels && Object.keys(state.channels).length > 0) {
      // Use real channels from state
      return Object.entries(state.channels).map(([channel, context]) => ({
        channel,
        source: context.source,
        sourceName: getSourceName(context.source),
      }))
    }

    // Fallback to old channels field if state is not available
    if (connection.channels && Object.keys(connection.channels).length > 0) {
      return Object.keys(connection.channels).map((channel, index) => ({
        channel,
        source: undefined,
        sourceName: undefined,
      }))
    }

    return []
  }

  const sendApiRequest = async (method: string, params: any) => {
    if (actionInFlight) return
    setActionInFlight(true)
    try {
      const data = await command(method, params)

      if (data.error) {
        showAlert(`API Error: ${data.error.message || 'Unknown error'}`, {
          severity: 'error',
        })
        return
      }

      showAlert(`Request successfully sent`, { severity: 'success' })
    } catch (error) {
      handleError(error)
    } finally {
      setActionInFlight(false)
    }
  }

  const handleReconnect = (connection: ConnectionInfo) => {
    sendApiRequest('disconnect', {
      user: connection.user,
      client: connection.client,
      disconnect: {
        code: 3011,
        reason: 'force reconnect',
      },
    })
  }

  const handleDisconnect = (connection: ConnectionInfo) => {
    sendApiRequest('disconnect', {
      user: connection.user,
      client: connection.client,
      disconnect: {
        code: 3503,
        reason: 'force disconnect',
      },
    })
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
          {currentPageSize > 0
            ? `${startItem.toLocaleString()}-${endItem.toLocaleString()}`
            : '0'}
          {total !== null && ` of ${total.toLocaleString()}`}
        </Typography>
        <Box display="flex" gap={1} alignItems="center">
          <Button
            size="small"
            startIcon={<NavigateBeforeIcon />}
            onClick={handlePrev}
            disabled={loading || prevCursors.length === 0}
            variant="tonal"
            color="inherit"
          >
            Previous
          </Button>
          <Button
            size="small"
            endIcon={<NavigateNextIcon />}
            onClick={handleNext}
            disabled={loading || !nextCursor}
            variant="tonal"
            color="inherit"
          >
            Next
          </Button>
        </Box>
      </Box>
    )
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>
  }

  return (
    <Box>
      {/* Search and Pagination */}
      <Box
        mb={2}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
      >
        <Box display="flex" alignItems="center" gap={1}>
          <TextField
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
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
                  <IconButton
                    size="small"
                    onClick={handleSearch}
                    disabled={loading}
                  >
                    <SearchIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          {total !== null && (
            <Typography variant="body2" color="text.secondary">
              {searchApplied
                ? 'Filtered results'
                : `${total.toLocaleString()} total connections`}
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
            No connections found. Note: For older snapshots, this may occur due
            to snapshot data expiration.
          </Typography>
        </Box>
      ) : (
        <>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Client ID</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Client Name</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell>Transport</TableCell>
                  <TableCell>Latency</TableCell>
                  <TableCell>Labels</TableCell>
                  <TableCell
                    sx={{ width: '1%', whiteSpace: 'nowrap', padding: 0 }}
                  ></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {connections.map(connection => (
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
                    <TableCell>
                      {connection.labels &&
                      Object.keys(connection.labels).length > 0 ? (
                        <Box
                          display="flex"
                          flexWrap="wrap"
                          gap={0.5}
                          sx={{ maxWidth: 260 }}
                        >
                          {Object.entries(connection.labels).map(([k, v]) => (
                            <Chip
                              key={k}
                              label={`${k}: ${v}`}
                              size="small"
                              variant="outlined"
                              color="primary"
                            />
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          -
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell
                      sx={{ width: '1%', whiteSpace: 'nowrap', padding: '6px' }}
                    >
                      <Box display="flex" gap={1}>
                        <Button
                          variant="tonal"
                          color="info"
                          size="small"
                          startIcon={<InfoIcon />}
                          onClick={() => setSelectedConnection(connection)}
                        >
                          Details
                        </Button>
                        <Button
                          variant="tonal"
                          color="info"
                          size="small"
                          startIcon={<OpenInNewIcon />}
                          onClick={() =>
                            handleTraceConnection(connection.client)
                          }
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
        {selectedConnection && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box display="flex" alignItems="center" gap={2}>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <PersonIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" component="div">
                    Connection Details
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontFamily: 'monospace' }}
                  >
                    {selectedConnection.client}
                  </Typography>
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Box display="flex" flexDirection="column" gap={2}>
                {/* Top Row - Basic Info and Connection Cards */}
                <Box
                  display="flex"
                  gap={2}
                  sx={{ flexWrap: { xs: 'wrap', md: 'nowrap' } }}
                >
                  {/* Basic Info Card */}
                  <Box sx={{ flex: 1, minWidth: { xs: '100%', md: '300px' } }}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent>
                        <Box display="flex" alignItems="center" gap={1} mb={2}>
                          <PersonIcon color="primary" />
                          <Typography variant="h6">
                            Basic Information
                          </Typography>
                        </Box>
                        <Box display="flex" flexDirection="column" gap={1}>
                          <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                          >
                            <Typography variant="body2" color="text.secondary">
                              User:
                            </Typography>
                            <Typography variant="body2" fontWeight="medium">
                              {selectedConnection.user || 'Anonymous'}
                            </Typography>
                          </Box>
                          <Divider />
                          <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                          >
                            <Typography variant="body2" color="text.secondary">
                              Node:
                            </Typography>
                            <Typography variant="body2" fontWeight="medium">
                              {selectedConnection.node}
                            </Typography>
                          </Box>
                          <Divider />
                          <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                          >
                            <Typography variant="body2" color="text.secondary">
                              Client Name:
                            </Typography>
                            <Typography variant="body2" fontWeight="medium">
                              {selectedConnection.name || 'Unknown'}
                            </Typography>
                          </Box>
                          <Divider />
                          <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                          >
                            <Typography variant="body2" color="text.secondary">
                              Version:
                            </Typography>
                            <Typography variant="body2" fontWeight="medium">
                              {selectedConnection.version || 'Unknown'}
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Box>

                  {/* Connection Info Card */}
                  <Box sx={{ flex: 1, minWidth: { xs: '100%', md: '300px' } }}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent>
                        <Box display="flex" alignItems="center" gap={1} mb={2}>
                          <DevicesIcon color="primary" />
                          <Typography variant="h6">Connection</Typography>
                        </Box>
                        <Box display="flex" flexDirection="column" gap={1}>
                          <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                          >
                            <Typography variant="body2" color="text.secondary">
                              Transport:
                            </Typography>
                            <Typography variant="body2" fontWeight="medium">
                              {selectedConnection.transport}
                            </Typography>
                          </Box>
                          <Divider />
                          <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                          >
                            <Typography variant="body2" color="text.secondary">
                              Protocol:
                            </Typography>
                            <Typography variant="body2" fontWeight="medium">
                              {selectedConnection.protocol || 'Unknown'}
                            </Typography>
                          </Box>
                          <Divider />
                          <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                          >
                            <Typography variant="body2" color="text.secondary">
                              Latency:
                            </Typography>
                            {selectedConnection.latency < 0 ? (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                n/a
                              </Typography>
                            ) : (
                              <Chip
                                label={`${selectedConnection.latency}ms`}
                                size="small"
                                color={
                                  getLatencyColor(
                                    selectedConnection.latency
                                  ) as any
                                }
                              />
                            )}
                          </Box>
                          <Divider />
                          <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                          >
                            <Typography variant="body2" color="text.secondary">
                              Connected:
                            </Typography>
                            <Box display="flex" alignItems="center" gap={1}>
                              <AccessTimeIcon fontSize="small" color="action" />
                              <Typography variant="body2" fontWeight="medium">
                                {formatConnectedAt(
                                  selectedConnection.connected_at
                                )}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Box>
                </Box>

                {/* Labels Card */}
                {selectedConnection.labels &&
                  Object.keys(selectedConnection.labels).length > 0 && (
                    <Card variant="outlined">
                      <CardContent>
                        <Box display="flex" alignItems="center" gap={1} mb={2}>
                          <SellIcon color="primary" />
                          <Typography variant="h6">Labels</Typography>
                        </Box>
                        <Box display="flex" flexWrap="wrap" gap={1}>
                          {Object.entries(selectedConnection.labels).map(
                            ([k, v]) => (
                              <Chip
                                key={k}
                                label={`${k}: ${v}`}
                                size="small"
                                variant="outlined"
                                color="primary"
                              />
                            )
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  )}

                {/* Channels Card */}
                {(() => {
                  const channels = getChannelSubscriptions(selectedConnection)
                  return channels.length > 0 ? (
                    <Card variant="outlined">
                      <CardContent>
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          onClick={() => setChannelsExpanded(!channelsExpanded)}
                          sx={{ cursor: 'pointer', userSelect: 'none' }}
                        >
                          <Typography variant="subtitle1">
                            Subscriptions ({channels.length})
                          </Typography>
                          {channelsExpanded ? (
                            <ExpandLessIcon />
                          ) : (
                            <ExpandMoreIcon />
                          )}
                        </Box>
                        {channelsExpanded && (
                          <Box
                            display="flex"
                            flexDirection="column"
                            gap={1}
                            sx={{ mt: 2 }}
                          >
                            {channels.map(({ channel, sourceName }) => (
                              <Box
                                key={channel}
                                display="flex"
                                justifyContent="space-between"
                                alignItems="center"
                                sx={{
                                  py: 1,
                                  px: 1.5,
                                  backgroundColor: 'background.default',
                                  borderRadius: 1,
                                  border: '1px solid',
                                  borderColor: 'divider',
                                }}
                              >
                                <Box display="flex" alignItems="center" gap={1}>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontFamily: 'monospace',
                                      fontWeight: 'medium',
                                    }}
                                  >
                                    {channel}
                                  </Typography>
                                  {sourceName && (
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      sx={{
                                        fontSize: '0.75rem',
                                        fontStyle: 'italic',
                                      }}
                                    >
                                      via {sourceName}
                                    </Typography>
                                  )}
                                </Box>
                                <Box display="flex" alignItems="center" gap={1}>
                                  {/* <AccessTimeIcon fontSize="small" color="action" /> */}
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                  >
                                    {/* {subscribedAt.toLocaleString()} */}
                                  </Typography>
                                </Box>
                              </Box>
                            ))}
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  ) : null
                })()}

                {/* Connection Token Card */}
                {(() => {
                  const state = parseConnectionState(selectedConnection.state)
                  return state?.connection_token ? (
                    <Card variant="outlined">
                      <CardContent>
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          onClick={() =>
                            setConnectionTokenExpanded(!connectionTokenExpanded)
                          }
                          sx={{ cursor: 'pointer', userSelect: 'none' }}
                        >
                          <Typography variant="subtitle1">
                            Connection Token
                          </Typography>
                          {connectionTokenExpanded ? (
                            <ExpandLessIcon />
                          ) : (
                            <ExpandMoreIcon />
                          )}
                        </Box>
                        {connectionTokenExpanded && (
                          <Box
                            display="flex"
                            flexDirection="column"
                            gap={1}
                            sx={{ mt: 2 }}
                          >
                            <Box
                              display="flex"
                              justifyContent="space-between"
                              alignItems="center"
                            >
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                UID:
                              </Typography>
                              <Typography
                                variant="body2"
                                fontWeight="medium"
                                sx={{ fontFamily: 'monospace' }}
                              >
                                {state.connection_token.uid || 'N/A'}
                              </Typography>
                            </Box>
                            <Box
                              display="flex"
                              justifyContent="space-between"
                              alignItems="center"
                            >
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                Issued At:
                              </Typography>
                              <Typography variant="body2" fontWeight="medium">
                                {state.connection_token.issued_at
                                  ? new Date(
                                      state.connection_token.issued_at * 1000
                                    ).toLocaleString()
                                  : 'N/A'}
                              </Typography>
                            </Box>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  ) : null
                })()}

                {/* Subscription Tokens Card */}
                {(() => {
                  const state = parseConnectionState(selectedConnection.state)
                  return state?.subscription_tokens &&
                    Object.keys(state.subscription_tokens).length > 0 ? (
                    <Card variant="outlined">
                      <CardContent>
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          onClick={() =>
                            setSubscriptionTokensExpanded(
                              !subscriptionTokensExpanded
                            )
                          }
                          sx={{ cursor: 'pointer', userSelect: 'none' }}
                        >
                          <Typography variant="subtitle1">
                            Subscription Tokens (
                            {Object.keys(state.subscription_tokens).length})
                          </Typography>
                          {subscriptionTokensExpanded ? (
                            <ExpandLessIcon />
                          ) : (
                            <ExpandMoreIcon />
                          )}
                        </Box>
                        {subscriptionTokensExpanded && (
                          <Box
                            display="flex"
                            flexDirection="column"
                            gap={1}
                            sx={{ mt: 2 }}
                          >
                            {Object.entries(state.subscription_tokens).map(
                              ([channel, tokenInfo], index) => (
                                <Box key={channel}>
                                  {index > 0 && <Divider sx={{ my: 1 }} />}
                                  <Typography
                                    variant="body2"
                                    fontWeight="medium"
                                    sx={{ fontFamily: 'monospace', mb: 1 }}
                                  >
                                    {channel}
                                  </Typography>
                                  <Box
                                    display="flex"
                                    flexDirection="column"
                                    gap={0.5}
                                    sx={{ pl: 2 }}
                                  >
                                    <Box
                                      display="flex"
                                      justifyContent="space-between"
                                      alignItems="center"
                                    >
                                      <Typography
                                        variant="body2"
                                        color="text.secondary"
                                      >
                                        UID:
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        fontWeight="medium"
                                        sx={{ fontFamily: 'monospace' }}
                                      >
                                        {tokenInfo.uid || 'N/A'}
                                      </Typography>
                                    </Box>
                                    <Box
                                      display="flex"
                                      justifyContent="space-between"
                                      alignItems="center"
                                    >
                                      <Typography
                                        variant="body2"
                                        color="text.secondary"
                                      >
                                        Issued At:
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        fontWeight="medium"
                                      >
                                        {tokenInfo.issued_at
                                          ? new Date(
                                              tokenInfo.issued_at * 1000
                                            ).toLocaleString()
                                          : 'N/A'}
                                      </Typography>
                                    </Box>
                                  </Box>
                                </Box>
                              )
                            )}
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  ) : null
                })()}

                {/* Meta Field Card */}
                {(() => {
                  const state = parseConnectionState(selectedConnection.state)
                  return state?.meta ? (
                    <Card variant="outlined">
                      <CardContent>
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          onClick={() => setMetaExpanded(!metaExpanded)}
                          sx={{ cursor: 'pointer', userSelect: 'none' }}
                        >
                          <Typography variant="subtitle1">Meta Data</Typography>
                          {metaExpanded ? (
                            <ExpandLessIcon />
                          ) : (
                            <ExpandMoreIcon />
                          )}
                        </Box>
                        {metaExpanded && (
                          <Typography
                            variant="body2"
                            component="pre"
                            sx={{
                              whiteSpace: 'pre-wrap',
                              backgroundColor: 'background.default',
                              padding: 2,
                              borderRadius: 1,
                              border: '1px solid',
                              borderColor: 'divider',
                              fontFamily: 'monospace',
                              fontSize: '0.875rem',
                              mt: 2,
                            }}
                          >
                            {JSON.stringify(state.meta, null, 2)}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  ) : null
                })()}

                {/* Additional Info Card */}
                {selectedConnection.info && (
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Additional Information
                      </Typography>
                      <Typography
                        variant="body2"
                        component="pre"
                        sx={{
                          whiteSpace: 'pre-wrap',
                          backgroundColor: 'background.default',
                          padding: 2,
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'divider',
                          fontFamily: 'monospace',
                          fontSize: '0.875rem',
                        }}
                      >
                        {selectedConnection.info}
                      </Typography>
                    </CardContent>
                  </Card>
                )}
              </Box>
            </DialogContent>
            <DialogActions
              sx={{ justifyContent: 'space-between', px: 3, py: 2 }}
            >
              <Box display="flex" gap={1}>
                <Button
                  variant="tonal"
                  startIcon={<LinkIcon />}
                  onClick={() => handleReconnect(selectedConnection)}
                  color="warning"
                  disabled={actionInFlight}
                >
                  Reconnect
                </Button>
                <Button
                  variant="tonal"
                  startIcon={<LinkOffIcon />}
                  onClick={() => handleDisconnect(selectedConnection)}
                  color="error"
                  disabled={actionInFlight}
                >
                  Disconnect
                </Button>
              </Box>
              <Button
                variant="text"
                onClick={() => setSelectedConnection(null)}
              >
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  )
}
