// oxlint-disable import/no-namespace
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { afterEach, expect } from "bun:test";
import { restoreStubbedGlobals } from "./globals";

expect.extend(matchers);

afterEach(() => {
  cleanup();
  restoreStubbedGlobals();
});

Object.defineProperty(window, "matchMedia", {
  value: (query: string) => ({
    matches: query.includes("min-width"),
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  }),
  writable: true,
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock;
globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0) as unknown as number;
globalThis.cancelAnimationFrame = (handle) => clearTimeout(handle);
