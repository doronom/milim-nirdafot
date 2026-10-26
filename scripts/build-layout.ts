import { writeFileSync } from 'node:fs';
import { content } from '../src/content';
import { buildLayout } from '../src/engine/layout';

/** Writes src/generated/layout.json. Committed so layout changes show up in review; a test keeps it fresh. */
export const LAYOUT_PATH = 'src/generated/layout.json';
export const serializeLayout = () => JSON.stringify(buildLayout(content), null, 2) + '\n';

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(LAYOUT_PATH, serializeLayout());
  const layout = buildLayout(content);
  for (const w of layout.worlds) {
    const levels = w.stations.flatMap((s) => s.levels);
    const sizes = levels.filter((l) => l.kind === 'learn').map((l) => l.itemIds.length);
    console.log(
      `world ${w.id}: ${w.stations.length} stations, ${levels.length} levels + boss; learn level sizes ${Math.min(...sizes)}-${Math.max(...sizes)}`,
    );
  }
}
