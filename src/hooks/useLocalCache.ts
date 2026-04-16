import { useCallback } from 'react';

/**
 * Lightweight localStorage cache helper with namespaced keys.
 * Stores `{ data, savedAt }` to support TTL-based revalidation if needed.
 */
export function useLocalCache<T>(key: string) {
  const read = useCallback((): T | null => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return (parsed?.data ?? null) as T | null;
    } catch {
      return null;
    }
  }, [key]);

  const write = useCallback((data: T) => {
    try {
      localStorage.setItem(key, JSON.stringify({ data, savedAt: Date.now() }));
    } catch {
      // ignore quota / serialization errors
    }
  }, [key]);

  const clear = useCallback(() => {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }, [key]);

  return { read, write, clear };
}
