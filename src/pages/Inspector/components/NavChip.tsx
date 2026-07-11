import { ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'

// A small outlined chip that navigates within the app on click. Used for the
// Inspector's cross-links to related pages (analytics history, push devices, …).
export const NavChip = ({
  icon,
  label,
  to,
  tooltip,
}: {
  icon: ReactElement
  label: string
  to: string
  tooltip?: string
}) => {
  const navigate = useNavigate()
  const chip = (
    <Chip
      icon={icon}
      size="small"
      variant="outlined"
      clickable
      onClick={() => navigate(to)}
      label={label}
    />
  )
  return tooltip ? (
    <Tooltip title={tooltip} arrow>
      {chip}
    </Tooltip>
  ) : (
    chip
  )
}
