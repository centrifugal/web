import { useContext, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import CircularProgress from '@mui/material/CircularProgress'
import CompressIcon from '@mui/icons-material/Compress'

import { ShellContext } from 'contexts/ShellContext'
import { EmptyState } from 'components/EmptyState'

import { useCompressionApi, CompressionApiError } from './api'
import { OverviewTab } from './tabs/OverviewTab'
import { ProfilesTab } from './tabs/ProfilesTab'
import { SessionsTab } from './tabs/SessionsTab'
import { StructureTab } from './tabs/StructureTab'

interface CompressionProps {
  signinSilent: () => void
  authorization: string
}

type TabKey = 'overview' | 'profiles' | 'sessions' | 'structure'

const TAB_KEYS: TabKey[] = ['overview', 'profiles', 'sessions', 'structure']

// Compression: the dictionary compression admin section (tab host), mirroring
// the Inspector page's shape. Tabs are URL-synced via `?tab=`, the default tab
// (Overview) deletes the param, and only the active tab is mounted so exactly
// one tab polls at a time.
export const Compression = ({
  signinSilent,
  authorization,
}: CompressionProps) => {
  const { setTitle } = useContext(ShellContext)
  const [searchParams, setSearchParams] = useSearchParams()
  const api = useCompressionApi({ authorization, signinSilent })

  useEffect(() => {
    setTitle('Centrifugo | Dictionary Compression')
  }, [setTitle])

  const tabParam = searchParams.get('tab')
  const tab: TabKey = TAB_KEYS.includes(tabParam as TabKey)
    ? (tabParam as TabKey)
    : 'overview'

  const handleTab = (_: React.SyntheticEvent, value: TabKey) => {
    const next = new URLSearchParams(searchParams)
    if (value === 'overview') next.delete('tab')
    else next.set('tab', value)
    // Drill-downs belong to the tab that opened them (see useUrlSelection).
    // Carrying ?profile= into the sessions tab would leave the URL describing
    // a place nothing is rendering, and restore it if you came back.
    next.delete('profile')
    next.delete('session')
    next.delete('candidate')
    setSearchParams(next, { replace: true })
  }

  // Every dictionary compression handler 404s when the feature is disabled in
  // config. Rather than let each tab discover that independently, probe once
  // here with GET /compression and hide the whole section if it 404s.
  const [available, setAvailable] = useState<'loading' | 'yes' | 'no'>(
    'loading'
  )

  useEffect(() => {
    let cancelled = false
    setAvailable('loading')
    api
      .getCompression()
      .then(() => {
        if (!cancelled) setAvailable('yes')
      })
      .catch(err => {
        if (cancelled) return
        if (err instanceof CompressionApiError && err.status === 404) {
          setAvailable('no')
        } else {
          // A transient/auth error shouldn't hide the section outright — let
          // the active tab's own fetch surface it instead.
          api.handleError(err)
          setAvailable('yes')
        }
      })
    return () => {
      cancelled = true
    }
    // Re-probe only when identity changes, not on every api re-creation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorization])

  if (available === 'loading') {
    return (
      <Box
        className="max-w-8xl mx-auto p-8"
        sx={{ display: 'flex', justifyContent: 'center' }}
      >
        <CircularProgress disableShrink />
      </Box>
    )
  }

  if (available === 'no') {
    return (
      <Box className="max-w-8xl mx-auto p-8">
        <EmptyState
          icon={<CompressIcon sx={{ fontSize: 40 }} />}
          title="Dictionary compression is disabled"
          hint="Enable it in the server configuration to train, review, and serve preset dictionaries."
        />
      </Box>
    )
  }

  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2.5 }}>
        <Tabs value={tab} onChange={handleTab}>
          <Tab label="Overview" value="overview" />
          <Tab label="Profiles" value="profiles" />
          <Tab label="Sessions" value="sessions" />
          <Tab label="Structure" value="structure" />
        </Tabs>
      </Box>

      <Box className="max-w-8xl mx-auto p-8">
        {tab === 'overview' && (
          <OverviewTab
            authorization={authorization}
            signinSilent={signinSilent}
          />
        )}
        {tab === 'profiles' && (
          <ProfilesTab
            authorization={authorization}
            signinSilent={signinSilent}
          />
        )}
        {tab === 'sessions' && (
          <SessionsTab
            authorization={authorization}
            signinSilent={signinSilent}
          />
        )}
        {tab === 'structure' && (
          <StructureTab
            authorization={authorization}
            signinSilent={signinSilent}
          />
        )}
      </Box>
    </Box>
  )
}

export default Compression
