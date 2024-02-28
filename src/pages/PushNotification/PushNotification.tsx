import { useEffect, useContext, useState, useCallback } from 'react'
import { styled } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import { Stack, TableFooter, TablePagination } from '@mui/material'
import CircularProgress from '@mui/material/CircularProgress'
import { Dialog, DialogTitle, DialogContent, IconButton } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import SettingsIcon from '@mui/icons-material/Settings'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import { TextField } from '@mui/material'
import { Link } from '@mui/material'
import Autocomplete from '@mui/material/Autocomplete'

import { globalUrlPrefix } from 'config/url'
import { ShellContext } from 'contexts/ShellContext'

import { ConfirmDialog } from '../../components/ConfirmDialog'

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

function truncateText(text: String, len: number) {
  if (text.length > len) {
    text = text.substring(0, len) + '...'
  }
  return text
}

function createData(
  deviceId: string,
  token: string,
  provider: string,
  platform: string,
  user: string,
  timezone: string,
  language: string,
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
    language,
    created_at,
    updated_at,
    meta,
    topics,
    labels,
    scores,
  }
}

export function PushNotification({
  signinSilent,
  authorization,
  edition,
}: PushNotificationProps) {
  const savedLimit = localStorage.getItem('push_notifications.devices.limit')
  const { setTitle, showAlert } = useContext(ShellContext)
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
  const [userIds, setUserIds] = useState<any[]>([])

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
    sendPush(getDeviceFilter())
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
    sendPush({ ids: [selectedItem.deviceId] })
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

  const sendPush = function (filter: any) {
    const headers: any = {
      Accept: 'application/json',
      Authorization: authorization,
    }

    fetch(`${globalUrlPrefix}admin/api`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        method: 'send_push_notification',
        params: {
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
          },
        },
      }),
      mode: 'same-origin',
    })
      .then(response => {
        if (!response.ok) {
          if (response.status === 401) {
            showAlert('Unauthorized', { severity: 'error' })
            signinSilent()
            return
          }
          if (response.status === 403) {
            showAlert('Permission denied', { severity: 'error' })
            return
          }
          throw Error(response.status.toString())
        }
        return response.json()
      })
      .then(data => {
        if (data.error) {
          showAlert('Error: ' + data.error.message, { severity: 'error' })
          return
        }
        showAlert('Push sent', { severity: 'success' })
      })
      .catch(e => {
        showAlert('Error connecting to server', { severity: 'error' })
        console.log(e)
      })
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
            item.language || '',
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

    const fetchDevices = (
      page: number,
      limit: number,
      cursor: string,
      userIds: string[],
      topicNames: string[]
    ) => {
      setCursorMap(c => c.set(page, cursor))

      const headers: any = {
        Accept: 'application/json',
        Authorization: authorization,
      }

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

      fetch(`${globalUrlPrefix}admin/api`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          method: 'device_list',
          params: params,
        }),
        mode: 'same-origin',
      })
        .then(response => {
          if (!response.ok) {
            if (response.status === 401) {
              showAlert('Unauthorized', { severity: 'error' })
              signinSilent()
              return
            }
            if (response.status === 403) {
              showAlert('Permission denied', { severity: 'error' })
              return
            }
            throw Error(response.status.toString())
          }
          return response.json()
        })
        .then(data => {
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
        })
        .catch(e => {
          showAlert('Error connecting to server', { severity: 'error' })
          console.log(e)
        })
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
    signinSilent,
    showAlert,
    authorization,
    getDeviceFilter,
  ])

  const headCellSx = { fontWeight: 'bold', fontSize: '1em' }

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
                        {selectedItem.deviceId}
                        <pre>
                          {navigator.clipboard ? (
                            <Box>
                              <Link
                                style={{ cursor: 'pointer' }}
                                variant="body2"
                                color="primary"
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    selectedItem.deviceId
                                  )
                                  showAlert('Device ID copied', {
                                    severity: 'success',
                                  })
                                }}
                              >
                                {'Copy device ID'}
                              </Link>
                              &nbsp;
                              <Link
                                style={{ cursor: 'pointer' }}
                                variant="body2"
                                color="primary"
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    selectedItem.token
                                  )
                                  showAlert('Token copied', {
                                    severity: 'success',
                                  })
                                }}
                              >
                                {'Copy raw provider token'}
                              </Link>
                            </Box>
                          ) : (
                            <code style={{ fontSize: '0.5em' }}>
                              {selectedItem.token}{' '}
                            </code>
                          )}
                        </pre>
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
                    value.map((option: string, index: number) => (
                      <Chip
                        size="medium"
                        variant="filled"
                        label={option}
                        {...getTagProps({ index })}
                      />
                    ))
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
                    value.map((option: string, index: number) => (
                      <Chip
                        size="medium"
                        variant="filled"
                        label={option}
                        {...getTagProps({ index })}
                      />
                    ))
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
                      <TableCell sx={headCellSx} align="right"></TableCell>
                      <TableCell sx={headCellSx} align="right">
                        Provider
                      </TableCell>
                      <TableCell sx={headCellSx} align="right">
                        Platform
                      </TableCell>
                      <TableCell sx={headCellSx} align="right">
                        User
                      </TableCell>
                      <TableCell sx={headCellSx} align="right">
                        Timezone
                      </TableCell>
                      <TableCell sx={headCellSx} align="right">
                        Language
                      </TableCell>
                      <TableCell sx={headCellSx} align="right">
                        Created
                      </TableCell>
                      <TableCell sx={headCellSx} align="right">
                        Updated
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {nodes.map(node => (
                      <StyledTableRow
                        key={node.deviceId}
                        sx={{
                          '&:last-child td, &:last-child th': { border: 0 },
                        }}
                      >
                        <TableCell component="th" scope="row">
                          <span onClick={() => handleRowClick(node)}>
                            {truncateText(node.deviceId, 30)}
                          </span>
                        </TableCell>
                        <TableCell align="right">
                          <SettingsIcon
                            fontSize="small"
                            style={{ cursor: 'pointer' }}
                            color="action"
                            onClick={() => handleRowClick(node)}
                          />
                        </TableCell>
                        <TableCell align="right">{node.provider}</TableCell>
                        <TableCell align="right">{node.platform}</TableCell>
                        <TableCell align="right">{node.user}</TableCell>
                        <TableCell align="right">{node.timezone}</TableCell>
                        <TableCell align="right">{node.language}</TableCell>
                        <TableCell align="right">
                          {new Date(node.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell align="right">
                          {new Date(node.updated_at).toLocaleString()}
                        </TableCell>
                      </StyledTableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TablePagination
                        colSpan={7}
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
            <Box>
              <Typography color="text.secondary" gutterBottom>
                Push notifications are not enabled
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}
