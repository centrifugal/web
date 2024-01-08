import { useEffect, useContext, useState } from 'react'
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

import { globalUrlPrefix } from 'config/url'
import { HumanSeconds, HumanSize } from 'utils/Functions'
import { ShellContext } from 'contexts/ShellContext'
import { Chip } from '@mui/material'

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': {
    backgroundColor: theme.palette.action.hover,
  },
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
  rss: string
) {
  return { name, version, uptime, clients, users, subs, channels, cpu, rss }
}

export function Status({ signinSilent, authorization, edition }: StatusProps) {
  const { showAlert } = useContext(ShellContext)
  const [nodes, setNodes] = useState<any[]>([])
  const [numNodes, setNumNodes] = useState(0)
  const [numConns, setNumConns] = useState(0)
  const [loading, setLoading] = useState(true)
  const { setTitle } = useContext(ShellContext)

  const [visibilityListenerSet, setVisibilityListenerSet] = useState(false)
  const [visible, setVisible] = useState(document.visibilityState === 'visible')

  // automatically sign-in
  useEffect(() => {
    if (visibilityListenerSet) {
      return
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        setVisible(false)
      } else {
        setVisible(true)
      }
    })
    setVisibilityListenerSet(true)
  }, [visibilityListenerSet])

  useEffect(() => {
    setTitle('Centrifugo | Status')
  }, [setTitle])

  useEffect(() => {
    const handleInfo = function (result: any) {
      const rows: any[] = []
      const resultNodes: any[] = result.nodes
      setNumNodes(resultNodes.length)
      let nConns = 0

      resultNodes.forEach(node => {
        nConns += node.num_clients
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
            node.process ? HumanSize(node.process.rss) : 'n/a'
          )
        )
      })

      setNumConns(nConns)
      setNodes(rows)
    }

    const askInfo = function () {
      const headers = {
        Accept: 'application/json',
        Authorization: authorization,
      }

      fetch(`${globalUrlPrefix}admin/api`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          method: 'info',
          params: {},
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
          if (!data) {
            return
          }
          handleInfo(data.result)
          setLoading(false)
        })
        .catch(e => {
          showAlert('Error connecting to server', { severity: 'error' })
          console.log(e)
        })
    }

    if (visible) {
      askInfo()
    }
    const interval = setInterval(function () {
      if (!visible) {
        return
      }
      askInfo()
    }, 5000)
    return () => clearInterval(interval)
  }, [signinSilent, showAlert, authorization, visible])

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
          <TableContainer sx={{ mt: 4 }} component={Paper}>
            <Table aria-label="simple table">
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
                  {edition === 'pro' ? (
                    <TableCell sx={headCellSx} align="right">
                      CPU %
                    </TableCell>
                  ) : (
                    <></>
                  )}
                  {edition === 'pro' ? (
                    <TableCell sx={headCellSx} align="right">
                      RSS
                    </TableCell>
                  ) : (
                    <></>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {nodes
                  .sort((a, b) => (a.uptime > b.uptime ? 1 : -1))
                  .map(node => (
                    <StyledTableRow
                      key={node.name}
                      sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
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
                      {edition === 'pro' ? (
                        <TableCell align="right">{node.cpu}</TableCell>
                      ) : (
                        <></>
                      )}
                      {edition === 'pro' ? (
                        <TableCell align="right">{node.rss}</TableCell>
                      ) : (
                        <></>
                      )}
                    </StyledTableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  )
}
