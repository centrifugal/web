import {
  createTheme,
  Theme,
  alpha,
  darken,
  lighten,
  getContrastRatio,
} from '@mui/material/styles'

// The Centrifugo admin design system, expressed as an MUI theme.
//
// Buttons come in two honest variants:
//   • variant="solid" — an opaque fill with a subtly darker edge (the emphatic
//     primary action, and the escalation coral).
//   • variant="tonal" — a barely-tinted wash + coloured border + ink (everything
//     else: info/navigate, destructive, warning, neutral).
// Neutral tonal buttons use color="inherit" (not "secondary").
//
// Two user-customisable accents: primary (main actions, highlights, focus) and
// a secondary that drives the info/navigate family (links, Trace). Both default
// to the built-in green / blue. Semantic colours (success/warning/error) are
// fixed so meaning never changes with a theme choice.

declare module '@mui/material/Button' {
  interface ButtonPropsVariantOverrides {
    tonal: true
    solid: true
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
  green: string
  greenInk: string
  info: string
  infoInk: string
  danger: string
  dangerSolid: string
  dangerInk: string
  warning: string
  warningInk: string
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
  greenInk: '#0E5A3D',
  info: '#3667CC',
  infoInk: '#26468C',
  danger: '#D2331F',
  dangerSolid: '#E84C3B',
  dangerInk: '#8B2114',
  warning: '#D97706',
  warningInk: '#B45309',
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
  greenInk: '#92E8C3',
  info: '#6C97F0',
  infoInk: '#B6CBF7',
  danger: '#F26456',
  dangerSolid: '#E84C3B',
  dangerInk: '#F7A99F',
  warning: '#F0A83C',
  warningInk: '#F5C787',
  tooltipBg: '#33333C',
  tooltipFg: '#F4F4F5',
}

// Tonal recipe: a light wash of `base` (fill/hover as 0-100 opacity), a matching
// border, and coloured `ink`. Uses alpha() (computed in JS) so there's no
// color-mix() browser dependency.
const tonal = (
  base: string,
  ink: string,
  fill: number,
  border: number,
  hover: number
) => ({
  backgroundColor: alpha(base, fill / 100),
  color: ink,
  border: `1px solid ${alpha(base, border / 100)}`,
  '&:hover': {
    backgroundColor: alpha(base, hover / 100),
    border: `1px solid ${alpha(base, border / 100)}`,
  },
})

// Solid recipe: opaque fill, contrast ink, a subtly darker edge (16% toward
// black) for definition. Flat — no shadow/gradient.
const solid = (base: string, ink: string, hover: string) => ({
  backgroundColor: base,
  color: ink,
  border: `1px solid ${darken(base, 0.16)}`,
  boxShadow: 'none',
  '&:hover': {
    backgroundColor: hover,
    boxShadow: 'none',
    border: `1px solid ${darken(hover, 0.16)}`,
  },
})

interface Accent {
  main: string
  solidInk: string
  solidHover: string
  tonalInk: string
}

// Pick the higher-contrast ink (white or near-black) for text on a solid fill.
const bestInk = (bg: string): string =>
  getContrastRatio(bg, '#FFFFFF') >= getContrastRatio(bg, '#141416')
    ? '#FFFFFF'
    : '#141416'

// Derive a full accent from one base colour, per theme. Robust: the solid ink is
// always the higher-contrast of white/near-black, and the tonal ink is a
// readable shade of the accent. Invalid input falls back.
const resolveAccent = (
  mode: Mode,
  base: string | undefined,
  fallback: Accent
): Accent => {
  if (!base) return fallback
  try {
    const main = mode === 'dark' ? lighten(base, 0.06) : base
    return {
      main,
      solidInk: bestInk(main),
      solidHover: mode === 'dark' ? lighten(main, 0.12) : darken(main, 0.1),
      tonalInk: mode === 'dark' ? lighten(base, 0.28) : darken(base, 0.34),
    }
  } catch {
    return fallback
  }
}

export const createAppTheme = (
  mode: Mode,
  accentColor?: string,
  accentColor2?: string
): Theme => {
  const t = mode === 'dark' ? DARK : LIGHT

  const primaryDefault: Accent = {
    main: t.green,
    solidInk: mode === 'dark' ? '#05271C' : '#FFFFFF',
    solidHover: mode === 'dark' ? '#45D99A' : '#1A8A5E',
    tonalInk: t.greenInk,
  }
  const infoDefault: Accent = {
    main: t.info,
    solidInk: bestInk(t.info),
    solidHover: mode === 'dark' ? lighten(t.info, 0.12) : darken(t.info, 0.1),
    tonalInk: t.infoInk,
  }
  // primary accent → main actions + highlights; secondary accent → info/navigate.
  // The built-in primary default is violet (#A38FFB); success/health stays green.
  const primary = resolveAccent(mode, accentColor ?? '#A38FFB', primaryDefault)
  const info = resolveAccent(mode, accentColor2, infoDefault)

  const solidPrimary = solid(primary.main, primary.solidInk, primary.solidHover)
  // Success/health stays green even when the accent is customised.
  const solidGreen = solid(
    t.green,
    mode === 'dark' ? '#05271C' : '#FFFFFF',
    mode === 'dark' ? '#45D99A' : '#1A8A5E'
  )
  // Escalation coral (variant="solid" color="error") — the one loud button.
  const solidDanger = solid(
    t.dangerSolid,
    '#FFFFFF',
    darken(t.dangerSolid, 0.08)
  )

  const neutralTonal = {
    backgroundColor: alpha(t.text, 0.07),
    color: t.text,
    border: `1px solid ${t.borderStrong}`,
    '&:hover': {
      backgroundColor: alpha(t.text, 0.11),
      border: `1px solid ${t.textSubtle}`,
    },
  }

  const chipTonal = (base: string, ink: string) => ({
    '&.MuiChip-filled': {
      backgroundColor: alpha(base, 0.16),
      color: ink,
      border: `1px solid ${alpha(base, 0.32)}`,
    },
  })

  return createTheme({
    palette: {
      mode,
      primary: { main: primary.main, contrastText: primary.solidInk },
      secondary: { main: t.textMuted },
      error: { main: t.dangerSolid, contrastText: '#FFFFFF' },
      warning: { main: t.warning },
      info: { main: info.main },
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
        // color-scheme makes native controls (date/time pickers, scrollbars)
        // render for the active theme.
        styleOverrides: `
          :root { color-scheme: ${mode}; }
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
              backgroundColor: alpha(t.text, 0.04),
              color: t.textSubtle,
              border: `1px solid ${t.border}`,
            },
          },
        },
        variants: [
          // Solid — emphatic, opaque.
          {
            props: { variant: 'solid', color: 'primary' },
            style: solidPrimary,
          },
          { props: { variant: 'solid', color: 'success' }, style: solidGreen },
          { props: { variant: 'solid', color: 'error' }, style: solidDanger },
          // Tonal — soft wash.
          {
            props: { variant: 'tonal', color: 'primary' },
            style: tonal(primary.main, primary.tonalInk, 10, 48, 18),
          },
          {
            props: { variant: 'tonal', color: 'info' },
            style: tonal(info.main, info.tonalInk, 9, 48, 16),
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
            props: { variant: 'tonal', color: 'success' },
            style: tonal(t.green, t.greenInk, 9, 48, 16),
          },
          // Neutral tonal (the quiet button). No bare `{ variant: 'tonal' }`
          // catch-all — being last it would override the colour-specific styles
          // above (turning every tonal button grey); a color-less tonal button
          // already defaults to `primary`.
          {
            props: { variant: 'tonal', color: 'inherit' },
            style: neutralTonal,
          },
          {
            props: { variant: 'tonal', color: 'secondary' },
            style: neutralTonal,
          },
        ],
      },
      MuiAlert: {
        styleOverrides: {
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
            borderLeftColor: info.main,
            '& .MuiAlert-icon': { color: info.main },
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
        defaultProps: { color: info.main },
        styleOverrides: { root: { textDecorationColor: 'currentColor' } },
      },
      MuiOutlinedInput: {
        styleOverrides: {
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
      MuiAvatar: {
        styleOverrides: {
          root: {
            backgroundColor: primary.main,
            color: primary.solidInk,
            fontSize: '0.95rem',
            fontWeight: 600,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 500 },
          colorSuccess: chipTonal(t.green, t.greenInk),
          colorError: chipTonal(t.danger, t.dangerInk),
          colorWarning: chipTonal(t.warning, t.warningInk),
          colorInfo: chipTonal(info.main, info.tonalInk),
        },
      },
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
      MuiTabs: {
        styleOverrides: {
          indicator: { backgroundColor: primary.main, height: 2 },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'uppercase',
            fontWeight: 500,
            letterSpacing: '0.05em',
            '&.Mui-selected': { color: t.text },
          },
        },
      },
      MuiAppBar: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          colorInherit: {
            backgroundColor: t.surface,
            color: t.text,
            backgroundImage: 'none',
            boxShadow: 'none',
            borderBottom: `1px solid ${t.border}`,
          },
        },
      },
    },
  })
}
