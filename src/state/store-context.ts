import { createContext, useContext } from 'react';
import type { KeyValueStore } from '../storage/kv';

export const StoreContext = createContext<KeyValueStore | null>(null);

export function useStore(): KeyValueStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore outside StoreContext');
  return store;
}
