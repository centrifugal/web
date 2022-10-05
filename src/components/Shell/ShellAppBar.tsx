import { Link, useLocation } from 'react-router-dom'

import { styled } from '@mui/material/styles'
import MuiAppBar, { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import SettingsIcon from '@mui/icons-material/Settings'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import MenuIcon from '@mui/icons-material/Menu'
import LogoutIcon from '@mui/icons-material/Logout'
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import MenuItem from '@mui/material/MenuItem'
import Container from '@mui/material/Container'
import Box from '@mui/material/Box'
import Menu from '@mui/material/Menu'
import * as React from 'react'
import Avatar from '@mui/material/Avatar'
import { ImageListItem } from '@mui/material'

import { routes } from 'config/routes'

interface AppBarProps extends MuiAppBarProps {
  open?: boolean
}

export const AppBar = styled(MuiAppBar, {
  shouldForwardProp: prop => prop !== 'open',
})<AppBarProps>(({ theme, open }) => ({
  transition: theme.transitions.create(['margin', 'width'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
}))

interface ShellAppBarProps {
  handleLogout: () => void
  title: string
  insecure: boolean
}

const pages = [
  {
    name: 'Status',
    icon: SignalCellularAltIcon,
    iconColor: '#4caf50',
    to: routes.ROOT,
  },
  {
    name: 'Actions',
    icon: LocalFireDepartmentIcon,
    iconColor: '#ff9800',
    to: routes.ACTIONS,
  },
  {
    name: 'Tracing',
    icon: PlayCircleIcon,
    iconColor: '#03a9f4',
    to: routes.TRACING,
  },
]

export const ShellAppBar = ({ handleLogout, title, insecure }: ShellAppBarProps) => {
  const location = useLocation()

  const [anchorElNav, setAnchorElNav] = React.useState<null | HTMLElement>(null)
  const [anchorElUser, setAnchorElUser] = React.useState<null | HTMLElement>(
    null
  )

  const handleOpenNavMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElNav(event.currentTarget)
  }
  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElUser(event.currentTarget)
  }

  const handleCloseNavMenu = () => {
    setAnchorElNav(null)
  }

  const handleCloseUserMenu = () => {
    setAnchorElUser(null)
  }

  const handleLogoutClick = () => {
    handleCloseUserMenu()
    handleLogout()
  }

  return (
    <AppBar position="static" color="inherit">
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          <ImageListItem
            sx={{
              display: { xs: 'none', md: 'flex' },
              mr: 1,
              width: 30,
              height: 30,
            }}
          >
            <img src="favicon.png" alt="" />
          </ImageListItem>
          <Typography
            noWrap
            component="a"
            href="/"
            sx={{
              mr: 2,
              display: { xs: 'none', md: 'flex' },
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            CENTRIFUGO
          </Typography>

          <Box sx={{ flexGrow: 1, display: { xs: 'flex', md: 'none' } }}>
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleOpenNavMenu}
              color="inherit"
            >
              <MenuIcon />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorElNav}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'left',
              }}
              open={Boolean(anchorElNav)}
              onClose={handleCloseNavMenu}
              sx={{
                display: { xs: 'block', md: 'none' },
              }}
            >
              {pages.map(page => (
                <MenuItem
                  key={page.name}
                  onClick={handleCloseNavMenu}
                  selected={page.to === location.pathname}
                  component={Link}
                  to={page.to}
                >
                  <Typography textAlign="center">{page.name}</Typography>
                </MenuItem>
              ))}
            </Menu>
          </Box>
          <ImageListItem
            sx={{
              display: { xs: 'flex', md: 'none' },
              mr: 1,
              width: 30,
              height: 30,
            }}
          >
            <img src="favicon.png" alt="" />
          </ImageListItem>
          <Typography
            variant="h5"
            noWrap
            component="a"
            href=""
            sx={{
              mr: 2,
              display: { xs: 'flex', md: 'none' },
              flexGrow: 1,
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            CENTRIFUGO
          </Typography>
          <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' } }}>
            {pages.map(page => (
              <MenuItem
                key={page.name}
                onClick={handleCloseNavMenu}
                component={Link}
                to={page.to}
                sx={{ display: 'block' }}
                selected={page.to === location.pathname}
              >
                <page.icon
                  sx={{
                    lineHeight: '1em',
                    fontSize: '1.2em',
                    mb: '3px',
                    color: page.iconColor,
                  }}
                />{' '}
                {page.name}
              </MenuItem>
            ))}
          </Box>

          <Box sx={{ flexGrow: 0 }}>
            <Tooltip title="Open settings">
              <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                <Avatar alt="Remy Sharp" />
              </IconButton>
            </Tooltip>
            <Menu
              sx={{ mt: '45px' }}
              id="menu-appbar"
              anchorEl={anchorElUser}
              anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={Boolean(anchorElUser)}
              onClose={handleCloseUserMenu}
            >
              <MenuItem
                onClick={handleCloseUserMenu}
                component={Link}
                to={routes.SETTINGS}
              >
                <SettingsIcon sx={{ fontSize: '1em' }} />
                &nbsp;
                <Typography>{'Settings'}</Typography>
              </MenuItem>
              {!insecure ? (
              <MenuItem onClick={handleLogoutClick}>
                <LogoutIcon sx={{ fontSize: '1em' }} />
                &nbsp;
                <Typography>{'Log out'}</Typography>
              </MenuItem>
              ) : (
                <></>
              )}
            </Menu>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  )
}
