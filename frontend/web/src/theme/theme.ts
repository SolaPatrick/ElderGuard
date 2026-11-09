import { createTheme, type PaletteOptions } from '@mui/material/styles';
import { darkColors, lightColors, numbers, type ColorTokens } from '@elderguard/shared';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';

declare module '@mui/material/styles' {
  interface Palette {
    /** ElderGuard design tokens for the active mode, e.g. sx={{ bgcolor: 'eg.status.incidentNewBg' }} */
    eg: ColorTokens;
  }
  interface PaletteOptions {
    eg?: ColorTokens;
  }
}

/** Maps ElderGuard tokens onto MUI's palette so stock components pick them up. */
function paletteFrom(c: ColorTokens): PaletteOptions {
  return {
    primary: { main: c.sys.primary, contrastText: c.sys.onPrimary },
    secondary: { main: c.sys.info, contrastText: c.sys.onInfo },
    error: { main: c.sys.critical, contrastText: c.sys.onCritical },
    warning: { main: c.sys.warning, contrastText: c.sys.onWarning },
    success: { main: c.sys.success, contrastText: c.sys.onSuccess },
    info: { main: c.sys.info, contrastText: c.sys.onInfo },
    background: { default: c.sys.surface, paper: c.sys.surfaceContainerLowest },
    text: { primary: c.sys.onSurface, secondary: c.sys.onSurfaceVariant },
    divider: c.sys.outlineVariant,
    eg: c,
  };
}

const n = numbers;

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'data-eg-mode' },
  colorSchemes: {
    light: { palette: paletteFrom(lightColors) },
    dark: { palette: paletteFrom(darkColors) },
  },
  spacing: 4, // sx={{ p: 4 }} = 16px, matches the 4px spacing scale
  shape: { borderRadius: n.radius.radiusMd },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    // Material 3 type scale (ElderGuard text styles)
    h1: { fontSize: 57, lineHeight: '64px', fontWeight: 400 }, // Display L
    h2: { fontSize: 45, lineHeight: '52px', fontWeight: 400 }, // Display M
    h3: { fontSize: 36, lineHeight: '44px', fontWeight: 600 }, // KPI / Display S
    h4: { fontSize: 28, lineHeight: '36px', fontWeight: 500 }, // Headline M (page titles)
    h5: { fontSize: 22, lineHeight: '28px', fontWeight: 500 }, // Title L
    h6: { fontSize: 16, lineHeight: '24px', fontWeight: 600 }, // Title M (card titles)
    subtitle1: { fontSize: 16, lineHeight: '24px', fontWeight: 500 },
    subtitle2: { fontSize: 14, lineHeight: '20px', fontWeight: 600 }, // Title S
    body1: { fontSize: 16, lineHeight: '24px' },
    body2: { fontSize: 14, lineHeight: '20px' },
    caption: { fontSize: 12, lineHeight: '16px', letterSpacing: 0.2 },
    overline: { fontSize: 11, lineHeight: '16px', fontWeight: 500, letterSpacing: 0.5 },
    button: { fontSize: 14, lineHeight: '20px', fontWeight: 600, textTransform: 'none' },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: n.radius.radiusFull,
          minHeight: n.size.targetWeb,
          paddingInline: 20,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { minWidth: n.size.targetWeb, minHeight: n.size.targetWeb } },
    },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: n.radius.radiusMd,
          borderColor: (theme.vars ?? theme).palette.eg.sys.outlineVariant,
        }),
      },
    },
    MuiChip: {
      styleOverrides: { root: { borderRadius: n.radius.radiusSm, fontWeight: 500 } },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: n.radius.radiusLg } },
    },
    MuiTextField: { defaultProps: { fullWidth: true } },
    MuiLink: { defaultProps: { underline: 'hover' }, styleOverrides: { root: { fontWeight: 500 } } },
    MuiButtonBase: {
      styleOverrides: {
        root: ({ theme }) => ({
          '&.Mui-focusVisible': {
            outline: `${n.size.focusRingWidth}px solid ${(theme.vars ?? theme).palette.eg.comp.focusRing}`,
            outlineOffset: n.size.focusRingOffset,
          },
        }),
      },
    },
  },
});
