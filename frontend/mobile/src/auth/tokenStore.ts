import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'elderguard.token';

/** The login token. Kept in memory for requests and saved in the phone's secure storage. */
let current: string | null = null;

// expo-secure-store has no web version, so the browser preview uses localStorage.
const web = {
  get: () => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set: (value: string | null) => {
    try {
      if (value === null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, value);
    } catch {
      // Storage can be blocked; the session then lasts until the page closes.
    }
  },
};

export const tokenStore = {
  get: (): string | null => current,

  async load(): Promise<string | null> {
    current = Platform.OS === 'web' ? web.get() : await SecureStore.getItemAsync(KEY);
    return current;
  },

  async set(token: string): Promise<void> {
    current = token;
    if (Platform.OS === 'web') web.set(token);
    else await SecureStore.setItemAsync(KEY, token);
  },

  async clear(): Promise<void> {
    current = null;
    if (Platform.OS === 'web') web.set(null);
    else await SecureStore.deleteItemAsync(KEY);
  },
};
