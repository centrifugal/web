import {
  createTheme,
  Theme,
  darken,
  lighten,
  getContrastRatio,
} from '@mui/material/styles'

// The Centrifugo admin design system, expressed as an MUI theme.
//
// Direction: charcoal-based neutrals; a single living green drives primary
// actions AND the healthy/success state; coral is reserved for destructive /
// error; amber (distinct from coral) is warning; blue is info/links.
//
// Buttons are TONAL — barely-tinted (~10%) with a coloured border and ink, so
// they read as light and fresh, not filled pills. The primary carries the
// strongest border to lead. One solid coral (`variant="contained" color="error"`)
// is held in reserve for irreversible, cluster-wide actions.

declare module '@mui/material/Button' {
  interface ButtonPropsVariantOverrides {
    tonal: true
  }
}

type Mode = 'light' | 'dark'

interface Tokens {
  bg: string
  surface: string
  surface2: string
  border: string
  borderStrong: string
  text: string
  textMuted: string
  textSubtle: string
  // green (primary + success share this)
  green: string
  greenSoft: string
  greenInk: string
  // info blue
  info: string
  infoSoft: string
  infoInk: string
  // danger coral (tonal accent + ink) and the solid escalation coral
  danger: string
  dangerSolid: string
  dangerSoft: string
  dangerInk: string
  // warning amber
  warning: string
  warningSoft: string
  warningInk: string
  focus: string
  tooltipBg: string
  tooltipFg: string
}

const LIGHT: Tokens = {
  bg: '#F1F1F4',
  surface: '#FFFFFF',
  surface2: '#FAFAFB',
  border: '#E4E4EA',
  borderStrong: '#D2D2DB',
  text: '#1E1E24',
  textMuted: '#62626C',
  textSubtle: '#8B8B95',
  green: '#1F9D6B',
  greenSoft: '#E6F5EE',
  greenInk: '#0E5A3D',
  info: '#3667CC',
  infoSoft: '#E8EEFB',
  infoInk: '#26468C',
  danger: '#D2331F',
  dangerSolid: '#E84C3B',
  dangerSoft: '#FDEBE9',
  dangerInk: '#8B2114',
  warning: '#D97706',
  warningSoft: '#FDF0D5',
  warningInk: '#B45309',
  focus: '#3667CC',
  tooltipBg: '#2B2B31',
  tooltipFg: '#F4F4F5',
}

const DARK: Tokens = {
  bg: '#100F13',
  surface: '#1A1A1F',
  surface2: '#212127',
  border: 'rgba(255,255,255,0.09)',
  borderStrong: 'rgba(255,255,255,0.17)',
  text: '#ECECEF',
  textMuted: '#9B9BA5',
  textSubtle: '#6B6B75',
  green: '#37C98C',
  greenSoft: 'rgba(55,201,140,0.14)',
  greenInk: '#92E8C3',
  info: '#6C97F0',
  infoSoft: 'rgba(108,151,240,0.15)',
  infoInk: '#B6CBF7',
  danger: '#F26456',
  dangerSolid: '#E84C3B',
  dangerSoft: 'rgba(232,76,59,0.16)',
  dangerInk: '#F7A99F',
  warning: '#F0A83C',
  warningSoft: 'rgba(240,168,60,0.14)',
  warningInk: '#F5C787',
  focus: '#6C97F0',
  tooltipBg: '#33333C',
  tooltipFg: '#F4F4F5',
}

// One tonal button recipe: a wash of `base` with a matching border and `ink`
// text. `fill`/`hover` are the wash strengths (percent of `base` over the
// surface). Percentages mirror the reference design system.
const tonal = (
  base: string,
  ink: string,
  fill: number,
  border: number,
  hover: number
) => ({
  backgroundColor: `color-mix(in srgb, ${base} ${fill}%, transparent)`,
  color: ink,
  border: `1px solid color-mix(in srgb, ${base} ${border}%, transparent)`,
  '&:hover': {
    backgroundColor: `color-mix(in srgb, ${base} ${hover}%, transparent)`,
    border: `1px solid color-mix(in srgb, ${base} ${border}%, transparent)`,
  },
})

// Solid flat recipe: an opaque fill, contrast ink, no shadow/gradient — flat
// design — with a subtly darker edge (derived from the fill) for definition.
// Hover just shifts the fill slightly.
const solid = (base: string, ink: string, hover: string) => ({
  backgroundColor: base,
  color: ink,
  border: `1px solid color-mix(in srgb, ${base} 84%, #000)`,
  boxShadow: 'none',
  '&:hover': {
    backgroundColor: hover,
    boxShadow: 'none',
    border: `1px solid color-mix(in srgb, ${hover} 84%, #000)`,
  },
})

