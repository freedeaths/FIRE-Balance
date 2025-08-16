/**
 * App Store - Global application state management
 *
 * Handles language, theme, loading states, and other app-wide concerns.
 * This is the top-level store that coordinates with other stores.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { AppStore, AppState, StoreConfig } from './types';
import type { LanguageCode } from '../types';
import { detectUserLanguage, saveLanguagePreference } from '../utils/languageDetection';

// =============================================================================
// Initial State
// =============================================================================

const initialAppState: AppState = {
  // Language and i18n - 自动检测用户语言
  currentLanguage: detectUserLanguage(),
  isI18nLoaded: false,

  // App-wide UI state
  isLoading: false,
  error: null,

  // Theme and preferences
  theme: 'system',

  // App metadata
  version: '0.2.0-dev',
  buildTime: undefined,
};

// =============================================================================
// Store Creator Function
// =============================================================================

export const createAppStore = (config?: StoreConfig) => {
  const storeCreator = (set: any, get: any) => ({
          ...initialAppState,

          // =============================================================================
          // Language Management
          // =============================================================================

          setLanguage: (language: LanguageCode) => {
            // 保存语言偏好到本地存储
            saveLanguagePreference(language);
            set({ currentLanguage: language }, false, 'setLanguage');
          },

          setI18nLoaded: (loaded: boolean) => {
            set({ isI18nLoaded: loaded }, false, 'setI18nLoaded');
          },

          // =============================================================================
          // Global State Management
          // =============================================================================

          setLoading: (loading: boolean) => {
            set({ isLoading: loading }, false, 'setLoading');
          },

          setError: (error: string | null) => {
            set({ error }, false, 'setError');
          },

          clearError: () => {
            set({ error: null }, false, 'clearError');
          },

          // =============================================================================
          // Theme Management
          // =============================================================================

          setTheme: (theme: 'light' | 'dark' | 'system') => {
            set({ theme }, false, 'setTheme');
          },

          // =============================================================================
          // Utilities
          // =============================================================================

          reset: () => {
            set(initialAppState, false, 'reset');
          },
        });

  // Create store with conditional persistence
  if (config?.persist?.enabled) {
    return create<AppStore>()(
      devtools(
        persist(
          storeCreator,
          {
            name: config.persist.key ?? 'fire-app-state',
            partialize: (state) => ({
              currentLanguage: state.currentLanguage,
              theme: state.theme,
            }),
          }
        ),
        {
          name: 'FIRE-App-Store',
          enabled: config?.devtools ?? process.env.NODE_ENV === 'development',
        }
      )
    );
  } else {
    return create<AppStore>()(
      devtools(
        storeCreator,
        {
          name: 'FIRE-App-Store',
          enabled: config?.devtools ?? process.env.NODE_ENV === 'development',
        }
      )
    );
  }
};

// =============================================================================
// Default Store Instance
// =============================================================================

// Export the store type for external usage
export type { AppStore } from './types';

export const useAppStore = createAppStore({
  persist: {
    enabled: true, // Enable persistence for language and theme settings
    key: 'fire-app-state',
    storage: 'localStorage',
  },
  devtools: true,
});

// =============================================================================
// Store Selectors (for performance optimization)
// =============================================================================

// Language selectors
export const useCurrentLanguage = () => useAppStore((state) => state.currentLanguage);
export const useIsI18nLoaded = () => useAppStore((state) => state.isI18nLoaded);

// UI state selectors
export const useIsLoading = () => useAppStore((state) => state.isLoading);
export const useError = () => useAppStore((state) => state.error);

// Theme selectors
export const useTheme = () => useAppStore((state) => state.theme);

// App metadata selectors
export const useAppVersion = () => useAppStore((state) => state.version);

// =============================================================================
// Store Actions (for direct usage without hooks)
// =============================================================================

// Language actions
export const setLanguage = (language: LanguageCode) =>
  useAppStore.getState().setLanguage(language);

export const setI18nLoaded = (loaded: boolean) =>
  useAppStore.getState().setI18nLoaded(loaded);

// Loading and error actions
export const setLoading = (loading: boolean) =>
  useAppStore.getState().setLoading(loading);

export const setError = (error: string | null) =>
  useAppStore.getState().setError(error);

export const clearError = () =>
  useAppStore.getState().clearError();

// Theme actions
export const setTheme = (theme: 'light' | 'dark' | 'system') =>
  useAppStore.getState().setTheme(theme);

// Utility actions
export const resetAppStore = () =>
  useAppStore.getState().reset();
