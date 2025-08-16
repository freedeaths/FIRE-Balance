/**
 * Internationalization support for FIRE Planner
 * Browser-compatible TypeScript port from Python i18n.py
 *
 * This module provides translation management with:
 * - Loading translations from shared JSON files
 * - Dot notation key lookup (e.g., 'planner.stages.stage1_title')
 * - Variable substitution in translation strings
 * - Singleton pattern for global access
 */

// Import translations using @shared alias
import enTranslations from '@shared/i18n/en.json';
import zhTranslations from '@shared/i18n/zh-CN.json';
import jaTranslations from '@shared/i18n/ja.json';

// =============================================================================
// Types
// =============================================================================

/**
 * Translation data structure - nested object with string values
 */
type TranslationData = Record<string, any>;

/**
 * Language codes supported by the application
 */
type LanguageCode = 'en' | 'zh-CN' | 'ja';

// Translation data mapping
const TRANSLATIONS: Record<LanguageCode, TranslationData> = {
  'en': enTranslations,
  'zh-CN': zhTranslations,
  'ja': jaTranslations,
};

// =============================================================================
// I18nManager Class
// =============================================================================

/**
 * Internationalization manager for FIRE Planner
 * Direct TypeScript equivalent of Python's I18nManager class
 */
export class I18nManager {
  private language: LanguageCode;
  private translations: TranslationData;

  /**
   * Initialize i18n manager with specified language
   */
  constructor(language: LanguageCode = 'en') {
    this.language = language;
    this.translations = this._loadTranslations();
  }

  /**
   * Load translation data for current language
   */
  private _loadTranslations(): TranslationData {
    // Use pre-imported translations (browser-compatible)
    const translations = TRANSLATIONS[this.language];

    if (translations && typeof translations === 'object') {
      return translations;
    }

    // Fallback to English
    const fallback = TRANSLATIONS['en'];
    if (fallback && typeof fallback === 'object') {
      console.warn(`Translations not found for ${this.language}, falling back to English`);
      return fallback;
    }

    console.error('No translations available');
    return {};
  }

  /**
   * Translate a key with optional variable substitution
   *
   * @param key Translation key using dot notation (e.g., 'planner.stages.stage1_title')
   * @param kwargs Variables for string interpolation
   * @returns Translated string with variables substituted
   *
   * Example:
   *   i18n.t('planner.welcome', { name: 'John' })
   *   // Returns: 'Welcome to FIRE Planner, John!'
   */
  t(key: string, kwargs: Record<string, any> = {}): string {
    // Navigate nested dictionary using dot notation
    const keys = key.split('.');
    let value: any = this.translations;

    for (const k of keys) {
      if (typeof value === 'object' && value !== null && k in value) {
        value = value[k];
      } else {
        // Return key if translation not found
        return key;
      }
    }

    // If final value is not a string, return key
    if (typeof value !== 'string') {
      return key;
    }

    // Substitute variables if provided
    if (Object.keys(kwargs).length > 0) {
      try {
        // Simple template substitution using {key} format
        let result = value;
        for (const [variable, replacement] of Object.entries(kwargs)) {
          const placeholder = `{${variable}}`;
          result = result.replace(new RegExp(placeholder, 'g'), String(replacement));
        }
        return result;
      } catch (error) {
        // Return original value if substitution fails
        return value;
      }
    }

    return value;
  }

  /**
   * Get list of supported language codes
   */
  getSupportedLanguages(): LanguageCode[] {
    return ['en', 'zh-CN', 'ja'];
  }

  /**
   * Change current language and reload translations
   */
  setLanguage(language: LanguageCode): void {
    this.language = language;
    this.translations = this._loadTranslations();
  }

  /**
   * Get current language code
   */
  getCurrentLanguage(): LanguageCode {
    return this.language;
  }

  /**
   * Check if a translation key exists
   */
  hasTranslation(key: string): boolean {
    const keys = key.split('.');
    let value: any = this.translations;

    for (const k of keys) {
      if (typeof value === 'object' && value !== null && k in value) {
        value = value[k];
      } else {
        return false;
      }
    }

    return typeof value === 'string';
  }

