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
import DataObjectIcon from '@mui/icons-material/DataObject'
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import PlayCircleIcon from '@mui/icons-material/PlayCircle'
import ManageSearchIcon from '@mui/icons-material/ManageSearch'
import QueryStatsIcon from '@mui/icons-material/QueryStats'
import NotificationsIcon from '@mui/icons-material/Notifications'
import CameraAltIcon from '@mui/icons-material/CameraAlt'
import CompressIcon from '@mui/icons-material/Compress'
import MenuItem from '@mui/material/MenuItem'
import Container from '@mui/material/Container'
import Box from '@mui/material/Box'
import Menu from '@mui/material/Menu'
import * as React from 'react'
import Avatar from '@mui/material/Avatar'

import { routes } from 'config/routes'
import { Logo } from './Logo'

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
  edition: 'oss' | 'pro'
  username: string
}

const pages = [
  {
    name: 'Status',
    icon: SignalCellularAltIcon,
    iconColor: '#2FB37D',
    to: routes.ROOT,
    oss: true,
  },
  {
    name: 'Actions',
    icon: LocalFireDepartmentIcon,
    iconColor: '#E0952A',
    to: routes.ACTIONS,
    oss: true,
  },
  {
    name: 'Inspector',
    icon: ManageSearchIcon,
    iconColor: '#17A2A0',
    to: routes.INSPECTOR,
    oss: false,
  },
  {
    name: 'Tracing',
    icon: PlayCircleIcon,
    iconColor: '#3D6FD6',
    to: routes.TRACING,
    oss: false,
  },
  {
    name: 'Snapshots',
    icon: CameraAltIcon,
    iconColor: '#D6468F',
    to: routes.SNAPSHOTS,
    oss: false,
  },
  {
    name: 'Analytics',
    icon: QueryStatsIcon,
    iconColor: '#6E5AE0',
    to: routes.ANALYTICS,
    oss: false,
  },
  {
    name: 'Push Notifications',
    icon: NotificationsIcon,
    iconColor: '#E84C3B',
    to: routes.PUSH_NOTIFICATION,
    oss: false,
  },
  {
    name: 'Config',
    icon: DataObjectIcon,
    iconColor: '#7A7A84',
    to: routes.CONFIG,
    oss: false,
  },
  {
    name: 'Compression',
    icon: CompressIcon,
    iconColor: '#2FA6D6',
    to: routes.COMPRESSION,
    oss: false,
    // Reachable at /compression, just not advertised in the nav while the
    // feature settles. Drop this line to put it back.
    hidden: true,
  },
]

export const ShellAppBar = ({
  handleLogout,
  title,
  insecure,
  edition,
  username,
}: ShellAppBarProps) => {
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

  const menuPages = [
    <MenuItem
      key={'settings'}
      onClick={handleCloseUserMenu}
      component={Link}
      to={routes.SETTINGS}
    >
      <SettingsIcon sx={{ fontSize: '1em' }} />
      &nbsp;
      <Typography>{'Settings'}</Typography>
    </MenuItem>,
  ]
  if (!insecure) {
    menuPages.push(
      <MenuItem key={'logout'} onClick={handleLogoutClick}>
        <LogoutIcon sx={{ fontSize: '1em' }} />
        &nbsp;
        <Typography>{'Log out'}</Typography>
      </MenuItem>
    )
  }

  return (
    <AppBar position="static" color="inherit">
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          <Box sx={{ display: { xs: 'none', md: 'flex' }, mr: 1 }}>
            <Logo size={30} />
          </Box>
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
            Centrifugo{edition === 'pro' ? ' PRO' : ''}
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
              {pages
                .filter(page => !page.hidden)
                .filter(page => page.oss || edition === 'pro')
                .map(page => (
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
          <Box sx={{ display: { xs: 'flex', md: 'none' }, mr: 1 }}>
            <Logo size={30} />
          </Box>
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
            Centrifugo{edition === 'pro' ? ' PRO' : ''}
          </Typography>
          <Box
            sx={{
              flexGrow: 1,
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
            }}
          >
            {pages
              .filter(page => !page.hidden)
              .filter(page => page.oss || edition === 'pro')
              .map(page => {
                return (
                  <MenuItem
                    key={page.name}
                    onClick={handleCloseNavMenu}
                    component={Link}
                    to={page.to}
                    selected={page.to === location.pathname}
                    sx={{ display: 'block' }}
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
                )
              })}
            <Typography sx={{ marginLeft: 'auto', marginRight: '10px' }}>
              {username}
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 0 }}>
            <Tooltip title="Account menu">
              <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                <Avatar alt={username || 'Account'}>
                  {username ? username.charAt(0).toUpperCase() : null}
                </Avatar>
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
              {menuPages}
            </Menu>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  )
}
