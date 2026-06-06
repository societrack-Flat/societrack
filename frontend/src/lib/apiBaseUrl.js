/** Production Azure API hostname (default domain for societrack-api web app). */
export const PRODUCTION_API_BASE_URL =
  'https://societrack-api-ffa2axbagaffghe9.centralindia-01.azurewebsites.net';

const INVALID_API_HOSTS = new Set(['https://societrack-api.azurewebsites.net']);

/**
 * Resolve API base URL for fetch calls.
 * VITE_API_BASE_URL is baked in at build time; invalid legacy hostnames fall back to production.
 */
export function getApiBaseUrl() {
  const fromEnv = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
  if (!fromEnv) {
    return import.meta.env.DEV ? 'http://localhost:8000' : PRODUCTION_API_BASE_URL;
  }
  if (INVALID_API_HOSTS.has(fromEnv)) {
    return PRODUCTION_API_BASE_URL;
  }
  return fromEnv;
}
