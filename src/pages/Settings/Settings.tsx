import { useContext, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Switch from '@mui/material/Switch'
import FormGroup from '@mui/material/FormGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import Tooltip from '@mui/material/Tooltip'

import { ShellContext } from 'contexts/ShellContext'
import { StorageContext } from 'contexts/StorageContext'

import { ConfirmDialog } from '../../components/ConfirmDialog'
import { SettingsContext } from '../../contexts/SettingsContext'

// Preset accent colours offered alongside the custom picker.
const PRESET_COLORS: { label: string; value: string }[] = [
  { label: 'Green', value: '#1F9D6B' },
  { label: 'Blue', value: '#3D6FD6' },
  { label: 'Violet', value: '#A38FFB' },
  { label: 'Teal', value: '#17A2A0' },
  { label: 'Amber', value: '#E0952A' },
  { label: 'Pink', value: '#D6468F' },
]

// One accent control: a "default" swatch + presets + custom picker + reset.
const AccentPicker = ({
  label,
  hint,
  value,
  defaultHex,
  onChange,
}: {
  label: string
  hint: string
  value?: string
  defaultHex: string
  onChange: (v?: string) => void
}) => (
  <Box sx={{ mt: 3 }}>
    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
      {label}
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
      {hint}
    </Typography>
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        flexWrap: 'wrap',
        minHeight: 40,
      }}
    >
      <Tooltip title="Default" arrow>
        <Box
          component="button"
          aria-label="Default"
          onClick={() => onChange(undefined)}
          sx={{
            width: 32,
            height: 32,
            p: 0,
            borderRadius: '50%',
            cursor: 'pointer',
            bgcolor: defaultHex,
            border: theme =>
              `2px solid ${
                value === undefined
                  ? theme.palette.text.primary
                  : theme.palette.divider
              }`,
          }}
        />
      </Tooltip>
      {PRESET_COLORS.map(p => (
        <Tooltip key={p.value} title={p.label} arrow>
          <Box
            component="button"
            aria-label={p.label}
            onClick={() => onChange(p.value)}
            sx={{
              width: 32,
              height: 32,
              p: 0,
              borderRadius: '50%',
              cursor: 'pointer',
              bgcolor: p.value,
              border: theme =>
                `2px solid ${
                  value === p.value
                    ? theme.palette.text.primary
                    : theme.palette.divider
                }`,
            }}
          />
        </Tooltip>
      ))}
      <Box
        component="label"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          ml: 1,
          cursor: 'pointer',
        }}
      >
        <input
          type="color"
          value={value ?? defaultHex}
          onChange={e => onChange(e.target.value)}
          style={{
            width: 34,
            height: 34,
            padding: 0,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
          }}
        />
        <Typography variant="caption" color="text.secondary">
          Custom
        </Typography>
      </Box>
      {/* Always rendered (visibility toggled) so the row never reflows. */}
      <Button
        variant="tonal"
        color="inherit"
        size="small"
        onClick={() => onChange(undefined)}
        sx={{ visibility: value ? 'visible' : 'hidden' }}
      >
        Reset
      </Button>
    </Box>
  </Box>
)

export const Settings = () => {
  const { setTitle } = useContext(ShellContext)
  const { updateUserSettings, getUserSettings } = useContext(SettingsContext)
  const { getPersistedStorage } = useContext(StorageContext)
  const colorMode = getUserSettings().colorMode
  const accentColor = getUserSettings().accentColor
  const accentColor2 = getUserSettings().accentColor2
  const [
    isDeleteSettingsConfirmDialogOpen,
    setIsDeleteSettingsConfirmDialogOpen,
  ] = useState(false)

  const handleColorModeToggleClick = () => {
    const newMode = colorMode === 'light' ? 'dark' : 'light'
    updateUserSettings({ colorMode: newMode })
  }

  const persistedStorage = getPersistedStorage()

  useEffect(() => {
    setTitle('Centrifugo | Settings')
  }, [setTitle])

  const handleDeleteSettingsClick = () => {
    setIsDeleteSettingsConfirmDialogOpen(true)
  }

  const handleDeleteSettingsCancel = () => {
    setIsDeleteSettingsConfirmDialogOpen(false)
  }

  const handleDeleteSettingsConfirm = async () => {
    await persistedStorage.clear()
    localStorage.clear()
    window.location.reload()
  }

  return (
    <Box className="max-w-8xl mx-auto p-8">
      <FormGroup>
        <FormControlLabel
          control={
            <Switch
              checked={colorMode === 'dark'}
              onChange={handleColorModeToggleClick}
            />
          }
          label="Enable dark theme"
        />
      </FormGroup>

      <AccentPicker
        label="Primary accent"
        hint="Main buttons, highlights and focus."
        value={accentColor}
        defaultHex="#1F9D6B"
        onChange={v => updateUserSettings({ accentColor: v })}
      />
      <AccentPicker
        label="Secondary accent"
        hint="Links, navigation and info (e.g. Trace buttons)."
        value={accentColor2}
        defaultHex="#3D6FD6"
        onChange={v => updateUserSettings({ accentColor2: v })}
      />

      <Divider sx={{ my: 3 }} />
      <Button
        variant="tonal"
        color="error"
        sx={{ mb: 2 }}
        onClick={handleDeleteSettingsClick}
      >
        Drop saved settings, tokens and restart
      </Button>
      <ConfirmDialog
        isOpen={isDeleteSettingsConfirmDialogOpen}
        onCancel={handleDeleteSettingsCancel}
        onConfirm={handleDeleteSettingsConfirm}
      />
      <Typography variant="subtitle2" sx={{ mb: 2 }}>
        Centrifugo admin panel only stores user preferences data locally on your
        device and not a server.
      </Typography>
    </Box>
  )
}
