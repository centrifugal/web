import { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import BlockIcon from '@mui/icons-material/Block'
import UndoIcon from '@mui/icons-material/Undo'

import { CompressionApiHook, Version, VersionValue } from '../api'
import { fmtInt } from '../format'

interface VersionValuesDialogProps {
  api: CompressionApiHook
  // The version whose values are shown; open whenever this is non-null.
  version: Version | null
  // Withdrawing takes ops:write; without it the dialog only lists.
  canWithdraw: boolean
  onClose: () => void
  // Called with the new version once values were withdrawn.
  onWithdrawn: (created: Version) => void
}

// VersionValuesDialog: what a version ships, and the way to take a value back
// that should never have been approved - without training again. Withdrawing
// rebuilds the version without it as a new version, which replaces the old one
// if it was active, and the denial is remembered for the profile.
export const VersionValuesDialog = ({
  api,
  version,
  canWithdraw,
  onClose,
  onWithdrawn,
}: VersionValuesDialogProps) => {
  const [values, setValues] = useState<VersionValue[] | null>(null)
  const [denied, setDenied] = useState<Set<string>>(new Set())
  const [deniedFields, setDeniedFields] = useState<Set<string>>(new Set())
  const [menu, setMenu] = useState<{
    anchor: HTMLElement
    value: VersionValue
  } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    setValues(null)
    setSearch('')
    setDenied(new Set())
    setDeniedFields(new Set())
    if (!version) return
    let cancelled = false
    api
      .listVersionValues(version.id)
      .then(r => {
        if (!cancelled) setValues(r.values ?? [])
      })
      .catch(err => {
        if (!cancelled) {
          setValues([])
          api.handleError(err)
        }
      })
    return () => {
      cancelled = true
    }
  }, [api, version])

  if (!version) return null

  const toggle = (
    set: Set<string>,
    update: (s: Set<string>) => void,
    key: string
  ) => {
    const next = new Set(set)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    update(next)
  }
  const withdrawn = (values ?? []).filter(
    v => denied.has(v.value_hash) || deniedFields.has(v.path)
  ).length

  const handleWithdraw = async () => {
    setSubmitting(true)
    try {
      const created = await api.denyVersionValues(version.id, {
        denied: Array.from(denied),
        denied_fields: Array.from(deniedFields),
      })
      onWithdrawn(created)
    } catch (err) {
      api.handleError(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open
      onClose={() => !submitting && onClose()}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>Values in this version</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Every value here is shown to this profile&apos;s audience. Deny one
          that should not be, and the version is rebuilt without it
          {version.active
            ? `, replacing the active one at ${version.rollout_percent}%`
            : ''}
          . Denials are remembered, so later training never recommends them.
          Connections that already hold this dictionary keep it until they
          reconnect.
        </Typography>
        <TextField
          size="small"
          fullWidth
          placeholder="Search value or key path"
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ mb: 1 }}
        />
        {values === null ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress disableShrink />
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Key path</TableCell>
                <TableCell>Value</TableCell>
                <TableCell align="right">Witnesses</TableCell>
                <TableCell padding="checkbox"></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {values
                .filter(v => {
                  const q = search.trim().toLowerCase()
                  return (
                    !q ||
                    v.path.toLowerCase().includes(q) ||
                    v.value.toLowerCase().includes(q)
                  )
                })
                .map(v => {
                  const fieldDenied = deniedFields.has(v.path)
                  const rowDenied = fieldDenied || denied.has(v.value_hash)
                  return (
                    <TableRow
                      key={v.value_hash}
                      sx={rowDenied ? { opacity: 0.6 } : undefined}
                    >
                      <TableCell sx={{ fontFamily: 'monospace' }}>
                        {v.path}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>
                        {rowDenied && (
                          <Chip
                            size="small"
                            color="error"
                            variant="outlined"
                            label={fieldDenied ? 'field denied' : 'denied'}
                            sx={{ mr: 1, fontFamily: 'inherit' }}
                          />
                        )}
                        {v.value}
                      </TableCell>
                      <TableCell align="right">{fmtInt(v.witnesses)}</TableCell>
                      <TableCell padding="checkbox">
                        {!canWithdraw ? null : rowDenied ? (
                          <Tooltip title="Keep it">
                            <IconButton
                              size="small"
                              aria-label={`Keep ${v.path} = ${v.value}`}
                              onClick={() =>
                                fieldDenied
                                  ? toggle(
                                      deniedFields,
                                      setDeniedFields,
                                      v.path
                                    )
                                  : toggle(denied, setDenied, v.value_hash)
                              }
                            >
                              <UndoIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Tooltip title="Deny - take it out of this version">
                            <IconButton
                              size="small"
                              aria-label={`Deny ${v.path} = ${v.value}`}
                              onClick={e =>
                                setMenu({ anchor: e.currentTarget, value: v })
                              }
                            >
                              <BlockIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
        )}
        <Menu
          anchorEl={menu?.anchor}
          open={menu !== null}
          onClose={() => setMenu(null)}
        >
          <MenuItem
            onClick={() => {
              if (menu) toggle(denied, setDenied, menu.value.value_hash)
              setMenu(null)
            }}
          >
            Deny this value
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (menu) toggle(deniedFields, setDeniedFields, menu.value.path)
              setMenu(null)
            }}
          >
            Deny every value of&nbsp;
            <Typography component="span" sx={{ fontFamily: 'monospace' }}>
              {menu?.value.path}
            </Typography>
          </MenuItem>
        </Menu>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose} disabled={submitting}>
          {canWithdraw ? 'Cancel' : 'Close'}
        </Button>
        {canWithdraw && (
          <Button
            variant="solid"
            color="warning"
            onClick={handleWithdraw}
            disabled={withdrawn === 0 || submitting}
            startIcon={
              submitting ? <CircularProgress size={16} color="inherit" /> : null
            }
          >
            {withdrawn === 0
              ? 'Withdraw'
              : `Withdraw ${withdrawn} value${withdrawn === 1 ? '' : 's'}`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
