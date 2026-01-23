import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import fs from 'fs';
import { marked } from 'marked';

/**
 * Custom plugin to convert usage markdown to HTML and copy to dist folder
 */
function copyUsageDocs(): Plugin {
  return {
    name: 'copy-usage-docs',
    generateBundle() {
      const docsDir = path.resolve(__dirname, '../../docs');
      const usageFiles = [
        { md: 'usage_en.md', html: 'usage_en.html' },
        { md: 'usage_cn.md', html: 'usage_cn.html' },
        { md: 'usage_ja.md', html: 'usage_ja.html' },
      ];

      usageFiles.forEach(({ md, html }) => {
        const sourcePath = path.join(docsDir, md);
        if (fs.existsSync(sourcePath)) {
          const markdownContent = fs.readFileSync(sourcePath, 'utf-8');

          // Configure marked for better HTML output
          marked.setOptions({
            breaks: true,
            gfm: true,
          });

          // Convert markdown to HTML
          const htmlContent = marked(markdownContent);

          // Create a complete HTML document
          const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FIRE Balance - User Guide</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
            background: #fff;
        }
        h1, h2, h3, h4, h5, h6 {
            color: #f97316;
            margin-top: 2em;
            margin-bottom: 0.5em;
        }
        h1 {
            border-bottom: 2px solid #f97316;
            padding-bottom: 0.3em;
        }
        h2 {
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 0.3em;
        }
        code {
            background: #f3f4f6;
            padding: 0.2em 0.4em;
            border-radius: 3px;
            font-family: 'Monaco', 'Menlo', monospace;
        }
        pre {
            background: #f3f4f6;
            padding: 1em;
            border-radius: 5px;
            overflow-x: auto;
        }
        blockquote {
            border-left: 4px solid #f97316;
            margin: 0;
            padding-left: 1em;
            color: #666;
        }
        a {
            color: #f97316;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        .header-nav {
            text-align: center;
            margin-bottom: 2em;
            padding-bottom: 1em;
            border-bottom: 1px solid #e5e7eb;
        }
        .header-nav a {
            margin: 0 1em;
            padding: 0.5em 1em;
            background: #f3f4f6;
            border-radius: 5px;
            display: inline-block;
        }
        .header-nav a:hover {
            background: #f97316;
            color: white;
            text-decoration: none;
        }
        @media (max-width: 768px) {
            body {
                padding: 10px;
            }
            .header-nav a {
                display: block;
                margin: 0.5em 0;
            }
        }
    </style>
</head>
<body>
    <div class="header-nav">
        <a href="usage_en.html">English</a>
        <a href="usage_cn.html">中文</a>
        <a href="usage_ja.html">日本語</a>
        <a href="./">← Back to App</a>
    </div>
    ${htmlContent}
</body>
</html>`;

          this.emitFile({
            type: 'asset',
            fileName: html,
            source: fullHtml,
          });
        }
      });
    },
  };
}

/**
 * Vite configuration for FIRE Balance Calculator
 *
 * Features:
 * - React with TypeScript support
 * - PWA capabilities with offline support
 * - Path aliases for clean imports
 * - Optimized build settings
 * - Development server configuration
 * - Copies usage documentation to dist for CDN accessibility
 */
export default defineConfig(() => {
  // Workaround: workbox-build bundles the generated service worker with Rollup + @rollup/plugin-terser
  // when mode === 'production'. On some Node.js versions (observed on Node 22) this can fail with:
  // "Unexpected early exit ... (terser) renderChunk".
  // This only affects the service worker bundling/minification step, not the main app bundle.
  //
  // - Default to 'production' for normal builds.
  // - Fall back to 'development' on Node 22+ to keep builds stable.
  // - Allow override via env var: PWA_SW_MODE=production|development
  const pwaSwMode = (() => {
    const override = process.env.PWA_SW_MODE;
    if (override === 'production' || override === 'development')
      return override;

    const major = Number(String(process.versions.node).split('.')[0] || 0);
    return major >= 22 ? 'development' : 'production';
  })();

  return {
    plugins: [
      // React plugin with fast refresh
      react(),

      // Copy usage documentation to dist folder
      copyUsageDocs(),

      // PWA plugin for offline support and app installation
      VitePWA({
        mode: pwaSwMode,
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
  };
});
