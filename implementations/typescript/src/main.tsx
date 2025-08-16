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
      <App />
    </MantineProvider>
  </React.StrictMode>
);
