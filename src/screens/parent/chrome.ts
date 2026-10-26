import { createContext, useContext } from 'react';

/** Where the parent pages lead: the child's parent area by default, or parent mode viewing a child's cloud snapshot. */
export interface ParentChrome {
  /** Target and label of the top bar's back button. */
  home: string;
  homeLabel: string;
  /** The activity log page for the dashboard's failed-attempts badge. */
  logPath: string;
}

export const ParentChromeContext = createContext<ParentChrome>({
  home: '/',
  homeLabel: 'חזרה למסע',
  logPath: '/parent/log',
});

export const useParentChrome = (): ParentChrome => useContext(ParentChromeContext);
