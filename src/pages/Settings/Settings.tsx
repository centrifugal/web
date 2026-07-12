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

// Preset accents (value undefined = the built-in green default).
const ACCENT_PRESETS: { label: string; value?: string }[] = [
  { label: 'Green (default)' },
  { label: 'Violet', value: '#A38FFB' },
  { label: 'Blue', value: '#3D6FD6' },
  { label: 'Teal', value: '#17A2A0' },
  { label: 'Amber', value: '#E0952A' },
  { label: 'Pink', value: '#D6468F' },
]

export const Settings = () => {
  const { setTitle } = useContext(ShellContext)
  const { updateUserSettings, getUserSettings } = useContext(SettingsContext)
  const { getPersistedStorage } = useContext(StorageContext)
  const colorMode = getUserSettings().colorMode
  const accentColor = getUserSettings().accentColor
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

      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
          Accent color
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Drives the primary button, highlights and focus. Pick a preset or your
          own colour.
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
          {ACCENT_PRESETS.map(p => {
            const selected = accentColor === p.value
            return (
              <Tooltip key={p.label} title={p.label} arrow>
                <Box
                  component="button"
                  aria-label={p.label}
                  onClick={() => updateUserSettings({ accentColor: p.value })}
                  sx={{
                    width: 32,
                    height: 32,
                    p: 0,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    bgcolor: p.value ?? '#1F9D6B',
                    border: theme =>
                      `2px solid ${
                        selected
                          ? theme.palette.text.primary
                          : theme.palette.divider
                      }`,
                  }}
                />
              </Tooltip>
            )
          })}
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
              value={accentColor ?? '#1F9D6B'}
              onChange={e =>
                updateUserSettings({ accentColor: e.target.value })
              }
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
          {/* Always rendered (visibility toggled) so its space is reserved and
              the row never reflows when it appears/disappears. */}
          <Button
            variant="tonal"
            color="secondary"
            size="small"
            onClick={() => updateUserSettings({ accentColor: undefined })}
            sx={{ visibility: accentColor ? 'visible' : 'hidden' }}
          >
            Reset
          </Button>
        </Box>
      </Box>

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
