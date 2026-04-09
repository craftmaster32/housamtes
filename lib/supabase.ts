import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.');
}

// SecureStore has a 2048-byte limit per key.
// Supabase sessions (JWT + user object) exceed this, so we chunk large values.
const CHUNK_SIZE = 1800;

async function setChunked(key: string, value: string): Promise<void> {
  const chunks = Math.ceil(value.length / CHUNK_SIZE);
  await SecureStore.setItemAsync(`${key}__n`, String(chunks));
  for (let i = 0; i < chunks; i++) {
    await SecureStore.setItemAsync(`${key}__${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
  }
}

async function getChunked(key: string): Promise<string | null> {
  const countStr = await SecureStore.getItemAsync(`${key}__n`);
  if (!countStr) {
    // Fall back to reading un-chunked value (handles existing sessions)
    return SecureStore.getItemAsync(key);
  }
  const count = parseInt(countStr, 10);
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const part = await SecureStore.getItemAsync(`${key}__${i}`);
    if (part === null) return null;
    parts.push(part);
  }
  return parts.join('');
}

async function removeChunked(key: string): Promise<void> {
  const countStr = await SecureStore.getItemAsync(`${key}__n`);
  if (countStr) {
    const count = parseInt(countStr, 10);
    await SecureStore.deleteItemAsync(`${key}__n`);
    for (let i = 0; i < count; i++) {
      await SecureStore.deleteItemAsync(`${key}__${i}`);
    }
  }
  // Also clean up any legacy un-chunked value
  await SecureStore.deleteItemAsync(key).catch(() => {});
}

// iOS/Android: store tokens in the device's encrypted secure vault (iOS Keychain / Android Keystore).
// Web: fall back to localStorage (no Keychain available in browser).
const authStorage =
  Platform.OS === 'web'
    ? {
        getItem: (key: string): string | null => {
          if (typeof window === 'undefined') return null;
          return window.localStorage.getItem(key);
        },
        setItem: (key: string, value: string): void => {
          if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
        },
        removeItem: (key: string): void => {
          if (typeof window !== 'undefined') window.localStorage.removeItem(key);
        },
      }
    : {
        getItem: (key: string): Promise<string | null> => getChunked(key),
        setItem: (key: string, value: string): Promise<void> => setChunked(key, value),
        removeItem: (key: string): Promise<void> => removeChunked(key),
      };

// AsyncStorage is kept only as a fallback for non-sensitive data (settings, feature flags).
export { AsyncStorage };

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
