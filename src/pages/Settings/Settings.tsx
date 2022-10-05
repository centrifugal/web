import { useContext, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Switch from '@mui/material/Switch'
import FormGroup from '@mui/material/FormGroup'
import FormControlLabel from '@mui/material/FormControlLabel'

import { ShellContext } from 'contexts/ShellContext'
import { StorageContext } from 'contexts/StorageContext'

import { ConfirmDialog } from '../../components/ConfirmDialog'
import { SettingsContext } from '../../contexts/SettingsContext'

export const Settings = () => {
  const { setTitle } = useContext(ShellContext)
  const { updateUserSettings, getUserSettings } = useContext(SettingsContext)
  const { getPersistedStorage } = useContext(StorageContext)
  const colorMode = getUserSettings().colorMode
  const [
    isDeleteSettingsConfirmDiaglogOpen,
    setIsDeleteSettingsConfirmDiaglogOpen,
  ] = useState(false)

  const handleColorModeToggleClick = () => {
    const newMode = colorMode === 'light' ? 'dark' : 'light'
    updateUserSettings({ colorMode: newMode })
  }

  const persistedStorage = getPersistedStorage()

  useEffect(() => {
    setTitle('Settings')
  }, [setTitle])

  const handleDeleteSettingsClick = () => {
    setIsDeleteSettingsConfirmDiaglogOpen(true)
  }

  const handleDeleteSettingsCancel = () => {
    setIsDeleteSettingsConfirmDiaglogOpen(false)
  }

  const handleDeleteSettingsConfirm = async () => {
    await persistedStorage.clear()
    window.location.reload()
  }

  return (
    <Box className="max-w-8xl p-8">
      <Typography
        variant="h4"
        sx={theme => ({
          mb: 2,
        })}
      >
        Settings
      </Typography>
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
      <Divider sx={{ my: 2 }} />
      <Typography
        variant="h2"
        sx={theme => ({
          fontSize: theme.typography.h5.fontSize,
          fontWeight: theme.typography.fontWeightMedium,
          mb: 1.5,
        })}
      >
        Delete all settings data
      </Typography>
      <Button
        variant="outlined"
        color="error"
        sx={_theme => ({
          mb: 2,
        })}
        onClick={handleDeleteSettingsClick}
      >
        Delete all data and restart
      </Button>
      <ConfirmDialog
        isOpen={isDeleteSettingsConfirmDiaglogOpen}
        onCancel={handleDeleteSettingsCancel}
        onConfirm={handleDeleteSettingsConfirm}
      />
      <Typography
        variant="subtitle2"
        sx={_theme => ({
          mb: 2,
        })}
      >
        Centrifugo admin panel only stores user preferences data locally on your
        device and not a server.
      </Typography>
      <Divider sx={{ my: 2 }} />
    </Box>
  )
}
