import { useEffect, useState } from 'react';
import { deleteRecording, getRecording, playWord, saveRecording } from '../../audio/recordings';
import { customEntry, newCustomId, splitWords } from '../../content/edits';
import { POS_VALUES, type Difficulty, type Entry, type Pos } from '../../content/types';
import { useStore } from '../../state/store-context';
import { useContentEditor } from '../../state/use-content-editor';
import { Icon } from '../../ui/Icon';
import { Pill } from '../../ui/Pill';
import { TactileButton } from '../../ui/TactileButton';
import { Field, Problems, Segmented } from './controls';
import { ParentPage } from './ParentArea';
import { POS_LABEL } from './labels';
import { Recorder } from './Recorder';
import styles from './parent.module.css';

interface Draft {
  id: string | null;
  headword: string;
  synonyms: string;
  hint: string;
  pos: Pos;
  difficulty: Difficulty;
  recording: Blob | null;
  /** The recording changed in this form (saved, replaced or removed on save). */
  recordingChanged: boolean;
}

const emptyDraft = (): Draft => ({
  id: null,
  headword: '',
  synonyms: '',
  hint: '',
  pos: 'noun',
  difficulty: 1,
  recording: null,
  recordingChanged: false,
});

/** "My new words": the parent's own words, with a recording that plays instead of speech on the learn cards. */
export function MyWords() {
  const store = useStore();
  const { overrides, saveCustom, deleteCustom } = useContentEditor();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [saved, setSaved] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<Record<string, Blob>>({});
  const words = overrides.custom;

  useEffect(() => {
    let cancelled = false;
    void Promise.all(words.map(async (w) => [w.id, await getRecording(store, w.id)] as const)).then((found) => {
      if (!cancelled) setRecorded(Object.fromEntries(found.filter((f): f is [string, Blob] => f[1] !== undefined)));
    });
    return () => {
      cancelled = true;
    };
  }, [words, store]);

  const edit = (e: Entry) =>
    setDraft({
      id: e.id,
      headword: e.headword,
      synonyms: e.synonyms.join(', '),
      hint: e.hint ?? '',
      pos: e.pos,
      difficulty: e.difficulty,
      recording: recorded[e.id] ?? null,
      recordingChanged: false,
    });

  const save = async () => {
    if (!draft) return;
    const headword = draft.headword.trim().replace(/\s+/g, ' ');
    const synonyms = splitWords(draft.synonyms);
    const local = [
      ...(headword ? [] : ['חסרה מילת המטרה']),
      ...(synonyms.length > 0 ? [] : ['צריך לפחות מילה נרדפת אחת']),
    ];
    if (local.length > 0) return setProblems(local);
    const id = draft.id ?? newCustomId();
    const entry = customEntry(id, {
      headword,
      synonyms,
      hint: draft.hint.trim() || null,
      pos: draft.pos,
      difficulty: draft.difficulty,
    });
    const result = await saveCustom(entry);
    if (!result.ok) return setProblems(result.problems);
    if (draft.recordingChanged) {
      if (draft.recording) await saveRecording(store, id, draft.recording);
      else await deleteRecording(store, id);
    }
    setProblems([]);
    setDraft(null);
    setSaved(headword);
  };

  const remove = async (id: string) => {
    await deleteCustom(id);
    await deleteRecording(store, id);
    setConfirmDelete(null);
  };

  return (
    <ParentPage
      title="המילים החדשות שלי"
      subtitle="נכנסות לתחנה ״המילים שלי״ בעולם 1"
      end={
        !draft && (
          <button type="button" className={styles.linkButton} onClick={() => setDraft(emptyDraft())}>
            <Icon name="plus" size="sm" /> מילה חדשה
          </button>
        )
      }
    >
      {saved && !draft && (
        <p className={styles.notice} role="status">
          <span className={styles.ok}>נשמר:</span> {saved}. המילה מחכה לילד בתחנה ״המילים שלי״ ובחזרות.
        </p>
      )}

      {draft && (
        <form
          className={styles.card}
          aria-label={draft.id ? 'עריכת מילה' : 'מילה חדשה'}
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <h2 className={styles.cardTitle}>
            <Icon name="edit" /> {draft.id ? 'עריכת מילה' : 'מילה חדשה'}
          </h2>
          <Field label="מילת מטרה">
            <input
              className={styles.input}
              value={draft.headword}
              onChange={(e) => setDraft({ ...draft, headword: e.target.value })}
              required
            />
          </Field>
          <Field label="מילים נרדפות" note="מפרידים בפסיק">
            <input
              className={styles.input}
              value={draft.synonyms}
              onChange={(e) => setDraft({ ...draft, synonyms: e.target.value })}
            />
          </Field>
          {splitWords(draft.synonyms).length > 0 && (
            <div className={styles.wrap}>
              {splitWords(draft.synonyms).map((w) => (
                <span key={w} className={styles.chip}>
                  {w}
                  <button
                    type="button"
                    className={styles.chipRemove}
                    aria-label={`הסרת ${w}`}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        synonyms: splitWords(draft.synonyms)
                          .filter((x) => x !== w)
                          .join(', '),
                      })
                    }
                  >
                    <Icon name="close" size="sm" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <Field label="רמז (לא חובה)" note="עוזר להבחין בין שתי משמעויות של אותה מילה">
            <input
              className={styles.input}
              value={draft.hint}
              onChange={(e) => setDraft({ ...draft, hint: e.target.value })}
            />
          </Field>
          <Field label="חלק דיבר">
            <select
              className={styles.input}
              value={draft.pos}
              onChange={(e) => setDraft({ ...draft, pos: e.target.value as Pos })}
            >
              {POS_VALUES.map((p) => (
                <option key={p} value={p}>
                  {POS_LABEL[p]}
                </option>
              ))}
            </select>
          </Field>
          <span className={styles.field}>רמת קושי</span>
          <Segmented
            label="רמת קושי"
            value={draft.difficulty}
            options={[
              { value: 1 as Difficulty, title: 'קל' },
              { value: 2 as Difficulty, title: 'בינוני' },
              { value: 3 as Difficulty, title: 'מאתגר' },
            ]}
            onChange={(d) => setDraft({ ...draft, difficulty: d })}
          />
          <span className={styles.field}>הקלטת הגייה</span>
          <Recorder
            value={draft.recording}
            onChange={(b) => setDraft((d) => (d ? { ...d, recording: b, recordingChanged: true } : d))}
          />
          <Problems problems={problems} />
          <div className={styles.actions}>
            <TactileButton type="submit" tone="success" icon="check">
              שמירת המילה
            </TactileButton>
            <TactileButton
              tone="quiet"
              onClick={() => {
                setDraft(null);
                setProblems([]);
              }}
            >
              ביטול
            </TactileButton>
          </div>
        </form>
      )}

      <section className={styles.card} aria-labelledby="my-words-list">
        <div className={styles.cardHead}>
          <h2 id="my-words-list" className={styles.cardTitle}>
            המילים שהוספתם
          </h2>
          <Pill tone="world">{words.length}</Pill>
        </div>
        {words.length === 0 ? (
          <p className={styles.muted}>עוד אין מילים. הוסיפו מילה מספר, משיעור או מהחיים, והיא תופיע במסע.</p>
        ) : (
          <ul className={styles.list}>
            {words.map((w) => (
              <li key={w.id} className={styles.item}>
                <div className={styles.itemHead}>
                  <span className={styles.word}>{w.headword}</span>
                  {w.hint && <Pill>{w.hint}</Pill>}
                  {recorded[w.id] && (
                    <Pill tone="success" icon="mic">
                      הוקלט
                    </Pill>
                  )}
                </div>
                <span className={styles.muted}>{w.synonyms.join(', ')}</span>
                {confirmDelete === w.id ? (
                  <div className={styles.error} role="alert">
                    <span>למחוק את ״{w.headword}״? גם ההתקדמות בה תימחק.</span>
                    <div className={styles.actions}>
                      <TactileButton tone="danger" icon="trash" onClick={() => void remove(w.id)}>
                        כן, למחוק
                      </TactileButton>
                      <TactileButton tone="quiet" onClick={() => setConfirmDelete(null)}>
                        ביטול
                      </TactileButton>
                    </div>
                  </div>
                ) : (
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() => playWord(w.headword, recorded[w.id])}
                    >
                      <Icon name="speaker" size="sm" /> השמעה
                    </button>
                    <button type="button" className={styles.linkButton} onClick={() => edit(w)}>
                      <Icon name="edit" size="sm" /> עריכה
                    </button>
                    <button type="button" className={styles.linkButton} onClick={() => setConfirmDelete(w.id)}>
                      <Icon name="trash" size="sm" /> מחיקה
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </ParentPage>
  );
}
