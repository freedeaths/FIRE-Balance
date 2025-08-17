import type { Config } from "jest";

/**
 * Jest configuration for React + TypeScript testing
 *
 * This configuration:
 * - Uses ts-jest for TypeScript support
 * - Sets up jsdom environment for React component testing
 * - Configures module mapping for static assets and path aliases
 * - Sets up testing library matchers
 * - Provides coverage reporting
 */
// 调试信息
if (process.env.PRE_COMMIT) {
  console.log("🧪 Jest config: Pre-commit environment detected");
  console.log("🔧 Jest config: Loading with debugging enabled");
}

const config: Config = {
  // Test environment - jsdom simulates browser DOM for React testing
  testEnvironment: "jsdom",

  // TypeScript preset for transforming .ts/.tsx files
  preset: "ts-jest",

  // Setup files to run before each test
  setupFilesAfterEnv: ["<rootDir>/src/test-setup.ts"],

  // Module name mapping - handle static assets and CSS modules
  moduleNameMapper: {
    // Handle CSS imports
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",

    // Handle static assets (images, fonts, etc.)
    "\\.(jpg|jpeg|png|gif|svg|ico|webp)$":
      "<rootDir>/src/__mocks__/fileMock.ts",

    // Path aliases matching tsconfig.app.json paths
    "@/(.*)$": "<rootDir>/src/$1",
    "@shared/(.*)$": "<rootDir>/../../shared/$1",
    "@components/(.*)$": "<rootDir>/src/components/$1",
    "@hooks/(.*)$": "<rootDir>/src/hooks/$1",
    "@utils/(.*)$": "<rootDir>/src/utils/$1",
    "@types/(.*)$": "<rootDir>/src/types/$1",
    "@core/(.*)$": "<rootDir>/src/core/$1",

    // Handle JSON imports from shared directory
    "^@shared/i18n/(.*)\\.json$": "<rootDir>/../../shared/i18n/$1.json",
  },

  // Transform configuration (updated to avoid deprecated globals)
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        // Point to the correct tsconfig file (includes all necessary settings)
        tsconfig: "./tsconfig.app.json",
        useESM: false,
      },
    ],
  },

  // Test file patterns
  testMatch: [
    "<rootDir>/src/**/__tests__/**/*.(ts|tsx)",
    "<rootDir>/src/**/?(*.)(test|spec).(ts|tsx)",
  ],

  // Ignore these directories
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/dist/"],

  // Coverage configuration
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts", // Exclude type definitions
    "!src/main.tsx", // Exclude entry point
    "!src/vite-env.d.ts", // Exclude Vite types
    "!src/**/*.stories.tsx", // Exclude Storybook files
    "!src/**/__tests__/**", // Exclude test files from coverage
  ],

  // Coverage thresholds - enforce minimum test coverage
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // Coverage reporters
  coverageReporters: ["text", "lcov", "html"],

  // Verbose output for detailed test results
  verbose: true,

  // Module resolution
  moduleDirectories: ["node_modules", "<rootDir>/src"],

  // File extensions Jest should handle
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],

  // 适当的超时设置，强制退出防止卡住
  testTimeout: 30000, // 30秒超时
  detectOpenHandles: true, // 检测未关闭的句柄，用于调试
  forceExit: true, // 强制退出，防止卡住

  // 在 CI 环境下的特殊配置
  ...(process.env.CI
    ? {
        watchAll: false,
        coverage: false, // 跳过覆盖率收集以加快速度
        verbose: false, // 减少输出
      }
    : {}),
};

export default config;
