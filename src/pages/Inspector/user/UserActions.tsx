import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import BlockIcon from '@mui/icons-material/Block'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import KeyOffIcon from '@mui/icons-material/KeyOff'
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew'
import TimelineIcon from '@mui/icons-material/Timeline'

import { ConfirmButton } from 'components/ConfirmButton'
import { DurabilityBadge } from '../components/DurabilityBadge'
import { InspectorApi } from '../types'
import { ServerConfig } from '../useServerConfig'

// User-level operator actions. Block/Invalidate carry durability badges so the
// operator knows whether the effect survives a restart.
export const UserActions = ({
  user,
  api,
  server,
  blocked,
  blockKnown,
  onChanged,
}: {
  user: string
  api: InspectorApi
  server: ServerConfig
  // Current block state; when blockKnown is false (older server / still loading)
  // both Block and Unblock are shown since we can't tell.
  blocked?: boolean
  blockKnown?: boolean
  onChanged?: () => void
}) => {
  const navigate = useNavigate()
  const [blockOpen, setBlockOpen] = useState(false)

  // Block is always available (re-block changes the duration); Unblock only when
  // the user is or might be blocked.
  const showUnblock = !blockKnown || blocked

  const act = async (method: string, params: any, ok: string) => {
    try {
      await api.call(method, params)
      api.showAlert(ok, { severity: 'success' })
      onChanged?.()
    } catch (e: any) {
      api.showAlert(e?.message || 'Action failed', { severity: 'error' })
    }
  }

  return (
    <Box
      sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}
    >
      <Button
        variant="tonal"
        size="small"
        color="error"
        startIcon={<BlockIcon />}
        onClick={() => setBlockOpen(true)}
      >
        {blockKnown && blocked ? 'Change block' : 'Block'}
        <DurabilityBadge durability={server.blockDurability} inline />
      </Button>

      {showUnblock && (
        <ConfirmButton
          title="Unblock user?"
          body={`Removes any active block for "${user}".`}
          confirmText="Unblock"
          confirmColor="primary"
          onConfirm={() => act('unblock_user', { user }, 'User unblocked')}
        >
          {open => (
            <Button
              variant="solid"
              color="primary"
              size="small"
              startIcon={<LockOpenIcon />}
              onClick={open}
            >
              Unblock
            </Button>
          )}
        </ConfirmButton>
      )}

      <ConfirmButton
        title="Invalidate all tokens?"
        body={`Invalidates every connection token for "${user}" issued before now. Existing connections drop on their next token check; the user must obtain a fresh token.`}
        confirmText="Invalidate"
        onConfirm={() =>
          act(
            'invalidate_user_tokens',
            { user, issued_before: Math.floor(Date.now() / 1000) },
            'Tokens invalidated'
          )
        }
      >
        {open => (
          <Button
            variant="tonal"
            size="small"
            color="warning"
            startIcon={<KeyOffIcon />}
            onClick={open}
          >
            Invalidate tokens
            <DurabilityBadge durability={server.invalidateDurability} inline />
          </Button>
        )}
      </ConfirmButton>

      <ConfirmButton
        title="Disconnect all connections?"
        body={`Disconnects every active connection of "${user}".`}
        confirmText="Disconnect all"
        onConfirm={() => act('disconnect', { user }, 'User disconnected')}
      >
        {open => (
          <Button
            variant="tonal"
            size="small"
            color="error"
            startIcon={<PowerSettingsNewIcon />}
            onClick={open}
          >
            Disconnect all
          </Button>
        )}
      </ConfirmButton>

      <Box sx={{ flexGrow: 1 }} />
      <Button
        variant="tonal"
        color="info"
        size="small"
        startIcon={<TimelineIcon />}
        onClick={() => navigate(`/tracing?user=${encodeURIComponent(user)}`)}
      >
        Trace
      </Button>

      <BlockDialog
        open={blockOpen}
        onClose={() => setBlockOpen(false)}
        user={user}
        onBlock={expireAt =>
          act('block_user', { user, expire_at: expireAt }, 'User blocked')
        }
      />
    </Box>
  )
}

const DURATIONS = [
  { label: '1 hour', seconds: 3600 },
  { label: '24 hours', seconds: 86400 },
  { label: '7 days', seconds: 7 * 86400 },
  { label: '30 days', seconds: 30 * 86400 },
  { label: 'Permanent', seconds: 0 },
]

const BlockDialog = ({
  open,
  onClose,
  user,
  onBlock,
}: {
  open: boolean
  onClose: () => void
  user: string
  onBlock: (expireAt: number) => Promise<void> | void
}) => {
  const [choice, setChoice] = useState('86400')
  const submit = async () => {
    const seconds = parseInt(choice)
    const expireAt = seconds === 0 ? 0 : Math.floor(Date.now() / 1000) + seconds
    await onBlock(expireAt)
    onClose()
  }
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Block {user}</DialogTitle>
      <DialogContent>
        <TextField
          select
          fullWidth
          margin="normal"
          label="Block duration"
          value={choice}
          onChange={e => setChoice(e.target.value)}
          helperText="Blocked users are disconnected and cannot reconnect until the block expires."
        >
          {DURATIONS.map(d => (
            <MenuItem key={d.seconds} value={String(d.seconds)}>
              {d.label}
            </MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="tonal" color="error" onClick={submit}>
          Block
        </Button>
      </DialogActions>
    </Dialog>
  )
}
