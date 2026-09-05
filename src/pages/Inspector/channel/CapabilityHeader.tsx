import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import { alpha, useTheme } from '@mui/material/styles'

import {
  ChannelOptions,
  ResolvedChannel,
  channelRest,
  subscriptionType,
  hasPresence,
  hasHistory,
  isCacheRecovery,
  isStreamProxied,
} from '../channelOptions'
import { CapabilityChip } from '../ui'

const TYPE_COLORS: Record<string, string> = {
  stream: '#03a9f4',
  map: '#7e57c2',
  map_clients: '#7e57c2',
  map_users: '#7e57c2',
  shared_poll: '#26a69a',
}

// Test the channel-name part (after the namespace prefix) against channel_regex.
// Returns null when there's no regex, or the regex is invalid.
const regexMatch = (
  resolved: ResolvedChannel,
  boundary: string
): boolean | null => {
  const re = resolved.options.channel_regex
  if (!re) return null
  // The namespace name isn't necessarily the literal channel prefix (a private
  // channel is `$news:index` but resolves to `news`), so cut at the boundary
  // rather than by the namespace name's length.
  const rest = channelRest(resolved.channel, boundary)
  try {
    return new RegExp(re).test(rest)
  } catch {
    return null
  }
}

// The "what is this channel" header: resolved namespace, a prominent
// subscription-type badge, and the enabled capabilities as chips.
export const CapabilityHeader = ({
  resolved,
  boundary,
}: {
  resolved: ResolvedChannel
  boundary: string
}) => {
  const theme = useTheme()
  const o: ChannelOptions = resolved.options
  const type = subscriptionType(o)
  const typeColor = TYPE_COLORS[type] || theme.palette.text.secondary
  const reMatch = regexMatch(resolved, boundary)

  return (
    <Box sx={{ mb: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          mb: 1,
          flexWrap: 'wrap',
        }}
      >
        <Typography
          variant="h6"
          sx={{ fontFamily: 'monospace', fontWeight: 600 }}
        >
          {resolved.channel}
        </Typography>
        <Chip
          size="small"
          label={type}
          sx={{
            bgcolor: alpha(typeColor, 0.15),
            color: typeColor,
            fontWeight: 600,
            fontFamily: 'monospace',
          }}
        />
        <Typography variant="body2" color="text.secondary">
          namespace:{' '}
          <Box
            component="span"
            sx={{ fontFamily: 'monospace', color: 'text.primary' }}
          >
            {resolved.namespace ?? '(default)'}
          </Box>
        </Typography>
      </Box>

      {!resolved.known && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          No namespace <code>{resolved.namespace}</code> is configured —
          Centrifugo would reject subscriptions to this channel.
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
        <CapabilityChip
          label="presence"
          tone={hasPresence(o) ? 'on' : 'off'}
          title="Presence tracking (set of subscribed clients)"
        />
        <CapabilityChip
          label={
            hasHistory(o)
              ? `history ${o.history_size}${o.history_ttl ? ` · ${o.history_ttl}` : ''}`
              : 'history'
          }
          tone={hasHistory(o) ? 'on' : 'off'}
          title="Channel message history"
        />
        {(o.force_recovery || o.allow_recovery) && (
          <CapabilityChip
            label={`recovery${isCacheRecovery(o) ? ' · cache' : ''}`}
            tone="info"
            title="Missed-message recovery for resubscribing clients"
          />
        )}
        {(o.force_positioning || o.allow_positioning) && (
          <CapabilityChip label="positioning" tone="info" />
        )}
        {o.join_leave && <CapabilityChip label="join/leave" tone="info" />}
        {o.delta_publish && <CapabilityChip label="delta" tone="info" />}
        {o.allow_tags_filter && (
          <CapabilityChip label="tags filter" tone="info" />
        )}
        {o.allow_user_limited_channels && (
          <CapabilityChip label="user-limited" tone="info" />
        )}
        {isStreamProxied(o) && (
          <CapabilityChip
            label="stream-proxied"
            tone="warn"
            title="Publications stream from your backend, not the PUB/SUB engine — history/presence semantics differ"
          />
        )}
      </Box>

      {o.channel_regex && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            channel_regex: <code>{o.channel_regex}</code>
          </Typography>
          {reMatch === true && (
            <CapabilityChip label="name matches" tone="on" />
          )}
          {reMatch === false && (
            <CapabilityChip
              label="name does NOT match — would be rejected"
              tone="warn"
            />
          )}
        </Box>
      )}
    </Box>
  )
}
