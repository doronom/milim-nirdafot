import type { RouteObject } from 'react-router';
import { AppShell } from '../screens/AppShell';
import { ComingSoonScreen } from '../screens/ComingSoonScreen';
import { LevelScreen } from '../screens/LevelScreen';
import { WorldMapScreen } from '../screens/WorldMapScreen';
import { WorldScreen } from '../screens/WorldScreen';

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <WorldMapScreen /> },
      { path: 'world/:worldId', element: <WorldScreen /> },
      {
        path: 'adventure',
        element: <ComingSoonScreen title="הרפתקה" message="דו-קרב ואתגר מהירות יגיעו לכאן בקרוב." />,
      },
      { path: 'treasures', element: <ComingSoonScreen title="אוצרות" message="האלבום והמדבקות שתאספו יחכו כאן." /> },
      { path: 'profile', element: <ComingSoonScreen title="פרופיל" message="הדרגה, הרצף והתעודות שלכם יופיעו כאן." /> },
      { path: 'parent', element: <ComingSoonScreen title="אזור הורים" message="אזור ההורים ייפתח בהמשך הבנייה." /> },
      {
        path: '*',
        element: <ComingSoonScreen title="לא נמצא" message="הדף הזה לא קיים. חזרו למפה דרך הניווט למטה." />,
      },
    ],
  },
  { path: 'level/:levelId', element: <LevelScreen /> },
];
