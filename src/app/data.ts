import { content } from '../content';
import type { Layout } from '../engine/layout';
import layoutJson from '../generated/layout.json';
import { buildGameData } from './game-data';

/** The build-time level layout. */
export const staticLayout = layoutJson as Layout;

/** Game data from the bundled content alone (no parent overrides): for scripts, tests and defaults. */
export const baseData = buildGameData(content, staticLayout);
export { content as bundledContent };
