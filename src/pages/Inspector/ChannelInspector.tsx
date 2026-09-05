import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import TravelExploreIcon from '@mui/icons-material/TravelExplore'

import { EmptyState } from 'components/EmptyState'

import { TabProps } from './types'
import { useInspectorApi } from './useInspectorApi'
import { useChannelResolution } from './useChannelResolution'
import { SearchBar } from './ui'
import {
  hasPresence,
  isCacheRecovery,
  isLinearHistory,
  isMapType,
} from './channelOptions'
import { CapabilityHeader } from './channel/CapabilityHeader'
import { ChannelActions } from './channel/ChannelActions'
import { ChannelProxies } from './channel/ChannelProxies'
import { PresencePanel } from './channel/PresencePanel'
import { HistoryPanel } from './channel/HistoryPanel'
import { MapPanel } from './channel/MapPanel'

// Channel tab: resolve a channel's effective namespace options from config, then
// render only the live panels and actions that the configuration supports.
export const ChannelInspector = ({
  authorization,
  signinSilent,
  server,
}: TabProps) => {
  const api = useInspectorApi(authorization, signinSilent)
  const [searchParams, setSearchParams] = useSearchParams()

  const active = searchParams.get('channel') ?? ''
  const [input, setInput] = useState(active)
  useEffect(() => setInput(active), [active])
  // Bump to force live panels to remount/refresh after a mutating action.
  const [rev, setRev] = useState(0)

  const submit = (value?: string) => {
    const ch = (value ?? input).trim()
    const next = new URLSearchParams(searchParams)
    if (ch) next.set('channel', ch)
    else next.delete('channel')
    setSearchParams(next, { replace: true })
  }

  const goToUser = (user: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', 'user')
    next.set('user', user)
    next.delete('channel')
    setSearchParams(next)
  }

  // Server-accurate resolution (namespace + PRO patterns), with client fallback.
  const { loading: resolving, resolved } = useChannelResolution(
    active,
    api,
    server
  )

  const suggestions = useMemo(
    () => server.namespaces.map(n => `${n}${server.namespaceBoundary}`),
    [server.namespaces, server.namespaceBoundary]
  )

  const o = resolved?.options ?? {}
  // An unknown namespace hides the live panels, but only when the server itself
  // said so: the client-side fallback mis-resolves private-prefixed and pattern
  // channels, and hiding presence/history on its guess is worse than showing them.
  const showPanels = !!resolved && (resolved.known || !resolved.verified)

  return (
    <Box>
      <Box sx={{ maxWidth: 720, mb: 3 }}>
        <SearchBar
          value={input}
          onChange={setInput}
          onSubmit={() => submit()}
          placeholder="Channel name, e.g. chat:room42"
          loading={resolving}
          suggestions={suggestions}
          autoFocus={!active}
        />
      </Box>

      {!active ? (
        <EmptyState
          icon={<TravelExploreIcon sx={{ fontSize: 40 }} />}
          title="Inspect a channel"
          hint="Enter a channel name to see its resolved namespace options, live presence and history, and the actions available for it."
        />
      ) : resolving && !resolved ? (
        <CircularProgress />
      ) : resolved ? (
        <>
          <CapabilityHeader resolved={resolved} />

          {showPanels && <ChannelProxies options={o} />}

          <Box sx={{ mb: 2 }}>
            <ChannelActions
              channel={active}
              analyticsEnabled={server.analyticsEnabled}
            />
          </Box>

          {showPanels && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {hasPresence(o) && (
                <PresencePanel
                  channel={active}
                  api={api}
                  onGoToUser={goToUser}
                  refreshKey={rev}
                />
              )}
              {isLinearHistory(o) && (
                <HistoryPanel
                  channel={active}
                  api={api}
                  cacheMode={isCacheRecovery(o)}
                  onPurged={() => setRev(r => r + 1)}
                  refreshKey={rev}
                />
              )}
              {isMapType(o) && (
                <MapPanel channel={active} api={api} refreshKey={rev} />
              )}
            </Box>
          )}
        </>
      ) : null}
    </Box>
  )
}
