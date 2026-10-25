import { useEffect, useState } from 'react'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'

import { CompressionApiHook, Profile, SizeCurvePoint } from '../api'
import { HumanSize } from 'utils/Functions'

interface ProfileFieldProps {
  api: CompressionApiHook
  profileId: string
  onProfileChange: (id: string) => void
  // Called with the selected profile once profiles are loaded, and on every
  // change, so a caller can say what choosing it will do.
  onProfileResolved?: (p: Profile | null) => void
}

// useTargetProfiles loads the profiles a version can go to. A preselected id
// that names no profile any more (deleted since the session started) is
// cleared, rather than left selected with nothing shown for it.
const useTargetProfiles = (
  api: CompressionApiHook,
  profileId: string,
  onProfileChange: (id: string) => void,
  onProfileResolved?: (p: Profile | null) => void
) => {
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

  const selected = profiles.find(p => p.id === profileId) ?? null
  useEffect(() => {
    if (loading) return
    if (profileId !== '' && !selected) onProfileChange('')
    onProfileResolved?.(selected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, selected])

  return { profiles, loading }
}

// ProfileField: just the audience. Approving a reviewed candidate uses this
// alone - the size was chosen on the review screen, because it decides which
// values are worth approving and therefore has to precede the review, not
// follow it.
export const ProfileField = ({
  api,
  profileId,
  onProfileChange,
  onProfileResolved,
}: ProfileFieldProps) => {
  const { profiles, loading } = useTargetProfiles(
    api,
    profileId,
    onProfileChange,
    onProfileResolved
  )

  return (
    <TextField
      select
      fullWidth
      margin="normal"
      label="Target profile"
      // A preselected id is shown once its option exists.
      value={loading ? '' : profileId}
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
  )
}

interface ProfileSizeFieldsProps {
  api: CompressionApiHook
  profileId: string
  onProfileChange: (id: string) => void
  onProfileResolved?: (p: Profile | null) => void
  sizeBytes: number
  onSizeChange: (n: number) => void
  // The measured size ladder for this candidate. Given one, the size becomes a
  // choice between answers instead of a number to invent.
  curve?: SizeCurvePoint[]
  // The rung the build recommends, marked in the list. Zero when the session
  // had no control window and nothing could be measured.
  recommendedSize?: number
}

// ProfileSizeFields: the profile + dictionary size picker shared by "assign a
// schema candidate straight to a version" and "approve a reviewed candidate."
// Both ultimately produce a version for one profile at one size, so the form
// fragment is shared even though the surrounding flow differs.
//
// The size used to be a free-form byte count with a hint to go read the curve
// somewhere else, which is no way to ask anyone anything: bigger is not better
// past the knee, every byte is delivered to every connection, and the operator
// had no way to see where the knee was from inside this dialog. So the field
// offers the rungs that were actually measured, each with what it buys and
// what it costs, and defaults to the recommended one.
export const ProfileSizeFields = ({
  api,
  profileId,
  onProfileChange,
  sizeBytes,
  onSizeChange,
  curve,
  recommendedSize,
  onProfileResolved,
}: ProfileSizeFieldsProps) => {
  const { profiles, loading } = useTargetProfiles(
    api,
    profileId,
    onProfileChange,
    onProfileResolved
  )

  const rungs = curve ?? []
  const measured = rungs.some(p => p.measured)
  const chosen = rungs.find(p => p.size_bytes === sizeBytes)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <TextField
        select
        fullWidth
        margin="normal"
        label="Target profile"
        // A preselected id is shown once its option exists.
        value={loading ? '' : profileId}
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
      {rungs.length > 0 ? (
        <TextField
          select
          fullWidth
          margin="normal"
          label="Dictionary size"
          value={sizeBytes}
          onChange={e => onSizeChange(Number(e.target.value))}
          helperText={
            chosen
              ? `${HumanSize(chosen.delivery_bytes)} delivered once per cold connect, earned back after ${chosen.payback_frames.toLocaleString()} frame${chosen.payback_frames === 1 ? '' : 's'}.`
              : measured
                ? 'Ratios measured on traffic held back from training.'
                : 'Ratios are projected — this session had no control window.'
          }
        >
          {rungs.map(p => (
            <MenuItem key={p.size_bytes} value={p.size_bytes}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  width: '100%',
                }}
              >
                <span>{HumanSize(p.size_bytes)}</span>
                <Typography variant="body2" color="text.secondary">
                  {p.ratio.toFixed(2)}x
                  {p.recommended_values > 0 &&
                    ` · ${p.recommended_values} values`}
                </Typography>
                {recommendedSize === p.size_bytes && (
                  <Chip
                    size="small"
                    color="primary"
                    variant="outlined"
                    label="Recommended"
                    sx={{ ml: 'auto' }}
                  />
                )}
              </Box>
            </MenuItem>
          ))}
        </TextField>
      ) : (
        <TextField
          type="number"
          fullWidth
          margin="normal"
          label="Dictionary size (bytes)"
          value={sizeBytes}
          onChange={e => onSizeChange(Number(e.target.value))}
          inputProps={{ min: 1 }}
          helperText="Larger dictionaries compress better up to a point, but every byte is delivered to every connection."
        />
      )}
    </Box>
  )
}
