export * from './schemas';
export * from './format';
export * from './alertOptions';
export * from './notifications';
export * from './helpContent';
export * from './reports';
export * from './reportDocuments';
export * from './cameraSummary';
export * from './incidentFilters';
export { lightColors, darkColors, numbers } from './tokens/tokens.generated';

import type { lightColors } from './tokens/tokens.generated';
/** Shape of one color mode (light or dark) with plain string values. */
export type ColorTokens = {
  [G in keyof typeof lightColors]: { [K in keyof (typeof lightColors)[G]]: string };
};
