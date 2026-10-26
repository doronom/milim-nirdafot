import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseData } from '../src/app/data';
import { emptyOverrides } from '../src/content/overrides';
import { addActivity } from '../src/engine/activity';
import { initialProgress, type Progress } from '../src/engine/progress';
import { formatPairingCode, newPairingCode, normalizePairingCode, PAIRING_ALPHABET } from '../src/sync/local';
import { createUploadScheduler } from '../src/sync/scheduler';
import { buildSnapshot, firstName, snapshotStore, SNAPSHOT_MAX_BYTES } from '../src/sync/snapshot';

const card = { box: 4 as const, due: '2026-11-01', seen: 3, lapses: 0, lastSeen: '2026-10-20' };
const progress = (): Progress => ({
  ...addActivity({ ...initialProgress(), onboarded: true }, '2026-10-26', 600),
  xp: 420,
  levels: { 'w1-emotions-1': { stars: 3, bestAccuracy: 1, completedAt: '2026-10-26' } },
  leitner: { 'b031|ענק': card },
  settings: { ...initialProgress().settings, childName: 'Testchild Cohen' },
});
const queues = { alsoCorrect: [], sentenceReports: [], itemDisputes: [] };

describe('progress snapshot', () => {
  const snap = () =>
    buildSnapshot({
      progress: progress(),
      overrides: emptyOverrides(),
      log: [{ at: '2026-10-26T10:00:00.000Z', kind: 'entry', text: 'כניסה לאזור ההורים' }],
      queues,
      layout: baseData.layout,
    });

  it('carries Leitner boxes, levels, XP, streak, minutes per day, per-world and per-station stats, log and queues', () => {
    const s = snap();
    expect(s.schema).toBe(1);
    expect(s.progress.leitner['b031|ענק']).toEqual(card);
    expect(s.progress.xp).toBe(420);
    expect(s.progress.activity).toEqual({ '2026-10-26': 600 });
    expect(s.progress.streak).toBeDefined();
    expect(s.worlds).toHaveLength(4);
    expect(s.worlds[0]).toMatchObject({ id: 1, levelsDone: 1, stars: 3 });
    expect(s.worlds[0]!.stations[0]).toMatchObject({ id: 'w1-emotions', done: 1 });
    expect(s.log).toHaveLength(1);
    expect(s.queues).toEqual(queues);
  });

  it('never carries the child name (sent separately as a first name), the passcode, the lockout or recordings', () => {
    const text = JSON.stringify(snap());
    expect(text).not.toContain('Testchild');
    for (const key of ['parent:lock', 'parent:lockout', 'recording', 'PBKDF2', 'recovery', 'childName'])
      expect(text).not.toContain(key);
    expect(firstName('Testchild Cohen')).toBe('Testchild');
    expect(firstName(undefined)).toBe('');
  });

  it('is plain data Firestore accepts (no undefined), and stays under the size cap by trimming the oldest log', () => {
    const s = buildSnapshot({
      progress: { ...progress(), speedBest: undefined },
      overrides: emptyOverrides(),
      log: Array.from({ length: 20_000 }, (_, i) => ({
        at: `t${i}`,
        kind: 'change' as const,
        text: 'שינוי הגדרה '.repeat(4),
      })),
      queues,
      layout: baseData.layout,
    });
    expect(JSON.stringify(s).length).toBeLessThanOrEqual(SNAPSHOT_MAX_BYTES);
    expect(s.log.at(-1)?.at).toBe('t19999');
    expect('speedBest' in s.progress).toBe(false);
  });

  it('turns back into the store a read-only dashboard renders', () => {
    const seed = snapshotStore(snap(), 'נועה');
    expect(seed.progress).toMatchObject({ xp: 420, settings: { childName: 'נועה' } });
    expect(seed['parent:log']).toHaveLength(1);
  });
});

describe('upload scheduling', () => {
  afterEach(() => vi.useRealTimers());

  it('debounces changes into one upload, and flushes at once (level end, app backgrounded)', async () => {
    vi.useFakeTimers();
    const upload = vi.fn(async () => undefined);
    const s = createUploadScheduler(upload, 20_000);
    s.schedule();
    s.schedule();
    await vi.advanceTimersByTimeAsync(19_000);
    s.schedule();
    await vi.advanceTimersByTimeAsync(19_000);
    expect(upload).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(upload).toHaveBeenCalledTimes(1);
    s.schedule();
    await s.flush();
    expect(upload).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(upload).toHaveBeenCalledTimes(2);
  });

  it('runs one upload at a time and catches up once after changes made during it', async () => {
    let release!: () => void;
    const upload = vi.fn(() => new Promise<void>((r) => (release = r)));
    const s = createUploadScheduler(upload, 1000);
    const first = s.flush();
    void s.flush();
    void s.flush();
    expect(upload).toHaveBeenCalledTimes(1);
    release();
    // The two flushes during the upload become a single catch-up upload.
    await vi.waitFor(() => expect(upload).toHaveBeenCalledTimes(2));
    release();
    await first;
    expect(upload).toHaveBeenCalledTimes(2);
  });

  it('a failed upload (offline) is swallowed; the game never sees an error', async () => {
    const s = createUploadScheduler(async () => {
      throw new Error('offline');
    });
    await expect(s.flush()).resolves.toBeUndefined();
  });
});

describe('pairing codes', () => {
  it('are 8 characters without look-alikes', () => {
    for (let i = 0; i < 50; i++) {
      const code = newPairingCode();
      expect(code).toHaveLength(8);
      expect([...code].every((c) => PAIRING_ALPHABET.includes(c))).toBe(true);
    }
    expect(formatPairingCode('K7QM2XRA')).toBe('K7QM-2XRA');
  });

  it('are read back typed, formatted, lower-case or from a scanned pairing link', () => {
    expect(normalizePairingCode('k7qm-2xra')).toBe('K7QM2XRA');
    expect(normalizePairingCode(' K7QM 2XRA ')).toBe('K7QM2XRA');
    expect(normalizePairingCode('https://example.com/#/parent?pair=K7QM2XRA')).toBe('K7QM2XRA');
    expect(normalizePairingCode('K7QM2XR0')).toBeNull();
    expect(normalizePairingCode('K7QM')).toBeNull();
  });
});
