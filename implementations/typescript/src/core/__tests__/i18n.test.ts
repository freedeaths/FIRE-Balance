/**
 * Tests for I18n functionality - Direct port from Python test_i18n.py
 * Ensures identical internationalization behavior between TypeScript and Python implementations
 */

import {
  I18nManager,
  getI18n,
  setLanguage,
  getCurrentLanguage,
  getSupportedLanguages,
  t,
  createI18nManager,
  BrowserI18nManager,
} from '../i18n';

describe('I18nManager', () => {
  describe('Initialization', () => {
    test('default language', () => {
      const i18n = new I18nManager();

      expect(i18n.getCurrentLanguage()).toBe('en');
    });

    test('custom language', () => {
      const i18n = new I18nManager('zh-CN');

      expect(i18n.getCurrentLanguage()).toBe('zh-CN');
    });

    test('supported languages', () => {
      const i18n = new I18nManager();
      const languages = i18n.getSupportedLanguages();

      expect(languages).toEqual(['en', 'zh-CN', 'ja']);
      expect(languages).toContain('en');
      expect(languages).toContain('zh-CN');
      expect(languages).toContain('ja');
    });
  });

  describe('Translation', () => {
    test('translate existing key', () => {
      const i18n = new I18nManager();

      // Mock translations data for testing
      (i18n as any).translations = {
        test: {
          simple: 'Hello World',
          nested: {
            key: 'Nested Value'
          }
        }
      };

      expect(i18n.t('test.simple')).toBe('Hello World');
      expect(i18n.t('test.nested.key')).toBe('Nested Value');
    });

    test('translate non-existent key returns key', () => {
      const i18n = new I18nManager();

      (i18n as any).translations = {};

      expect(i18n.t('non.existent.key')).toBe('non.existent.key');
      expect(i18n.t('another.missing')).toBe('another.missing');
    });

    test('translate with variable substitution', () => {
      const i18n = new I18nManager();

      (i18n as any).translations = {
        greeting: 'Hello, {name}!',
        welcome: 'Welcome to {app}, {user}. You have {count} messages.'
      };

      expect(i18n.t('greeting', { name: 'John' })).toBe('Hello, John!');
      expect(i18n.t('welcome', {
        app: 'FIRE Planner',
        user: 'Alice',
        count: 5
      })).toBe('Welcome to FIRE Planner, Alice. You have 5 messages.');
    });

    test('translate with invalid substitution', () => {
      const i18n = new I18nManager();

      (i18n as any).translations = {
        message: 'Hello, {name}!'
      };

      // Missing variable should return original string
      expect(i18n.t('message', { wrongVar: 'value' })).toBe('Hello, {name}!');
    });

    test('translate non-string value returns key', () => {
      const i18n = new I18nManager();

      (i18n as any).translations = {
        invalid: {
          number: 123,
          boolean: true,
          object: { nested: 'value' }
        }
      };

      expect(i18n.t('invalid.number')).toBe('invalid.number');
      expect(i18n.t('invalid.boolean')).toBe('invalid.boolean');
      expect(i18n.t('invalid.object')).toBe('invalid.object');
    });
  });

  describe('Language Management', () => {
    test('set language changes current language', () => {
      const i18n = new I18nManager('en');

      expect(i18n.getCurrentLanguage()).toBe('en');

      i18n.setLanguage('zh-CN');
      expect(i18n.getCurrentLanguage()).toBe('zh-CN');

      i18n.setLanguage('ja');
      expect(i18n.getCurrentLanguage()).toBe('ja');
    });

    test('set language reloads translations', () => {
      const i18n = new I18nManager('en');

      // Mock the _loadTranslations method to track calls
      let loadCallCount = 0;
      const originalLoad = (i18n as any)._loadTranslations;
      (i18n as any)._loadTranslations = () => {
        loadCallCount++;
        return { test: `loaded-${loadCallCount}` };
      };

      i18n.setLanguage('zh-CN'); // Should trigger reload
      expect(loadCallCount).toBe(1);
      expect((i18n as any).translations.test).toBe('loaded-1');

      i18n.setLanguage('ja'); // Should trigger another reload
      expect(loadCallCount).toBe(2);
      expect((i18n as any).translations.test).toBe('loaded-2');
    });
  });

  describe('Utility Methods', () => {
    test('has translation', () => {
      const i18n = new I18nManager();

      (i18n as any).translations = {
        existing: {
          key: 'value',
          nested: {
            deep: 'deep value'
          }
        }
      };

      expect(i18n.hasTranslation('existing.key')).toBe(true);
      expect(i18n.hasTranslation('existing.nested.deep')).toBe(true);
      expect(i18n.hasTranslation('non.existent')).toBe(false);
      expect(i18n.hasTranslation('existing.nested')).toBe(false); // Not a string
    });

    test('get available keys', () => {
      const i18n = new I18nManager();

      (i18n as any).translations = {
        app: {
          title: 'FIRE Planner',
          description: 'Financial Independence Tool'
        },
        user: {
          greeting: 'Hello',
          profile: {
            name: 'Name',
            age: 'Age'
          }
        }
      };

      const keys = i18n.getAvailableKeys();

      expect(keys).toEqual([
        'app.description',
        'app.title',
        'user.greeting',
        'user.profile.age',
        'user.profile.name'
      ]);
    });
  });
});

