import { useCallback } from 'react';
import { appendLog } from './parent-log';
import { useStore } from './store-context';

/** Records a change made in the parent area in the activity log (with the time). */
export function useParentLog(): (text: string) => void {
  const store = useStore();
  return useCallback((text: string) => void appendLog(store, 'change', text), [store]);
}
