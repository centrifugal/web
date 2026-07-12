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
      <Divider sx={{ my: 2 }} />
      <Button
        variant="outlined"
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
