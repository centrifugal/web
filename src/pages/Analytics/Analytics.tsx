import { useContext, useEffect, useState, useCallback } from 'react'
import Box from '@mui/material/Box'
import { styled } from '@mui/material/styles'
import TextField from '@mui/material/TextField'
import FormControlLabel from '@mui/material/FormControlLabel'
import CircularProgress from '@mui/material/CircularProgress'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableFooter from '@mui/material/TableFooter'
import TablePagination from '@mui/material/TablePagination'
import IconButton from '@mui/material/IconButton'
import FirstPageIcon from '@mui/icons-material/FirstPage'
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft'
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight'
import LastPageIcon from '@mui/icons-material/LastPage'
import { useTheme } from '@mui/material/styles'
import Link from '@mui/material/Link'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControl from '@mui/material/FormControl'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'

import { globalUrlPrefix } from 'config/url'
import { ShellContext } from 'contexts/ShellContext'
import { Button, Chip, Grid } from '@mui/material'

interface AnalyticsProps {
  signinSilent: () => void
  authorization: string
  edition: 'oss' | 'pro'
}

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': {
    backgroundColor: theme.palette.action.hover,
  },
}))

interface IntervalDialogProps {
  open: boolean
  initial: number
  includeIntervals: boolean
  includePastSnapshots: boolean
  closeFunc: null | ((value: number) => void)
}

function IntervalDialog(props: IntervalDialogProps) {
  const { open, initial, includeIntervals, includePastSnapshots, closeFunc } =
    props

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!closeFunc) {
      return
    }
    closeFunc(parseInt((event.target as HTMLInputElement).value))
  }

  const handleClose = (
    event: React.SyntheticEvent<unknown>,
    reason?: string
  ) => {
    if (!closeFunc) {
      return
    }
    if (reason !== 'backdropClick') {
      closeFunc(initial)
    }
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Select an interval to aggregate over</DialogTitle>
      <DialogContent>
        <Box component="form" sx={{ display: 'flex', flexWrap: 'wrap' }}>
          <FormControl>
            <RadioGroup
              row
              aria-labelledby="demo-row-radio-buttons-group-label"
              name="row-radio-buttons-group"
              defaultValue={initial.toString()}
              onChange={handleChange}
            >
              {includePastSnapshots ? (
                <Box>
                  <Typography>Snapshot at:</Typography>
                  <FormControlLabel
                    value={'0'}
                    control={<Radio />}
                    label="now"
                  />
                  <FormControlLabel
                    value={'-5'}
                    control={<Radio />}
                    label="5 min ago"
                  />
                  <FormControlLabel
                    value={'-60'}
                    control={<Radio />}
                    label="1 hour ago"
                  />
                  <FormControlLabel
                    value={'-1439'}
                    control={<Radio />}
                    label="1 day ago"
                  />
                </Box>
              ) : (
                <></>
              )}
              {includeIntervals ? (
                <Box>
                  <Typography>Sum over:</Typography>
                  <FormControlLabel
                    value={'1'}
                    control={<Radio />}
                    label="last 1 min"
                  />
                  <FormControlLabel
                    value={'5'}
                    control={<Radio />}
                    label="last 5 min"
                  />
                  <FormControlLabel
                    value={'60'}
                    control={<Radio />}
                    label="last 1 hour"
                  />
                  <FormControlLabel
                    value={'1440'}
                    control={<Radio />}
                    label="last 1 day"
                  />
                </Box>
              ) : (
                <></>
              )}
            </RadioGroup>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  )
}

interface TablePaginationActionsProps {
  count: number
  page: number
  rowsPerPage: number
  onPageChange: (
    event: React.MouseEvent<HTMLButtonElement>,
    newPage: number
  ) => void
}

function TablePaginationActions(props: TablePaginationActionsProps) {
  const theme = useTheme()
  const { count, page, rowsPerPage, onPageChange } = props

  const handleFirstPageButtonClick = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    onPageChange(event, 0)
  }

  const handleBackButtonClick = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    onPageChange(event, page - 1)
  }

  const handleNextButtonClick = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    onPageChange(event, page + 1)
  }

  const handleLastPageButtonClick = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    onPageChange(event, Math.max(0, Math.ceil(count / rowsPerPage) - 1))
  }

  return (
    <Box sx={{ flexShrink: 0, ml: 2.5 }}>
      <IconButton
        onClick={handleFirstPageButtonClick}
        disabled={page === 0}
        aria-label="first page"
      >
        {theme.direction === 'rtl' ? <LastPageIcon /> : <FirstPageIcon />}
      </IconButton>
      <IconButton
        onClick={handleBackButtonClick}
        disabled={page === 0}
        aria-label="previous page"
      >
        {theme.direction === 'rtl' ? (
          <KeyboardArrowRight />
        ) : (
          <KeyboardArrowLeft />
        )}
      </IconButton>
      <IconButton
        onClick={handleNextButtonClick}
        disabled={page >= Math.ceil(count / rowsPerPage) - 1}
        aria-label="next page"
      >
        {theme.direction === 'rtl' ? (
          <KeyboardArrowLeft />
        ) : (
          <KeyboardArrowRight />
        )}
      </IconButton>
      <IconButton
        onClick={handleLastPageButtonClick}
        disabled={page >= Math.ceil(count / rowsPerPage) - 1}
        aria-label="last page"
      >
        {theme.direction === 'rtl' ? <FirstPageIcon /> : <LastPageIcon />}
      </IconButton>
    </Box>
  )
}

