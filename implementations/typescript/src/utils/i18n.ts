/**
 * Internationalization (i18n) utilities for FIRE Balance Calculator
 *
 * This module provides translation functionality that reuses the shared i18n JSON files
 * from the `/shared/i18n/` directory. It maintains compatibility with the Python
 * implementation while providing a modern TypeScript API.
 *
 * Key features:
 * - Reuses shared translation files (no duplication)
 * - Type-safe translation keys
 * - React-friendly hooks
 * - Persistent language preferences
 * - Fallback handling for missing translations
 */

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import type { LanguageCode } from '../types';

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Translation object structure matching the JSON files
 */
interface TranslationObject {
  [key: string]: string | TranslationObject;
}

/**
 * i18n context interface for React Context API
 */
interface I18nContextType {
  /** Current language code */
  currentLanguage: LanguageCode;

  /** Change the current language */
  changeLanguage: (language: LanguageCode) => void;

  /** Translate a key to current language */
  t: (key: string, params?: Record<string, string | number>) => string;

  /** Check if translations are loaded */
  isLoaded: boolean;
}

// =============================================================================
// Constants and Configuration
// =============================================================================

/** Available language codes */
export const AVAILABLE_LANGUAGES: LanguageCode[] = ['en', 'zh-CN', 'ja'];

/** Default language */
export const DEFAULT_LANGUAGE: LanguageCode = 'en';

/** Local storage key for language preference */
const LANGUAGE_STORAGE_KEY = 'fire-balance-language';

// =============================================================================
// Translation Loading
// =============================================================================

/**
 * Cache for loaded translations to avoid repeated network requests
 */
const translationCache = new Map<LanguageCode, TranslationObject>();

/**
 * Load translation file for a specific language
 * Dynamically imports from the shared i18n directory
 */
const loadTranslation = async (language: LanguageCode): Promise<TranslationObject> => {
  // Check cache first
  if (translationCache.has(language)) {
    return translationCache.get(language)!;
  }

  try {
    // Dynamic import of the translation file
    // Note: Vite will handle the path resolution for @shared alias
    const translationModule = await import(`@shared/i18n/${language}.json`);
    const translations = translationModule.default || translationModule;

    // Cache the loaded translations
    translationCache.set(language, translations);
    return translations;

  } catch (error) {
    console.warn(`Failed to load translations for language '${language}':`, error);

    // Fallback to English if not already trying English
    if (language !== 'en') {
      console.warn(`Falling back to English translations`);
      return loadTranslation('en');
    }

    // If English also fails, return empty object
    return {};
  }
};

// =============================================================================
// Translation Utilities
// =============================================================================

/**
 * Get nested value from translation object using dot notation
 * Example: getNestedValue(obj, 'user.profile.name') returns obj.user.profile.name
 */
const getNestedValue = (obj: TranslationObject, path: string): string | undefined => {
  return path.split('.').reduce((current: any, key: string) => {
    if (current && typeof current === 'object' && key in current) {
      const value = current[key];
      return value;
    }
    return undefined;
  }, obj) as string | undefined;
};

/**
 * Replace placeholders in translation string with provided parameters
 * Supports {param} style placeholders
 * Example: replacePlaceholders('Hello {name}!', { name: 'John' }) returns 'Hello John!'
 */
const replacePlaceholders = (
  text: string,
  params: Record<string, string | number> = {}
): string => {
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    const value = params[key];
    return value !== undefined ? String(value) : match;
  });
};

// =============================================================================
// Core Translation Class
// =============================================================================

/**
 * Core i18n manager class
 * Provides translation functionality with caching and fallbacks
 */
class I18nManager {
  private currentLanguage: LanguageCode = DEFAULT_LANGUAGE;
  private translations: TranslationObject = {};
  private isLoaded = false;
  private listeners: Set<() => void> = new Set();

  constructor() {
    // Load saved language preference from localStorage
    this.loadLanguagePreference();
  }

