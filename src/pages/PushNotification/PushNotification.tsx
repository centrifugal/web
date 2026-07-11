import { useEffect, useContext, useState, useCallback, ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { styled } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import { Stack, TableFooter, TablePagination, Typography } from '@mui/material'
import CircularProgress from '@mui/material/CircularProgress'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Tooltip,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import SettingsIcon from '@mui/icons-material/Settings'
import NotificationsIcon from '@mui/icons-material/Notifications'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import { TextField } from '@mui/material'
import Autocomplete from '@mui/material/Autocomplete'

import { useAdminApi } from 'api/adminApi'
import { ShellContext } from 'contexts/ShellContext'

import { ConfirmDialog } from '../../components/ConfirmDialog'
import { CopyButton } from '../../components/CopyButton'
import { EmptyState } from '../../components/EmptyState'

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': {
    backgroundColor: theme.palette.action.hover,
  },
}))

interface PushNotificationProps {
  signinSilent: () => void
  authorization: string
  edition: 'oss' | 'pro'
}

function createData(
  deviceId: string,
  token: string,
  provider: string,
  platform: string,
  user: string,
  timezone: string,
  locale: string,
  created_at: number,
  updated_at: number,
  meta: any,
  topics: any,
  labels: any,
  scores: any
) {
  return {
    deviceId,
    token,
    provider,
    platform,
    user,
    timezone,
    locale,
    created_at,
    updated_at,
    meta,
    topics,
    labels,
    scores,
  }
}

// InlineDetail renders a compact "label: value" pair that flows inline with
// others (used for short scalar attributes to save vertical space).
const InlineDetail = ({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) => (
  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'baseline' }}>
    <Typography variant="body2" color="text.secondary">
      {label}:
    </Typography>
    <Typography variant="body2">{value}</Typography>
  </Box>
)

