import React, { useEffect, useContext, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import FormControl from '@mui/material/FormControl'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import MuiLink from '@mui/material/Link'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import Tooltip from '@mui/material/Tooltip'
import Avatar from '@mui/material/Avatar'
import Button from '@mui/material/Button'
import CssBaseline from '@mui/material/CssBaseline'
import TextField from '@mui/material/TextField'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import Grid from '@mui/material/Grid'
import Container from '@mui/material/Container'

import { routes } from 'config/routes'
import { ShellContext } from 'contexts/ShellContext'
import { ReactComponent as Logo } from 'img/logo.svg'
import UILink from '@mui/material/Link'

interface LoginProps {
  handleLogin: (password: string) => void
}

export function Login({ handleLogin }: LoginProps) {
  //   const { setTitle } = useContext(ShellContext)
  //   const [roomName, setRoomName] = useState(uuid())
  const navigate = useNavigate()

  const [password, setPassword] = useState('')

  //   useEffect(() => {
  //     setTitle('Centrifugo')
  //   }, [setTitle])

  //   const handleRoomNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  //     const { value } = event.target
  //     setRoomName(value)
  //   }

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    handleLogin(password)
  }

  return (
    <Box
      sx={{
        marginTop: 8,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
        <LockOutlinedIcon />
      </Avatar>
      <Typography component="h1" variant="h5">
        Sign in to Centrifugo
      </Typography>
      <Box
        component="form"
        onSubmit={handleFormSubmit}
        noValidate
        sx={{ mt: 1 }}
      >
        {/* <TextField
        margin="normal"
        required
        fullWidth
        id="email"
        label="Email Address"
        name="email"
        autoComplete="email"
        autoFocus
      /> */}
        <TextField
          margin="normal"
          required
          fullWidth
          name="password"
          label="Password"
          type="password"
          id="password"
          autoComplete="current-password"
          onChange={event => setPassword(event.target.value)}
          value={password}
        />
        {/* <FormControlLabel
        control={<Checkbox value="remember" color="primary" />}
        label="Remember me"
      /> */}
        <Button
          type="submit"
          fullWidth
          variant="contained"
          sx={{ mt: 3, mb: 2 }}
        >
          Sign In
        </Button>
      </Box>
    </Box>
  )
}
