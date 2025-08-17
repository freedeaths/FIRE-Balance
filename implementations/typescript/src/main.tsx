/**
 * Main application entry point
 *
 * Sets up the React application with all necessary providers and configuration:
 * - Mantine UI library with theme customization
 * - Internationalization (i18n) provider
 * - Global CSS and styling
 * - Error boundaries for production resilience
 *
 * This file follows React 18+ best practices with concurrent features
 * and provides a solid foundation for the FIRE Balance Calculator app.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

// Global styles
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/charts/styles.css';

// App components and providers
import App from './App';

// Import our custom theme
import { theme } from './styles/theme';

// PWA Service Worker 由 Vite PWA 插件自动处理
// 通过 registerSW.js 注册

// 调试启动屏幕和权限
console.log('🖼️ Splash Screen Debug:');
console.log(
  '  - Mobile splash exists:',
  document.querySelector('link[href="/splash-mobile-640x1138.png"]') !== null
);
console.log(
  '  - Desktop splash exists:',
  document.querySelector('link[href="/splash-hires-desktop-1200x900.png"]') !==
    null
);
console.log(
  '  - Apple touch startup images:',
  document.querySelectorAll('link[rel="apple-touch-startup-image"]').length
);

// 明确禁用所有可能触发权限弹窗的功能
console.log('🔐 Permission Policy: All unnecessary permissions disabled');

// 禁用通知相关功能
if ('Notification' in window) {
  // 不请求通知权限，保持默认状态
  console.log('🔔 Notifications available but disabled by policy');
}

// 禁用地理位置
if ('geolocation' in navigator) {
  console.log('📍 Geolocation available but disabled by policy');
}

// 禁用设备运动传感器
if ('DeviceMotionEvent' in window) {
  console.log('📱 Device motion available but disabled by policy');
}

// 监听页面可见性变化（可能触发权限弹窗）
document.addEventListener('visibilitychange', () => {
  console.log('👁️ Page visibility changed:', document.visibilityState);
});

// 监听焦点变化（可能触发权限弹窗）
window.addEventListener('focus', () => {
  console.log('🎯 Window gained focus');
});

window.addEventListener('blur', () => {
  console.log('😴 Window lost focus');
});

// =============================================================================
// Application Initialization
// =============================================================================

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <MantineProvider theme={theme}>
      <Notifications position='top-right' />
      <App />
    </MantineProvider>
  </React.StrictMode>
);
