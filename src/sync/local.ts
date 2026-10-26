import type { KeyValueStore } from '../storage/kv';

export const PAIRING_KEY = 'cloud:pairing';
export const SYNC_STATUS_KEY = 'cloud:status';

/** This device's link to the parents (kept locally so the game knows it is paired while offline). */
export interface LocalPairing {
  /** The anonymous Firebase user of this device. */
  uid: string;
  family: string;
  pairedAt: string;
}

export interface SyncStatus {
  /** Last successful snapshot upload (epoch ms). */
  lastUploadAt?: number;
  /** Last successful check of the pairing and passcode (epoch ms). */
  lastPullAt?: number;
}

export const getPairing = (store: KeyValueStore) => store.get<LocalPairing>(PAIRING_KEY);
export const setPairing = (store: KeyValueStore, p: LocalPairing | null) =>
  p ? store.set(PAIRING_KEY, p) : store.del(PAIRING_KEY);
export const getSyncStatus = async (store: KeyValueStore): Promise<SyncStatus> =>
  (await store.get<SyncStatus>(SYNC_STATUS_KEY)) ?? {};
export const updateSyncStatus = async (store: KeyValueStore, patch: SyncStatus) =>
  store.set(SYNC_STATUS_KEY, { ...(await getSyncStatus(store)), ...patch });

/** Pairing codes: 8 characters from an alphabet without look-alikes (no 0/O, 1/I/L). */
export const PAIRING_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const PAIRING_CODE_LENGTH = 8;
export const PAIRING_MINUTES = 10;

export function newPairingCode(): string {
  const out: string[] = [];
  while (out.length < PAIRING_CODE_LENGTH)
    for (const b of crypto.getRandomValues(new Uint8Array(PAIRING_CODE_LENGTH)))
      if (b < 256 - (256 % PAIRING_ALPHABET.length) && out.length < PAIRING_CODE_LENGTH)
        out.push(PAIRING_ALPHABET[b % PAIRING_ALPHABET.length]!);
  return out.join('');
}

/** Typed or scanned back: case-insensitive, dashes and spaces ignored; a scanned pairing link works too. */
export function normalizePairingCode(input: string): string | null {
  const fromLink = /[?&#/]pair[=/]([A-Za-z0-9-]+)/.exec(input)?.[1];
  const code = (fromLink ?? input).toUpperCase().replace(/[\s-]/g, '');
  return new RegExp(`^[${PAIRING_ALPHABET}]{${PAIRING_CODE_LENGTH}}$`).test(code) ? code : null;
}

/** "K7QM-2XRA": easier to read aloud and type. */
export const formatPairingCode = (code: string): string => `${code.slice(0, 4)}-${code.slice(4)}`;