describe('Singleton Functions', () => {
  beforeEach(() => {
    // Reset singleton instance for each test
    (global as any)._i18nInstance = null;
  });

  test('get i18n returns singleton', () => {
    const i18n1 = getI18n();
    const i18n2 = getI18n();

    expect(i18n1).toBe(i18n2); // Should be the same instance
    expect(i18n1).toBeInstanceOf(I18nManager);
  });

  test('set language affects global instance', () => {
    setLanguage('zh-CN');

    expect(getCurrentLanguage()).toBe('zh-CN');
    expect(getI18n().getCurrentLanguage()).toBe('zh-CN');
  });

  test('get supported languages from global', () => {
    const languages = getSupportedLanguages();

    expect(languages).toEqual(['en', 'zh-CN', 'ja']);
  });

  test('convenience translation function', () => {
    const i18n = getI18n();

    (i18n as any).translations = {
      test: 'Hello {name}!'
    };

    expect(t('test', { name: 'World' })).toBe('Hello World!');
    expect(t('missing')).toBe('missing');
  });
});

describe('Factory Functions', () => {
  test('create i18n manager', () => {
    const i18n1 = createI18nManager('en');
    const i18n2 = createI18nManager('zh-CN');

    expect(i18n1).toBeInstanceOf(I18nManager);
    expect(i18n2).toBeInstanceOf(I18nManager);
    expect(i18n1).not.toBe(i18n2); // Should be different instances

    expect(i18n1.getCurrentLanguage()).toBe('en');
    expect(i18n2.getCurrentLanguage()).toBe('zh-CN');
  });
});

describe('BrowserI18nManager', () => {
  test('initialization only (skip fetch tests in Node.js)', () => {
    const browserI18n = new BrowserI18nManager('en', '/custom-i18n');

    expect(browserI18n.getCurrentLanguage()).toBe('en');
    expect(browserI18n.getSupportedLanguages()).toEqual(['en', 'zh-CN', 'ja']);
  });

  test('translation without loaded data', () => {
    const browserI18n = new BrowserI18nManager();

    // Should return key when no translations are loaded
    expect(browserI18n.t('any.key')).toBe('any.key');
  });
});

describe('Edge Cases', () => {
  test('empty translations object', () => {
    const i18n = new I18nManager();
    (i18n as any).translations = {};

    expect(i18n.t('any.key')).toBe('any.key');
    expect(i18n.hasTranslation('any.key')).toBe(false);
    expect(i18n.getAvailableKeys()).toEqual([]);
  });

  test('null and undefined handling', () => {
    const i18n = new I18nManager();
    (i18n as any).translations = {
      nullValue: null,
      undefinedValue: undefined,
      valid: 'Valid string'
    };

    expect(i18n.t('nullValue')).toBe('nullValue');
    expect(i18n.t('undefinedValue')).toBe('undefinedValue');
    expect(i18n.t('valid')).toBe('Valid string');

    expect(i18n.hasTranslation('nullValue')).toBe(false);
    expect(i18n.hasTranslation('undefinedValue')).toBe(false);
    expect(i18n.hasTranslation('valid')).toBe(true);
  });

  test('deeply nested key access', () => {
    const i18n = new I18nManager();
    (i18n as any).translations = {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: 'Deep value'
            }
          }
        }
      }
    };

    expect(i18n.t('level1.level2.level3.level4.level5')).toBe('Deep value');
    expect(i18n.t('level1.level2.level3.level4.missing')).toBe('level1.level2.level3.level4.missing');
  });

  test('variable substitution with special characters', () => {
    const i18n = new I18nManager();
    (i18n as any).translations = {
      special: 'Price: ${amount} USD, quantity: {count} items'
    };

    // {amount} should be substituted, ${amount} (with $) should not be substituted by our implementation
    expect(i18n.t('special', { amount: '100.50', count: 3 })).toBe('Price: $100.50 USD, quantity: 3 items');
  });

  test('repeated variable substitution', () => {
    const i18n = new I18nManager();
    (i18n as any).translations = {
      repeated: '{name} said: "{name} is great!", and {name} smiled.'
    };

    expect(i18n.t('repeated', { name: 'Alice' })).toBe('Alice said: "Alice is great!", and Alice smiled.');
  });
});
