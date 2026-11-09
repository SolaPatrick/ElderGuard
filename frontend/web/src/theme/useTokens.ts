import { useColorScheme } from '@mui/material/styles';
import { darkColors, lightColors, type ColorTokens } from '@elderguard/shared';

/**
 * Raw color values for the current mode. Use this only where CSS variables do
 * not work (e.g. chart libraries that write SVG attributes). Everywhere else use
 * sx paths like 'eg.sys.primary'.
 */
export function useTokens(): ColorTokens {
  const { mode, systemMode } = useColorScheme();
  const resolved = mode === 'system' ? systemMode : mode;
  return resolved === 'dark' ? darkColors : lightColors;
}
