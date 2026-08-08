import { useEffect, useState } from 'react'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Box from '@mui/material/Box'

import { CompressionApiHook, Profile } from '../api'

interface ProfileSizeFieldsProps {
  api: CompressionApiHook
  profileId: string
  onProfileChange: (id: string) => void
  sizeBytes: number
  onSizeChange: (n: number) => void
}

// ProfileSizeFields: the profile + dictionary size picker shared by "assign a
// schema candidate straight to a version" and "approve a reviewed candidate."
// Both ultimately produce a version for one profile at one size, so the form
// fragment is shared even though the surrounding flow differs.
export const ProfileSizeFields = ({
  api,
  profileId,
  onProfileChange,
  sizeBytes,
  onSizeChange,
}: ProfileSizeFieldsProps) => {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api
      .listProfiles()
      .then(data => {
        if (!cancelled) setProfiles(data.profiles || [])
      })
      .catch(err => api.handleError(err))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <TextField
        select
        fullWidth
        margin="normal"
        label="Target profile"
        value={profileId}
        onChange={e => onProfileChange(e.target.value)}
        disabled={loading}
        helperText="The audience this dictionary version will serve."
      >
        {profiles.map(p => (
          <MenuItem key={p.id} value={p.id}>
            {p.name}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        type="number"
        fullWidth
        margin="normal"
        label="Dictionary size (bytes)"
        value={sizeBytes}
        onChange={e => onSizeChange(Number(e.target.value))}
        inputProps={{ min: 1 }}
        helperText="Pick a point from the candidate's size curve — larger dictionaries compress better but cost more to deliver on a cold connect."
      />
    </Box>
  )
}
