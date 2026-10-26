import type { RouteObject } from 'react-router';
import { AdventureScreen } from '../screens/AdventureScreen';
import { AlbumScreen } from '../screens/AlbumScreen';
import { AppShell } from '../screens/AppShell';
import { CertificateScreen } from '../screens/CertificateScreen';
import { ComingSoonScreen } from '../screens/ComingSoonScreen';
import { DuelScreen } from '../screens/DuelScreen';
import { LevelScreen } from '../screens/LevelScreen';
import { Onboarded } from '../screens/Onboarded';
import { PlacementScreen } from '../screens/PlacementScreen';
import { Backup } from '../screens/parent/Backup';
import { ContentReview } from '../screens/parent/ContentReview';
import { Dashboard } from '../screens/parent/Dashboard';
import { MyWords } from '../screens/parent/MyWords';
import { ParentArea } from '../screens/parent/ParentArea';
import { ParentSettings } from '../screens/parent/ParentSettings';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SpeedScreen } from '../screens/SpeedScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { WorldMapScreen } from '../screens/WorldMapScreen';
import { WorldScreen } from '../screens/WorldScreen';

export const routes: RouteObject[] = [
  { path: 'welcome', element: <WelcomeScreen /> },
  { path: 'placement', element: <PlacementScreen /> },
  {
    element: <Onboarded />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <WorldMapScreen /> },
          { path: 'world/:worldId', element: <WorldScreen /> },
          { path: 'adventure', element: <AdventureScreen /> },
          { path: 'treasures', element: <AlbumScreen /> },
          { path: 'profile', element: <ProfileScreen /> },
          {
            path: '*',
            element: <ComingSoonScreen title="לא נמצא" message="הדף הזה לא קיים. חזרו למפה דרך הניווט למטה." />,
          },
        ],
      },
      {
        path: 'parent',
        element: <ParentArea />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'words', element: <MyWords /> },
          { path: 'content', element: <ContentReview /> },
          { path: 'settings', element: <ParentSettings /> },
          { path: 'backup', element: <Backup /> },
        ],
      },
      { path: 'level/:levelId', element: <LevelScreen /> },
      { path: 'speed', element: <SpeedScreen /> },
      { path: 'duel', element: <DuelScreen /> },
      { path: 'certificate/:worldId', element: <CertificateScreen /> },
    ],
  },
];
