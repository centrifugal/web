import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'

import { loginErrorMessage } from './loginError'
import { SwitchAccountLink } from './SwitchAccountLink'

// NoAccess is shown instead of the admin UI to a user the identity provider
// logged in, but whom Centrifugo does not let in (PRO, admin.oidc.access_cel).
// It is laid out like the login page.
export const NoAccess = ({
  onSwitchAccount,
  onLogout,
}: {
  onSwitchAccount: () => void
  onLogout: () => void
}) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      px: 2,
    }}
  >
    <Typography component="h1" variant="h4">
      No access
    </Typography>
    <Box sx={{ mt: 1, maxWidth: 400 }}>
      <Alert severity="error" sx={{ mt: 2 }}>
        {loginErrorMessage('denied')}
      </Alert>
      <Button
        type="button"
        fullWidth
        variant="solid"
        color="primary"
        sx={{ mt: 3, mb: 2 }}
        onClick={onLogout}
      >
        Log out
      </Button>
      <SwitchAccountLink onClick={onSwitchAccount} />
    </Box>
  </Box>
)
