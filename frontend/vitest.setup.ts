import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Without `globals: true`, Testing Library does not unmount between tests on its own.
afterEach(cleanup);

// jsdom has no matchMedia: by default nobody asked to reduce motion. A test
// that needs another answer overrides it with vi.spyOn(window, 'matchMedia').
// Tests that run in the node environment have no window at all.
if (typeof window !== 'undefined') {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
