// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/app/App';
import type { ContentOverrides } from '../src/content/overrides';
import { applyTokens } from '../src/design/tokens';
import { initialProgress, type Progress } from '../src/engine/progress';
import { newRecoveryCode } from '../src/engine/passcode';
import { setupLock } from '../src/state/parent-lock';
import { memoryStore, type KeyValueStore } from '../src/storage/kv';

const started = (extra: Partial<Progress> = {}): Progress => ({ ...initialProgress(), onboarded: true, ...extra });

/** The passcode in tests (the lock is stored with a low PBKDF2 cost so tests stay fast). */
const PASS = 'Tiger&Moon7';
const FAST = 1000;

/** A store whose parent passcode is already set. */
async function lockedStore(): Promise<KeyValueStore> {
  const store = memoryStore();
  await setupLock(store, PASS, newRecoveryCode(), { iterations: FAST });
  return store;
}

/** Renders the app at a hash; the progress lives in the store so screens read and write it like on a device. */
async function renderAt(hash: string, progress: Progress = started(), store?: KeyValueStore) {
  const s = store ?? (await lockedStore());
  await s.set('progress', progress);
  window.location.hash = hash;
  applyTokens();
  render(<App store={s} />);
  return s;
}

/** Holds the entry button for `ms` (fake animation frames). */
async function hold(ms = 3100) {
  const button = await screen.findByRole('button', { name: /החזיקו לחוץ/ });
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  fireEvent.pointerDown(button);
  await act(async () => vi.advanceTimersByTime(ms));
  fireEvent.pointerUp(button);
  vi.useRealTimers();
}

async function typePasscode(value: string) {
  fireEvent.change(await screen.findByLabelText('קוד הורים'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'כניסה' }));
}

/** Passes the lock: the 3-second hold, then the passcode. */
async function openGate() {
  await hold();
  await typePasscode(PASS);
}

beforeEach(() => {
  window.scrollTo = () => undefined;
});
afterEach(() => {
  expect(document.querySelector('[class~="undefined"]')).toBeNull();
  vi.useRealTimers();
  cleanup();
  window.location.hash = '';
});

describe('parent lock', () => {
  it('needs a full 3-second hold before the passcode field', async () => {
    await renderAt('#/parent');
    await hold(1500);
    expect(screen.queryByLabelText('קוד הורים')).toBeNull();
    await hold(3100);
    expect(await screen.findByLabelText('קוד הורים')).toBeTruthy();
  });

  it('first entry sets a passcode twice, shows a one-time recovery code, and stores only hashes', async () => {
    const store = memoryStore();
    await renderAt('#/parent', started(), store);
    await hold();
    const [first, second] = await screen.findAllByLabelText(/קוד הורים|שוב, לאישור/);
    expect(first!.getAttribute('type')).toBe('password');
    expect(first!.getAttribute('autocomplete')).toBe('off');
    expect(first!.getAttribute('autocorrect')).toBe('off');
    fireEvent.click(screen.getAllByRole('button', { name: 'הצגת הקוד' })[0]!);
    expect(first!.getAttribute('type')).toBe('text');

    fireEvent.change(first!, { target: { value: '12345678' } });
    fireEvent.change(second!, { target: { value: '12345678' } });
    fireEvent.click(screen.getByRole('button', { name: 'המשך' }));
    expect((await screen.findByRole('alert')).textContent).toContain('רצף פשוט');

    fireEvent.change(first!, { target: { value: 'מסע-המילים!7' } });
    fireEvent.change(second!, { target: { value: 'מסע-המילים!8' } });
    fireEvent.click(screen.getByRole('button', { name: 'המשך' }));
    expect((await screen.findByRole('alert')).textContent).toContain('לא זהים');

    fireEvent.change(second!, { target: { value: 'מסע-המילים!7' } });
    fireEvent.click(screen.getByRole('button', { name: 'המשך' }));
    const code = (await screen.findByLabelText('קוד השחזור')).textContent!;
    expect(code).toMatch(/^([A-Z0-9]{4}-){4}[A-Z0-9]{4}$/);
    expect(screen.getByText(/למחוק את נתוני האתר/)).toBeTruthy();
    // Nothing is saved until the parent confirms writing the code down.
    expect(await store.get('parent:lock')).toBeUndefined();
    const finish = screen.getByRole('button', { name: 'סיום וכניסה' });
    expect(finish.hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: /רשמתי את קוד השחזור/ }));
    fireEvent.click(finish);
    expect(await screen.findByText('דקות משחק בשבוע האחרון')).toBeTruthy();
    const saved = JSON.stringify(await store.get('parent:lock'));
    expect(saved).toContain('PBKDF2-SHA256');
    expect(saved).not.toContain('מסע-המילים');
    expect(saved).not.toContain(code);
  });

  it('a wrong passcode counts down to a lockout that refuses even the right one', async () => {
    await renderAt('#/parent');
    await hold();
    await typePasscode('wrong-pass-1');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('נותרו 2 ניסיונות'));
    await typePasscode('wrong-pass-2');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('נותר ניסיון אחד'));
    await typePasscode('wrong-pass-3');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/לנסות שוב בעוד/));
    expect((screen.getByLabelText('קוד הורים') as HTMLInputElement).disabled).toBe(true);
  });

  it('shows failed attempts since the previous entry on the dashboard, and logs entries and changes', async () => {
    const store = await lockedStore();
    await renderAt('#/parent', started(), store);
    await openGate();
    await screen.findByText('דקות משחק בשבוע האחרון');
    cleanup();
    await renderAt('#/parent', started(), store);
    await hold();
    await typePasscode('wrong-pass-1');
    await screen.findByRole('alert');
    await typePasscode(PASS);
    await screen.findByText('דקות משחק בשבוע האחרון');
    expect((await screen.findByRole('alert')).textContent).toContain('ניסיון כניסה שגוי אחד');

    fireEvent.click(screen.getByRole('link', { name: 'הגדרות' }));
    fireEvent.click(await screen.findByRole('switch', { name: /פתיחת כל השלבים/ }));
    fireEvent.click(screen.getByRole('link', { name: 'יומן הפעילות' }));
    expect(await screen.findByText('הגדרה: פתיחת כל השלבים והעולמות: הופעל')).toBeTruthy();
    expect(screen.getByText('ניסיון כניסה עם קוד שגוי')).toBeTruthy();
    expect(screen.getAllByText('כניסה לאזור ההורים')).toHaveLength(2);
  });
});

