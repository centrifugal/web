import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import { alpha, useTheme } from '@mui/material/styles'

import {
  ChannelOptions,
  ResolvedChannel,
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

// The "what is this channel" header: resolved namespace, a prominent
// subscription-type badge, and the enabled capabilities as chips.
export const CapabilityHeader = ({
  resolved,
}: {
  resolved: ResolvedChannel
}) => {
  const theme = useTheme()
  const o: ChannelOptions = resolved.options
  const type = subscriptionType(o)
  const typeColor = TYPE_COLORS[type] || theme.palette.text.secondary

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
        {resolved.pattern && (
          <CapabilityChip
            label="pattern"
            tone="info"
            title="Matched by a channel pattern rather than a namespace prefix — channel_regex is tested against the whole channel name"
          />
        )}
      </Box>

      {/* Only the server's own resolver may claim a channel would be rejected.
          The client-side fallback cannot see PRO channel patterns or the private
          prefix, so its "unknown namespace" is a guess, and saying otherwise hid
          working panels behind a false warning. */}
      {!resolved.known && resolved.verified && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          No namespace <code>{resolved.namespace}</code> is configured —
          Centrifugo would reject subscriptions to this channel.
        </Alert>
      )}

      {!resolved.verified && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          This server does not expose channel resolution, so these options were
          resolved from its configuration in the browser and may differ from
          what Centrifugo applies.
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
          {resolved.nameValid === true && (
            <CapabilityChip label="name matches" tone="on" />
          )}
          {resolved.nameValid === false && (
            <CapabilityChip
              label="name does NOT match — would be rejected"
              tone="warn"
            />
          )}
        </Box>
      )}

      {/* A rejected name is not always a regex miss: with no channel_regex
          configured the server applies its own rules (ASCII-only, and the
          channel.max_length limit), and those verdicts have no regex line to
          hang off. Rendering them only inside the block above meant a channel
          Centrifugo would reject looked perfectly healthy. */}
      {!o.channel_regex && resolved.nameValid === false && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          Centrifugo would reject this channel name. With no{' '}
          <code>channel_regex</code> configured for this namespace, names must
          be ASCII-only and within <code>channel.max_length</code>.
        </Alert>
      )}
    </Box>
  )
}