// DetailRow renders one label/value pair as two cells of a parent CSS grid.
const DetailRow = ({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) => (
  <>
    <Typography variant="body2" color="text.secondary">
      {label}
    </Typography>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
      {children}
    </Box>
  </>
)

export function PushNotification({
  signinSilent,
  authorization,
  edition,
}: PushNotificationProps) {
  const savedLimit = localStorage.getItem('push_notifications.devices.limit')
  const [searchParams] = useSearchParams()
  const { setTitle, showAlert } = useContext(ShellContext)
  const { command, handleError } = useAdminApi({ authorization, signinSilent })
  const [nodes, setNodes] = useState<any[]>([])
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [limit, setLimit] = useState(savedLimit ? parseInt(savedLimit, 10) : 10)
  const [cursor, setCursor] = useState('')
  const [nextCursor, setNextCursor] = useState('')
  const [totalCount, setTotalCount] = useState(0)
  const [cursorMap, setCursorMap] = useState(new Map<number, string>())
  const [selectedItem, setSelectedItem] = useState<any>(null)

  const [topicNames, setTopicNames] = useState<any[]>([])
  // Pre-fill the user filter when deep-linked from the Inspector (?user=...).
  const [userIds, setUserIds] = useState<any[]>(() => {
    const u = searchParams.get('user')
    return u ? [u] : []
  })

  const [pushTitle, setPushTitle] = useState('')
  const [pushBody, setPushBody] = useState('')

  const [pushDialogOpen, setPushDialogOpen] = useState(false)
  const [
    isPushToFilteredConfirmDiaglogOpen,
    setIsPushToFilteredConfirmDiaglogOpen,
  ] = useState(false)

  const [
    isPushToDeviceConfirmDiaglogOpen,
    setIsPushToDeviceConfirmDiaglogOpen,
  ] = useState(false)

  const handlePushToFilteredCancel = () => {
    setIsPushToFilteredConfirmDiaglogOpen(false)
  }

  const handlePushToFilteredConfirm = async () => {
    // Await the send before closing so the ConfirmDialog keeps its Confirm
    // button disabled for the duration and a double-click can't send twice.
    await sendPush(getDeviceFilter())
    setIsPushToFilteredConfirmDiaglogOpen(false)
    setPushTitle('')
    setPushBody('')
    setPushDialogOpen(false)
  }

  const isPushFilled = function () {
    return pushTitle !== '' && pushBody !== ''
  }

  const handlePushToFilteredSubmit = () => {
    if (!isPushFilled()) {
      showAlert('Push title and body required', { severity: 'warning' })
      return
    }
    setIsPushToFilteredConfirmDiaglogOpen(true)
  }

  const handlePushToDeviceCancel = () => {
    setIsPushToDeviceConfirmDiaglogOpen(false)
  }

  const handlePushToDeviceConfirm = async () => {
    // Await the send before closing so the ConfirmDialog keeps its Confirm
    // button disabled for the duration and a double-click can't send twice.
    await sendPush({ ids: [selectedItem.deviceId] })
    setIsPushToDeviceConfirmDiaglogOpen(false)
  }

  const handlePushToDeviceSubmit = () => {
    if (pushTitle === '' || pushBody === '') {
      showAlert('Push title and body required', { severity: 'warning' })
      return
    }
    setIsPushToDeviceConfirmDiaglogOpen(true)
  }

  const filterData = () => {
    setPage(0)
    setNextCursor('')
    setCursorMap(new Map<number, string>())
  }

  const handleChangePage = (event: any, newPage: number) => {
    setPage(newPage)
    if (newPage > page) {
      setCursor(nextCursor)
    } else {
      setCursor(cursorMap.get(newPage) || '')
    }
  }

  const handleChangeRowsPerPage = (event: any) => {
    const newRowsPerPage = parseInt(event.target.value, 10)
    setLimit(newRowsPerPage)
    localStorage.setItem(
      'push_notifications.devices.limit',
      newRowsPerPage.toString()
    )
    setNextCursor('')
    setPage(0)
  }

  const handleRowClick = (item: any) => {
    setSelectedItem(item)
  }

  const handleClose = () => {
    setSelectedItem(null)
  }

  const handlePushDialogClose = () => {
    setPushDialogOpen(false)
  }

  const isFilterEmpty = () => {
    return userIds.length === 0 && topicNames.length === 0
  }

  const handlePushToFilteredClick = () => {
    if (isFilterEmpty()) {
      showAlert('Empty filter', { severity: 'error' })
      return
    }
    setPushDialogOpen(true)
  }

  const sendPush = async function (filter: any) {
    const params = {
      recipient: {
        filter: filter,
      },
      notification: {
        fcm: {
          message: {
            notification: { title: pushTitle, body: pushBody },
          },
        },
        hms: {
          message: {
            notification: { title: pushTitle, body: pushBody },
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: pushTitle,
                body: pushBody,
              },
            },
          },
        },
        webpush: {
          payload: { title: pushTitle, body: pushBody },
        },
      },
    }

    try {
      const data = await command('send_push_notification', params)
      if (data.error) {
        showAlert('Error: ' + data.error.message, { severity: 'error' })
        return
      }
      showAlert('Push sent', { severity: 'success' })
    } catch (e) {
      handleError(e)
    }
  }

  const handleKeyDown = (event: any) => {
    if (event.key === 'Enter') {
      filterData()
    }
  }

  const getDeviceFilter = useCallback(() => {
    const filter: any = {}
    if (topicNames.length > 0) {
      filter.topics = topicNames
    }
    if (userIds.length > 0) {
      filter.users = userIds
    }
    return filter
  }, [topicNames, userIds])

  useEffect(() => {
    setTitle('Push notifications')

    const handleDevices = function (page: number, result: any) {
      const rows: any[] = []
      const items: any[] = result.items

      items.forEach(item => {
        rows.push(
          createData(
            item.id,
            item.token,
            item.provider,
            item.platform,
            item.user,
            item.timezone || '',
            item.locale || '',
            item.created_at,
            item.updated_at,
            item.meta,
            item.topics,
            item.labels,
            item.scores
          )
        )
      })

      setNodes(rows)
      setNextCursor(result.next_cursor || '')
      setTotalCount(result.total_count)
    }

    const fetchDevices = async (
      page: number,
      limit: number,
      cursor: string,
      userIds: string[],
      topicNames: string[]
    ) => {
      setCursorMap(c => c.set(page, cursor))

      const params: any = {
        filter: getDeviceFilter(),
        limit: limit,
        cursor: cursor,
        include_total_count: true,
        include_meta: true,
        include_topics: true,
        include_labels: true,
        include_scores: true,
      }

      try {
        const data = await command('device_list', params)
        setLoading(false)
        if (!data) {
          return
        }
        if (data.error) {
          return
        }
        setEnabled(true)
        handleDevices(page, data.result)
        setLoading(false)
      } catch (e) {
        setLoading(false)
        handleError(e)
      }
    }
    fetchDevices(page, limit, cursor, userIds, topicNames)
    return () => {}
  }, [
    setTitle,
    page,
    limit,
    cursor,
    userIds,
    topicNames,
    command,
    handleError,
    getDeviceFilter,
  ])

  const headCellSx = { fontWeight: 'bold', fontSize: '1em' }
  // Constrain long identifier columns: truncate with an ellipsis (full value in
  // a tooltip) so device IDs / user IDs don't blow out the table width.
  const ellipsisSx = {
    display: 'inline-block',
    maxWidth: 200,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    verticalAlign: 'bottom',
  } as const

  const users = ['']

  return (
    <Box className="max-w-8xl mx-auto p-8">
      {loading ? (
        <Box>
          <CircularProgress disableShrink color="secondary" />
        </Box>
      ) : (
        <Box>
          {enabled ? (
            <Box>
              {pushDialogOpen ? (
                <Dialog
                  open
                  onClose={handlePushDialogClose}
                  maxWidth="md"
                  fullWidth
                >
                  <DialogTitle>
                    Push to ({totalCount}) filtered devices
                    <IconButton
                      style={{ position: 'absolute', right: 0, top: 0 }}
                      onClick={handlePushDialogClose}
                    >
                      <CloseIcon />
                    </IconButton>
                  </DialogTitle>
                  <DialogContent>
                    <Box
                      style={{ marginTop: '20px' }}
                      component="form"
                      noValidate
                      autoComplete="off"
                    >
                      <TextField
                        label="Title"
                        size="small"
                        value={pushTitle}
                        style={{ width: '100%', marginBottom: '20px' }}
                        onChange={event => {
                          setPushTitle(event.target.value)
                        }}
                      />
                      <TextField
                        label="Body"
                        size="small"
                        value={pushBody}
                        style={{ width: '100%', marginBottom: '20px' }}
                        onChange={event => {
                          setPushBody(event.target.value)
                        }}
                      />
                      <Button
                        variant="outlined"
                        color="secondary"
                        disabled={!isPushFilled()}
                        onClick={handlePushToFilteredSubmit}
                      >
                        Push to filtered
                      </Button>
                      <ConfirmDialog
                        isOpen={isPushToFilteredConfirmDiaglogOpen}
                        onCancel={handlePushToFilteredCancel}
                        onConfirm={handlePushToFilteredConfirm}
                      />
                    </Box>
                  </DialogContent>
                </Dialog>
              ) : (
                <></>
              )}
              {selectedItem ? (
                <Dialog open onClose={handleClose} maxWidth="md" fullWidth>
                  <DialogTitle>
                    <IconButton
                      style={{ position: 'absolute', right: 0, top: 0 }}
                      onClick={handleClose}
                    >
                      <CloseIcon />
                    </IconButton>
                  </DialogTitle>
                  <DialogContent>
                    <Stack spacing={3}>
                      <Box>
                        <Typography
                          variant="subtitle1"
                          sx={{ fontWeight: 'bold', mb: 1 }}
                        >
                          Device details
                        </Typography>
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: 'auto 1fr',
                            columnGap: 2,
                            rowGap: 0.75,
                            alignItems: 'center',
                          }}
                        >
                          <DetailRow label="Device ID">
                            <Box
                              component="span"
                              sx={{
                                fontFamily: 'monospace',
                                overflowWrap: 'anywhere',
                              }}
                            >
                              {selectedItem.deviceId}
                            </Box>
                            <CopyButton
                              value={selectedItem.deviceId}
                              label="Copy device ID"
                            />
                          </DetailRow>
                          <DetailRow label="User">
                            {selectedItem.user ? (
                              <>
                                <Box
                                  component="span"
                                  sx={{
                                    fontFamily: 'monospace',
                                    overflowWrap: 'anywhere',
                                  }}
                                >
                                  {selectedItem.user}
                                </Box>
                                <CopyButton
                                  value={selectedItem.user}
                                  label="Copy user ID"
                                />
                              </>
                            ) : (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                anonymous
                              </Typography>
                            )}
                          </DetailRow>
                          <DetailRow label="Provider token">
                            <Box
                              component="span"
                              sx={{
                                ...ellipsisSx,
                                fontFamily: 'monospace',
                                fontSize: '0.8em',
                                maxWidth: 280,
                              }}
                            >
                              {selectedItem.token}
                            </Box>
                            <CopyButton
                              value={selectedItem.token}
                              label="Copy provider token"
                            />
                          </DetailRow>
                        </Box>
                        <Box
                          sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            columnGap: 3,
                            rowGap: 1,
                            mt: 1.5,
                          }}
                        >
                          <InlineDetail
                            label="Provider"
                            value={selectedItem.provider}
                          />
                          <InlineDetail
                            label="Platform"
                            value={selectedItem.platform}
                          />
                          <InlineDetail
                            label="Timezone"
                            value={selectedItem.timezone || '—'}
                          />
                          <InlineDetail
                            label="Language"
                            value={selectedItem.locale || '—'}
                          />
                          <InlineDetail
                            label="Created"
                            value={new Date(
                              selectedItem.created_at
                            ).toLocaleString()}
                          />
                          <InlineDetail
                            label="Updated"
                            value={new Date(
                              selectedItem.updated_at
                            ).toLocaleString()}
                          />
                        </Box>
                      </Box>
                      <Box>
                        <p style={{ marginBottom: '5px' }}>Topics:</p>
                        {selectedItem.topics ? (
                          selectedItem.topics.map(
                            (item: string, index: number) => (
                              <Chip
                                variant="outlined"
                                key={index}
                                label={item}
                                style={{ marginRight: '3px' }}
                              />
                            )
                          )
                        ) : (
                          <span style={{ fontSize: '0.8em' }}>
                            Device does not have topics
                          </span>
                        )}
                      </Box>
                      <Box>
                        <p style={{ marginBottom: '5px' }}>Meta information:</p>
                        {selectedItem.meta ? (
                          <pre style={{ fontSize: '0.8em' }}>
                            {JSON.stringify(selectedItem.meta, null, '  ')}
                          </pre>
                        ) : (
                          <span style={{ fontSize: '0.8em' }}>
                            Device does not have meta
                          </span>
                        )}
                      </Box>
                      <Box
                        style={{ marginTop: '20px' }}
                        component="form"
                        noValidate
                        autoComplete="off"
                      >
                        <TextField
                          label="Title"
                          size="small"
                          value={pushTitle}
                          style={{ width: '100%', marginBottom: '20px' }}
                          onChange={event => {
                            setPushTitle(event.target.value)
                          }}
                        />
                        <TextField
                          label="Body"
                          size="small"
                          value={pushBody}
                          style={{ width: '100%', marginBottom: '20px' }}
                          onChange={event => {
                            setPushBody(event.target.value)
                          }}
                        />
                        <Button
                          variant="outlined"
                          color="secondary"
                          disabled={!isPushFilled()}
                          onClick={handlePushToDeviceSubmit}
                        >
                          Push to device
                        </Button>
                        <ConfirmDialog
                          isOpen={isPushToDeviceConfirmDiaglogOpen}
                          onCancel={handlePushToDeviceCancel}
                          onConfirm={handlePushToDeviceConfirm}
                        />
                      </Box>
                    </Stack>
                  </DialogContent>
                </Dialog>
              ) : (
                <></>
              )}
              <Box
                component="form"
                noValidate
                autoComplete="off"
                onKeyDown={handleKeyDown}
              >
                <Autocomplete
                  multiple
                  limitTags={3}
                  style={{
                    width: '400px',
                    float: 'left',
                    marginRight: '20px',
                    marginBottom: '20px',
                  }}
                  options={[]}
                  value={topicNames}
                  onChange={(_, newValue) => {
                    setTopicNames(newValue)
                  }}
                  freeSolo
                  renderTags={(value: readonly string[], getTagProps) =>
                    value.map((option: string, index: number) => {
                      const { key, ...tagProps } = getTagProps({ index })
                      return (
                        <Chip
                          key={key}
                          size="medium"
                          variant="filled"
                          label={option}
                          {...tagProps}
                        />
                      )
                    })
                  }
                  renderInput={params => (
                    <TextField
                      {...params}
                      variant="outlined"
                      label="Topics"
                      placeholder="filter by topics..."
                    />
                  )}
                />
                <Autocomplete
                  multiple
                  limitTags={3}
                  style={{
                    width: '400px',
                    float: 'left',
                    marginBottom: '20px',
                  }}
                  options={users}
                  value={userIds}
                  freeSolo
                  onChange={(_, newValue) => {
                    setUserIds(newValue)
                  }}
                  getOptionLabel={option => {
                    if (option === '') {
                      return 'Include users with empty ID'
                    }
                    return option
                  }}
                  filterSelectedOptions
                  renderTags={(value: readonly string[], getTagProps) =>
                    value.map((option: string, index: number) => {
                      const { key, ...tagProps } = getTagProps({ index })
                      return (
                        <Chip
                          key={key}
                          size="medium"
                          variant="filled"
                          label={option}
                          {...tagProps}
                        />
                      )
                    })
                  }
                  renderInput={params => (
                    <TextField
                      {...params}
                      variant="outlined"
                      label="Users"
                      placeholder="filter by user IDs..."
                    />
                  )}
                />
                <Button
                  variant="outlined"
                  size="large"
                  color="secondary"
                  disabled={isFilterEmpty() || nodes.length === 0}
                  onClick={handlePushToFilteredClick}
                  style={{
                    float: 'right',
                    padding: '14px',
                    marginBottom: '20px',
                  }}
                >
                  Push to filtered ({totalCount})
                </Button>
              </Box>
              <TableContainer sx={{ mt: 4 }} component={Paper}>
                <Table size="medium" aria-label="simple table">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={headCellSx}>Device ID</TableCell>
                      <TableCell sx={headCellSx}>Provider</TableCell>
                      <TableCell sx={headCellSx}>Platform</TableCell>
                      <TableCell sx={headCellSx}>User</TableCell>
                      <TableCell sx={headCellSx}>Timezone</TableCell>
                      <TableCell sx={headCellSx}>Language</TableCell>
                      <TableCell sx={headCellSx}>Created</TableCell>
                      <TableCell sx={headCellSx}>Updated</TableCell>
                      <TableCell sx={headCellSx} align="right"></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {nodes.map(node => (
                      <StyledTableRow
                        key={node.deviceId}
                        hover
                        sx={{
                          '&:last-child td, &:last-child th': { border: 0 },
                        }}
                      >
                        <TableCell component="th" scope="row">
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                            }}
                          >
                            <Tooltip title={node.deviceId}>
                              <Box
                                component="span"
                                onClick={() => handleRowClick(node)}
                                sx={{
                                  ...ellipsisSx,
                                  fontFamily: 'monospace',
                                  cursor: 'pointer',
                                }}
                              >
                                {node.deviceId}
                              </Box>
                            </Tooltip>
                            <CopyButton
                              value={node.deviceId}
                              label="Copy device ID"
                            />
                          </Box>
                        </TableCell>
                        <TableCell>{node.provider}</TableCell>
                        <TableCell>{node.platform}</TableCell>
                        <TableCell>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                            }}
                          >
                            <Tooltip title={node.user || 'anonymous'}>
                              <Box
                                component="span"
                                sx={{ ...ellipsisSx, maxWidth: 160 }}
                              >
                                {node.user || '—'}
                              </Box>
                            </Tooltip>
                            {node.user && (
                              <CopyButton
                                value={node.user}
                                label="Copy user ID"
                              />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>{node.timezone}</TableCell>
                        <TableCell>{node.locale}</TableCell>
                        <TableCell>
                          <Tooltip
                            title={new Date(node.created_at).toLocaleString()}
                          >
                            <span>
                              {new Date(node.created_at).toLocaleDateString()}
                            </span>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Tooltip
                            title={new Date(node.updated_at).toLocaleString()}
                          >
                            <span>
                              {new Date(node.updated_at).toLocaleDateString()}
                            </span>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            aria-label="Device settings"
                            onClick={() => handleRowClick(node)}
                          >
                            <SettingsIcon fontSize="small" color="action" />
                          </IconButton>
                        </TableCell>
                      </StyledTableRow>
                    ))}
                    {nodes.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} sx={{ border: 0 }}>
                          <EmptyState
                            icon={<NotificationsIcon sx={{ fontSize: 40 }} />}
                            title="No devices found"
                            hint="No registered push devices match the current filter. Devices appear here once clients register for push notifications."
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TablePagination
                        colSpan={9}
                        rowsPerPageOptions={[10, 50, 200]}
                        count={-1}
                        rowsPerPage={limit}
                        page={page}
                        SelectProps={{
                          inputProps: {
                            'aria-label': 'rows per page',
                          },
                        }}
                        labelDisplayedRows={({ from, to, count }) =>
                          `Page ${page + 1}`
                        }
                        backIconButtonProps={{
                          disabled: page === 0,
                        }}
                        nextIconButtonProps={
                          !nextCursor
                            ? {
                                disabled: true,
                              }
                            : undefined
                        }
                        onPageChange={handleChangePage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                      />
                    </TableRow>
                  </TableFooter>
                </Table>
              </TableContainer>
            </Box>
          ) : (
            <Alert severity="info">
              Push notifications are not enabled. Please check your server
              configuration.
            </Alert>
          )}
        </Box>
      )}
    </Box>
  )
}
