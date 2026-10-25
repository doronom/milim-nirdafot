import { content } from '../content';
import { createDisplayWord, createItemLabel } from '../content/display';
import type { Layout } from '../engine/layout';
import layoutJson from '../generated/layout.json';

/** Static game data for the UI: content plus the build-time level layout. */
export const layout = layoutJson as Layout;
export { content };
export const displayWord = createDisplayWord(content);
export const itemLabel = createItemLabel(content);