describe('dashboard', () => {
  it('shows minutes, boxes, struggling and mastered words', async () => {
    const card = (box: 1 | 2 | 3 | 4 | 5, lapses: number) => ({
      box,
      due: '2026-01-01',
      seen: 4,
      lapses,
      lastSeen: '2026-01-01',
    });
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    await renderAt(
      '#/parent',
      started({ activity: { [key]: 16 * 60 }, leitner: { 'b031|ענק': card(1, 3), 'b035|לוהט': card(5, 0) } }),
    );
    await openGate();
    expect(await screen.findByText('גדול = ענק')).toBeTruthy();
    expect(screen.getByText('חם = לוהט')).toBeTruthy();
    expect(screen.getByRole('table', { name: 'מספר הפריטים בכל תיבת חזרה' })).toBeTruthy();
    expect(
      within(screen.getByRole('table', { name: 'דקות משחק בכל יום בשבוע האחרון' })).getAllByText('16 דקות'),
    ).toHaveLength(1);
  });
});

describe('content editing', () => {
  async function editB031(store: KeyValueStore, synonyms: string) {
    fireEvent.click(await screen.findByRole('tab', { name: /כל התוכן/ }));
    fireEvent.change(screen.getByLabelText('חיפוש בתוכן'), { target: { value: 'ענק, עצום' } });
    const item = await screen.findByRole('listitem', { name: 'גדול' });
    fireEvent.click(within(item).getByRole('button', { name: 'עריכה' }));
    fireEvent.change(within(item).getByLabelText(/מילים נרדפות/), { target: { value: synonyms } });
    fireEvent.click(within(item).getByRole('button', { name: 'שמירה' }));
    return { item, store };
  }

  it('blocks an invalid edit with the reason and saves nothing', async () => {
    const store = await renderAt('#/parent/content');
    await openGate();
    const { item } = await editB031(store, 'גדול');
    expect((await within(item).findByRole('alert')).textContent).toContain('המילה מופיעה כנרדפת של עצמה');
    expect((await store.get<ContentOverrides>('content:overrides'))?.entries.b031).toBeUndefined();
  });

  it('saves a valid edit as an override, drops the removed pair from Leitner, and reverts', async () => {
    const card = { box: 3 as const, due: '2026-01-01', seen: 2, lapses: 0, lastSeen: '2026-01-01' };
    const store = await renderAt('#/parent/content', started({ leitner: { 'b031|כביר': card, 'b031|ענק': card } }));
    await openGate();
    await editB031(store, 'ענק, עצום, אדיר');
    await waitFor(async () =>
      expect((await store.get<ContentOverrides>('content:overrides'))?.entries.b031).toEqual({
        synonyms: ['ענק', 'עצום', 'אדיר'],
      }),
    );
    await waitFor(async () => {
      const leitner = (await store.get<Progress>('progress'))!.leitner;
      expect(leitner['b031|כביר']).toBeUndefined();
      expect(leitner['b031|אדיר']?.box).toBe(1);
      expect(leitner['b031|ענק']?.box).toBe(3);
    });
    const item = await screen.findByRole('listitem', { name: 'גדול' });
    expect(within(item).getByText('נערך')).toBeTruthy();
    fireEvent.click(within(item).getByRole('button', { name: /חזרה למקור/ }));
    await waitFor(async () =>
      expect((await store.get<ContentOverrides>('content:overrides'))?.entries.b031).toBeUndefined(),
    );
    await waitFor(() => expect(within(screen.getByRole('listitem', { name: 'גדול' })).queryByText('נערך')).toBeNull());
  });

  it('approves and rejects drafts', async () => {
    const store = await renderAt('#/parent/content');
    await openGate();
    fireEvent.click(await screen.findByRole('tab', { name: /טיוטות/ }));
    const item = (await screen.findAllByRole('listitem', { name: 'מאוכזב' }))[0]!;
    fireEvent.click(within(item).getByRole('button', { name: /לאשר/ }));
    await waitFor(async () =>
      expect((await store.get<ContentOverrides>('content:overrides'))?.decisions.e001).toBe('approved'),
    );
    expect(await within(screen.getAllByRole('listitem', { name: 'מאוכזב' })[0]!).findByText('אושר')).toBeTruthy();
  });
});

