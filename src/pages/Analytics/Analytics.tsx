import { useContext, useEffect, useState, useCallback } from 'react'
import Box from '@mui/material/Box'
import { styled } from '@mui/material/styles'
import TextField from '@mui/material/TextField'
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

import { globalUrlPrefix } from 'config/url'
import { ShellContext } from 'contexts/ShellContext'
import { Button, Chip, Grid } from '@mui/material'

interface StatusProps {
  handleLogout: () => void
  insecure: boolean
  edition: 'oss' | 'pro'
}

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': {
    backgroundColor: theme.palette.action.hover,
  },
}))

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

export const Analytics = ({ handleLogout, insecure, edition }: StatusProps) => {
  const { setTitle, showAlert } = useContext(ShellContext)
  const [loading, setLoading] = useState(true)
  const [reloading, setReloading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [analyticsData, setAnalyticsData] = useState<null | any>(null)
  const localStorageRequestKey = 'centrifugo_analytics_request'

  let savedReq: any
  if (localStorage.getItem(localStorageRequestKey) === null) {
    savedReq = {
      numUniqueUsers: {
        lastMinutes: 60,
      },
      numPublications: {
        lastMinutes: 60,
      },
      clientDistribution: {
        lastMinutes: 5,
      },
      transportDistribution: {
        lastMinutes: 5,
      },
      userConnections: {
        lastMinutes: 1,
        user: '',
      },
      channelSubscribers: {
        lastMinutes: 1,
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

  const [userConnectionsUser, setUserConnectionsUser] = useState(
    request.userConnections.user
  )

  const [channelSubscribersChannel, setChannelSubscribersChannel] = useState(
    request.channelSubscribers.channel
  )

  const [channelPublicationsChannel, setChannelPublicationsChannel] = useState(
    request.channelPublications.channel
  )
  const [channelPublicationsSource, setChannelPublicationsSource] = useState(
    request.channelPublications.source
  )

  const [userOpsPage, setUserOpsPage] = useState(0)
  const [userOpsRowsPerPage, setUserOpsRowsPerPage] = useState(10)
  const [userOpsUser, setUserOpsUser] = useState(request.userOps.user)
  const [userOpsOp, setUserOpsOp] = useState(request.userOps.op)

  const [userErrorsUser, setUserErrorsUser] = useState(request.userErrors.user)
  const [userErrorsOp, setUserErrorsOp] = useState(request.userErrors.op)
  const [userErrorsError, setUserErrorsError] = useState(
    request.userErrors.error
  )

  const [userDisconnectsUser, setUserDisconnectsUser] = useState(
    request.userDisconnects.user
  )
  const [userDisconnectsOp, setUserDisconnectsOp] = useState(
    request.userDisconnects.op
  )
  const [userDisconnectsDisconnect, setUserDisconnectsDisconnect] = useState(
    request.userDisconnects.disconnect
  )

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

  useEffect(() => {
    setTitle('Centrifugo | Analytics')
  }, [setTitle])

  const askFullAnalyticsData = useCallback(
    function () {
      setReloading(true)

      const headers: any = {
        Accept: 'application/json',
      }
      if (!insecure) {
        headers.Authorization = `token ${localStorage.getItem('token')}`
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
              handleLogout()
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
    [handleLogout, insecure, showAlert, request]
  )

  useEffect(() => {
    const interval = setInterval(function () {
      askFullAnalyticsData()
    }, 60000)
    askFullAnalyticsData()
    return () => clearInterval(interval)
  }, [setTitle, askFullAnalyticsData, handleLogout, insecure, showAlert])

  const handleReloadClick = (e: any) => {
    e.preventDefault()
    askFullAnalyticsData()
    return
  }

  const headCellSx = { fontWeight: 'bold', p: 1.5 }
  const widgetCellSx = { p: 1.5 }

  // Avoid a layout jump when reaching the last page with empty rows.
  const userOpsEmptyRows =
    userOpsPage > 0
      ? Math.max(
          0,
          (1 + userOpsPage) * userOpsRowsPerPage - analyticsData.userOps.length
        )
      : 0

  let allClients: number
  let allTransports: number
  if (analyticsData && analyticsData.clientDistribution) {
    allClients = analyticsData.clientDistribution.reduce(
      (a: number, v: any) => (a = a + v.count),
      0
    )
  }
  if (analyticsData && analyticsData.transportDistribution) {
    allTransports = analyticsData.transportDistribution.reduce(
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

  const handleChannelSubscribersSubmit = (
    event: React.SyntheticEvent<HTMLFormElement>
  ) => {
    event.preventDefault()
    let shallow = Object.assign({}, request)
    shallow.channelSubscribers.channel = channelSubscribersChannel
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
                        Unique users in
                        <Button size="large" sx={{ p: 1 }}>
                          1 hour
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
                        Publications in
                        <Button size="large" sx={{ p: 1 }}>
                          1 hour
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
                        Client distribution in
                        <Button size="large" sx={{ p: 1 }}>
                          1 min
                        </Button>
                      </Typography>
                      {analyticsData.clientDistribution !== undefined ? (
                        <Box>
                          <Typography
                            variant="h5"
                            component="div"
                            color="#8ab200"
                          >
                            {analyticsData.clientDistribution.map(
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
                        Transport distribution in
                        <Button size="large" sx={{ p: 1 }}>
                          1 min
                        </Button>
                      </Typography>
                      {analyticsData.transportDistribution !== undefined ? (
                        <Box>
                          <Typography
                            variant="h5"
                            component="div"
                            color="#8ab200"
                          >
                            {analyticsData.transportDistribution.map(
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
                        User connections in
                        <Button size="large" sx={{ p: 1 }}>
                          1 min
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
                                {analyticsData.userConnections.map(
                                  (elem: any) => (
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
                                  )
                                )}
                              </TableBody>
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
                        Channel subscribers in
                        <Button size="large" sx={{ p: 1 }}>
                          1 min
                        </Button>
                      </Typography>

                      <Box
                        component="form"
                        onSubmit={handleChannelSubscribersSubmit}
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
                                setChannelSubscribersChannel(event.target.value)
                              }
                              value={channelSubscribersChannel}
                            />
                            <Button type="submit" sx={{ display: 'none' }}>
                              Submit
                            </Button>
                          </Grid>
                        </Grid>
                      </Box>
                      {analyticsData.channelSubscribers &&
                      analyticsData.channelSubscribers.length > 0 ? (
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
                                {analyticsData.channelSubscribers.map(
                                  (elem: any) => (
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
                                  )
                                )}
                              </TableBody>
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
                        Users commands without errors in
                        <Button size="large" sx={{ p: 1 }}>
                          5 min
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
                                ).map((row: any) => (
                                  <StyledTableRow
                                    key={row.user + row.op}
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
                                      {row.user}
                                    </TableCell>
                                    <TableCell sx={widgetCellSx}>
                                      {row.op}
                                    </TableCell>
                                    <TableCell sx={widgetCellSx}>
                                      {row.count}
                                    </TableCell>
                                  </StyledTableRow>
                                ))}
                                {userOpsEmptyRows > 0 && (
                                  <TableRow
                                    style={{
                                      height: 45 * userOpsEmptyRows - 1,
                                    }}
                                  >
                                    <TableCell colSpan={6} />
                                  </TableRow>
                                )}
                              </TableBody>
                              <TableFooter>
                                <TableRow>
                                  <TablePagination
                                    rowsPerPageOptions={[
                                      10,
                                      25,
                                      { label: 'All', value: -1 },
                                    ]}
                                    colSpan={3}
                                    count={analyticsData.userOps.length}
                                    rowsPerPage={userOpsRowsPerPage}
                                    page={userOpsPage}
                                    SelectProps={{
                                      inputProps: {
                                        'aria-label': 'rows per page',
                                      },
                                      native: true,
                                    }}
                                    onPageChange={handleUserOpsChangePage}
                                    onRowsPerPageChange={
                                      handleUserOpsChangeRowsPerPage
                                    }
                                    ActionsComponent={TablePaginationActions}
                                  />
                                </TableRow>
                              </TableFooter>
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
                        Channel publications in
                        <Button size="large" sx={{ p: 1 }}>
                          5 min
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
                                {analyticsData.channelPublications.map(
                                  (elem: any) => (
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
                                  )
                                )}
                              </TableBody>
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
                        Users with command errors in
                        <Button size="large" sx={{ p: 1 }}>
                          5 min
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
                                {analyticsData.userErrors.map((elem: any) => (
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
                              </TableBody>
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
                        Users with disconnects after commands in
                        <Button size="large" sx={{ p: 1 }}>
                          5 min
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
                                {analyticsData.userDisconnects.map(
                                  (elem: any) => (
                                    <StyledTableRow
                                      key={
                                        elem.user + elem.op + elem.disconnect
                                      }
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
                                  )
                                )}
                              </TableBody>
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
