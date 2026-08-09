// Shared, presentational building blocks for the Inspector. Theme-aware, no data
// logic — so both tabs read the same visual language and new panels compose fast.

import { ReactNode, useRef } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import Tooltip from '@mui/material/Tooltip'
import Autocomplete from '@mui/material/Autocomplete'
import { alpha, useTheme } from '@mui/material/styles'

// ---- Widget: compact collapsible card -------------------------------------
// A single inline header row (icon · title · inline stats · spacer · controls);
// details render below only when `children` are provided, so the widget stays one
// row tall until the operator expands it.

export const Widget = ({
  icon,
  title,
  stats,
  controls,
  children,
}: {
  icon?: ReactNode
  title: ReactNode
  stats?: ReactNode
  controls?: ReactNode
  children?: ReactNode
}) => (
  <Card variant="outlined" sx={{ borderRadius: 2 }}>
    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexWrap: 'wrap',
        }}
      >
        {icon && (
          <Box sx={{ display: 'flex', color: 'text.secondary' }}>{icon}</Box>
        )}
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {stats}
        <Box sx={{ flexGrow: 1 }} />
        {controls}
      </Box>
      {children ? <Box sx={{ mt: 1.5 }}>{children}</Box> : null}
    </CardContent>
  </Card>
)

// ---- Panel: a titled section card -----------------------------------------

export const Panel = ({
  title,
  subtitle,
  icon,
  action,
  dense,
  children,
}: {
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  dense?: boolean
  children: ReactNode
}) => (
  <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
    <CardContent
      sx={{ p: dense ? 1.5 : 2.5, '&:last-child': { pb: dense ? 1.5 : 2.5 } }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: subtitle ? 0.25 : 1.5,
        }}
      >
        {icon && (
          <Box sx={{ display: 'flex', color: 'text.secondary' }}>{icon}</Box>
        )}
        <Typography variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }}>
          {title}
        </Typography>
        {action}
      </Box>
      {subtitle && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mb: 1.5 }}
        >
          {subtitle}
        </Typography>
      )}
      {children}
    </CardContent>
  </Card>
)

// ---- CapabilityChip: on/off/info feature indicator ------------------------

export type ChipTone = 'on' | 'off' | 'info' | 'warn'

export const CapabilityChip = ({
  label,
  tone = 'info',
  title,
}: {
  label: ReactNode
  tone?: ChipTone
  title?: string
}) => {
  const theme = useTheme()
  const palette: Record<ChipTone, string> = {
    on: theme.palette.success.main,
    off: theme.palette.text.disabled,
    info: theme.palette.primary.main,
    warn: theme.palette.warning.main,
  }
  const c = palette[tone]
  const chip = (
    <Chip
      size="small"
      label={label}
      variant="outlined"
      sx={{
        height: 24,
        borderColor: alpha(c, 0.5),
        color: tone === 'off' ? 'text.disabled' : c,
        bgcolor: alpha(c, tone === 'off' ? 0 : 0.08),
        fontWeight: 500,
        '& .MuiChip-label': { px: 1 },
      }}
    />
  )
  return title ? (
    <Tooltip title={title} arrow>
      {chip}
    </Tooltip>
  ) : (
    chip
  )
}

// ---- FieldRow: label → value line for detail lists ------------------------

export const FieldRow = ({
  label,
  children,
}: {
  label: ReactNode
  children: ReactNode
}) => (
  <Box sx={{ display: 'flex', gap: 2, py: 0.5, alignItems: 'baseline' }}>
    <Typography
      variant="body2"
      color="text.secondary"
      sx={{ minWidth: 150, flexShrink: 0 }}
    >
      {label}
    </Typography>
    <Box sx={{ flexGrow: 1, minWidth: 0, wordBreak: 'break-word' }}>
      {children}
    </Box>
  </Box>
)

// ---- InlineStat: FieldRow's compact sibling -------------------------------

// A label and its value on one line, for summaries whose facts are each a word
// long. FieldRow gives every field its own row and a 150px label column, which
// is right for a detail list and wrong for four short facts - they end up as a
// column of near-empty rows. Put several of these in a wrapping flex row
// instead.
export const InlineStat = ({
  label,
  children,
}: {
  label: ReactNode
  children: ReactNode
}) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
    <Typography variant="body2" color="text.secondary">
      {label}
    </Typography>
    {children}
  </Box>
)

// ---- SearchBar: entity input with submit + optional suggestions -----------

export const SearchBar = ({
  value,
  onChange,
  onSubmit,
  placeholder,
  loading,
  disabled,
  suggestions,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  placeholder: string
  loading?: boolean
  disabled?: boolean
  suggestions?: string[]
  autoFocus?: boolean
}) => {
  const endAdornment = (
    // No edge="end": it applies a negative right margin that clips the icon
    // button's circular hover/ripple against the input's rounded edge.
    <InputAdornment position="end" sx={{ mr: 0.5 }}>
      {loading ? (
        <CircularProgress size={20} sx={{ mr: 1 }} />
      ) : (
        <IconButton onClick={onSubmit} disabled={disabled} aria-label="inspect">
          <ArrowIcon />
        </IconButton>
      )}
    </InputAdornment>
  )
  // The option currently highlighted in the dropdown (via arrow keys or hover), so
  // Tab can accept it into the input.
  const highlightedRef = useRef<string | null>(null)

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSubmit()
    } else if (e.key === 'Tab' && highlightedRef.current) {
      // Accept the highlighted suggestion instead of moving focus.
      e.preventDefault()
      onChange(highlightedRef.current)
      highlightedRef.current = null
    }
  }

  // Always render through Autocomplete (even with no suggestions) so the channel
  // and user inputs are structurally identical — same markup, spacing, and arrow
  // position. Autocomplete owns the input value via inputValue/onInputChange, so
  // the rendered TextField must not re-declare value/onChange.
  return (
    <Autocomplete
      freeSolo
      // We render our own submit-arrow adornment, so disable Autocomplete's
      // clear/popup icons — otherwise typing toggles their reserved right padding
      // and the content visibly shifts left.
      disableClearable
      forcePopupIcon={false}
      options={suggestions ?? []}
      inputValue={value}
      onInputChange={(_, v) => onChange(v)}
      onHighlightChange={(_, option) => {
        highlightedRef.current = option ?? null
      }}
      disabled={disabled}
      renderInput={params => (
        <TextField
          {...params}
          fullWidth
          size="medium"
          autoFocus={autoFocus}
          placeholder={placeholder}
          onKeyDown={onKeyDown}
          InputProps={{ ...params.InputProps, endAdornment }}
        />
      )}
    />
  )
}

const ArrowIcon = () => (
  <Box component="span" sx={{ display: 'flex' }} aria-hidden>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </Box>
)
