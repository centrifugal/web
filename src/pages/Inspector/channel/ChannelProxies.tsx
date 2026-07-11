import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

import { ChannelOptions } from '../channelOptions'
import { CapabilityChip } from '../ui'

// Event-routing (proxy) chips for a channel. Shown near the top and only when at
// least one proxy is configured — otherwise renders nothing.
export const ChannelProxies = ({ options: o }: { options: ChannelOptions }) => {
  const proxies: Array<[string, boolean | undefined, string | undefined]> = [
    ['Subscribe', o.subscribe_proxy_enabled, o.subscribe_proxy_name],
    ['Publish', o.publish_proxy_enabled, o.publish_proxy_name],
    ['Sub refresh', o.sub_refresh_proxy_enabled, o.sub_refresh_proxy_name],
    [
      o.subscribe_stream_proxy_bidirectional
        ? 'Subscribe stream (bidirectional)'
        : 'Subscribe stream',
      o.subscribe_stream_proxy_enabled,
      o.subscribe_stream_proxy_name,
    ],
    ['Cache empty', o.cache_empty_proxy_enabled, o.cache_empty_proxy_name],
    ['Channel state', o.state_proxy_enabled, undefined],
  ]
  const active = proxies.filter(([, on]) => on)
  if (active.length === 0) return null

  return (
    <Box sx={{ mb: 2 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mb: 0.5 }}
      >
        Event routing (proxies)
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
        {active.map(([label, , name]) => (
          <CapabilityChip
            key={label}
            tone="warn"
            label={name && name !== 'default' ? `${label} → ${name}` : label}
          />
        ))}
      </Box>
    </Box>
  )
}
