import { useColorScheme } from 'react-native';
import { darkColors, lightColors, numbers, type ColorTokens } from '@elderguard/shared';
import { usePrefs } from './prefs';

/** Light or dark: the choice in M-29, or the phone's own setting when that is "Same as phone". */
export function useIsDark(): boolean {
  const system = useColorScheme();
  const { appearance } = usePrefs();
  return appearance === 'system' ? system === 'dark' : appearance === 'dark';
}

/** The ElderGuard design tokens for the light or dark look. */
export function useColors(): ColorTokens {
  return useIsDark() ? darkColors : lightColors;
}

export const space = numbers.spacing;
export const radius = numbers.radius;
export const size = numbers.size;
