/**
 * Jest test setup file
 *
 * This file runs before each test and sets up:
 * - Testing Library matchers for better assertions
 * - Global test utilities
 * - Mock configurations
 * - Custom matchers for domain-specific testing
 */

import '@testing-library/jest-dom';

// Extend Jest matchers with Testing Library's custom matchers
// This provides matchers like .toBeInTheDocument(), .toHaveClass(), etc.

/**
 * Mock IntersectionObserver API
 * Mantine components often use this for visibility detection
 */
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect(): void {}
  observe(): void {}
  unobserve(): void {}
} as any;

/**
 * Mock ResizeObserver API
 * Used by some chart components for responsive behavior
 */
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect(): void {}
  observe(): void {}
  unobserve(): void {}
} as any;

/**
 * Mock window.matchMedia
 * Used for responsive design testing
 */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

/**
 * Mock HTMLCanvasElement.getContext
 * Required for chart components that use canvas
 */
HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  getImageData: jest.fn(() => ({ data: new Array(4) })),
  putImageData: jest.fn(),
  createImageData: jest.fn(() => []),
  setTransform: jest.fn(),
  drawImage: jest.fn(),
  save: jest.fn(),
  fillText: jest.fn(),
  restore: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  closePath: jest.fn(),
  stroke: jest.fn(),
  translate: jest.fn(),
  scale: jest.fn(),
  rotate: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  measureText: jest.fn(() => ({ width: 0 })),
  transform: jest.fn(),
  rect: jest.fn(),
  clip: jest.fn(),
} as any);

/**
 * Suppress console warnings/errors in tests unless explicitly needed
 * Uncomment these lines if you want cleaner test output
 */
// console.warn = jest.fn();
// console.error = jest.fn();