const cssVars = (t: Tokens) => `
  --bg:${t.bg}; --surface:${t.surface}; --surface-2:${t.surface2};
  --border:${t.border}; --border-strong:${t.borderStrong};
  --text:${t.text}; --text-muted:${t.textMuted}; --text-subtle:${t.textSubtle};
  --green:${t.green}; --green-soft:${t.greenSoft}; --green-ink:${t.greenInk};
  --info:${t.info}; --info-soft:${t.infoSoft}; --info-ink:${t.infoInk};
  --danger:${t.danger}; --danger-solid:${t.dangerSolid}; --danger-soft:${t.dangerSoft}; --danger-ink:${t.dangerInk};
  --warning:${t.warning}; --warning-soft:${t.warningSoft}; --warning-ink:${t.warningInk};
  --focus:${t.focus};
`

// Derive a full accent (solid button fill, contrast ink, hover) from a single
// user-chosen base colour, per theme. Invalid input falls back to green.
const deriveAccent = (mode: Mode, base: string, fallback: string) => {
  try {
    const main = mode === 'dark' ? lighten(base, 0.06) : base
    return {
      main,
      solidInk:
        getContrastRatio(main, '#FFFFFF') >= 2.9 ? '#FFFFFF' : '#131316',
      solidHover: mode === 'dark' ? lighten(main, 0.12) : darken(main, 0.1),
    }
  } catch {
    return {
      main: fallback,
      solidInk: mode === 'dark' ? '#05271C' : '#FFFFFF',
      solidHover: mode === 'dark' ? '#45D99A' : '#1A8A5E',
    }
  }
}

