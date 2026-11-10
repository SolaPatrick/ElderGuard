import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { server } from '../mocks/node';
import { resetDb } from '../mocks/db';

// Screen tests render the whole app (router, login check, MUI). On a busy machine the first
// screen can take over a second in jsdom, which is the default wait, so allow up to 3 seconds.
configure({ asyncUtilTimeout: 3000 });

// jsdom does not implement matchMedia; MUI uses it for night mode and breakpoints.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// Recharts' ResponsiveContainer needs ResizeObserver.
if (!('ResizeObserver' in window)) {
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => {
  resetDb();
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
