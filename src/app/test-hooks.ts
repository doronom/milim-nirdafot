import { baseData } from './data';

/**
 * e2e hooks, loaded only in emulator builds (main.tsx): lets the cross-device test answer game questions correctly.
 * The production build never imports this file.
 */
(window as unknown as { __wqTest: unknown }).__wqTest = {
  areLinked: (a: string, b: string) => baseData.links.areLinked(a, b),
};