export const createAppTheme = (mode: Mode, accentColor?: string): Theme => {
  const t = mode === 'dark' ? DARK : LIGHT

  // The accent drives the primary button, highlights and focus. Default is the
  // built-in green; a custom hex recomputes it. Success/health stays green.
  const accent = accentColor
    ? deriveAccent(mode, accentColor, t.green)
    : {
        main: t.green,
        solidInk: mode === 'dark' ? '#05271C' : '#FFFFFF',
        solidHover: mode === 'dark' ? '#45D99A' : '#1A8A5E',
      }
  const solidAccent = solid(accent.main, accent.solidInk, accent.solidHover)
  // Success buttons keep the semantic green even when the accent is customised.
  const solidGreen = solid(
    t.green,
    mode === 'dark' ? '#05271C' : '#FFFFFF',
    mode === 'dark' ? '#45D99A' : '#1A8A5E'
  )

  return createTheme({
    palette: {
      mode,
      primary: {
        main: accent.main,
        contrastText: accent.solidInk,
      },
      secondary: { main: t.textMuted },
      error: { main: t.dangerSolid, contrastText: '#FFFFFF' },
      warning: { main: t.warning },
      info: { main: t.info },
      success: { main: t.green },
      background: { default: t.bg, paper: t.surface },
      text: { primary: t.text, secondary: t.textMuted, disabled: t.textSubtle },
      divider: t.border,
    },
    shape: { borderRadius: 6 },
    typography: {
      fontFamily:
        'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
      button: {
        textTransform: 'uppercase',
        fontWeight: 500,
        letterSpacing: '0.05em',
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: `
          :root { ${cssVars(t)} color-scheme: ${mode}; }
          body { background: ${t.bg}; }
        `,
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 6,
            paddingTop: 7,
            paddingBottom: 7,
            '&:active': { transform: 'translateY(1px)' },
            '&.Mui-disabled': {
              backgroundColor: `color-mix(in srgb, ${t.text} 4%, transparent)`,
              color: t.textSubtle,
              border: `1px solid ${t.border}`,
            },
          },
        },
        variants: [
          {
            props: { variant: 'tonal', color: 'primary' },
            style: solidAccent,
          },
          {
            props: { variant: 'tonal', color: 'success' },
            style: solidGreen,
          },
          {
            props: { variant: 'tonal', color: 'info' },
            style: tonal(t.info, t.infoInk, 9, 48, 16),
          },
          {
            props: { variant: 'tonal', color: 'error' },
            style: tonal(t.danger, t.dangerInk, 9, 48, 16),
          },
          {
            props: { variant: 'tonal', color: 'warning' },
            style: tonal(t.warning, t.warningInk, 9, 48, 16),
          },
          {
            props: { variant: 'tonal', color: 'secondary' },
            style: {
              backgroundColor: `color-mix(in srgb, ${t.text} 7%, transparent)`,
              color: t.text,
              border: `1px solid ${t.borderStrong}`,
              '&:hover': {
                backgroundColor: `color-mix(in srgb, ${t.text} 11%, transparent)`,
                border: `1px solid ${t.textSubtle}`,
              },
            },
          },
          // Bare `variant="tonal"` with no explicit color → neutral.
          {
            props: { variant: 'tonal' },
            style: {},
          },
        ],
      },
      MuiAlert: {
        styleOverrides: {
          // Clean, fully-opaque card (so a floating Snackbar never bleeds page
          // text through) with the severity carried by a colored left stripe and
          // the icon — not a muddy full-background tint.
          root: {
            borderRadius: 10,
            backgroundColor: t.surface,
            color: t.text,
            border: `1px solid ${t.border}`,
            borderLeft: `3px solid ${t.border}`,
          },
          icon: { opacity: 1 },
          standardSuccess: {
            borderLeftColor: t.green,
            '& .MuiAlert-icon': { color: t.green },
          },
          standardInfo: {
            borderLeftColor: t.info,
            '& .MuiAlert-icon': { color: t.info },
          },
          standardWarning: {
            borderLeftColor: t.warning,
            '& .MuiAlert-icon': { color: t.warning },
          },
          standardError: {
            borderLeftColor: t.danger,
            '& .MuiAlert-icon': { color: t.danger },
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: t.tooltipBg,
            color: t.tooltipFg,
            fontSize: 12,
            fontWeight: 400,
            borderRadius: 6,
            padding: '6px 10px',
          },
          arrow: { color: t.tooltipBg },
        },
      },
      MuiLink: {
        defaultProps: { color: t.info },
        styleOverrides: { root: { textDecorationColor: 'currentColor' } },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          // Keep the outline 1px on focus (MUI defaults to 2px), so the field
          // doesn't visibly thicken/shift — only the border colour changes.
          root: {
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderWidth: 1,
            },
          },
        },
      },
      MuiCircularProgress: {
        defaultProps: { color: 'primary' },
      },
      // Account avatar: a themed accent circle (follows the chosen accent), not
      // MUI's default grey.
      MuiAvatar: {
        styleOverrides: {
          root: {
            backgroundColor: accent.main,
            color: accent.solidInk,
            fontSize: '0.95rem',
            fontWeight: 600,
          },
        },
      },
      // Coloured chips render tonal (soft fill + ink text + subtle border), like
      // the design system — not MUI's solid fill.
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 500 },
          colorSuccess: {
            '&.MuiChip-filled': {
              backgroundColor: t.greenSoft,
              color: t.greenInk,
              border: `1px solid color-mix(in srgb, ${t.green} 32%, transparent)`,
            },
          },
          colorError: {
            '&.MuiChip-filled': {
              backgroundColor: t.dangerSoft,
              color: t.dangerInk,
              border: `1px solid color-mix(in srgb, ${t.danger} 32%, transparent)`,
            },
          },
          colorWarning: {
            '&.MuiChip-filled': {
              backgroundColor: t.warningSoft,
              color: t.warningInk,
              border: `1px solid color-mix(in srgb, ${t.warning} 35%, transparent)`,
            },
          },
          colorInfo: {
            '&.MuiChip-filled': {
              backgroundColor: t.infoSoft,
              color: t.infoInk,
              border: `1px solid color-mix(in srgb, ${t.info} 32%, transparent)`,
            },
          },
        },
      },
      // One table-header style everywhere: uppercase, letter-spaced, muted — and a
      // consistent divider colour on every cell. Density is medium everywhere (the
      // MUI default) — no page overrides the size.
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottomColor: t.border },
          head: {
            fontWeight: 600,
            fontSize: '0.75rem',
            lineHeight: 1.5,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: t.textMuted,
          },
        },
      },
      MuiAppBar: {
        // A flat bar defined by its bottom border, not a heavy drop shadow.
        defaultProps: { elevation: 0 },
        styleOverrides: {
          // ShellAppBar renders with color="inherit"; make it a clean themed bar
          // (light in light, dark in dark). The logo adapts per theme in
          // ShellAppBar so it stays legible on both.
          colorInherit: {
            backgroundColor: t.surface,
            color: t.text,
            backgroundImage: 'none',
            boxShadow: 'none',
            borderBottom: `1px solid ${t.border}`,
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: { backgroundColor: accent.main, height: 2 },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'uppercase',
            fontWeight: 500,
            letterSpacing: '0.05em',
            // Neutral label with a green underline (rather than a green label),
            // so the tab bar stays calm and the accent lives in the indicator.
            '&.Mui-selected': { color: t.text },
          },
        },
      },
    },
  })
}
