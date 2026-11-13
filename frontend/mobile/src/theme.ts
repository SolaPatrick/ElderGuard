import { useColorScheme } from 'react-native';
import { darkColors, lightColors, numbers, type ColorTokens } from '@elderguard/shared';

/** The ElderGuard design tokens for the phone's light or dark mode. */
export function useColors(): ColorTokens {
  return useColorScheme() === 'dark' ? darkColors : lightColors;
}

export const space = numbers.spacing;
export const radius = numbers.radius;
export const size = numbers.size;
