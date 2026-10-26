import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildContentChanges } from '../../content/content-changes';
import { baseItem } from '../../content/edits';
import { draftItems, FILTER_LABEL, reviewItems, type ReviewFilter, type ReviewItem } from '../../content/review-items';
import { bundledContent } from '../../app/data';
import {
  decideItemDispute,
  decideReport,
  listItemDisputes,
  listReports,
  type AlsoCorrectReport,
  type ItemDispute,
} from '../../engine/review-queue';
import { decideSentenceReport, listSentenceReports, type SentenceReport } from '../../engine/sentence-reports';
import { download } from '../../share/share-image';
import { dayKey } from '../../engine/dates';
import { useContent } from '../../state/content-context';
import { useStore } from '../../state/store-context';
import { useContentEditor } from '../../state/use-content-editor';
import { Icon } from '../../ui/Icon';
import { Pill } from '../../ui/Pill';
import { EditForm } from './EditForm';
import { itemLine } from './labels';
import { ParentPage } from './ParentArea';
import styles from './parent.module.css';

type Tab = 'reports' | 'drafts' | 'all';
const PAGE = 20;

interface Queues {
  pairs: AlsoCorrectReport[];
  sentences: SentenceReport[];
  disputes: ItemDispute[];
}

/** Reports from play, drafts to approve or reject, and every item of the content with an edit form. */
export function ContentReview() {
  const store = useStore();
  const { data, overrides, added, refresh } = useContent();
  const [tab, setTab] = useState<Tab>('reports');
  const [queues, setQueues] = useState<Queues>({ pairs: [], sentences: [], disputes: [] });
  const [exported, setExported] = useState(false);

  const loadQueues = useCallback(async () => {
    const [pairs, sentences, disputes] = await Promise.all([
      listReports(store),
      listSentenceReports(store),
      listItemDisputes(store),
    ]);
    return { pairs, sentences, disputes };
  }, [store]);
  useEffect(() => {
    let cancelled = false;
    void loadQueues().then((q) => !cancelled && setQueues(q));
    return () => {
      cancelled = true;
    };
  }, [loadQueues]);
  const reload = async () => setQueues(await loadQueues());

  const items = useMemo(() => reviewItems(data.full, overrides), [data, overrides]);
  const drafts = useMemo(() => draftItems(items), [items]);
  const pending =
    queues.pairs.filter((r) => r.status === 'pending').length +
    queues.sentences.filter((r) => r.status === 'pending').length +
    queues.disputes.filter((r) => r.status === 'pending').length;
  const waiting = drafts.filter((d) => !d.decision).length;

  const exportChanges = () => {
    const file = buildContentChanges(
      overrides,
      added,
      queues.sentences.flatMap((r) => (r.status === 'pending' ? [] : [{ sentenceId: r.sentenceId, status: r.status }])),
      queues.disputes.flatMap((d) =>
        d.status === 'pending' ? [] : [{ itemKey: d.itemKey, answer: d.answer, status: d.status }],
      ),
    );
    download(
      new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }),
      `word-quest-content-changes-${dayKey()}.json`,
    );
    setExported(true);
  };

  return (
    <ParentPage
      title="בדיקת תוכן ודיווחים"
      end={
        <button type="button" className={styles.linkButton} onClick={exportChanges}>
          <Icon name="download" size="sm" /> ייצוא שינויי תוכן
        </button>
      }
    >
      {exported && (
        <p className={styles.notice} role="status">
          הקובץ נשמר. להכנסת השינויים לקוד: <span dir="ltr">npm run apply:content-changes &lt;file&gt;</span>
        </p>
      )}
      <div className={styles.tabs} role="tablist" aria-label="סוג בדיקה">
        {(
          [
            ['reports', 'דיווחי משחק', pending],
            ['drafts', 'טיוטות', waiting],
            ['all', 'כל התוכן', null],
          ] as const
        ).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`${styles.tab} ${tab === id ? styles.tabActive : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
            {count !== null && count > 0 && <span className={styles.chip}>{count}</span>}
          </button>
        ))}
      </div>
      {tab === 'reports' && (
        <Reports
          queues={queues}
          onDecidePair={async (id, status) => {
            await decideReport(store, id, status);
            await reload();
            await refresh();
          }}
          onDecideSentence={async (id, status) => {
            await decideSentenceReport(store, id, status);
            await reload();
          }}
          onDecideDispute={async (d, status) => {
            await decideItemDispute(store, d.itemKey, d.answer, status);
            await reload();
          }}
        />
      )}
      {tab === 'drafts' && <ItemList items={drafts} decisions />}
      {tab === 'all' && <ItemList items={items} />}
    </ParentPage>
  );
}

function Reports({
  queues,
  onDecidePair,
  onDecideSentence,
  onDecideDispute,
}: {
  queues: Queues;
  onDecidePair: (id: string, status: 'accepted' | 'rejected') => Promise<void>;
  onDecideSentence: (id: string, status: 'kept' | 'removed') => Promise<void>;
  onDecideDispute: (d: ItemDispute, status: 'accepted' | 'rejected') => Promise<void>;
}) {
  const { data } = useContent();
  const pairs = queues.pairs.filter((r) => r.status === 'pending');
  const sentences = queues.sentences.filter((r) => r.status === 'pending');
  const disputes = queues.disputes.filter((r) => r.status === 'pending');
  const sentenceText = (id: string) => data.full.sentences.find((s) => s.id === id);
  if (pairs.length + sentences.length + disputes.length === 0)
    return <p className={styles.notice}>אין דיווחים חדשים מהמשחק.</p>;
  return (
    <ul className={styles.list}>
      {pairs.map((r) => (
        <li key={r.id} className={styles.card}>
          <div className={styles.cardHead}>
            <Pill tone="guest">גם זו תשובה נכונה?</Pill>
            <span className={styles.caption}>{r.count > 1 ? `${r.count} פעמים` : 'פעם אחת'}</span>
          </div>
          <p>
            מילה נרדפת ל־<strong>{data.displayWord(r.targetWord)}</strong>, והילד בחר{' '}
            <strong>{data.displayWord(r.word)}</strong>
          </p>
          <div className={styles.actions}>
            <button type="button" className={styles.linkButton} onClick={() => void onDecidePair(r.id, 'accepted')}>
              <Icon name="check" size="sm" /> לאשר כנרדפת
            </button>
            <button type="button" className={styles.linkButton} onClick={() => void onDecidePair(r.id, 'rejected')}>
              <Icon name="close" size="sm" /> לדחות (מסיח הוגן)
            </button>
          </div>
        </li>
      ))}
      {sentences.map((r) => {
        const s = sentenceText(r.sentenceId);
        return (
          <li key={r.sentenceId} className={styles.card}>
            <div className={styles.cardHead}>
              <Pill tone="xp" icon="flag">
                דיווח על משפט
              </Pill>
              <span className={styles.caption}>{r.count > 1 ? `${r.count} פעמים` : 'פעם אחת'}</span>
            </div>
            <p>{s?.text ?? r.sentenceId}</p>
            <p className={styles.caption}>המשפט הוצא מהמשחק עד להחלטה (אלא אם כבר אושר).</p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => void onDecideSentence(r.sentenceId, 'kept')}
              >
                <Icon name="check" size="sm" /> המשפט תקין
              </button>
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => void onDecideSentence(r.sentenceId, 'removed')}
              >
                <Icon name="trash" size="sm" /> להסיר
              </button>
            </div>
          </li>
        );
      })}
      {disputes.map((d) => {
        const item = data.resolver.byKey(d.itemKey);
        return (
          <li key={`${d.itemKey}|${d.answer}`} className={styles.card}>
            <div className={styles.cardHead}>
              <Pill tone="guest">ערעור על תשובה</Pill>
              <span className={styles.caption}>{d.count > 1 ? `${d.count} פעמים` : 'פעם אחת'}</span>
            </div>
            <p>{item ? itemLine(item, data.displayWord) : d.itemKey}</p>
            <p>
              תשובת הילד: <strong>{d.answer}</strong>
            </p>
            <p className={styles.caption}>ההחלטה נשמרת בייצוא שינויי התוכן; לתיקון הפריט עצמו השתמשו בעריכה.</p>
            <div className={styles.actions}>
              <button type="button" className={styles.linkButton} onClick={() => void onDecideDispute(d, 'accepted')}>
                <Icon name="check" size="sm" /> הילד צודק
              </button>
              <button type="button" className={styles.linkButton} onClick={() => void onDecideDispute(d, 'rejected')}>
                <Icon name="close" size="sm" /> לדחות
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const FILTERS: (ReviewFilter | 'all')[] = [
  'all',
  'booklet',
  'extra',
  'custom',
  'scales',
  'registers',
  'contexts',
  'idioms',
  'sentences',
];

function ItemList({ items, decisions = false }: { items: readonly ReviewItem[]; decisions?: boolean }) {
  const [filter, setFilter] = useState<ReviewFilter | 'all'>('all');
  const [query, setQuery] = useState('');
  const [editedOnly, setEditedOnly] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const q = query.trim();
  const list = items.filter(
    (i) => (filter === 'all' || i.filter === filter) && (!editedOnly || i.edited) && (!q || i.text.includes(q)),
  );
  return (
    <>
      <div className={styles.card}>
        <input
          className={styles.input}
          type="search"
          placeholder="חיפוש מילה או משפט"
          aria-label="חיפוש בתוכן"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShown(PAGE);
          }}
        />
        <div className={styles.wrap} role="group" aria-label="סינון לפי סוג">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              className={`${styles.linkButton} ${filter === f ? styles.tabActive : ''}`}
              onClick={() => {
                setFilter(f);
                setShown(PAGE);
              }}
            >
              {f === 'all' ? 'הכל' : FILTER_LABEL[f]}
            </button>
          ))}
          {!decisions && (
            <button
              type="button"
              aria-pressed={editedOnly}
              className={`${styles.linkButton} ${editedOnly ? styles.tabActive : ''}`}
              onClick={() => setEditedOnly(!editedOnly)}
            >
              <Icon name="edit" size="sm" /> נערכו
            </button>
          )}
        </div>
        <span className={styles.caption}>{list.length} פריטים</span>
      </div>
      <ul className={styles.list}>
        {list.slice(0, shown).map((i) => (
          <ItemCard key={`${i.kind}:${i.id}`} item={i} decisions={decisions} />
        ))}
      </ul>
      {list.length > shown && (
        <button type="button" className={styles.linkButton} onClick={() => setShown(shown + PAGE)}>
          להציג עוד ({list.length - shown})
        </button>
      )}
    </>
  );
}

function ItemCard({ item, decisions }: { item: ReviewItem; decisions: boolean }) {
  const { data } = useContent();
  const { saveEdit, revert, decide } = useContentEditor();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string[]>([]);
  // The parent's own new words are edited in "My new words"; everything else through the override layer.
  const ownWord = item.kind === 'entries' && item.filter === 'custom' && !baseItem(bundledContent, 'entries', item.id);
  const current = (data.full[item.kind] as readonly { id: string }[]).find(
    (x) => x.id === item.id,
  ) as unknown as Record<string, unknown>;
  const run = async (p: Promise<{ ok: true } | { ok: false; problems: string[] }>) => {
    const r = await p;
    setError(r.ok ? [] : r.problems);
  };

  return (
    <li className={styles.item} aria-label={item.title}>
      <div className={styles.itemHead}>
        <span className={styles.word}>{item.title}</span>
        <Pill>{FILTER_LABEL[item.filter]}</Pill>
        {item.edited && !ownWord && (
          <Pill tone="xp" icon="edit">
            נערך
          </Pill>
        )}
        {item.hidden && (
          <Pill tone="muted" icon="eye-off">
            מוסתר
          </Pill>
        )}
        {!item.reviewed && !item.decision && <Pill tone="guest">טרם נבדק</Pill>}
        {item.decision === 'approved' && <Pill tone="success">אושר</Pill>}
        {item.decision === 'rejected' && <Pill tone="muted">נדחה</Pill>}
      </div>
      <span className={styles.muted}>{item.detail}</span>
      {error.length > 0 && (
        <div className={styles.error} role="alert">
          {error.map((e) => (
            <span key={e}>{e}</span>
          ))}
        </div>
      )}
      {editing ? (
        <EditForm
          kind={item.kind}
          item={current}
          onCancel={() => setEditing(false)}
          onSave={async (fields) => {
            const r = await saveEdit(item.kind, item.id, fields);
            if (r.ok) setEditing(false);
            return r;
          }}
        />
      ) : (
        <div className={styles.actions}>
          {decisions && !item.decision && (
            <>
              <button type="button" className={styles.linkButton} onClick={() => void run(decide(item.id, 'approved'))}>
                <Icon name="check" size="sm" /> לאשר
              </button>
              <button type="button" className={styles.linkButton} onClick={() => void run(decide(item.id, 'rejected'))}>
                <Icon name="close" size="sm" /> לדחות
              </button>
            </>
          )}
          {decisions && item.decision && (
            <button type="button" className={styles.linkButton} onClick={() => void run(decide(item.id, null))}>
              <Icon name="refresh" size="sm" /> ביטול ההחלטה
            </button>
          )}
          {ownWord ? (
            <span className={styles.caption}>עריכה בלשונית ״המילים שלי״</span>
          ) : (
            <button type="button" className={styles.linkButton} onClick={() => setEditing(true)}>
              <Icon name="edit" size="sm" /> עריכה
            </button>
          )}
          {item.edited && !ownWord && (
            <button type="button" className={styles.linkButton} onClick={() => void run(revert(item.kind, item.id))}>
              <Icon name="refresh" size="sm" /> חזרה למקור
            </button>
          )}
        </div>
      )}
    </li>
  );
}
