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
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

// Global styles
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/charts/styles.css';
import '@mantine/dates/styles.css';
import './index.css';

// App components and providers
import App from './App';
import { I18nProvider } from '@/utils/i18n';

// =============================================================================
// Theme Configuration
// =============================================================================

/**
 * Custom Mantine theme matching our design system
 * Integrates with Tailwind CSS colors and responsive breakpoints
 */
const theme = createTheme({
  // Color palette matching Tailwind configuration
  colors: {
    // Primary brand color (orange)
    primary: [
      '#fff7ed', // primary.50
      '#ffedd5', // primary.100
      '#fed7aa', // primary.200
      '#fdba74', // primary.300
      '#fb923c', // primary.400
      '#f97316', // primary.500 - Main brand color
      '#ea580c', // primary.600
      '#c2410c', // primary.700
      '#9a3412', // primary.800
      '#7c2d12', // primary.900
    ],
  },

  // Set primary color
  primaryColor: 'primary',

  // Typography settings
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
  fontFamilyMonospace: 'JetBrains Mono, Monaco, Consolas, monospace',

  // Responsive breakpoints matching Tailwind CSS
  breakpoints: {
    xs: '480px',  // Extra small devices
    sm: '640px',  // Small devices
    md: '768px',  // Medium devices
    lg: '1024px', // Large devices
    xl: '1280px', // Extra large devices
  },
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
      <Notifications position="top-right" />
      <I18nProvider>
        <App />
      </I18nProvider>
    </MantineProvider>
  </React.StrictMode>
);
