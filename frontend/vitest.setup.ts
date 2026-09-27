import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Without `globals: true`, Testing Library does not unmount between tests on its own.
afterEach(cleanup);
