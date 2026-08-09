import { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

interface EmptyStateProps {
  // Optional leading icon, rendered muted and centered above the text.
  icon?: ReactNode
  // Primary line — what's empty / what happened.
  title: string
  // Optional secondary line — a hint on how to populate it.
  hint?: ReactNode
}

// EmptyState is the shared placeholder shown when a view has no data to render
// (no results, nothing created yet, empty stream). It keeps empty views from
// rendering as a blank area and gives the user a consistent, gently-styled hint.
export const EmptyState = ({ icon, title, hint }: EmptyStateProps) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      gap: 1,
      py: 6,
      px: 2,
      color: 'text.secondary',
    }}
  >
    {icon && (
      <Box sx={{ color: 'text.disabled', display: 'flex', mb: 0.5 }}>
        {icon}
      </Box>
    )}
    <Typography variant="body1" color="text.secondary">
      {title}
    </Typography>
    {hint && (
      // component="div" because hint is a ReactNode: callers pass buttons and
      // laid-out blocks, and a <p> may not contain them. Typography resets its
      // own margin, so this renders identically to the paragraph it replaces.
      <Typography
        component="div"
        variant="body2"
        color="text.disabled"
        sx={{ maxWidth: 420 }}
      >
        {hint}
      </Typography>
    )}
  </Box>
)
