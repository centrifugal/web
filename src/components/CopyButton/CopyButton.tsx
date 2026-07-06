import { useEffect, useRef, useState } from 'react'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon from '@mui/icons-material/Check'

interface CopyButtonProps {
  value: string
  // Accessible name / tooltip, e.g. "Copy device ID".
  label?: string
  size?: 'small' | 'medium'
}

// CopyButton copies a value to the clipboard and briefly swaps to a check with a
// "Copied" tooltip for feedback. It stops click propagation so it can live
// inside clickable rows/cells without triggering their handlers.
export const CopyButton = ({
  value,
  label = 'Copy',
  size = 'small',
}: CopyButtonProps) => {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timeoutRef.current), [])

  const handleCopy = (event: React.MouseEvent) => {
    event.stopPropagation()
    // Optional chaining: navigator.clipboard is undefined in insecure contexts.
    navigator.clipboard?.writeText(value)?.catch(() => {})
    setCopied(true)
    window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <Tooltip title={copied ? 'Copied' : label}>
      <IconButton
        size={size}
        aria-label={label}
        onClick={handleCopy}
        sx={{ flexShrink: 0, p: 0.25, color: 'action.active' }}
      >
        {copied ? (
          <CheckIcon color="success" sx={{ fontSize: 16 }} />
        ) : (
          <ContentCopyIcon sx={{ fontSize: 16 }} />
        )}
      </IconButton>
    </Tooltip>
  )
}
