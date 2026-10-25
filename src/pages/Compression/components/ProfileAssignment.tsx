import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

import { CopyButton } from 'components/CopyButton'

import { Profile } from '../api'

interface ProfileAssignmentProps {
  profile: Profile
}

const Snippet = ({ value }: { value: string }) => (
  <Box
    component="span"
    sx={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}
  >
    <code>{value}</code>
    <CopyButton value={value} label="Copy" />
  </Box>
)

// ProfileAssignment: who receives this profile, in the words an operator acts
// on. A profile no connection is assigned to trains on nothing and serves
// nobody, and the ways to assign one live outside this UI, so they are spelled
// out here with what to paste.
export const ProfileAssignment = ({ profile }: ProfileAssignmentProps) => {
  const claim = `"profile": "${profile.name}"`
  return (
    <Box
      component="ul"
      sx={{
        m: 0,
        pl: 2.5,
        listStyle: 'disc',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
      }}
    >
      {profile.serve_as_default && (
        <Typography component="li" variant="body2">
          Every connection that has no profile receives it: it is the default
          profile.
        </Typography>
      )}
      <Typography component="li" variant="body2">
        {profile.serve_as_default
          ? 'Your backend can also assign it'
          : 'Your backend assigns it'}{' '}
        with <Snippet value={claim} /> in the connection token claims, or{' '}
        <code>profile</code> in the connect proxy result. No client release is
        needed.
      </Typography>
      <Typography component="li" variant="body2">
        {profile.client_declarable ? (
          <>
            Clients may also ask for it by name:{' '}
            <Snippet value={`profile: '${profile.name}'`} /> in the SDK options.
          </>
        ) : (
          'Clients cannot ask for it by name: Client declarable is off.'
        )}
      </Typography>
    </Box>
  )
}
