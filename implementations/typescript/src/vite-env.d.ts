/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AFDIAN_URL?: string;
  readonly VITE_KOFI_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
