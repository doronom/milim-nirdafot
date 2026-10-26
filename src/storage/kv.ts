import { createStore, del, get, set, type UseStore } from 'idb-keyval';

/** The small async key-value surface the app persists through. IndexedDB in the browser, memory in tests. */
export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  del(key: string): Promise<void>;
}

export function memoryStore(initial: Record<string, unknown> = {}): KeyValueStore {
  const data = new Map<string, unknown>(Object.entries(initial));
  return {
    get: async <T>(key: string) => structuredClone(data.get(key)) as T | undefined,
    set: async (key, value) => {
      data.set(key, structuredClone(value));
    },
    del: async (key) => {
      data.delete(key);
    },
  };
}

export function idbStore(dbName = 'word-quest', storeName = 'kv'): KeyValueStore {
  const store: UseStore = createStore(dbName, storeName);
  return {
    get: <T>(key: string) => get<T>(key, store),
    set: (key, value) => set(key, value, store),
    del: (key) => del(key, store),
  };
}
