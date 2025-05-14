import React, { useEffect, useContext, useState, Fragment } from 'react'
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
import CircularProgress from '@mui/material/CircularProgress'
import Tooltip from '@mui/material/Tooltip'

import { globalUrlPrefix } from 'config/url'
import { HumanSeconds, HumanSize } from 'utils/Functions'
import { ShellContext } from 'contexts/ShellContext'
import { Chip } from '@mui/material'

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': { backgroundColor: theme.palette.action.hover },
}))

interface StatusProps {
  signinSilent: () => void
  authorization: string
  edition: 'oss' | 'pro'
}

function createData(
  name: string,
  version: string,
  uptime: number,
  clients: number,
  users: number,
  subs: number,
  channels: number,
  cpu: string | number,
  rss: string,
  connectionsByClient: Record<string, number>,
  messagesReceived: number,
  messagesSent: number,
  publications: number,
  interval: number,
  connectRate: string,
  subscribeRate: string,
  apiRate: string
) {
  return {
    name,
    version,
    uptime,
    clients,
    users,
    subs,
    channels,
    cpu,
    rss,
    connectionsByClient,
    messagesReceived,
    messagesSent,
    publications,
    interval,
    connectRate,
    subscribeRate,
    apiRate,
  }
}

export function Status({ signinSilent, authorization, edition }: StatusProps) {
  // if (localStorage.getItem('centrifugo-edition') == 'oss') {
  //   edition = 'oss'
  // }
  const { showAlert } = useContext(ShellContext)
  const [nodes, setNodes] = useState<any[]>([])
  const [numNodes, setNumNodes] = useState(0)
  const [numConns, setNumConns] = useState(0)
  const [loading, setLoading] = useState(true)
  const { setTitle } = useContext(ShellContext)

  const [visibilityListenerSet, setVisibilityListenerSet] = useState(false)
  const [visible, setVisible] = useState(document.visibilityState === 'visible')

  useEffect(() => {
    if (visibilityListenerSet) return
    document.addEventListener('visibilitychange', () =>
      setVisible(!document.hidden)
    )
    setVisibilityListenerSet(true)
  }, [visibilityListenerSet])

  useEffect(() => {
    setTitle('Centrifugo | Status')
  }, [setTitle])

  useEffect(() => {
    const handleInfo = (result: any) => {
      const rows: any[] = []
      let totalConns = 0

      result.nodes.forEach((node: any) => {
        totalConns += node.num_clients
        const items = node.metrics?.items || {}
        const interval = node.metrics?.interval || 1

        // connections by client_name
        const connectionsByClient: Record<string, number> = {}
        Object.entries(items).forEach(([key, value]) => {
          const prefix = 'centrifugo.client.connections_inflight.client_name.'
          if (key.startsWith(prefix)) {
            const clientName = key.slice(prefix.length).split('.')[0]
            connectionsByClient[clientName] =
              (connectionsByClient[clientName] || 0) + Number(value)
          }
        })

        // messages received/sent
        let messagesReceived = 0,
          messagesSent = 0
        Object.entries(items).forEach(([key, value]) => {
          if (
            key.startsWith('centrifugo.transport.messages_received.frame_type.')
          )
            messagesReceived += Number(value)
          if (key.startsWith('centrifugo.transport.messages_sent.frame_type.'))
            messagesSent += Number(value)
        })
        const publications = Number(
          items['centrifugo.node.messages_sent_count.type.publication'] || 0
        )

        // client command counts
        const cntConnect = Number(
          items[
            'centrifugo.client.command_duration_seconds.count.method.connect'
          ] || 0
        )
        const cntSubscribe = Number(
          items[
            'centrifugo.client.command_duration_seconds.count.method.subscribe'
          ] || 0
        )

        // api command counts sum
        let cntApi = 0
        Object.entries(items).forEach(([key, value]) => {
          if (
            key.startsWith(
              'centrifugo.api.command_duration_seconds.count.method.'
            )
          ) {
            cntApi += Number(value)
          }
        })

        // rates
        const connectRate = (cntConnect / interval).toFixed(1)
        const subscribeRate = (cntSubscribe / interval).toFixed(1)
        const apiRate = (cntApi / interval).toFixed(1)

        rows.push(
          createData(
            node.name,
            node.version,
            node.uptime || 0,
            node.num_clients,
            node.num_users,
            node.num_subs,
            node.num_channels,
            node.process ? (node.process.cpu || 0).toFixed(1) : 'n/a',
            node.process ? HumanSize(node.process.rss) : 'n/a',
            connectionsByClient,
            messagesReceived,
            messagesSent,
            publications,
            interval,
            connectRate,
            subscribeRate,
            apiRate
          )
        )
      })

      setNumNodes(result.nodes.length)
      setNumConns(totalConns)
      setNodes(rows)
      setLoading(false)
    }

    const askInfo = () => {
      fetch(`${globalUrlPrefix}admin/api`, {
        method: 'POST',
        headers: { Accept: 'application/json', Authorization: authorization },
        body: JSON.stringify({ method: 'info', params: {} }),
        mode: 'same-origin',
      })
        .then(res => {
          if (!res.ok) {
            if (res.status === 401) {
              showAlert('Unauthorized', { severity: 'error' })
              signinSilent()
              return null
            }
            if (res.status === 403) {
              showAlert('Permission denied', { severity: 'error' })
              return null
            }
            throw new Error(res.status.toString())
          }
          return res.json()
        })
        .then(data => data && handleInfo(data.result))
        .catch(err => {
          showAlert('Error connecting to server', { severity: 'error' })
          console.error(err)
        })
    }

    if (visible) askInfo()
    const intervalId = setInterval(() => visible && askInfo(), 5000)
    return () => clearInterval(intervalId)
  }, [signinSilent, authorization, showAlert, visible])

  const headCellSx = { fontWeight: 'bold', fontSize: '1em' }

  return (
    <Box className="max-w-8xl mx-auto p-8">
      {loading ? (
        <Box>
          <CircularProgress disableShrink color="secondary" />
        </Box>
      ) : (
        <Box>
          <Typography variant="h5" sx={{ mb: 1 }}>
            Nodes running: <Chip label={numNodes} sx={{ fontSize: '1em' }} />{' '}
            Total clients: <Chip label={numConns} sx={{ fontSize: '1em' }} />
          </Typography>
          <TableContainer component={Paper} sx={{ mt: 4 }}>
            <Table aria-label="detailed status table">
              <TableHead>
                <TableRow>
                  <TableCell sx={headCellSx}>Node name</TableCell>
                  <TableCell sx={headCellSx} align="right">
                    Version
                  </TableCell>
                  <TableCell sx={headCellSx} align="right">
                    Uptime
                  </TableCell>
                  <TableCell sx={headCellSx} align="right">
                    Clients
                  </TableCell>
                  <TableCell sx={headCellSx} align="right">
                    Users
                  </TableCell>
                  <TableCell sx={headCellSx} align="right">
                    Subs
                  </TableCell>
                  <TableCell sx={headCellSx} align="right">
                    Channels
                  </TableCell>
                  {edition === 'pro' && (
                    <TableCell sx={headCellSx} align="right">
                      CPU %
                    </TableCell>
                  )}
                  {edition === 'pro' && (
                    <TableCell sx={headCellSx} align="right">
                      RSS
                    </TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {nodes
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(node => (
                    <Fragment key={node.name}>
                      <StyledTableRow
                        sx={{
                          '&:last-child td, &:last-child th': { border: 0 },
                        }}
                      >
                        <TableCell component="th" scope="row">
                          {node.name}
                        </TableCell>
                        <TableCell align="right">{node.version}</TableCell>
                        <TableCell align="right">
                          {HumanSeconds(node.uptime)}
                        </TableCell>
                        <TableCell align="right">{node.clients}</TableCell>
                        <TableCell align="right">{node.users}</TableCell>
                        <TableCell align="right">{node.subs}</TableCell>
                        <TableCell align="right">{node.channels}</TableCell>
                        {edition === 'pro' && (
                          <TableCell align="right">{node.cpu}</TableCell>
                        )}
                        {edition === 'pro' && (
                          <TableCell align="right">{node.rss}</TableCell>
                        )}
                      </StyledTableRow>
                      {edition === 'pro' && (
                        <TableRow>
                          <TableCell colSpan={9} sx={{ padding: '6px 16px' }}>
                            <Typography variant="caption" color="textSecondary">
                              Aggregations over <b>{node.interval}s</b>{' '}
                              <Tooltip title="Metrics in this row are aggregated once in the specified interval (determined by node.info_metrics_aggregate_interval server option).">
                                <span style={{ cursor: 'help' }}>ℹ️</span>
                              </Tooltip>{' '}
                              &nbsp; Clients:&nbsp;
                              <b>
                                {Object.keys(node.connectionsByClient).length >
                                0
                                  ? Object.entries(node.connectionsByClient)
                                      .map(
                                        ([client, cnt]) => `${client}: ${cnt}`
                                      )
                                      .join(', ')
                                  : '-'}
                              </b>
                              &nbsp;| Client incoming frames rate:{' '}
                              <b>
                                {(
                                  node.messagesReceived / node.interval
                                ).toFixed(1)}
                                /s
                              </b>
                              &nbsp;| Client outgoing frames rate:{' '}
                              <b>
                                {(node.messagesSent / node.interval).toFixed(1)}
                                /s
                              </b>
                              &nbsp;| Connect rate: <b>{node.connectRate}/s</b>
                              &nbsp;| Subscribe rate:{' '}
                              <b>{node.subscribeRate}/s</b>
                              &nbsp;| Server API rate: <b>{node.apiRate}/s</b>
                              &nbsp;| Publication rate:{' '}
                              <b>
                                {(node.publications / node.interval).toFixed(1)}
                                /s
                              </b>
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  )
}
