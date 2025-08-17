import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

/**
 * Vite configuration for FIRE Balance Calculator
 *
 * Features:
 * - React with TypeScript support
 * - PWA capabilities with offline support
 * - Path aliases for clean imports
 * - Optimized build settings
 * - Development server configuration
 */
export default defineConfig({
  plugins: [
    // React plugin with fast refresh
    react(),

    // PWA plugin for offline support and app installation
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      injectRegister: 'auto', // 自动注册，适配更多环境
      manifestFilename: 'manifest.json', // 使用传统的 .json 扩展名
      devOptions: {
        enabled: false, // 开发模式禁用 SW
      },
      manifest: {
        name: 'FIRE Balance Calculator',
        short_name: 'FIRE Balance',
        description: 'Financial Independence, Retire Early planning tool',
        theme_color: '#f97316', // Primary orange color
        background_color: '#1a1a1a', // 深色背景，让图标更突出
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        icons: [
          // 标准应用图标
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        categories: ['finance', 'productivity', 'lifestyle'],
      },
      workbox: {
        // 更积极的Service Worker配置，提高PWA安装成功率
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        disableDevLogs: false,
        // 简单的运行时缓存配置
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
      },
    }),
  ],

  // Path resolution aliases for cleaner imports
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../../shared'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
      '@core': path.resolve(__dirname, './src/core'),
    },
  },

  // Development server configuration
  server: {
    port: 3000,
    host: true, // Listen on all addresses
    open: true, // Automatically open browser
  },

  // Preview server configuration
  preview: {
    port: 4173,
    host: true,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '*.ngrok.io',
      '6ff9f3f77730.ngrok-free.app',
    ],
  },

  // Build configuration
  build: {
    // Generate source maps for debugging
    sourcemap: true,

    // Optimize bundle size
    rollupOptions: {
      output: {
        // Code splitting for better caching
        manualChunks: {
          vendor: ['react', 'react-dom'],
          mantine: ['@mantine/core', '@mantine/hooks', '@mantine/form'],
          charts: ['@mantine/charts'],
        },
      },
    },

    // Target modern browsers for better performance
    target: 'es2020',
  },

  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', '@mantine/core', '@mantine/hooks'],
  },
});