export const Analytics = ({
  signinSilent,
  authorization,
  edition,
}: AnalyticsProps) => {
  const { setTitle, showAlert } = useContext(ShellContext)
  const [loading, setLoading] = useState(true)
  const [reloading, setReloading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [analyticsData, setAnalyticsData] = useState<null | any>(null)
  const localStorageRequestKey = 'centrifugo_analytics_request_v1'

  let savedReq: any
  if (localStorage.getItem(localStorageRequestKey) === null) {
    savedReq = {
      numUniqueUsers: {
        lastMinutes: 60,
      },
      numPublications: {
        lastMinutes: 60,
      },
      clientNames: {
        lastMinutes: 0,
      },
      transports: {
        lastMinutes: 0,
      },
      userConnections: {
        lastMinutes: 0,
        user: '',
      },
      channelSubscriptions: {
        lastMinutes: 0,
        channel: '',
      },
      userOps: {
        lastMinutes: 5,
        user: '',
        op: '',
      },
      channelPublications: {
        lastMinutes: 5,
        channel: '',
        source: '',
      },
      userErrors: {
        lastMinutes: 5,
        user: '',
        op: '',
        error: '',
      },
      userDisconnects: {
        lastMinutes: 5,
        user: '',
        op: '',
        disconnect: '',
      },
    }
  } else {
    savedReq = JSON.parse(localStorage.getItem(localStorageRequestKey)!)
  }
  const [request, setRequest] = useState(savedReq)

  const [intervalDialogOpen, setIntervalDialogOpen] = useState(false)
  const [intervalDialogInitial, setIntervalDialogInitial] = useState(0)
  const [intervalDialogField, setIntervalDialogField] = useState('')
  const [intervalDialogIncludeIntervals, setIntervalDialogIncludeIntervals] =
    useState(false)
  const [intervalDialogIncludeSnapshots, setIntervalDialogIncludeSnapshots] =
    useState(false)

  const [userConnectionsUser, setUserConnectionsUser] = useState(
    request.userConnections.user
  )
  const [userConnectionsPage, setUserConnectionsPage] = useState(0)
  const [userConnectionsRowsPerPage, setUserConnectionsRowsPerPage] =
    useState(10)
  const userConnectionsEmptyRows =
    userConnectionsPage > 0
      ? Math.max(
          0,
          (1 + userConnectionsPage) * userConnectionsRowsPerPage -
            analyticsData.userConnections.length
        )
      : 0

  const [channelSubscriptionsChannel, setchannelSubscriptionsChannel] =
    useState(request.channelSubscriptions.channel)
  const [channelSubscriptionsPage, setChannelSubscriptionsPage] = useState(0)
  const [channelSubscriptionsRowsPerPage, setChannelSubscriptionsRowsPerPage] =
    useState(10)
  const channelSubscriptionsEmptyRows =
    channelSubscriptionsPage > 0
      ? Math.max(
          0,
          (1 + channelSubscriptionsPage) * channelSubscriptionsRowsPerPage -
            analyticsData.channelSubscriptions.length
        )
      : 0

  const [userOpsUser, setUserOpsUser] = useState(request.userOps.user)
  const [userOpsOp, setUserOpsOp] = useState(request.userOps.op)
  const [userOpsPage, setUserOpsPage] = useState(0)
  const [userOpsRowsPerPage, setUserOpsRowsPerPage] = useState(10)
  const userOpsEmptyRows =
    userOpsPage > 0
      ? Math.max(
          0,
          (1 + userOpsPage) * userOpsRowsPerPage - analyticsData.userOps.length
        )
      : 0

  const [channelPublicationsChannel, setChannelPublicationsChannel] = useState(
    request.channelPublications.channel
  )
  const [channelPublicationsSource, setChannelPublicationsSource] = useState(
    request.channelPublications.source
  )
  const [channelPublicationsPage, setChannelPublicationsPage] = useState(0)
  const [channelPublicationsRowsPerPage, setChannelPublicationsRowsPerPage] =
    useState(10)
  const channelPublicationsEmptyRows =
    channelPublicationsPage > 0
      ? Math.max(
          0,
          (1 + channelPublicationsPage) * channelPublicationsRowsPerPage -
            analyticsData.channelPublications.length
        )
      : 0

  const [userErrorsUser, setUserErrorsUser] = useState(request.userErrors.user)
  const [userErrorsOp, setUserErrorsOp] = useState(request.userErrors.op)
  const [userErrorsError, setUserErrorsError] = useState(
    request.userErrors.error
  )
  const [userErrorsPage, setUserErrorsPage] = useState(0)
  const [userErrorsRowsPerPage, setUserErrorsRowsPerPage] = useState(10)
  const userErrorsEmptyRows =
    userErrorsPage > 0
      ? Math.max(
          0,
          (1 + userErrorsPage) * userErrorsRowsPerPage -
            analyticsData.userErrors.length
        )
      : 0

  const [userDisconnectsUser, setUserDisconnectsUser] = useState(
    request.userDisconnects.user
  )
  const [userDisconnectsOp, setUserDisconnectsOp] = useState(
    request.userDisconnects.op
  )
  const [userDisconnectsDisconnect, setUserDisconnectsDisconnect] = useState(
    request.userDisconnects.disconnect
  )
  const [userDisconnectsPage, setUserDisconnectsPage] = useState(0)
  const [userDisconnectsRowsPerPage, setUserDisconnectsRowsPerPage] =
    useState(10)
  const userDisconnectsEmptyRows =
    userDisconnectsPage > 0
      ? Math.max(
          0,
          (1 + userDisconnectsPage) * userDisconnectsRowsPerPage -
            analyticsData.userDisconnects.length
        )
      : 0

  const handleUserOpsChangePage = (
    event: React.MouseEvent<HTMLButtonElement> | null,
    newPage: number
  ) => {
    setUserOpsPage(newPage)
  }

  const handleUserOpsChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setUserOpsRowsPerPage(parseInt(event.target.value, 10))
    setUserOpsPage(0)
  }

  const handleChannelPublicationsChangePage = (
    event: React.MouseEvent<HTMLButtonElement> | null,
    newPage: number
  ) => {
    setChannelPublicationsPage(newPage)
  }

  const handleChannelPublicationsChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setChannelPublicationsRowsPerPage(parseInt(event.target.value, 10))
    setChannelPublicationsPage(0)
  }

  const handleUserConnectionsChangePage = (
    event: React.MouseEvent<HTMLButtonElement> | null,
    newPage: number
  ) => {
    setUserConnectionsPage(newPage)
  }

  const handleUserConnectionsChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setUserConnectionsRowsPerPage(parseInt(event.target.value, 10))
    setUserConnectionsPage(0)
  }

  const handleChannelSubscriptionsChangePage = (
    event: React.MouseEvent<HTMLButtonElement> | null,
    newPage: number
  ) => {
    setChannelSubscriptionsPage(newPage)
  }

  const handleChannelSubscriptionsChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setChannelSubscriptionsRowsPerPage(parseInt(event.target.value, 10))
    setChannelSubscriptionsPage(0)
  }

  const handleUserErrorsChangePage = (
    event: React.MouseEvent<HTMLButtonElement> | null,
    newPage: number
  ) => {
    setUserErrorsPage(newPage)
  }

  const handleUserErrorsChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setUserErrorsRowsPerPage(parseInt(event.target.value, 10))
    setUserErrorsPage(0)
  }

  const handleUserDisconnectsChangePage = (
    event: React.MouseEvent<HTMLButtonElement> | null,
    newPage: number
  ) => {
    setUserDisconnectsPage(newPage)
  }

  const handleUserDisconnectsChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setUserDisconnectsRowsPerPage(parseInt(event.target.value, 10))
    setUserDisconnectsPage(0)
  }

  useEffect(() => {
    setTitle('Centrifugo | Analytics')
  }, [setTitle])

  const askFullAnalyticsData = useCallback(
    function () {
      setReloading(true)

      const headers: any = {
        Accept: 'application/json',
        Authorization: authorization,
      }

      fetch(`${globalUrlPrefix}admin/analytics`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(request),
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
            if (response.status === 404) {
              setLoading(false)
              return
            }
            throw Error(response.status.toString())
          }
          setEnabled(true)
          return response.json()
        })
        .then(data => {
          if (!data) {
            return
          }
          setAnalyticsData(data.result)
          setLoading(false)
          setReloading(false)
        })
        .catch(e => {
          showAlert('Error connecting to server', { severity: 'error' })
          console.log(e)
        })
    },
    [signinSilent, authorization, showAlert, request]
  )

  const [didFetch, setDidFetch] = useState(false)

  useEffect(() => {
    if (didFetch) {
      return
    }
    setDidFetch(true)
    const interval = setInterval(function () {
      askFullAnalyticsData()
    }, 60000)
    askFullAnalyticsData()
    return () => clearInterval(interval)
  }, [askFullAnalyticsData, signinSilent, authorization, showAlert, didFetch])

  const handleReloadClick = (e: any) => {
    e.preventDefault()
    askFullAnalyticsData()
    return
  }

  const headCellSx = { fontWeight: 'bold', p: 1.5 }
  const widgetCellSx = { p: 1.5 }

  let allClients: number
  let allTransports: number
  if (analyticsData && analyticsData.clientNames) {
    allClients = analyticsData.clientNames.reduce(
      (a: number, v: any) => (a = a + v.count),
      0
    )
  }
  if (analyticsData && analyticsData.transports) {
    allTransports = analyticsData.transports.reduce(
      (a: number, v: any) => (a = a + v.count),
      0
    )
  }

  const saveAndMakeRequest = (req: any) => {
    localStorage.setItem(localStorageRequestKey, JSON.stringify(req))
    setRequest(req)
    askFullAnalyticsData()
  }

  const handleUserOpsSubmit = (
    event: React.SyntheticEvent<HTMLFormElement>
  ) => {
    event.preventDefault()
    let shallow = Object.assign({}, request)
    shallow.userOps.user = userOpsUser
    shallow.userOps.op = userOpsOp
    saveAndMakeRequest(shallow)
  }

  const handleUserConnectionsSubmit = (
    event: React.SyntheticEvent<HTMLFormElement>
  ) => {
    event.preventDefault()
    let shallow = Object.assign({}, request)
    shallow.userConnections.user = userConnectionsUser
    saveAndMakeRequest(shallow)
  }

  const handlechannelSubscriptionsSubmit = (
    event: React.SyntheticEvent<HTMLFormElement>
  ) => {
    event.preventDefault()
    let shallow = Object.assign({}, request)
    shallow.channelSubscriptions.channel = channelSubscriptionsChannel
    saveAndMakeRequest(shallow)
  }

  const handleChannelPublicationsSubmit = (
    event: React.SyntheticEvent<HTMLFormElement>
  ) => {
    event.preventDefault()
    let shallow = Object.assign({}, request)
    shallow.channelPublications.channel = channelPublicationsChannel
    shallow.channelPublications.source = channelPublicationsSource
    saveAndMakeRequest(shallow)
  }

  const handleUserErrorsSubmit = (
    event: React.SyntheticEvent<HTMLFormElement>
  ) => {
    event.preventDefault()
    let shallow = Object.assign({}, request)
    shallow.userErrors.user = userErrorsUser
    shallow.userErrors.op = userErrorsOp
    shallow.userErrors.error = userErrorsError
    saveAndMakeRequest(shallow)
  }

  const handleUserDisconnectsSubmit = (
    event: React.SyntheticEvent<HTMLFormElement>
  ) => {
    event.preventDefault()
    let shallow = Object.assign({}, request)
    shallow.userDisconnects.user = userDisconnectsUser
    shallow.userDisconnects.op = userDisconnectsOp
    shallow.userDisconnects.disconnect = userDisconnectsDisconnect
    saveAndMakeRequest(shallow)
  }

  const widgetCardSx = { p: 1, height: '100%' }
  const noDataSx = { mt: 3 }

  const humanizeMinutes = (mins: number): string => {
    if (mins === 0) {
      return 'now'
    } else if (mins === 1) {
      return 'in last 1 min'
    } else if (mins === 5) {
      return 'in last 5 min'
    } else if (mins === 60) {
      return 'in last 1 hour'
    } else if (mins === 1440) {
      return 'in last 1 day'
    } else if (mins === -5) {
      return '5 min ago'
    } else if (mins === -60) {
      return '1 hour ago'
    } else if (mins === -1439) {
      return '1 day ago'
    }
    return '?'
  }

  const intervalDialogClose = (value: number) => {
    setIntervalDialogOpen(false)
    let shallow = Object.assign({}, request)
    shallow[intervalDialogField].lastMinutes = value
    saveAndMakeRequest(shallow)
  }

  return (
    <Box className="max-w-8xl mx-auto p-8">
      {loading ? (
        <Box>
          <CircularProgress disableShrink color="secondary" />
        </Box>
      ) : (
        <Box>
          <IntervalDialog
            open={intervalDialogOpen}
            initial={intervalDialogInitial}
            includeIntervals={intervalDialogIncludeIntervals}
            includePastSnapshots={intervalDialogIncludeSnapshots}
            closeFunc={intervalDialogClose}
          />
          {enabled ? (
            <Box>
              <Typography color="text.secondary" gutterBottom>
                Analytics dashboard to observe a system state,{' '}
                <Link href="#" onClick={handleReloadClick}>
                  reload
                </Link>{' '}
                {reloading ? (
                  <CircularProgress
                    sx={{ maxWidth: '10px', maxHeight: '10px' }}
                    disableShrink
                    color="secondary"
                  />
                ) : (
                  <></>
                )}
              </Typography>
              <Grid container spacing={2} sx={{ mt: 0 }}>
                <Grid item xs={6} md={3} xl={3}>
                  <Card sx={widgetCardSx}>
                    <CardContent>
                      <Typography
                        variant="h6"
                        color="text.secondary"
                        gutterBottom
                      >
                        Unique users
                        <Button
                          size="large"
                          sx={{ p: 1 }}
                          onClick={() => {
                            setIntervalDialogInitial(
                              request.numUniqueUsers.lastMinutes
                            )
                            setIntervalDialogField('numUniqueUsers')
                            setIntervalDialogIncludeSnapshots(true)
                            setIntervalDialogIncludeIntervals(true)
                            setIntervalDialogOpen(true)
                          }}
                        >
                          {humanizeMinutes(request.numUniqueUsers.lastMinutes)}
                        </Button>
                      </Typography>
                      {analyticsData.numUniqueUsers !== undefined ? (
                        <Box>
                          <Typography variant="h3" component="div">
                            {analyticsData.numUniqueUsers}
                          </Typography>
                        </Box>
                      ) : (
                        <Box sx={noDataSx}>No data</Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} md={3} xl={3}>
                  <Card sx={widgetCardSx}>
                    <CardContent>
                      <Typography
                        variant="h6"
                        color="text.secondary"
                        gutterBottom
                      >
                        Publications
                        <Button
                          size="large"
                          sx={{ p: 1 }}
                          onClick={() => {
                            setIntervalDialogInitial(
                              request.numPublications.lastMinutes
                            )
                            setIntervalDialogField('numPublications')
                            setIntervalDialogIncludeSnapshots(false)
                            setIntervalDialogIncludeIntervals(true)
                            setIntervalDialogOpen(true)
                          }}
                        >
                          {humanizeMinutes(request.numPublications.lastMinutes)}
                        </Button>
                      </Typography>
                      {analyticsData.numUniqueUsers !== undefined ? (
                        <Box>
                          <Typography variant="h3">
                            {analyticsData.numPublications}
                          </Typography>
                        </Box>
                      ) : (
                        <Box sx={noDataSx}>No data</Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} md={3} xl={3}>
                  <Card sx={widgetCardSx}>
                    <CardContent>
                      <Typography
                        variant="h6"
                        color="text.secondary"
                        gutterBottom
                      >
                        Client names
                        <Button
                          size="large"
                          sx={{ p: 1 }}
                          onClick={() => {
                            setIntervalDialogInitial(
                              request.clientNames.lastMinutes
                            )
                            setIntervalDialogField('clientNames')
                            setIntervalDialogIncludeSnapshots(true)
                            setIntervalDialogIncludeIntervals(false)
                            setIntervalDialogOpen(true)
                          }}
                        >
                          {humanizeMinutes(request.clientNames.lastMinutes)}
                        </Button>
                      </Typography>
                      {analyticsData.clientNames !== undefined ? (
                        <Box>
                          <Typography
                            variant="h5"
                            component="div"
                            color="#8ab200"
                          >
                            {analyticsData.clientNames.map(
                              (clientCount: any) => (
                                <Box component="span" key={clientCount.name}>
                                  <Chip
                                    label={
                                      (clientCount.name
                                        ? clientCount.name
                                        : '?') +
                                      ' ' +
                                      (
                                        (clientCount.count * 100) /
                                        allClients
                                      ).toFixed(1) +
                                      '%'
                                    }
                                    sx={{ fontSize: '0.6em', mb: 1 }}
                                  />{' '}
                                </Box>
                              )
                            )}
                          </Typography>
                        </Box>
                      ) : (
                        <Box sx={noDataSx}>No data</Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} md={3} xl={3}>
                  <Card sx={widgetCardSx}>
                    <CardContent>
                      <Typography
                        variant="h6"
                        color="text.secondary"
                        gutterBottom
                      >
                        Transports
                        <Button
                          size="large"
                          sx={{ p: 1 }}
                          onClick={() => {
                            setIntervalDialogInitial(
                              request.transports.lastMinutes
                            )
                            setIntervalDialogField('transports')
                            setIntervalDialogIncludeSnapshots(true)
                            setIntervalDialogIncludeIntervals(false)
                            setIntervalDialogOpen(true)
                          }}
                        >
                          {humanizeMinutes(request.transports.lastMinutes)}
                        </Button>
                      </Typography>
                      {analyticsData.transports !== undefined ? (
                        <Box>
                          <Typography
                            variant="h5"
                            component="div"
                            color="#8ab200"
                          >
                            {analyticsData.transports.map(
                              (transportCount: any) => (
                                <Box component="span" key={transportCount.name}>
                                  <Chip
                                    label={
                                      transportCount.name +
                                      ' ' +
                                      (
                                        (transportCount.count * 100) /
                                        allTransports
                                      ).toFixed(1) +
                                      '%'
                                    }
                                    sx={{ fontSize: '0.6em', mb: 1 }}
                                  />{' '}
                                </Box>
                              )
                            )}
                          </Typography>
                        </Box>
                      ) : (
                        <Box sx={noDataSx}>No data</Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6} xl={6}>
                  <Card sx={widgetCardSx}>
                    <CardContent>
                      <Typography
                        variant="h6"
                        color="text.secondary"
                        gutterBottom
                      >
                        User connections
                        <Button
                          size="large"
                          sx={{ p: 1 }}
                          onClick={() => {
                            setIntervalDialogInitial(
                              request.userConnections.lastMinutes
                            )
                            setIntervalDialogField('userConnections')
                            setIntervalDialogIncludeSnapshots(true)
                            setIntervalDialogIncludeIntervals(true)
                            setIntervalDialogOpen(true)
                          }}
                        >
                          {humanizeMinutes(request.userConnections.lastMinutes)}
                        </Button>
                      </Typography>

                      <Box
                        component="form"
                        onSubmit={handleUserConnectionsSubmit}
                      >
                        <Grid
                          container
                          spacing={0}
                          columnSpacing={4}
                          sx={{ mt: 0 }}
                        >
                          <Grid item xs={12}>
                            <TextField
                              margin="none"
                              variant="standard"
                              fullWidth
                              name="user"
                              label="User"
                              type="text"
                              id="text"
                              autoComplete="off"
                              onChange={event =>
                                setUserConnectionsUser(event.target.value)
                              }
                              value={userConnectionsUser}
                            />
                            <Button type="submit" sx={{ display: 'none' }}>
                              Submit
                            </Button>
                          </Grid>
                        </Grid>
                      </Box>

                      {analyticsData.userConnections &&
                      analyticsData.userConnections.length > 0 ? (
                        <Box>
                          <TableContainer sx={{ mt: 4 }}>
                            <Table aria-label="simple table">
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={headCellSx}>User ID</TableCell>
                                  <TableCell sx={headCellSx}>Count</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {(userConnectionsRowsPerPage > 0
                                  ? analyticsData.userConnections.slice(
                                      userConnectionsPage *
                                        userConnectionsRowsPerPage,
                                      userConnectionsPage *
                                        userConnectionsRowsPerPage +
                                        userConnectionsRowsPerPage
                                    )
                                  : analyticsData.userConnections
                                ).map((elem: any) => (
                                  <StyledTableRow
                                    key={elem.user}
                                    sx={{
                                      '&:last-child td, &:last-child th': {
                                        border: 0,
                                      },
                                    }}
                                  >
                                    <TableCell
                                      sx={widgetCellSx}
                                      component="th"
                                      scope="row"
                                    >
                                      {elem.user}
                                    </TableCell>
                                    <TableCell sx={widgetCellSx}>
                                      {elem.count}
                                    </TableCell>
                                  </StyledTableRow>
                                ))}
                                {userConnectionsEmptyRows > 0 && (
                                  <TableRow
                                    style={{
                                      height: 45 * userConnectionsEmptyRows - 1,
                                    }}
                                  >
                                    <TableCell colSpan={3} />
                                  </TableRow>
                                )}
                              </TableBody>
                              {analyticsData.userConnections.length >
                              userConnectionsRowsPerPage ? (
                                <TableFooter>
                                  <TableRow>
                                    <TablePagination
                                      rowsPerPageOptions={[1]}
                                      colSpan={3}
                                      count={
                                        analyticsData.userConnections.length
                                      }
                                      rowsPerPage={userConnectionsRowsPerPage}
                                      page={userConnectionsPage}
                                      onPageChange={
                                        handleUserConnectionsChangePage
                                      }
                                      onRowsPerPageChange={
                                        handleUserConnectionsChangeRowsPerPage
                                      }
                                      ActionsComponent={TablePaginationActions}
                                    />
                                  </TableRow>
                                </TableFooter>
                              ) : (
                                <></>
                              )}
                            </Table>
                          </TableContainer>
                        </Box>
                      ) : (
                        <Box sx={noDataSx}>No data</Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6} xl={6}>
                  <Card sx={widgetCardSx}>
                    <CardContent>
                      <Typography
                        variant="h6"
                        color="text.secondary"
                        gutterBottom
                      >
                        Channel subscriptions
                        <Button
                          size="large"
                          sx={{ p: 1 }}
                          onClick={() => {
                            setIntervalDialogInitial(
                              request.channelSubscriptions.lastMinutes
                            )
                            setIntervalDialogField('channelSubscriptions')
                            setIntervalDialogIncludeSnapshots(true)
                            setIntervalDialogIncludeIntervals(true)
                            setIntervalDialogOpen(true)
                          }}
                        >
                          {humanizeMinutes(
                            request.channelSubscriptions.lastMinutes
                          )}
                        </Button>
                      </Typography>

                      <Box
                        component="form"
                        onSubmit={handlechannelSubscriptionsSubmit}
                      >
                        <Grid
                          container
                          spacing={0}
                          columnSpacing={4}
                          sx={{ mt: 0 }}
                        >
                          <Grid item xs={12}>
                            <TextField
                              margin="none"
                              variant="standard"
                              fullWidth
                              name="channel"
                              label="Channel"
                              type="text"
                              id="text"
                              autoComplete="off"
                              onChange={event =>
                                setchannelSubscriptionsChannel(
                                  event.target.value
                                )
                              }
                              value={channelSubscriptionsChannel}
                            />
                            <Button type="submit" sx={{ display: 'none' }}>
                              Submit
                            </Button>
                          </Grid>
                        </Grid>
                      </Box>
                      {analyticsData.channelSubscriptions &&
                      analyticsData.channelSubscriptions.length > 0 ? (
                        <Box>
                          <TableContainer sx={{ mt: 4 }}>
                            <Table aria-label="simple table">
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={headCellSx}>Channel</TableCell>
                                  <TableCell sx={headCellSx}>Count</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {(channelSubscriptionsRowsPerPage > 0
                                  ? analyticsData.channelSubscriptions.slice(
                                      channelSubscriptionsPage *
                                        channelSubscriptionsRowsPerPage,
                                      channelSubscriptionsPage *
                                        channelSubscriptionsRowsPerPage +
                                        channelSubscriptionsRowsPerPage
                                    )
                                  : analyticsData.channelSubscriptions
                                ).map((elem: any) => (
                                  <StyledTableRow
                                    key={elem.channel}
                                    sx={{
                                      '&:last-child td, &:last-child th': {
                                        border: 0,
                                      },
                                    }}
                                  >
                                    <TableCell
                                      sx={widgetCellSx}
                                      component="th"
                                      scope="row"
                                    >
                                      {elem.channel}
                                    </TableCell>
                                    <TableCell sx={widgetCellSx}>
                                      {elem.count}
                                    </TableCell>
                                  </StyledTableRow>
                                ))}
                                {channelSubscriptionsEmptyRows > 0 && (
                                  <TableRow
                                    style={{
                                      height:
                                        45 * channelSubscriptionsEmptyRows - 1,
                                    }}
                                  >
                                    <TableCell colSpan={3} />
                                  </TableRow>
                                )}
                              </TableBody>
                              {analyticsData.channelSubscriptions.length >
                              channelSubscriptionsRowsPerPage ? (
                                <TableFooter>
                                  <TableRow>
                                    <TablePagination
                                      rowsPerPageOptions={[1]}
                                      colSpan={3}
                                      count={
                                        analyticsData.channelSubscriptions
                                          .length
                                      }
                                      rowsPerPage={
                                        channelSubscriptionsRowsPerPage
                                      }
                                      page={channelSubscriptionsPage}
                                      onPageChange={
                                        handleChannelSubscriptionsChangePage
                                      }
                                      onRowsPerPageChange={
                                        handleChannelSubscriptionsChangeRowsPerPage
                                      }
                                      ActionsComponent={TablePaginationActions}
                                    />
                                  </TableRow>
                                </TableFooter>
                              ) : (
                                <></>
                              )}
                            </Table>
                          </TableContainer>
                        </Box>
                      ) : (
                        <Box sx={noDataSx}>No data</Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6} xl={6}>
                  <Card sx={widgetCardSx}>
                    <CardContent>
                      <Typography
                        variant="h6"
                        color="text.secondary"
                        gutterBottom
                      >
                        Users commands without errors
                        <Button
                          size="large"
                          sx={{ p: 1 }}
                          onClick={() => {
                            setIntervalDialogInitial(
                              request.userOps.lastMinutes
                            )
                            setIntervalDialogField('userOps')
                            setIntervalDialogIncludeSnapshots(false)
                            setIntervalDialogIncludeIntervals(true)
                            setIntervalDialogOpen(true)
                          }}
                        >
                          {humanizeMinutes(request.userOps.lastMinutes)}
                        </Button>
                      </Typography>

                      <Box component="form" onSubmit={handleUserOpsSubmit}>
                        <Grid
                          container
                          spacing={0}
                          columnSpacing={4}
                          sx={{ mt: 0 }}
                        >
                          <Grid item xs={6}>
                            <TextField
                              margin="none"
                              variant="standard"
                              fullWidth
                              name="user"
                              label="User"
                              type="text"
                              id="text"
                              autoComplete="off"
                              onChange={event =>
                                setUserOpsUser(event.target.value)
                              }
                              value={userOpsUser}
                            />
                          </Grid>
                          <Grid item xs={6}>
                            <TextField
                              margin="none"
                              variant="standard"
                              fullWidth
                              name="op"
                              label="Op"
                              type="text"
                              id="text"
                              autoComplete="off"
                              onChange={event =>
                                setUserOpsOp(event.target.value)
                              }
                              value={userOpsOp}
                            />
                            <Button type="submit" sx={{ display: 'none' }}>
                              Submit
                            </Button>
                          </Grid>
                        </Grid>
                      </Box>

                      {analyticsData.userOps &&
                      analyticsData.userOps.length > 0 ? (
                        <Box>
                          <TableContainer sx={{ mt: 4 }}>
                            <Table aria-label="simple table">
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={headCellSx}>User ID</TableCell>
                                  <TableCell sx={headCellSx}>Op</TableCell>
                                  <TableCell sx={headCellSx}>Count</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {(userOpsRowsPerPage > 0
                                  ? analyticsData.userOps.slice(
                                      userOpsPage * userOpsRowsPerPage,
                                      userOpsPage * userOpsRowsPerPage +
                                        userOpsRowsPerPage
                                    )
                                  : analyticsData.userOps
                                ).map((elem: any) => (
                                  <StyledTableRow
                                    key={elem.user + elem.op}
                                    sx={{
                                      '&:last-child td, &:last-child th': {
                                        border: 0,
                                      },
                                    }}
                                  >
                                    <TableCell
                                      sx={widgetCellSx}
                                      component="th"
                                      scope="row"
                                    >
                                      {elem.user}
                                    </TableCell>
                                    <TableCell sx={widgetCellSx}>
                                      {elem.op}
                                    </TableCell>
                                    <TableCell sx={widgetCellSx}>
                                      {elem.count}
                                    </TableCell>
                                  </StyledTableRow>
                                ))}
                                {userOpsEmptyRows > 0 && (
                                  <TableRow
                                    style={{
                                      height: 45 * userOpsEmptyRows - 1,
                                    }}
                                  >
                                    <TableCell colSpan={3} />
                                  </TableRow>
                                )}
                              </TableBody>
                              {analyticsData.userOps.length >
                              userOpsRowsPerPage ? (
                                <TableFooter>
                                  <TableRow>
                                    <TablePagination
                                      rowsPerPageOptions={[1]}
                                      colSpan={3}
                                      count={analyticsData.userOps.length}
                                      rowsPerPage={userOpsRowsPerPage}
                                      page={userOpsPage}
                                      onPageChange={handleUserOpsChangePage}
                                      onRowsPerPageChange={
                                        handleUserOpsChangeRowsPerPage
                                      }
                                      ActionsComponent={TablePaginationActions}
                                    />
                                  </TableRow>
                                </TableFooter>
                              ) : (
                                <></>
                              )}
                            </Table>
                          </TableContainer>
                        </Box>
                      ) : (
                        <Box sx={noDataSx}>No data</Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6} xl={6}>
                  <Card sx={theme => ({ p: 1, height: '100%' })}>
                    <CardContent>
                      <Typography
                        variant="h6"
                        color="text.secondary"
                        gutterBottom
                      >
                        Channel publications
                        <Button
                          size="large"
                          sx={{ p: 1 }}
                          onClick={() => {
                            setIntervalDialogInitial(
                              request.channelPublications.lastMinutes
                            )
                            setIntervalDialogField('channelPublications')
                            setIntervalDialogIncludeSnapshots(false)
                            setIntervalDialogIncludeIntervals(true)
                            setIntervalDialogOpen(true)
                          }}
                        >
                          {humanizeMinutes(
                            request.channelPublications.lastMinutes
                          )}
                        </Button>
                      </Typography>

                      <Box
                        component="form"
                        onSubmit={handleChannelPublicationsSubmit}
                      >
                        <Grid
                          container
                          spacing={0}
                          columnSpacing={4}
                          sx={{ mt: 0 }}
                        >
                          <Grid item xs={6}>
                            <TextField
                              margin="none"
                              variant="standard"
                              fullWidth
                              name="channel"
                              label="Channel"
                              type="text"
                              id="text"
                              autoComplete="off"
                              onChange={event =>
                                setChannelPublicationsChannel(
                                  event.target.value
                                )
                              }
                              value={channelPublicationsChannel}
                            />
                          </Grid>
                          <Grid item xs={6}>
                            <TextField
                              margin="none"
                              variant="standard"
                              fullWidth
                              name="source"
                              label="Source"
                              type="text"
                              id="text"
                              autoComplete="off"
                              onChange={event =>
                                setChannelPublicationsSource(event.target.value)
                              }
                              value={channelPublicationsSource}
                            />
                            <Button type="submit" sx={{ display: 'none' }}>
                              Submit
                            </Button>
                          </Grid>
                        </Grid>
                      </Box>
                      {analyticsData.channelPublications &&
                      analyticsData.channelPublications.length > 0 ? (
                        <Box>
                          <TableContainer sx={{ mt: 4 }}>
                            <Table aria-label="simple table">
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={headCellSx}>Channel</TableCell>
                                  <TableCell sx={headCellSx}>Source</TableCell>
                                  <TableCell sx={headCellSx}>Count</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {(channelPublicationsRowsPerPage > 0
                                  ? analyticsData.channelPublications.slice(
                                      channelPublicationsPage *
                                        channelPublicationsRowsPerPage,
                                      channelPublicationsPage *
                                        channelPublicationsRowsPerPage +
                                        channelPublicationsRowsPerPage
                                    )
                                  : analyticsData.channelPublications
                                ).map((elem: any) => (
                                  <StyledTableRow
                                    key={elem.channel + elem.source}
                                    sx={{
                                      '&:last-child td, &:last-child th': {
                                        border: 0,
                                      },
                                    }}
                                  >
                                    <TableCell
                                      sx={widgetCellSx}
                                      component="th"
                                      scope="row"
                                    >
                                      {elem.channel}
                                    </TableCell>
                                    <TableCell sx={widgetCellSx}>
                                      {elem.source}
                                    </TableCell>
                                    <TableCell sx={widgetCellSx}>
                                      {elem.count}
                                    </TableCell>
                                  </StyledTableRow>
                                ))}
                                {channelPublicationsEmptyRows > 0 && (
                                  <TableRow
                                    style={{
                                      height:
                                        45 * channelPublicationsEmptyRows - 1,
                                    }}
                                  >
                                    <TableCell colSpan={3} />
                                  </TableRow>
                                )}
                              </TableBody>
                              {analyticsData.channelPublications.length >
                              channelPublicationsRowsPerPage ? (
                                <TableFooter>
                                  <TableRow>
                                    <TablePagination
                                      rowsPerPageOptions={[10]}
                                      colSpan={3}
                                      count={
                                        analyticsData.channelPublications.length
                                      }
                                      rowsPerPage={
                                        channelPublicationsRowsPerPage
                                      }
                                      page={channelPublicationsPage}
                                      onPageChange={
                                        handleChannelPublicationsChangePage
                                      }
                                      onRowsPerPageChange={
                                        handleChannelPublicationsChangeRowsPerPage
                                      }
                                      ActionsComponent={TablePaginationActions}
                                    />
                                  </TableRow>
                                </TableFooter>
                              ) : (
                                <></>
                              )}
                            </Table>
                          </TableContainer>
                        </Box>
                      ) : (
                        <Box sx={noDataSx}>No data</Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6} xl={6}>
                  <Card sx={widgetCardSx}>
                    <CardContent>
                      <Typography
                        variant="h6"
                        color="text.secondary"
                        gutterBottom
                      >
                        Users with command errors
                        <Button
                          size="large"
                          sx={{ p: 1 }}
                          onClick={() => {
                            setIntervalDialogInitial(
                              request.userErrors.lastMinutes
                            )
                            setIntervalDialogField('userErrors')
                            setIntervalDialogIncludeSnapshots(false)
                            setIntervalDialogIncludeIntervals(true)
                            setIntervalDialogOpen(true)
                          }}
                        >
                          {humanizeMinutes(request.userErrors.lastMinutes)}
                        </Button>
                      </Typography>

                      <Box component="form" onSubmit={handleUserErrorsSubmit}>
                        <Grid
                          container
                          spacing={0}
                          columnSpacing={4}
                          sx={{ mt: 0 }}
                        >
                          <Grid item xs={4}>
                            <TextField
                              margin="none"
                              variant="standard"
                              fullWidth
                              name="user"
                              label="User"
                              type="text"
                              id="text"
                              autoComplete="off"
                              onChange={event =>
                                setUserErrorsUser(event.target.value)
                              }
                              value={userErrorsUser}
                            />
                          </Grid>
                          <Grid item xs={4}>
                            <TextField
                              margin="none"
                              variant="standard"
                              fullWidth
                              name="op"
                              label="Op"
                              type="text"
                              id="text"
                              autoComplete="off"
                              onChange={event =>
                                setUserErrorsOp(event.target.value)
                              }
                              value={userErrorsOp}
                            />
                          </Grid>
                          <Grid item xs={4}>
                            <TextField
                              margin="none"
                              variant="standard"
                              fullWidth
                              name="error"
                              label="Error"
                              type="text"
                              id="text"
                              autoComplete="off"
                              onChange={event =>
                                setUserErrorsError(event.target.value)
                              }
                              value={userErrorsError}
                            />
                            <Button type="submit" sx={{ display: 'none' }}>
                              Submit
                            </Button>
                          </Grid>
                        </Grid>
                      </Box>
                      {analyticsData.userErrors &&
                      analyticsData.userErrors.length > 0 ? (
                        <Box>
                          <TableContainer sx={{ mt: 4 }}>
                            <Table aria-label="simple table">
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={headCellSx}>User ID</TableCell>
                                  <TableCell sx={headCellSx}>Op</TableCell>
                                  <TableCell sx={headCellSx}>Error</TableCell>
                                  <TableCell sx={headCellSx}>Count</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {(userErrorsRowsPerPage > 0
                                  ? analyticsData.userErrors.slice(
                                      userErrorsPage * userErrorsRowsPerPage,
                                      userErrorsPage * userErrorsRowsPerPage +
                                        userErrorsRowsPerPage
                                    )
                                  : analyticsData.userErrors
                                ).map((elem: any) => (
                                  <StyledTableRow
                                    key={elem.user + elem.op + elem.error}
                                    sx={{
                                      '&:last-child td, &:last-child th': {
                                        border: 0,
                                      },
                                    }}
                                  >
                                    <TableCell
                                      sx={widgetCellSx}
                                      component="th"
                                      scope="row"
                                    >
                                      {elem.user}
                                    </TableCell>
                                    <TableCell sx={widgetCellSx}>
                                      {elem.op}
                                    </TableCell>
                                    <TableCell sx={widgetCellSx}>
                                      {elem.error}
                                    </TableCell>
                                    <TableCell sx={widgetCellSx}>
                                      {elem.count}
                                    </TableCell>
                                  </StyledTableRow>
                                ))}
                                {userErrorsEmptyRows > 0 && (
                                  <TableRow
                                    style={{
                                      height: 45 * userErrorsEmptyRows - 1,
                                    }}
                                  >
                                    <TableCell colSpan={4} />
                                  </TableRow>
                                )}
                              </TableBody>
                              {analyticsData.userErrors.length >
                              userErrorsRowsPerPage ? (
                                <TableFooter>
                                  <TableRow>
                                    <TablePagination
                                      rowsPerPageOptions={[10]}
                                      colSpan={4}
                                      count={analyticsData.userErrors.length}
                                      rowsPerPage={userErrorsRowsPerPage}
                                      page={userErrorsPage}
                                      onPageChange={handleUserErrorsChangePage}
                                      onRowsPerPageChange={
                                        handleUserErrorsChangeRowsPerPage
                                      }
                                      ActionsComponent={TablePaginationActions}
                                    />
                                  </TableRow>
                                </TableFooter>
                              ) : (
                                <></>
                              )}
                            </Table>
                          </TableContainer>
                        </Box>
                      ) : (
                        <Box sx={noDataSx}>No data</Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6} xl={6}>
                  <Card sx={widgetCardSx}>
                    <CardContent>
                      <Typography
                        variant="h6"
                        color="text.secondary"
                        gutterBottom
                      >
                        Users with disconnects after commands
                        <Button
                          size="large"
                          sx={{ p: 1 }}
                          onClick={() => {
                            setIntervalDialogInitial(
                              request.userDisconnects.lastMinutes
                            )
                            setIntervalDialogField('userDisconnects')
                            setIntervalDialogIncludeSnapshots(false)
                            setIntervalDialogIncludeIntervals(true)
                            setIntervalDialogOpen(true)
                          }}
                        >
                          {humanizeMinutes(request.userDisconnects.lastMinutes)}
                        </Button>
                      </Typography>

                      <Box
                        component="form"
                        onSubmit={handleUserDisconnectsSubmit}
                      >
                        <Grid
                          container
                          spacing={0}
                          columnSpacing={4}
                          sx={{ mt: 0 }}
                        >
                          <Grid item xs={4}>
                            <TextField
                              margin="none"
                              variant="standard"
                              fullWidth
                              name="user"
                              label="User"
                              type="text"
                              id="text"
                              autoComplete="off"
                              onChange={event =>
                                setUserDisconnectsUser(event.target.value)
                              }
                              value={userDisconnectsUser}
                            />
                          </Grid>
                          <Grid item xs={4}>
                            <TextField
                              margin="none"
                              variant="standard"
                              fullWidth
                              name="op"
                              label="Op"
                              type="text"
                              id="text"
                              autoComplete="off"
                              onChange={event =>
                                setUserDisconnectsOp(event.target.value)
                              }
                              value={userDisconnectsOp}
                            />
                          </Grid>
                          <Grid item xs={4}>
                            <TextField
                              margin="none"
                              variant="standard"
                              fullWidth
                              name="disconnect"
                              label="Disconnect"
                              type="text"
                              id="text"
                              autoComplete="off"
                              onChange={event =>
                                setUserDisconnectsDisconnect(event.target.value)
                              }
                              value={userDisconnectsDisconnect}
                            />
                            <Button type="submit" sx={{ display: 'none' }}>
                              Submit
                            </Button>
                          </Grid>
                        </Grid>
                      </Box>
                      {analyticsData.userDisconnects &&
                      analyticsData.userDisconnects.length > 0 ? (
                        <Box>
                          <TableContainer sx={{ mt: 4 }}>
                            <Table aria-label="simple table">
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={headCellSx}>User ID</TableCell>
                                  <TableCell sx={headCellSx}>Op</TableCell>
                                  <TableCell sx={headCellSx}>
                                    Disconnect
                                  </TableCell>
                                  <TableCell sx={headCellSx}>Count</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {(userDisconnectsRowsPerPage > 0
                                  ? analyticsData.userDisconnects.slice(
                                      userDisconnectsPage *
                                        userDisconnectsRowsPerPage,
                                      userDisconnectsPage *
                                        userDisconnectsRowsPerPage +
                                        userDisconnectsRowsPerPage
                                    )
                                  : analyticsData.userDisconnects
                                ).map((elem: any) => (
                                  <StyledTableRow
                                    key={elem.user + elem.op + elem.disconnect}
                                    sx={{
                                      '&:last-child td, &:last-child th': {
                                        border: 0,
                                      },
                                    }}
                                  >
                                    <TableCell
                                      sx={widgetCellSx}
                                      component="th"
                                      scope="row"
                                    >
                                      {elem.user}
                                    </TableCell>
                                    <TableCell sx={widgetCellSx}>
                                      {elem.op}
                                    </TableCell>
                                    <TableCell sx={widgetCellSx}>
                                      {elem.disconnect}
                                    </TableCell>
                                    <TableCell sx={widgetCellSx}>
                                      {elem.count}
                                    </TableCell>
                                  </StyledTableRow>
                                ))}
                                {userDisconnectsEmptyRows > 0 && (
                                  <TableRow
                                    style={{
                                      height: 45 * userDisconnectsEmptyRows - 1,
                                    }}
                                  >
                                    <TableCell colSpan={4} />
                                  </TableRow>
                                )}
                              </TableBody>
                              {analyticsData.userDisconnects.length >
                              userDisconnectsRowsPerPage ? (
                                <TableFooter>
                                  <TableRow>
                                    <TablePagination
                                      rowsPerPageOptions={[10]}
                                      colSpan={4}
                                      count={
                                        analyticsData.userDisconnects.length
                                      }
                                      rowsPerPage={userDisconnectsRowsPerPage}
                                      page={userDisconnectsPage}
                                      onPageChange={
                                        handleUserDisconnectsChangePage
                                      }
                                      onRowsPerPageChange={
                                        handleUserDisconnectsChangeRowsPerPage
                                      }
                                      ActionsComponent={TablePaginationActions}
                                    />
                                  </TableRow>
                                </TableFooter>
                              ) : (
                                <></>
                              )}
                            </Table>
                          </TableContainer>
                        </Box>
                      ) : (
                        <Box sx={noDataSx}>No data</Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          ) : (
            <Box>
              <Typography color="text.secondary" gutterBottom>
                Analytics is not enabled
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}
