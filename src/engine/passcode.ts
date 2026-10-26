/**
 * The parent passcode: rules, PBKDF2 hashing (WebCrypto), recovery codes and the lockout schedule. Only salted hashes
 * are ever stored; the passcode and the recovery code exist in memory only while they are typed.
 */

export const PASSCODE_MIN_LENGTH = 8;
/** Seconds the entry button must be held, so the parent area never opens by accident. */
export const GATE_HOLD_SECONDS = 3;
/** OWASP's recommendation for PBKDF2-HMAC-SHA256. */
export const PBKDF2_ITERATIONS = 600_000;

export interface HashRecord {
  algorithm: 'PBKDF2-SHA256';
  iterations: number;
  /** Base64. */
  salt: string;
  /** Base64, 256 bits. */
  hash: string;
}

/** Same characters typed on any keyboard compare equal (Hebrew letters can arrive composed or decomposed). */
export const normalizePasscode = (p: string): string => p.normalize('NFC');

const chars = (p: string) => [...normalizePasscode(p)];

export type PasscodeProblem = 'too-short' | 'repeated' | 'sequence';

/** A run of characters whose codes step by +1 or -1 the whole way: 12345678, abcdefgh, 87654321, אבגדהוזח. */
function isSequence(cs: string[]): boolean {
  const codes = cs.map((c) => c.toLowerCase().codePointAt(0)!);
  const step = codes[1]! - codes[0]!;
  return Math.abs(step) === 1 && codes.every((c, i) => i === 0 || c - codes[i - 1]! === step);
}

/** What is wrong with a new passcode (empty when it is acceptable). */
export function passcodeProblems(passcode: string): PasscodeProblem[] {
  const cs = chars(passcode);
  const problems: PasscodeProblem[] = [];
  if (cs.length < PASSCODE_MIN_LENGTH) problems.push('too-short');
  if (cs.length > 1 && new Set(cs.map((c) => c.toLowerCase())).size === 1) problems.push('repeated');
  else if (cs.length > 2 && isSequence(cs)) problems.push('sequence');
  return problems;
}

export const PROBLEM_TEXT: Record<PasscodeProblem, string> = {
  'too-short': `לפחות ${PASSCODE_MIN_LENGTH} תווים`,
  repeated: 'לא תו אחד שחוזר על עצמו (כמו 11111111)',
  sequence: 'לא רצף פשוט (כמו 12345678 או abcdefgh)',
};

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(secret: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/** A salted PBKDF2 hash with a fresh random salt. */
export async function hashSecret(secret: string, iterations = PBKDF2_ITERATIONS): Promise<HashRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(secret, salt, iterations);
  return { algorithm: 'PBKDF2-SHA256', iterations, salt: toBase64(salt), hash: toBase64(hash) };
}

/** Compares in constant time, with the iteration count the record was made with. */
export async function verifySecret(secret: string, record: HashRecord): Promise<boolean> {
  const expected = fromBase64(record.hash);
  const actual = await derive(secret, fromBase64(record.salt), record.iterations);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ expected[i]!;
  return diff === 0;
}

export const hashPasscode = (passcode: string, iterations?: number) =>
  hashSecret(normalizePasscode(passcode), iterations);
export const verifyPasscode = (passcode: string, record: HashRecord) =>
  verifySecret(normalizePasscode(passcode), record);

/** Recovery codes avoid look-alike characters (0/O, 1/I/L) so a handwritten copy reads back reliably. */
const RECOVERY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const RECOVERY_GROUPS = 5;
const RECOVERY_GROUP_SIZE = 4;

/** A random recovery code, e.g. "K7QM-2XRA-9PDH-TW4E-MZ3B" (20 characters, about 99 bits). */
export function newRecoveryCode(): string {
  const n = RECOVERY_GROUPS * RECOVERY_GROUP_SIZE;
  // Rejection sampling keeps every character equally likely.
  const out: string[] = [];
  while (out.length < n) {
    for (const b of crypto.getRandomValues(new Uint8Array(n))) {
      if (b < 256 - (256 % RECOVERY_ALPHABET.length) && out.length < n)
        out.push(RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]!);
    }
  }
  return Array.from({ length: RECOVERY_GROUPS }, (_, i) =>
    out.slice(i * RECOVERY_GROUP_SIZE, (i + 1) * RECOVERY_GROUP_SIZE).join(''),
  ).join('-');
}

/** Typed back case-insensitively, with or without dashes and spaces. */
export const normalizeRecoveryCode = (code: string): string => code.toUpperCase().replace(/[\s-]/g, '');

export const hashRecoveryCode = (code: string, iterations?: number) =>
  hashSecret(normalizeRecoveryCode(code), iterations);
export const verifyRecoveryCode = (code: string, record: HashRecord) =>
  verifySecret(normalizeRecoveryCode(code), record);

/** Wrong attempts allowed before each lockout. */
export const ATTEMPTS_PER_ROUND = 3;
/** Lockout lengths in minutes: the first, second, third, and every later one. */
export const LOCKOUT_MINUTES = [1, 5, 15, 60] as const;

export interface LockoutState {
  /** Wrong attempts since the last lockout ended or the last success. */
  failures: number;
  /** Lockouts so far in this run of failures (picks the next length). */
  lockouts: number;
  /** Epoch ms until which entry is refused, or null. */
  lockedUntil: number | null;
}

export const initialLockout = (): LockoutState => ({ failures: 0, lockouts: 0, lockedUntil: null });

export const lockedFor = (s: LockoutState, now: number): number =>
  s.lockedUntil !== null && s.lockedUntil > now ? s.lockedUntil - now : 0;

/** A wrong passcode or recovery code: every third one locks entry, for 1, 5, 15, then 60 minutes. */
export function registerFailure(s: LockoutState, now: number): LockoutState {
  const failures = s.failures + 1;
  if (failures < ATTEMPTS_PER_ROUND) return { ...s, failures };
  const minutes = LOCKOUT_MINUTES[Math.min(s.lockouts, LOCKOUT_MINUTES.length - 1)]!;
  return { failures: 0, lockouts: s.lockouts + 1, lockedUntil: now + minutes * 60_000 };
}

/** The right passcode clears the record. */
export const registerSuccess = (): LockoutState => initialLockout();
