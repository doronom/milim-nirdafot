import { useMemo, type ReactNode } from 'react';
import { Navigate, useOutletContext, useParams } from 'react-router';
import { ContentProvider } from '../../state/content';
import { ProgressProvider } from '../../state/progress';
import { StoreContext } from '../../state/store-context';
import { memoryStore } from '../../storage/kv';
import { snapshotStore, type ChildSnapshot } from '../../sync/snapshot';
import type { Progress } from '../../engine/progress';
import { ParentChromeContext } from '../parent/chrome';
import styles from '../parent/parent.module.css';
import type { ParentModeContext } from './ParentMode';

const when = new Intl.DateTimeFormat('he', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * A child's cloud snapshot shown with the same parent pages as on the child's device, read-only: the snapshot fills an
 * in-memory store, so nothing here can change the child's data.
 */
export function ChildView({ children: page }: { children: ReactNode }) {
  const { uid = '' } = useParams();
  const { children } = useOutletContext<ParentModeContext>();
  if (children === null) return null;
  const child = children.find((c) => c.uid === uid);
  if (!child?.snapshot) return <Navigate to="/parent-mode" replace />;
  return (
    <SnapshotView snapshot={child.snapshot} name={child.name ?? ''} uid={uid} updatedAt={child.updatedAt}>
      {page}
    </SnapshotView>
  );
}

function SnapshotView({
  snapshot,
  name,
  uid,
  updatedAt,
  children: page,
}: {
  snapshot: ChildSnapshot;
  name: string;
  uid: string;
  updatedAt?: number;
  children: ReactNode;
}) {
  const seed = useMemo(() => snapshotStore(snapshot, name), [snapshot, name]);
  const store = useMemo(() => memoryStore(seed), [seed]);
  return (
    <StoreContext.Provider value={store}>
      <ContentProvider store={store}>
        <ProgressProvider key={updatedAt} store={store} initial={seed.progress as Progress}>
          <ParentChromeContext.Provider
            value={{ home: '/parent-mode', homeLabel: 'חזרה למצב הורים', logPath: `/parent-mode/child/${uid}/log` }}
          >
            <div className={styles.area}>
              <p className={styles.notice} role="status">
                תצוגה בלבד, מהסנכרון האחרון: {updatedAt ? when.format(new Date(updatedAt)) : 'לא ידוע'}
              </p>
              {page}
            </div>
          </ParentChromeContext.Provider>
        </ProgressProvider>
      </ContentProvider>
    </StoreContext.Provider>
  );
}