  /**
   * Load language preference from localStorage
   */
  private loadLanguagePreference(): void {
    try {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved && AVAILABLE_LANGUAGES.includes(saved as LanguageCode)) {
        this.currentLanguage = saved as LanguageCode;
      }
    } catch (error) {
      console.warn('Failed to load language preference from localStorage:', error);
    }
  }

  /**
   * Save language preference to localStorage
   */
  private saveLanguagePreference(language: LanguageCode): void {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch (error) {
      console.warn('Failed to save language preference to localStorage:', error);
    }
  }

  /**
   * Add a listener for language changes
   */
  addListener(listener: () => void): void {
    this.listeners.add(listener);
  }

  /**
   * Remove a language change listener
   */
  removeListener(listener: () => void): void {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of language change
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  /**
   * Get current language
   */
  getCurrentLanguage(): LanguageCode {
    return this.currentLanguage;
  }

  /**
   * Change language and reload translations
   */
  async changeLanguage(language: LanguageCode): Promise<void> {
    if (language === this.currentLanguage) {
      return; // No change needed
    }

    this.currentLanguage = language;
    this.saveLanguagePreference(language);

    try {
      this.translations = await loadTranslation(language);
      this.isLoaded = true;
    } catch (error) {
      console.error(`Failed to change language to '${language}':`, error);
      this.isLoaded = false;
    }

    this.notifyListeners();
  }

  /**
   * Initialize translations for current language
   */
  async initialize(): Promise<void> {
    try {
      this.translations = await loadTranslation(this.currentLanguage);
      this.isLoaded = true;
    } catch (error) {
      console.error('Failed to initialize i18n:', error);
      this.isLoaded = false;
    }

    this.notifyListeners();
  }

  /**
   * Translate a key with optional parameter substitution
   */
  translate(key: string, params: Record<string, string | number> = {}): string {
    if (!this.isLoaded) {
      return key; // Return key as fallback if not loaded
    }

    const translation = getNestedValue(this.translations, key);

    if (translation === undefined) {
      console.warn(`Translation not found for key '${key}' in language '${this.currentLanguage}'`);
      return key; // Return key as fallback
    }

    return replacePlaceholders(translation, params);
  }

  /**
   * Check if translations are loaded
   */
  getIsLoaded(): boolean {
    return this.isLoaded;
  }
}

// =============================================================================
// Global Instance
// =============================================================================

/** Global i18n manager instance */
const i18nManager = new I18nManager();

// Initialize on module load
i18nManager.initialize();

// =============================================================================
// React Context
// =============================================================================

/**
 * React Context for i18n
 */
const I18nContext = createContext<I18nContextType | null>(null);

/**
 * i18n Provider component for React Context
 * Wrap your app with this component to enable i18n throughout the component tree
 */
export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>(
    i18nManager.getCurrentLanguage()
  );
  const [isLoaded, setIsLoaded] = useState(i18nManager.getIsLoaded());

  useEffect(() => {
    const handleLanguageChange = (): void => {
      setCurrentLanguage(i18nManager.getCurrentLanguage());
      setIsLoaded(i18nManager.getIsLoaded());
    };

    i18nManager.addListener(handleLanguageChange);
    return () => i18nManager.removeListener(handleLanguageChange);
  }, []);

  const changeLanguage = useCallback(async (language: LanguageCode) => {
    await i18nManager.changeLanguage(language);
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    return i18nManager.translate(key, params);
  }, []);

  const contextValue: I18nContextType = {
    currentLanguage,
    changeLanguage,
    t,
    isLoaded,
  };

  return React.createElement(
    I18nContext.Provider,
    { value: contextValue },
    children
  );
};

// =============================================================================
// React Hooks
// =============================================================================

/**
 * React hook for using i18n functionality
 * Must be used within an I18nProvider
 */
export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

/**
 * React hook for translation function only
 * Convenience hook when you only need the translation function
 */
export const useTranslation = (): ((key: string, params?: Record<string, string | number>) => string) => {
  const { t } = useI18n();
  return t;
};

// =============================================================================
// Standalone Functions (for non-React usage)
// =============================================================================

/**
 * Standalone translation function
 * Can be used outside of React components
 */
export const t = (key: string, params: Record<string, string | number> = {}): string => {
  return i18nManager.translate(key, params);
};

/**
 * Get current language (standalone function)
 */
export const getCurrentLanguage = (): LanguageCode => {
  return i18nManager.getCurrentLanguage();
};

/**
 * Change language (standalone function)
 */
export const changeLanguage = async (language: LanguageCode): Promise<void> => {
  await i18nManager.changeLanguage(language);
};

/**
 * Check if i18n is loaded (standalone function)
 */
export const isI18nLoaded = (): boolean => {
  return i18nManager.getIsLoaded();
};
