import { useState, useEffect, Dispatch, SetStateAction } from 'react';

interface UsePersistedStateOptions {
  serialize?: (value: any) => string;
  deserialize?: (value: string) => any;
}

export function usePersistedState<T>(
  key: string,
  defaultValue: T,
  options: UsePersistedStateOptions = {}
): [T, Dispatch<SetStateAction<T>>] {
  const {
    serialize = JSON.stringify,
    deserialize = JSON.parse,
  } = options;

  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return defaultValue;
    }
    
    try {
      const item = window.localStorage.getItem(key);
      return item ? deserialize(item) : defaultValue;
    } catch (error) {
      console.warn(`Error loading persisted state for key "${key}":`, error);
      return defaultValue;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    // Debounce localStorage writes to avoid blocking UI
    const timeoutId = setTimeout(() => {
      try {
        window.localStorage.setItem(key, serialize(state));
      } catch (error) {
        console.warn(`Error saving persisted state for key "${key}":`, error);
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [key, state, serialize]);

  return [state, setState];
}

// Alias for selection state
export function usePersistedSelection<T>(
  key: string,
  defaultValue: T,
  options?: UsePersistedStateOptions
): [T, Dispatch<SetStateAction<T>>] {
  return usePersistedState(key, defaultValue, options);
}

