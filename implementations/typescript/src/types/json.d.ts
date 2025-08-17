/**
 * JSON module type declarations
 *
 * Allows importing JSON files as modules in TypeScript
 */

declare module '*.json' {
  const value: any;
  export default value;
}

// Specific type declarations for shared i18n files
declare module '@shared/i18n/en.json' {
  const translations: Record<string, any>;
  export default translations;
}

declare module '@shared/i18n/zh-CN.json' {
  const translations: Record<string, any>;
  export default translations;
}

declare module '@shared/i18n/ja.json' {
  const translations: Record<string, any>;
  export default translations;
}
