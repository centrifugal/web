import { useContext, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'

import { ShellContext } from 'contexts/ShellContext'

import { useServerConfig } from './useServerConfig'
import { ChannelInspector } from './ChannelInspector'
import { UserInspector } from './UserInspector'

interface InspectorProps {
  signinSilent: () => void
  authorization: string
}

type TabKey = 'channel' | 'user'

// Inspector: a live, config-aware operational view of a single channel or user.
// Two tabs (Channel / User) driven by `?tab=`, mirroring the Analytics tab host.
export const Inspector = ({ signinSilent, authorization }: InspectorProps) => {
  const { setTitle } = useContext(ShellContext)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    setTitle('Centrifugo | Inspector')
  }, [setTitle])

  const tab: TabKey = searchParams.get('tab') === 'user' ? 'user' : 'channel'

  const handleTab = (_: React.SyntheticEvent, value: TabKey) => {
    const next = new URLSearchParams(searchParams)
    if (value === 'channel') next.delete('tab')
    else next.set('tab', value)
    setSearchParams(next, { replace: true })
  }

  // Single config fetch shared by both tabs (namespace resolution + gating facts).
  const server = useServerConfig(authorization)

  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2.5 }}>
        <Tabs value={tab} onChange={handleTab}>
          <Tab label="Channel" value="channel" />
          <Tab label="User" value="user" />
        </Tabs>
      </Box>

      <Box className="max-w-8xl mx-auto p-8">
        {tab === 'channel' ? (
          <ChannelInspector
            authorization={authorization}
            signinSilent={signinSilent}
            server={server}
          />
        ) : (
          <UserInspector
            authorization={authorization}
            signinSilent={signinSilent}
            server={server}
          />
        )}
      </Box>
    </Box>
  )
}

export default Inspector