describe('my new words', () => {
  it('adds a word that gets its own always-open station in World 1', async () => {
    const store = await renderAt('#/parent/words');
    await openGate();
    fireEvent.click(await screen.findByRole('button', { name: /מילה חדשה/ }));
    fireEvent.change(screen.getByLabelText('מילת מטרה'), { target: { value: 'ענווה' } });
    fireEvent.change(screen.getByLabelText(/מילים נרדפות/), { target: { value: 'צניעות, פשטות' } });
    fireEvent.click(screen.getByRole('button', { name: 'שמירת המילה' }));
    expect(await screen.findByText(/נשמר:/)).toBeTruthy();
    const ov = (await store.get<ContentOverrides>('content:overrides'))!;
    expect(ov.custom.map((e) => [e.headword, e.synonyms, e.source])).toEqual([
      ['ענווה', ['צניעות', 'פשטות'], 'custom'],
    ]);
    await waitFor(async () => {
      const leitner = (await store.get<Progress>('progress'))!.leitner;
      expect(leitner[`${ov.custom[0]!.id}|צניעות`]?.box).toBe(1);
    });
    cleanup();
    await renderAt('#/world/1', (await store.get<Progress>('progress'))!, store);
    const marker = await screen.findByText(/תחנה \d+: המילים שלי/);
    const n = marker.textContent!.match(/\d+/)![0];
    // Open right away, although no World 1 level is done.
    expect(screen.getByRole('link', { name: `שלב ${n}.1: היכרות` })).toBeTruthy();
  });

  it('refuses a word without synonyms', async () => {
    await renderAt('#/parent/words');
    await openGate();
    fireEvent.click(await screen.findByRole('button', { name: /מילה חדשה/ }));
    fireEvent.change(screen.getByLabelText('מילת מטרה'), { target: { value: 'ענווה' } });
    fireEvent.click(screen.getByRole('button', { name: 'שמירת המילה' }));
    expect((await screen.findByRole('alert')).textContent).toContain('לפחות מילה נרדפת אחת');
  });
});

describe('settings', () => {
  it('changes the daily goal and resets the journey only after a second step', async () => {
    const store = await renderAt('#/parent/settings', started({ xp: 500 }));
    await openGate();
    fireEvent.click(await screen.findByRole('radio', { name: /20 דק׳/ }));
    await waitFor(async () => expect((await store.get<Progress>('progress'))!.settings.dailyGoal).toBe(20));
    fireEvent.click(screen.getByRole('button', { name: /איפוס נתוני המסע/ }));
    expect((await store.get<Progress>('progress'))!.xp).toBe(500);
    fireEvent.click(screen.getByRole('button', { name: /כן, לאפס הכל/ }));
    await waitFor(async () => expect((await store.get<Progress>('progress'))!.xp).toBe(0));
    expect((await store.get<Progress>('progress'))!.settings.dailyGoal).toBe(20);
  });
});

describe('recordings on learn cards', () => {
  it('plays the parent recording instead of speech, and speech when there is none', async () => {
    const { LearnCards } = await import('../src/screens/level/LearnCards');
    const { practiceItemFor } = await import('../src/games/practice');
    const { customEntry } = await import('../src/content/edits');
    const word = customEntry('c-1', {
      headword: 'ענווה',
      synonyms: ['צניעות'],
      hint: null,
      pos: 'noun',
      difficulty: 1,
    });
    const speakSpy = vi.fn();
    Object.assign(window, { speechSynthesis: { speak: speakSpy, cancel: () => undefined, getVoices: () => [] } });
    Object.assign(globalThis, { SpeechSynthesisUtterance: function SpeechSynthesisUtterance() {} });
    URL.createObjectURL = () => 'blob:rec';
    URL.revokeObjectURL = () => undefined;
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const blob = new Blob([new Uint8Array([1])], { type: 'audio/webm' });
    const view = render(
      <LearnCards
        items={[practiceItemFor(word, {})]}
        sentenceFor={() => undefined}
        displayWord={(w) => w}
        recordingFor={() => blob}
        onDone={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'השמע: ענווה' }));
    expect(play).toHaveBeenCalledTimes(1);
    expect(speakSpy).not.toHaveBeenCalled();
    view.unmount();
    render(
      <LearnCards
        items={[practiceItemFor(word, {})]}
        sentenceFor={() => undefined}
        displayWord={(w) => w}
        onDone={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'השמע: ענווה' }));
    expect(speakSpy).toHaveBeenCalledTimes(1);
    play.mockRestore();
  });
});
