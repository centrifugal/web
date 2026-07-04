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

import { useAdminApi } from 'api/adminApi'
import { HumanSeconds, HumanSize } from 'utils/Functions'
import { ShellContext } from 'contexts/ShellContext'
import { Card, CardContent, Chip } from '@mui/material'
import {
  InfoOutlined,
  Storage,
  Person,
  Subscriptions,
} from '@mui/icons-material'

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': { backgroundColor: theme.palette.action.hover },
}))

const fmtInt = (n: number) => Number(n).toLocaleString()
const fmtRate = (n: number) =>
  `${n.toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}/s`

// SummaryCard is a cluster-level KPI tile: a neutral leading icon, an uppercase label, and the
// value in the accent color — theme-driven (no hard-coded backgrounds).
const SummaryCard = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) => (
  <Card elevation={2} sx={{ flex: '1 1 300px', minWidth: 300 }}>
    <CardContent
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        py: 3,
      }}
    >
      <Box sx={{ display: 'flex', color: 'text.secondary' }}>{icon}</Box>
      <Typography
        variant="h6"
        sx={{ fontWeight: 'bold', textTransform: 'uppercase', opacity: 0.9 }}
      >
        {label}:
      </Typography>
      <Typography
        variant="h6"
        sx={{
          fontWeight: 'bold',
          color: theme =>
            theme.palette.mode === 'dark'
              ? '#FE5E5E'
              : theme.palette.text.primary,
        }}
      >
        {value}
      </Typography>
    </CardContent>
  </Card>
)

// MiniStat is one inline labeled metric ("Connect 1.2/s") in a node's per-interval aggregation row.
const MiniStat = ({ label, value }: { label: string; value: string }) => (
  <Typography
    variant="caption"
    color="text.secondary"
    sx={{ whiteSpace: 'nowrap' }}
  >
    {label}{' '}
    <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
      {value}
    </Box>
  </Typography>
)

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
  const { command, handleError } = useAdminApi({ authorization, signinSilent })
  const [nodes, setNodes] = useState<any[]>([])
  const [numNodes, setNumNodes] = useState(0)
  const [numConns, setNumConns] = useState(0)
  const [numSubs, setNumSubs] = useState(0)
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
      let totalSubs = 0

      result.nodes.forEach((node: any) => {
        totalConns += node.num_clients
        totalSubs += node.num_subs
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
      setNumSubs(totalSubs)
      setNodes(rows)
      setLoading(false)
    }

    const askInfo = async () => {
      try {
        const data = await command('info')
        handleInfo(data.result)
      } catch (err) {
        handleError(err)
      }
    }

    if (visible) askInfo()
    const intervalId = setInterval(() => visible && askInfo(), 5000)
    return () => clearInterval(intervalId)
  }, [command, handleError, visible])

  const headCellSx = { fontWeight: 'bold', fontSize: '1em' }

  return (
    <Box className="max-w-8xl mx-auto p-8">
      {loading ? (
        <Box>
          <CircularProgress disableShrink color="secondary" />
        </Box>
      ) : (
        <Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 4 }}>
            <SummaryCard
              icon={<Storage sx={{ fontSize: 28 }} />}
              label="Nodes running"
              value={fmtInt(numNodes)}
            />
            <SummaryCard
              icon={<Person sx={{ fontSize: 28 }} />}
              label="Total clients"
              value={fmtInt(numConns)}
            />
            <SummaryCard
              icon={<Subscriptions sx={{ fontSize: 28 }} />}
              label="Total subs"
              value={fmtInt(numSubs)}
            />
          </Box>

          <TableContainer component={Paper}>
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
                  .sort((a, b) => a.uptime - b.uptime)
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
                        <TableCell align="right">
                          {fmtInt(node.clients)}
                        </TableCell>
                        <TableCell align="right">
                          {fmtInt(node.users)}
                        </TableCell>
                        <TableCell align="right">{fmtInt(node.subs)}</TableCell>
                        <TableCell align="right">
                          {fmtInt(node.channels)}
                        </TableCell>
                        {edition === 'pro' && (
                          <TableCell align="right">{node.cpu}</TableCell>
                        )}
                        {edition === 'pro' && (
                          <TableCell align="right">{node.rss}</TableCell>
                        )}
                      </StyledTableRow>
                      {edition === 'pro' && (
                        <TableRow>
                          <TableCell colSpan={9} sx={{ py: 1 }}>
                            <Box
                              sx={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                columnGap: 2,
                                rowGap: 0.5,
                              }}
                            >
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ whiteSpace: 'nowrap' }}
                              >
                                <b>{node.interval}s</b> aggregations
                              </Typography>
                              <Tooltip title="Metrics in this row are aggregated once in the specified interval (determined by node.info_metrics_aggregate_interval server option).">
                                <InfoOutlined
                                  sx={{ fontSize: 16, color: 'text.secondary' }}
                                />
                              </Tooltip>
                              <MiniStat
                                label="Incoming"
                                value={fmtRate(
                                  node.messagesReceived / node.interval
                                )}
                              />
                              <MiniStat
                                label="Outgoing"
                                value={fmtRate(
                                  node.messagesSent / node.interval
                                )}
                              />
                              <MiniStat
                                label="Connect"
                                value={`${node.connectRate}/s`}
                              />
                              <MiniStat
                                label="Subscribe"
                                value={`${node.subscribeRate}/s`}
                              />
                              <MiniStat
                                label="API"
                                value={`${node.apiRate}/s`}
                              />
                              <MiniStat
                                label="Publications"
                                value={fmtRate(
                                  node.publications / node.interval
                                )}
                              />
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ whiteSpace: 'nowrap' }}
                              >
                                Clients:
                              </Typography>
                              {Object.keys(node.connectionsByClient).length >
                              0 ? (
                                Object.entries(node.connectionsByClient).map(
                                  ([client, cnt]) => (
                                    <Chip
                                      key={client}
                                      size="small"
                                      variant="outlined"
                                      color="primary"
                                      label={`${client}: ${fmtInt(
                                        cnt as number
                                      )}`}
                                    />
                                  )
                                )
                              ) : (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  —
                                </Typography>
                              )}
                            </Box>
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
