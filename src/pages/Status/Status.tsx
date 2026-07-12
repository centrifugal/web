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
import { EmptyState } from 'components/EmptyState'
import { Card, CardContent } from '@mui/material'
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
              ? theme.palette.primary.main
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

// Distribution renders a label plus a compact "key value · key value" breakdown as
// plain inline text (no chips) so many buckets stay on one line. Each key/value pair
// is kept unbreakable, but the list may wrap between pairs when it must.
const Distribution = ({
  label,
  data,
}: {
  label: string
  data: Record<string, number>
}) => {
  const entries = Object.entries(data)
  return (
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'baseline' }}
    >
      <Box component="span" sx={{ mr: 0.75 }}>
        {label}
      </Box>
      {entries.length === 0 ? (
        '—'
      ) : (
        <Box
          component="span"
          sx={{ display: 'inline-flex', flexWrap: 'wrap', columnGap: 1 }}
        >
          {entries.map(([k, v]) => (
            <Box component="span" key={k} sx={{ whiteSpace: 'nowrap' }}>
              {k}{' '}
              <Box
                component="span"
                sx={{ fontWeight: 700, color: 'text.primary' }}
              >
                {fmtInt(v)}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Typography>
  )
}

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
  connectionsByTransport: Record<string, number>,
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
    connectionsByTransport,
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
  const { command, handleError } = useAdminApi({ authorization, signinSilent })
  const [nodes, setNodes] = useState<ReturnType<typeof createData>[]>([])
  const [numNodes, setNumNodes] = useState(0)
  const [numConns, setNumConns] = useState(0)
  const [numSubs, setNumSubs] = useState(0)
  const [loading, setLoading] = useState(true)
  const { setTitle } = useContext(ShellContext)

  const [visible, setVisible] = useState(document.visibilityState === 'visible')

  useEffect(() => {
    const onVisibilityChange = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () =>
      document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

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

        // Connections grouped by client_name. The connections_inflight gauge is
        // labeled {transport, accept_protocol, client_name, client_version}. The
        // server reports the name verbatim only when registered, "unregistered" for
        // an unrecognized name, and "unnamed" when the client sent no name — so every
        // series carries a client_name segment. Older servers instead left the label
        // empty and the metric aggregator dropped it (key had no client_name segment
        // at all, e.g. "...connections_inflight.transport.uni_http_stream"); we treat
        // that missing-segment case as "unnamed" too. Skip zero series.
        const connectionsByClient: Record<string, number> = {}
        const connectionsByTransport: Record<string, number> = {}
        const connPrefix = 'centrifugo.client.connections_inflight.'
        Object.entries(items).forEach(([key, value]) => {
          if (!key.startsWith(connPrefix)) return
          const n = Number(value)
          if (!n) return
          let name = 'unnamed'
          const marker = 'client_name.'
          const at = key.indexOf(marker, connPrefix.length)
          if (at !== -1) {
            // The client_name value runs until the next label segment. Labels are
            // emitted alphabetically, so client_version/transport follow client_name.
            let tail = key.slice(at + marker.length)
            for (const b of ['.client_version.', '.transport.']) {
              const cut = tail.indexOf(b)
              if (cut !== -1) tail = tail.slice(0, cut)
            }
            name = tail || 'unnamed'
          }
          connectionsByClient[name] = (connectionsByClient[name] || 0) + n

          // transport is the last label alphabetically, so its value runs to the
          // end of the key (transports have no dots — e.g. "admin:uni_stream").
          const tAt = key.indexOf('.transport.')
          if (tAt !== -1) {
            const transport = key.slice(tAt + '.transport.'.length)
            connectionsByTransport[transport] =
              (connectionsByTransport[transport] || 0) + n
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
            connectionsByTransport,
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

  return (
    <Box className="max-w-8xl mx-auto p-8">
      {loading ? (
        <Box>
          <CircularProgress disableShrink />
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

          {nodes.length === 0 ? (
            <Paper>
              <EmptyState
                icon={<Storage sx={{ fontSize: 40 }} />}
                title="No nodes reporting"
                hint="No Centrifugo nodes are currently reporting to this instance."
              />
            </Paper>
          ) : (
            <TableContainer component={Paper}>
              <Table aria-label="detailed status table">
                <TableHead>
                  <TableRow>
                    <TableCell>Node name</TableCell>
                    <TableCell align="right">Version</TableCell>
                    <TableCell align="right">Uptime</TableCell>
                    <TableCell align="right">Clients</TableCell>
                    <TableCell align="right">Users</TableCell>
                    <TableCell align="right">Subs</TableCell>
                    <TableCell align="right">Channels</TableCell>
                    {edition === 'pro' && (
                      <TableCell align="right">CPU %</TableCell>
                    )}
                    {edition === 'pro' && (
                      <TableCell align="right">RSS</TableCell>
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
                          <TableCell align="right">
                            {fmtInt(node.subs)}
                          </TableCell>
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
                                    sx={{
                                      fontSize: 16,
                                      color: 'text.secondary',
                                    }}
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
                                <Distribution
                                  label="Clients:"
                                  data={node.connectionsByClient}
                                />
                                <Distribution
                                  label="Transports:"
                                  data={node.connectionsByTransport}
                                />
                              </Box>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}
    </Box>
  )
}
