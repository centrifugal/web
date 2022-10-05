import { PropsWithChildren } from 'react'
import Box from '@mui/material/Box'
import { styled } from '@mui/material/styles'

const Main = styled('main', { shouldForwardProp: prop => prop !== 'open' })<{
  
}>(({ theme }) => ({
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
}))

interface RouteContentProps extends PropsWithChildren {
}

export const RouteContent = ({ children }: RouteContentProps) => {
  return (
    <Main>
      <Box>
        {children}
      </Box>
    </Main>
  )
}
