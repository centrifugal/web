import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

import { CompressionApiHook, Profile } from '../api'

interface ActivateNowFieldProps {
  profile: Profile | null
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  percent: number
  onPercentChange: (percent: number) => void
}

export const validRolloutPercent = (percent: number): boolean =>
  Number.isFinite(percent) && percent >= 1 && percent <= 100

// ActivateNowField: activating from the dialog that creates the version, so
// that serving it is not a separate trip to the profile. Off by default: the
// version is then created inactive, as without this field.
export const ActivateNowField = ({
  profile,
  checked,
  onCheckedChange,
  percent,
  onPercentChange,
}: ActivateNowFieldProps) => {
  const active = profile?.active_version
  return (
    <Box sx={{ mt: 1 }}>
      <FormControlLabel
        control={
          <Checkbox
            checked={checked}
            onChange={e => onCheckedChange(e.target.checked)}
          />
        }
        label="Activate now"
      />
      {checked ? (
        <TextField
          fullWidth
          margin="dense"
          type="number"
          label="Rollout percent"
          value={percent}
          onChange={e => onPercentChange(Number(e.target.value))}
          inputProps={{ min: 1, max: 100 }}
          error={!validRolloutPercent(percent)}
          helperText={
            active
              ? `Replaces the version ${profile.name} serves now (${active.rollout_percent}% rollout) for new connections. Established connections keep theirs until they reconnect.`
              : 'Share of matching connections that receive this version. Start low to watch it before raising it to 100.'
          }
        />
      ) : (
        <Typography variant="body2" color="text.secondary">
          The version is created inactive. Activate it from the profile.
        </Typography>
      )}
    </Box>
  )
}

// CreatedVersion is what a dialog that creates a version reports back.
// activatedPercent is null when the version was left inactive.
export interface CreatedVersion {
  profileId: string
  versionId: string
  activatedPercent: number | null
}

// activateCreated activates a version just created, if asked to. The version
// exists whatever happens here, so a failed activation is returned rather than
// thrown: the caller reports the version, then the error.
export const activateCreated = async (
  api: CompressionApiHook,
  versionId: string,
  activate: boolean,
  percent: number
): Promise<{ activatedPercent: number | null; error: unknown }> => {
  if (!activate) return { activatedPercent: null, error: null }
  try {
    const v = await api.activateVersion(versionId, percent)
    return { activatedPercent: v.rollout_percent || percent, error: null }
  } catch (error) {
    return { activatedPercent: null, error }
  }
}
