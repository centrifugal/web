import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone'

import { InspectorApi } from '../types'

// Compact indicator of how many push devices a user has registered, linking to the
// Push page filtered to this user. Rendered only when push + database are enabled.
export const UserPushDevices = ({
  user,
  api,
  refreshKey,
}: {
  user: string
  api: InspectorApi
  refreshKey?: number
}) => {
  const navigate = useNavigate()
  const [count, setCount] = useState<number | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setCount(null)
    setError(false)
    api
      .call<{ total_count?: number }>('device_list', {
        filter: { users: [user] },
        include_total_count: true,
        limit: 1,
      })
      .then(res => {
        if (!cancelled) setCount(res.total_count ?? 0)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [user, api, refreshKey])

  if (error) return null

  const label =
    count == null
      ? 'push devices'
      : `${count.toLocaleString()} push ${count === 1 ? 'device' : 'devices'}`

  return (
    <Tooltip title="View this user's push devices" arrow>
      <Chip
        icon={
          count == null ? (
            <CircularProgress size={12} sx={{ ml: 1 }} />
          ) : (
            <PhoneIphoneIcon />
          )
        }
        size="small"
        variant="outlined"
        clickable
        onClick={() => navigate(`/push?user=${encodeURIComponent(user)}`)}
        label={label}
      />
    </Tooltip>
  )
}
