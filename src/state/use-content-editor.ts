import { useCallback } from 'react';
import { bundledContent } from '../app/data';
import { checkEdit } from '../content/edit-check';
import { leitnerAfterEntryEdit, removeCustom, upsertCustom, withEdit } from '../content/edits';
import {
  revert as revertOverride,
  type ContentOverrides,
  type OverrideKind,
  type ReviewDecision,
} from '../content/overrides';
import type { Entry } from '../content/types';
import { dayKey } from '../engine/dates';
import { useContent } from './content-context';
import { useProgress } from './progress-context';

export type SaveResult = { ok: true } | { ok: false; problems: string[] };

/**
 * Every content change the parent makes goes through here: the validate:data rules run on the content with the change
 * (an invalid change is not saved, with the reasons), the game data is rebuilt, and Leitner boxes follow the synonyms
 * (removed pairs drop their boxes, new pairs start in box 1).
 */
export function useContentEditor() {
  const { overrides, added, data, saveOverrides } = useContent();
  const { update } = useProgress();

  const commit = useCallback(
    async (
      next: ContentOverrides,
      entryChange?: { before?: Entry; after?: Entry; isNew?: boolean },
    ): Promise<SaveResult> => {
      const check = checkEdit(bundledContent, overrides, next, added);
      if (!check.ok) return { ok: false, problems: check.problems };
      await saveOverrides(next);
      if (entryChange) {
        const { before, after, isNew } = entryChange;
        update((p) => ({ ...p, leitner: leitnerAfterEntryEdit(p.leitner, before, after, dayKey(), isNew) }));
      }
      return { ok: true };
    },
    [overrides, added, saveOverrides, update],
  );

  const entryNow = useCallback((id: string) => data.full.entries.find((e) => e.id === id), [data]);

  /** Applies a field edit (only the differences from the original are kept). */
  const saveEdit = useCallback(
    (kind: OverrideKind, id: string, fields: Record<string, unknown>) => {
      const next = withEdit(overrides, bundledContent, kind, id, fields);
      if (kind !== 'entries') return commit(next);
      const before = entryNow(id);
      return commit(next, { before, after: before && ({ ...before, ...fields } as Entry) });
    },
    [overrides, commit, entryNow],
  );

  const revert = useCallback(
    (kind: OverrideKind, id: string) => {
      const next = revertOverride(overrides, kind, id);
      if (kind !== 'entries') return commit(next);
      return commit(next, { before: entryNow(id), after: bundledContent.entries.find((e) => e.id === id) });
    },
    [overrides, commit, entryNow],
  );

  /** Approve or reject an unreviewed item or sentence; null takes the decision back. */
  const decide = useCallback(
    (id: string, decision: ReviewDecision | null) => {
      const { [id]: _old, ...rest } = overrides.decisions;
      void _old;
      return commit({ ...overrides, decisions: decision ? { ...rest, [id]: decision } : rest });
    },
    [overrides, commit],
  );

  const saveCustom = useCallback(
    (entry: Entry) => {
      const before = overrides.custom.find((e) => e.id === entry.id);
      return commit(upsertCustom(overrides, entry), { before, after: entry, isNew: !before });
    },
    [overrides, commit],
  );

  const deleteCustom = useCallback(
    (id: string) => {
      const before = overrides.custom.find((e) => e.id === id);
      return commit(removeCustom(overrides, id), { before, after: undefined });
    },
    [overrides, commit],
  );

  return { overrides, saveEdit, revert, decide, saveCustom, deleteCustom };
}
