import React, { useEffect, useContext, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import FormControl from '@mui/material/FormControl'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import MuiLink from '@mui/material/Link'
import GitHubIcon from '@mui/icons-material/GitHub'
import Tooltip from '@mui/material/Tooltip'
import { v4 as uuid } from 'uuid'

import { routes } from 'config/routes'
import { ShellContext } from 'contexts/ShellContext'
import { PeerNameDisplay } from 'components/PeerNameDisplay'
import { ReactComponent as Logo } from 'img/logo.svg'
import UILink from '@mui/material/Link'

interface HomeProps {}

export function Home({}: HomeProps) {
  const { setTitle } = useContext(ShellContext)
  const [roomName, setRoomName] = useState(uuid())
  const navigate = useNavigate()

  useEffect(() => {
    setTitle('Centrifugo')
  }, [setTitle])

  const handleRoomNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target
    setRoomName(value)
  }

  const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    navigate(`/public/${roomName}`)
  }

  return (
    <Box className="max-w-8xl mx-auto p-8">
      <UILink component={Link} to={routes.ABOUT}>
        About
      </UILink>
    </Box>
  )
}
