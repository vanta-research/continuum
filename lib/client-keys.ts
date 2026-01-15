/**
 * Client-side API key storage utility
 *
 * API keys are stored in localStorage and NEVER sent to the server for storage.
 * They are only passed directly to provider APIs or included in request headers
 * for server-side API calls that need to proxy requests.
 *
 * This ensures user API keys remain on their device and under their control.
 */

const STORAGE_KEY = 'continuum_api_keys';

export interface ClientAPIKeys {
  openaiApiKey: string;
  anthropicApiKey: string;
  mistralApiKey: string;
  openrouterApiKey: string;
  hfToken: string;
  customEndpointApiKey: string;
}

const DEFAULT_KEYS: ClientAPIKeys = {
  openaiApiKey: '',
  anthropicApiKey: '',
  mistralApiKey: '',
  openrouterApiKey: '',
  hfToken: '',
  customEndpointApiKey: '',
};

/**
 * Check if we're running in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

/**
 * Load API keys from localStorage
 */
export function loadClientKeys(): ClientAPIKeys {
  if (!isBrowser()) {
    return DEFAULT_KEYS;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_KEYS, ...parsed };
    }
  } catch (error) {
    console.error('Failed to load API keys from localStorage:', error);
  }

  return DEFAULT_KEYS;
}

/**
 * Save API keys to localStorage
 */
export function saveClientKeys(keys: Partial<ClientAPIKeys>): ClientAPIKeys {
  if (!isBrowser()) {
    return DEFAULT_KEYS;
  }

  try {
    const current = loadClientKeys();
    const updated = { ...current, ...keys };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Failed to save API keys to localStorage:', error);
    return loadClientKeys();
  }
}

/**
 * Clear all API keys from localStorage
 */
export function clearClientKeys(): void {
  if (!isBrowser()) {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear API keys from localStorage:', error);
  }
}

/**
 * Get a specific API key
 */
export function getClientKey(key: keyof ClientAPIKeys): string {
  const keys = loadClientKeys();
  return keys[key] || '';
}

/**
 * Set a specific API key
 */
export function setClientKey(key: keyof ClientAPIKeys, value: string): void {
  saveClientKeys({ [key]: value });
}

/**
 * Check if any API keys are configured
 */
export function hasAnyApiKeys(): boolean {
  const keys = loadClientKeys();
  return !!(
    keys.openaiApiKey ||
    keys.anthropicApiKey ||
    keys.mistralApiKey ||
    keys.openrouterApiKey
  );
}

/**
 * Get the API key for a specific provider
 */
export function getKeyForProvider(provider: string): string {
  const keys = loadClientKeys();

  switch (provider) {
    case 'openai':
      return keys.openaiApiKey;
    case 'anthropic':
      return keys.anthropicApiKey;
    case 'mistral':
      return keys.mistralApiKey;
    case 'openrouter':
      return keys.openrouterApiKey;
    case 'custom':
      return keys.customEndpointApiKey;
    default:
      return '';
  }
}
