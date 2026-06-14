/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** Set to `1` to show "Sign in with Zoho" on the login page. */
  readonly VITE_ENABLE_ZOHO_LOGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
