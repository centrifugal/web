import { useContext, useEffect } from 'react'
import Link from '@mui/material/Link'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'

import { messageCharacterSizeLimit } from 'config/messaging'
import { ShellContext } from 'contexts/ShellContext'

export const Actions = () => {
  const { setTitle } = useContext(ShellContext)

  useEffect(() => {
    setTitle('Actions')
  }, [setTitle])

  return <Box className="max-w-8xl mx-auto p-8">Actions</Box>
}
