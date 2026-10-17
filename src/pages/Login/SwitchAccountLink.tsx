import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'

// SwitchAccountLink logs in with a different account. With the identity
// provider's session alive a new login would bring the same account back, so
// the identity provider is asked for credentials (prompt=login). lastUser,
// when known, names the account it would bring back.
export const SwitchAccountLink = ({
  onClick,
  lastUser,
  disabled,
}: {
  onClick: () => void
  lastUser?: string | null
  disabled?: boolean
}) => (
  // width 0 + minWidth 100%: the form keeps its width, so the login button
  // is not stretched; the account line stays on one line and may stick out
  // of the form evenly on both sides, cut with an ellipsis if very long.
  <Box
    sx={{
      width: 0,
      minWidth: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}
  >
    {lastUser && (
      <Typography
        variant="body2"
        color="text.secondary"
        noWrap
        sx={{ flexShrink: 0, maxWidth: '90vw' }}
      >
        Last signed in as <b>{lastUser}</b>
      </Typography>
    )}
    <Link
      component="button"
      type="button"
      variant="body2"
      underline="hover"
      disabled={disabled}
      onClick={onClick}
    >
      Use a different account
    </Link>
  </Box>
)