  /**
   * Get all available keys (for debugging)
   */
  getAvailableKeys(): string[] {
    const keys: string[] = [];

    const collectKeys = (obj: any, prefix: string = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (typeof value === 'object' && value !== null) {
          collectKeys(value, fullKey);
        } else if (typeof value === 'string') {
          keys.push(fullKey);
        }
      }
    };

    collectKeys(this.translations);
    return keys.sort();
  }
}

// =============================================================================
// Singleton Pattern
// =============================================================================

/**
 * Global i18n instance
 */
let _i18nInstance: I18nManager | null = null;

/**
 * Get global i18n instance (singleton pattern)
 * Direct equivalent of Python's get_i18n() function
 */
export function getI18n(): I18nManager {
  if (_i18nInstance === null) {
    _i18nInstance = new I18nManager();
  }
  return _i18nInstance;
}

/**
 * Convenience function for translation
 * Direct equivalent of Python's t() function
 */
export function t(key: string, kwargs: Record<string, any> = {}): string {
  return getI18n().t(key, kwargs);
}

/**
 * Convenience function to set language globally
 * Direct equivalent of Python's set_language() function
 */
export function setLanguage(language: LanguageCode): void {
  getI18n().setLanguage(language);
}

/**
 * Get current language from global instance
 */
export function getCurrentLanguage(): LanguageCode {
  return getI18n().getCurrentLanguage();
}

/**
 * Get supported languages
 */
export function getSupportedLanguages(): LanguageCode[] {
  return getI18n().getSupportedLanguages();
}

/**
 * Create a new I18nManager instance (for testing or isolated usage)
 */
export function createI18nManager(language: LanguageCode = 'en'): I18nManager {
  return new I18nManager(language);
}

// =============================================================================
// Browser Compatibility (Client-Side Alternative)
// =============================================================================

/**
 * Browser-compatible I18nManager for client-side usage
 * This version loads translations from HTTP requests instead of filesystem
 */
export class BrowserI18nManager {
  private language: LanguageCode;
  private translations: TranslationData;
  private baseUrl: string;

  constructor(language: LanguageCode = 'en', baseUrl: string = '/i18n') {
    this.language = language;
    this.baseUrl = baseUrl;
    this.translations = {};
  }

  /**
   * Load translations asynchronously for browser environment
   */
  async loadTranslations(): Promise<void> {
    const translationUrl = `${this.baseUrl}/${this.language}.json`;
    const fallbackUrl = `${this.baseUrl}/en.json`;

    try {
      const response = await fetch(translationUrl);
      if (response.ok) {
        this.translations = await response.json();
        return;
      }
    } catch (error) {
      console.warn(`Failed to load translations from ${translationUrl}:`, error);
    }

    // Fallback to English
    try {
      const response = await fetch(fallbackUrl);
      if (response.ok) {
        this.translations = await response.json();
        return;
      }
    } catch (error) {
      console.warn(`Failed to load fallback translations from ${fallbackUrl}:`, error);
    }

    // Empty translations as final fallback
    this.translations = {};
  }

  /**
   * Translate method (same as I18nManager)
   */
  t(key: string, kwargs: Record<string, any> = {}): string {
    const keys = key.split('.');
    let value: any = this.translations;

    for (const k of keys) {
      if (typeof value === 'object' && value !== null && k in value) {
        value = value[k];
      } else {
        return key;
      }
    }

    if (typeof value !== 'string') {
      return key;
    }

    if (Object.keys(kwargs).length > 0) {
      try {
        let result = value;
        for (const [variable, replacement] of Object.entries(kwargs)) {
          const placeholder = `{${variable}}`;
          result = result.replace(new RegExp(placeholder, 'g'), String(replacement));
        }
        return result;
      } catch (error) {
        return value;
      }
    }

    return value;
  }

  /**
   * Set language and reload translations
   */
  async setLanguage(language: LanguageCode): Promise<void> {
    this.language = language;
    await this.loadTranslations();
  }

  getCurrentLanguage(): LanguageCode {
    return this.language;
  }

  getSupportedLanguages(): LanguageCode[] {
    return ['en', 'zh-CN', 'ja'];
  }
}
