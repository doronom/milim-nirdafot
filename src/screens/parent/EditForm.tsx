import { useState } from 'react';
import { splitWords } from '../../content/edits';
import type { OverrideKind } from '../../content/overrides';
import { POS_VALUES, type Pos } from '../../content/types';
import { TactileButton } from '../../ui/TactileButton';
import { Field, Problems, Segmented, Toggle } from './controls';
import { POS_LABEL } from './labels';
import styles from './parent.module.css';

type FieldType = 'text' | 'textarea' | 'list' | 'hint' | 'difficulty' | 'pos';
interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  note?: string;
}

const LIST_NOTE = 'מפרידים בפסיק';

/** The fields a parent may edit, per kind (the same fields the override layer stores). */
const FIELDS: Record<OverrideKind, FieldSpec[]> = {
  entries: [
    { key: 'headword', label: 'מילת מטרה', type: 'text' },
    { key: 'hint', label: 'רמז', type: 'hint', note: 'לא חובה; לא יכול להיות אחת הנרדפות' },
    { key: 'synonyms', label: 'מילים נרדפות', type: 'list', note: LIST_NOTE },
    { key: 'difficulty', label: 'רמת קושי', type: 'difficulty' },
    { key: 'pos', label: 'חלק דיבר', type: 'pos' },
  ],
  scales: [
    { key: 'theme', label: 'נושא הסולם', type: 'text' },
    { key: 'weakToStrong', label: 'מילים מהחלש לחזק', type: 'list', note: LIST_NOTE },
  ],
  registers: [
    { key: 'meaning', label: 'משמעות', type: 'text' },
    { key: 'everyday', label: 'יומיומי', type: 'list', note: LIST_NOTE },
    { key: 'standard', label: 'תקני', type: 'list', note: LIST_NOTE },
    { key: 'literary', label: 'ספרותי', type: 'list', note: LIST_NOTE },
  ],
  contexts: [
    { key: 'sentence', label: 'משפט (___ במקום המילה)', type: 'textarea' },
    { key: 'options', label: 'אפשרויות', type: 'list', note: LIST_NOTE },
    { key: 'answer', label: 'התשובה הנכונה', type: 'text', note: 'אחת האפשרויות' },
    { key: 'explanation', label: 'הסבר', type: 'textarea' },
  ],
  idioms: [
    { key: 'idiom', label: 'ביטוי', type: 'text' },
    { key: 'meaning', label: 'פירוש', type: 'text' },
    { key: 'example', label: 'משפט לדוגמה', type: 'textarea' },
    { key: 'exampleAnswer', label: 'הביטוי כפי שהוא מופיע במשפט', type: 'text' },
  ],
  sentences: [
    { key: 'text', label: 'משפט', type: 'textarea' },
    { key: 'fits', label: 'נרדפות שמתאימות למשפט כפי שהוא', type: 'list', note: LIST_NOTE },
  ],
};

type Values = Record<string, string | number | boolean>;

const toValues = (kind: OverrideKind, item: Record<string, unknown>): Values => {
  const v: Values = { hidden: Boolean(item.hidden) };
  for (const f of FIELDS[kind]) {
    const x = item[f.key];
    v[f.key] =
      f.type === 'list'
        ? (x as string[]).join(', ')
        : f.type === 'hint'
          ? ((x as string | null) ?? '')
          : (x as string | number);
  }
  return v;
};

const toFields = (kind: OverrideKind, v: Values): Record<string, unknown> => {
  const out: Record<string, unknown> = { hidden: v.hidden };
  for (const f of FIELDS[kind]) {
    const x = v[f.key];
    if (f.type === 'list') out[f.key] = splitWords(String(x));
    else if (f.type === 'hint') out[f.key] = String(x).trim() || null;
    else if (f.type === 'difficulty') out[f.key] = Number(x);
    else if (f.type === 'pos') out[f.key] = x;
    else out[f.key] = String(x).trim();
  }
  return out;
};

/**
 * Edits one item. Saving runs the data rules on the whole content; a change that breaks one is refused with the
 * reason, and nothing is stored.
 */
export function EditForm({
  kind,
  item,
  onSave,
  onCancel,
}: {
  kind: OverrideKind;
  item: Record<string, unknown>;
  onSave: (fields: Record<string, unknown>) => Promise<{ ok: true } | { ok: false; problems: string[] }>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(() => toValues(kind, item));
  const [problems, setProblems] = useState<string[]>([]);
  const set = (key: string, value: string | number | boolean) => setValues((v) => ({ ...v, [key]: value }));

  return (
    <form
      className={styles.card}
      aria-label="עריכת פריט"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(toFields(kind, values)).then((r) => setProblems(r.ok ? [] : r.problems));
      }}
    >
      {FIELDS[kind].map((f) => {
        const value = values[f.key];
        if (f.type === 'difficulty')
          return (
            <div key={f.key} className={styles.field}>
              <span>{f.label}</span>
              <Segmented
                label={f.label}
                value={Number(value)}
                options={[
                  { value: 1, title: '1 קל' },
                  { value: 2, title: '2 בינוני' },
                  { value: 3, title: '3 מאתגר' },
                ]}
                onChange={(d) => set(f.key, d)}
              />
            </div>
          );
        if (f.type === 'pos')
          return (
            <Field key={f.key} label={f.label}>
              <select className={styles.input} value={String(value)} onChange={(e) => set(f.key, e.target.value)}>
                {POS_VALUES.map((p: Pos) => (
                  <option key={p} value={p}>
                    {POS_LABEL[p]}
                  </option>
                ))}
              </select>
            </Field>
          );
        return (
          <Field key={f.key} label={f.label} note={f.note}>
            {f.type === 'textarea' ? (
              <textarea className={styles.input} value={String(value)} onChange={(e) => set(f.key, e.target.value)} />
            ) : (
              <input className={styles.input} value={String(value)} onChange={(e) => set(f.key, e.target.value)} />
            )}
          </Field>
        );
      })}
      <Toggle
        title="הסתרה מהמשחק"
        description="הפריט נשאר בנתונים אבל לא יופיע לילד"
        on={Boolean(values.hidden)}
        onChange={(on) => set('hidden', on)}
      />
      <Problems problems={problems} />
      <div className={styles.actions}>
        <TactileButton type="submit" tone="success" icon="check">
          שמירה
        </TactileButton>
        <TactileButton tone="quiet" onClick={onCancel}>
          ביטול
        </TactileButton>
      </div>
    </form>
  );
}
