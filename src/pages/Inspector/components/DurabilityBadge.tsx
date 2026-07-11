import Tooltip from '@mui/material/Tooltip'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import { alpha, useTheme } from '@mui/material/styles'

import { Durability } from '../useServerConfig'

// Communicates whether an action's effect survives a server restart. Memory-backed
// features (the server default) are per-node and lost on restart — operators must
// know this before, say, blocking a user during an incident.
export const DurabilityBadge = ({
  durability,
  inline,
}: {
  durability: Durability
  // Rendered inside a Button (as endIcon): drop the border and shrink so it reads
  // as a sub-label of the button rather than a nested button.
  inline?: boolean
}) => {
  const theme = useTheme()
  const map: Record<
    Durability,
    { label: string; color: 'default' | 'success' | 'warning'; tip: string }
  > = {
    memory: {
      label: 'in-memory',
      color: 'warning',
      tip: 'Stored in memory — per node and lost on restart. Configure redis/database storage for durability.',
    },
    redis: {
      label: 'durable · redis',
      color: 'success',
      tip: 'Backed by Redis — survives restarts and shared across nodes.',
    },
    database: {
      label: 'durable · database',
      color: 'success',
      tip: 'Backed by a database — survives restarts and shared across nodes.',
    },
    unknown: {
      label: 'storage: custom',
      color: 'default',
      tip: 'Non-standard storage type configured.',
    },
  }
  const m = map[durability]

  // Inline (inside a Button as endIcon): a Chip's internal label padding gets
  // squashed by the button, so render a plain padded span we fully control.
  if (inline) {
    const c =
      m.color === 'default'
        ? theme.palette.text.secondary
        : theme.palette[m.color].main
    return (
      <Tooltip title={m.tip} arrow>
        <Box
          component="span"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            height: 15,
            ml: 0.75,
            // Negative vertical margin keeps the badge from growing the button's
            // line box; it stays visually centered on the label row.
            my: '-3px',
            px: 0.75,
            borderRadius: 0.75,
            fontSize: 8.5,
            fontWeight: 600,
            lineHeight: 1,
            textTransform: 'none',
            color: c,
            bgcolor: alpha(c, 0.15),
          }}
        >
          {m.label}
        </Box>
      </Tooltip>
    )
  }

  return (
    <Tooltip title={m.tip} arrow>
      <Chip
        size="small"
        label={m.label}
        color={m.color}
        variant="outlined"
        sx={{ height: 20, fontSize: 11 }}
      />
    </Tooltip>
  )
}
