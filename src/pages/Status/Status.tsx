import { useEffect, useContext, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'

import { HumanSeconds, HumanSize } from 'utils/Functions'
import { ShellContext } from 'contexts/ShellContext'
import { Chip } from '@mui/material'

interface StatusProps {
  handleLogout: () => void
  insecure: boolean
}

const globalUrlPrefix = 'http://localhost:8000/' // window.location.pathname

function createData(
  name: string,
  version: string,
  uptime: string,
  clients: number,
  users: number,
  subs: number,
  channels: number,
  cpu: string | number,
  rss: string
) {
  return { name, version, uptime, clients, users, subs, channels, cpu, rss }
}

export function Status({ handleLogout, insecure }: StatusProps) {
  const { setTitle, showAlert } = useContext(ShellContext)
  const [nodes, setNodes] = useState<any[]>([])
  const [numNodes, setNumNodes] = useState(0)
  const [numConns, setNumConns] = useState(0)

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
          HumanSeconds(node.uptime),
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

  useEffect(() => {
    const askInfo = function () {
      const headers: any = {
        Accept: 'application/json',
      }
      if (!insecure) {
        headers.Authorization = `token ${localStorage.getItem('token')}`
      }
  
      fetch(`${globalUrlPrefix}admin/api`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          method: 'info',
          params: {},
        }),
        mode: 'cors',
      })
        .then(response => {
          if (!response.ok) {
            if (response.status === 401) {
              handleLogout()
              return
            }
            throw Error(response.status.toString())
          }
          return response.json()
        })
        .then(data => {
          handleInfo(data.result)
        })
        .catch(e => {
          showAlert("Error connecting to server", {severity: 'error'})
          console.log(e)
        })
    }

    const interval = setInterval(function() {
      askInfo()
    }, 5000);
    setTitle('Centrifugo')
    askInfo()
    return () => clearInterval(interval);
  }, [setTitle, handleLogout, insecure, showAlert]);

  return (
    <Box className="max-w-8xl mx-auto p-8">
      <Typography variant="h5" sx={{ mb: 1 }}>
        Nodes running: <Chip label={numNodes} sx={{ fontSize: '1em' }} /> Total
        clients: <Chip label={numConns} sx={{ fontSize: '1em' }} />
      </Typography>
      <TableContainer sx={{ mt: 4 }} component={Paper}>
        <Table aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Node name</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="right">
                Version
              </TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="right">
                Uptime
              </TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="right">
                Clients
              </TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="right">
                Users
              </TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="right">
                Subs
              </TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="right">
                Channels
              </TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="right">
                CPU %
              </TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="right">
                RSS
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {nodes.map(node => (
              <TableRow
                key={node.name}
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  {node.name}
                </TableCell>
                <TableCell align="right">{node.version}</TableCell>
                <TableCell align="right">{node.uptime}</TableCell>
                <TableCell align="right">{node.clients}</TableCell>
                <TableCell align="right">{node.users}</TableCell>
                <TableCell align="right">{node.subs}</TableCell>
                <TableCell align="right">{node.channels}</TableCell>
                <TableCell align="right">{node.cpu}</TableCell>
                <TableCell align="right">{node.rss}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
