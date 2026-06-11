/** Zoho OAuth sign-in is kept in the codebase but hidden unless explicitly enabled. */
export function isZohoLoginEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_ZOHO_LOGIN === "1";
}
