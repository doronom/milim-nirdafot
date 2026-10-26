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
import { itemTitle } from '../content/review-items';
import { useContent } from './content-context';
import { useParentLog } from './use-parent-log';
import { useProgress } from './progress-context';

export type SaveResult = { ok: true } | { ok: false; problems: string[] };

/** Field names for the activity log. */
const FIELD_NAMES: Record<string, string> = {
  headword: 'מילה',
  hint: 'רמז',
  synonyms: 'נרדפות',
  difficulty: 'רמת קושי',
  pos: 'חלק דיבר',
  theme: 'נושא',
  weakToStrong: 'סדר המילים',
  meaning: 'משמעות',
  everyday: 'יומיומי',
  standard: 'תקני',
  literary: 'ספרותי',
  sentence: 'משפט',
  options: 'אפשרויות',
  answer: 'תשובה',
  explanation: 'הסבר',
  idiom: 'ביטוי',
  example: 'דוגמה',
  exampleAnswer: 'הביטוי במשפט',
  text: 'טקסט',
  fits: 'נרדפות מתאימות',
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Every content change the parent makes goes through here: the validate:data rules run on the content with the change
 * (an invalid change is not saved, with the reasons), the game data is rebuilt, and Leitner boxes follow the synonyms
 * (removed pairs drop their boxes, new pairs start in box 1).
 */
export function useContentEditor() {
  const { overrides, added, data, saveOverrides } = useContent();
  const { update } = useProgress();
  const log = useParentLog();

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

  /** Applies a field edit (only the differences from the original are kept), and logs what changed. */
  const saveEdit = useCallback(
    async (kind: OverrideKind, id: string, fields: Record<string, unknown>) => {
      const next = withEdit(overrides, bundledContent, kind, id, fields);
      const current = (data.full[kind] as readonly { id: string }[]).find((x) => x.id === id) as
        Record<string, unknown> | undefined;
      const before = kind === 'entries' ? entryNow(id) : undefined;
      const result = await commit(
        next,
        kind === 'entries' ? { before, after: before && ({ ...before, ...fields } as Entry) } : undefined,
      );
      if (result.ok && current) {
        const title = itemTitle(data.full, kind, id);
        if (Boolean(fields.hidden) !== Boolean(current.hidden))
          log(fields.hidden ? `הוסתר מהמשחק: ${title}` : `הוחזר למשחק: ${title}`);
        const changed = Object.keys(fields).filter((k) => k !== 'hidden' && !same(fields[k], current[k]));
        if (changed.length > 0) log(`נערך: ${title} (${changed.map((k) => FIELD_NAMES[k] ?? k).join(', ')})`);
      }
      return result;
    },
    [overrides, commit, entryNow, data, log],
  );

  const revert = useCallback(
    async (kind: OverrideKind, id: string) => {
      const next = revertOverride(overrides, kind, id);
      const result = await commit(
        next,
        kind === 'entries'
          ? { before: entryNow(id), after: bundledContent.entries.find((e) => e.id === id) }
          : undefined,
      );
      if (result.ok) log(`חזרה למקור: ${itemTitle(data.full, kind, id)}`);
      return result;
    },
    [overrides, commit, entryNow, data, log],
  );

  /** Approve or reject an unreviewed item or sentence; null takes the decision back. */
  const decide = useCallback(
    async (id: string, decision: ReviewDecision | null, kind: OverrideKind = 'entries') => {
      const { [id]: _old, ...rest } = overrides.decisions;
      void _old;
      const result = await commit({ ...overrides, decisions: decision ? { ...rest, [id]: decision } : rest });
      const verb =
        decision === 'approved' ? 'אושר בבדיקת תוכן' : decision === 'rejected' ? 'נדחה בבדיקת תוכן' : 'בוטלה ההחלטה על';
      if (result.ok) log(`${verb}: ${itemTitle(data.full, kind, id)}`);
      return result;
    },
    [overrides, commit, data, log],
  );

  const saveCustom = useCallback(
    async (entry: Entry) => {
      const before = overrides.custom.find((e) => e.id === entry.id);
      const result = await commit(upsertCustom(overrides, entry), { before, after: entry, isNew: !before });
      if (result.ok) log(before ? `נערכה מילה שלי: ${entry.headword}` : `נוספה מילה שלי: ${entry.headword}`);
      return result;
    },
    [overrides, commit, log],
  );

  const deleteCustom = useCallback(
    async (id: string) => {
      const before = overrides.custom.find((e) => e.id === id);
      const result = await commit(removeCustom(overrides, id), { before, after: undefined });
      if (result.ok) log(`נמחקה מילה שלי: ${before?.headword ?? id}`);
      return result;
    },
    [overrides, commit, log],
  );

  return { overrides, saveEdit, revert, decide, saveCustom, deleteCustom };
}
