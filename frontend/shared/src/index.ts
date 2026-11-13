export * from './schemas';
export * from './format';
export * from './alertOptions';
export { lightColors, darkColors, numbers } from './tokens/tokens.generated';

import type { lightColors } from './tokens/tokens.generated';
/** Shape of one color mode (light or dark) with plain string values. */
export type ColorTokens = {
  [G in keyof typeof lightColors]: { [K in keyof (typeof lightColors)[G]]: string };
};
