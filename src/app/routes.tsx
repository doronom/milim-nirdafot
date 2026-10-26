import type { RouteObject } from 'react-router';
import { AdventureScreen } from '../screens/AdventureScreen';
import { AppShell } from '../screens/AppShell';
import { ComingSoonScreen } from '../screens/ComingSoonScreen';
import { Onboarded } from '../screens/Onboarded';
import { ProfileScreen } from '../screens/ProfileScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { WorldMapScreen } from '../screens/WorldMapScreen';
import { WorldScreen } from '../screens/WorldScreen';

/** Games, levels and the parent area load on first use (and are precached for offline play). */
export const routes: RouteObject[] = [
  { path: 'welcome', element: <WelcomeScreen /> },
  {
    path: 'placement',
    lazy: async () => ({ Component: (await import('../screens/PlacementScreen')).PlacementScreen }),
  },
  {
    element: <Onboarded />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <WorldMapScreen /> },
          { path: 'world/:worldId', element: <WorldScreen /> },
          { path: 'adventure', element: <AdventureScreen /> },
          {
            path: 'treasures',
            lazy: async () => ({ Component: (await import('../screens/AlbumScreen')).AlbumScreen }),
          },
          { path: 'profile', element: <ProfileScreen /> },
          {
            path: '*',
            element: <ComingSoonScreen title="לא נמצא" message="הדף הזה לא קיים. חזרו למפה דרך הניווט למטה." />,
          },
        ],
      },
      {
        // The parent area and the certificate (html-to-image) load on first use, keeping the child's first load small.
        path: 'parent',
        lazy: async () => ({ Component: (await import('../screens/parent/ParentArea')).ParentArea }),
        children: [
          { index: true, lazy: async () => ({ Component: (await import('../screens/parent/Dashboard')).Dashboard }) },
          { path: 'words', lazy: async () => ({ Component: (await import('../screens/parent/MyWords')).MyWords }) },
          {
            path: 'content',
            lazy: async () => ({ Component: (await import('../screens/parent/ContentReview')).ContentReview }),
          },
          {
            path: 'settings',
            lazy: async () => ({ Component: (await import('../screens/parent/ParentSettings')).ParentSettings }),
          },
          { path: 'backup', lazy: async () => ({ Component: (await import('../screens/parent/Backup')).Backup }) },
          {
            path: 'log',
            lazy: async () => ({ Component: (await import('../screens/parent/ActivityLog')).ActivityLog }),
          },
        ],
      },
      {
        path: 'level/:levelId',
        lazy: async () => ({ Component: (await import('../screens/LevelScreen')).LevelScreen }),
      },
      { path: 'speed', lazy: async () => ({ Component: (await import('../screens/SpeedScreen')).SpeedScreen }) },
      { path: 'duel', lazy: async () => ({ Component: (await import('../screens/DuelScreen')).DuelScreen }) },
      {
        path: 'certificate/:worldId',
        lazy: async () => ({ Component: (await import('../screens/CertificateScreen')).CertificateScreen }),
      },
    ],
  },
];
