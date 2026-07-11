import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import BlockIcon from '@mui/icons-material/Block'
import PersonSearchIcon from '@mui/icons-material/PersonSearch'
import QueryStatsIcon from '@mui/icons-material/QueryStats'

import { EmptyState } from 'components/EmptyState'

import { TabProps } from './types'
import { useInspectorApi } from './useInspectorApi'
import { useUserBlockStatus } from './useUserBlockStatus'
import { SearchBar } from './ui'
import { fmtDateTime } from './format'
import { NavChip } from './components/NavChip'
import { UserActions } from './user/UserActions'
import { ConnectionsPanel } from './user/ConnectionsPanel'
import { UserStatusPanel } from './user/UserStatusPanel'
import { UserPushDevices } from './user/UserPushDevices'

// User tab: live connections for a user + operator actions. User status is shown
// only when the feature is enabled server-side.
export const UserInspector = ({
  authorization,
  signinSilent,
  server,
}: TabProps) => {
  const api = useInspectorApi(authorization, signinSilent)
  const [searchParams, setSearchParams] = useSearchParams()

  const active = searchParams.get('user') ?? ''
  const [input, setInput] = useState(active)
  useEffect(() => setInput(active), [active])
  const [rev, setRev] = useState(0)

  const submit = (value?: string) => {
    const u = (value ?? input).trim()
    const next = new URLSearchParams(searchParams)
    if (u) next.set('user', u)
    else next.delete('user')
    setSearchParams(next, { replace: true })
  }

  const goToChannel = (channel: string) => {
    const next = new URLSearchParams(searchParams)
    next.delete('tab') // channel is the default tab
    next.set('channel', channel)
    next.delete('user')
    setSearchParams(next)
  }

  const block = useUserBlockStatus(active, api, rev)

  return (
    <Box>
      <Box sx={{ maxWidth: 720, mb: 3 }}>
        <SearchBar
          value={input}
          onChange={setInput}
          onSubmit={() => submit()}
          placeholder="User ID, e.g. 42"
          autoFocus={!active}
        />
      </Box>

      {!active ? (
        <EmptyState
          icon={<PersonSearchIcon sx={{ fontSize: 40 }} />}
          title="Inspect a user"
          hint="Enter a user ID to see their live connections and subscriptions, and to block, disconnect, or invalidate their tokens."
        />
      ) : (
        <>
          {server.error && (
            <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
              Could not load server configuration — durability and status
              indicators may be inaccurate. Connections and actions still work.
            </Alert>
          )}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              mb: 2,
              flexWrap: 'wrap',
            }}
          >
            <Typography
              variant="h6"
              sx={{ fontFamily: 'monospace', fontWeight: 600 }}
            >
              {active}
            </Typography>
            {block.blocked && (
              <Tooltip
                title={
                  block.expireAt
                    ? `Block expires ${fmtDateTime(block.expireAt * 1000)}`
                    : 'Block has no expiration'
                }
                arrow
              >
                <Chip
                  icon={<BlockIcon />}
                  size="small"
                  color="error"
                  label={block.expireAt ? 'Blocked' : 'Blocked · permanent'}
                />
              </Tooltip>
            )}
            {server.pushDevicesSupported && (
              <UserPushDevices user={active} api={api} refreshKey={rev} />
            )}
            {server.analyticsEnabled && (
              <NavChip
                icon={<QueryStatsIcon />}
                label="Analytics history"
                to={`/analytics?tab=user&user=${encodeURIComponent(active)}`}
                tooltip="View this user's historical analytics"
              />
            )}
          </Box>

          <Box sx={{ mb: 2 }}>
            <UserActions
              user={active}
              api={api}
              server={server}
              blocked={block.blocked}
              blockKnown={block.supported && !block.loading}
              onChanged={() => setRev(r => r + 1)}
            />
          </Box>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: server.userStatusEnabled ? 8 : 12 }}>
              <ConnectionsPanel
                user={active}
                api={api}
                onGoToChannel={goToChannel}
                analyticsEnabled={server.analyticsEnabled}
                refreshKey={rev}
              />
            </Grid>
            {server.userStatusEnabled && (
              <Grid size={{ xs: 12, md: 4 }}>
                <UserStatusPanel user={active} api={api} refreshKey={rev} />
              </Grid>
            )}
          </Grid>
        </>
      )}
    </Box>
  )
}
