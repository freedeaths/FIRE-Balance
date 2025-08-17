/**
 * Jest test setup file
 *
 * This file runs before each test and sets up:
 * - Testing Library matchers for better assertions
 * - Global test utilities
 * - Mock configurations
 * - Custom matchers for domain-specific testing
 */

import "@testing-library/jest-dom";

// Extend Jest matchers with Testing Library's custom matchers
// This provides matchers like .toBeInTheDocument(), .toHaveClass(), etc.

// 调试信息 - 检测 pre-commit 环境
if (process.env.PRE_COMMIT) {
  console.log("🔧 Pre-commit test environment detected");
  console.log("📁 Working directory:", process.cwd());
  console.log("🛠️ Node version:", process.version);
  console.log("💾 Memory usage:", process.memoryUsage());
}

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
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
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

// 调试测试执行过程
if (process.env.PRE_COMMIT) {
  let testCount = 0;

  beforeAll(() => {
    console.log("🚀 Jest: Starting all tests");
  });

  beforeEach(() => {
    testCount++;
    console.log(`🧪 Jest: Starting test #${testCount}`);
  });

  afterEach(() => {
    console.log(`✅ Jest: Completed test #${testCount}`);
    // 清理定时器
    jest.clearAllTimers();
  });

  afterAll(() => {
    console.log("🏁 Jest: All tests completed");
  });
} else {
  // 正常环境下的清理
  afterEach(() => {
    jest.clearAllTimers();
  });
}
