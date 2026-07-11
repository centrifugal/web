import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TimelineIcon from '@mui/icons-material/Timeline'
import QueryStatsIcon from '@mui/icons-material/QueryStats'

// Navigation actions for a channel — a single row of buttons: live Trace and,
// when ClickHouse analytics is enabled, historical Analytics.
export const ChannelActions = ({
  channel,
  analyticsEnabled,
}: {
  channel: string
  analyticsEnabled?: boolean
}) => {
  const navigate = useNavigate()
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      <Button
        variant="outlined"
        size="small"
        startIcon={<TimelineIcon />}
        onClick={() =>
          navigate(`/tracing?channel=${encodeURIComponent(channel)}`)
        }
      >
        Trace
      </Button>
      {analyticsEnabled && (
        <Button
          variant="outlined"
          size="small"
          startIcon={<QueryStatsIcon />}
          onClick={() =>
            navigate(
              `/analytics?tab=channel&channel=${encodeURIComponent(channel)}`
            )
          }
        >
          Analytics history
        </Button>
      )}
    </Box>
  )
}
