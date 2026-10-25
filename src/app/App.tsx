import { MotionConfig } from 'framer-motion';
import { useMemo } from 'react';
import { createHashRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import type { Progress } from '../engine/progress';
import { ProgressProvider } from '../state/progress';
import { StoreContext } from '../state/store-context';
import type { KeyValueStore } from '../storage/kv';
import { routes } from './routes';

/** Hash routing: works offline and from any static host (GitHub Pages, Netlify) without rewrite rules. */
export function App({ store, initialProgress }: { store: KeyValueStore; initialProgress?: Progress }) {
  const router = useMemo(() => createHashRouter(routes), []);
  return (
    <MotionConfig reducedMotion="user">
      <StoreContext.Provider value={store}>
        <ProgressProvider store={store} initial={initialProgress}>
          <RouterProvider router={router} />
        </ProgressProvider>
      </StoreContext.Provider>
    </MotionConfig>
  );
}
