import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(cleanup);

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({ matches: query.includes('min-width'), media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }),
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock;
globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0) as unknown as number;
globalThis.cancelAnimationFrame = (handle) => clearTimeout(handle);
