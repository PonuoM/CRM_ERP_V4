import { useEffect, useState } from "react";

type UsePersistentStateOptions<T> = {
  /**
   * Optional storage implementation.
   * Defaults to `window.localStorage` when available.
   */
  storage?: Storage;
  /**
   * Optional serializer. Defaults to `JSON.stringify`.
   */
  serialize?: (value: T) => string;
  /**
   * Optional deserializer. Defaults to `JSON.parse`.
   */
  deserialize?: (value: string) => T;
};

/**
 * React state hook that synchronizes a value with localStorage.
 * Useful for preserving lightweight UI preferences (filters, pagination, etc.).
 */
export function usePersistentState<T>(
  key: string,
  defaultValue: T,
  options: UsePersistentStateOptions<T> = {},
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const {
    storage: providedStorage,
    serialize = JSON.stringify,
    deserialize = JSON.parse,
  } = options;

  const getStorage = (): Storage | undefined => {
    if (typeof window === "undefined") return undefined;
    try {
      return providedStorage ?? window.localStorage;
    } catch (error) {
      console.warn(`Storage unavailable for key "${key}":`, error);
      return undefined;
    }
  };

  const readValue = (): T => {
    const storage = getStorage();
    if (!storage) return defaultValue;

    try {
      const raw = storage.getItem(key);
      if (raw === null) return defaultValue;
      return deserialize(raw);
    } catch (error) {
      console.warn(`Failed to read persistent state for "${key}":`, error);
      return defaultValue;
    }
  };

  const [value, setValue] = useState<T>(() => readValue());

  useEffect(() => {
    setValue(readValue());
  }, [key]);

  useEffect(() => {
    const storage = getStorage();
    if (!storage) return;

    try {
      storage.setItem(key, serialize(value));
    } catch (error) {
      console.warn(`Failed to persist state for "${key}":`, error);
    }
  }, [key, value, serialize, providedStorage]);

  return [value, setValue];
}

export default usePersistentState;
