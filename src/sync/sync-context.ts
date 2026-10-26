import { createContext, useContext } from 'react';
import type { CloudResult } from './child';

export interface SyncState {
  /** null while loading the local pairing. */
  paired: boolean | null;
  lastUploadAt?: number;
  pair: (code: string) => Promise<CloudResult>;
  /** Checks the pairing and passcode, then uploads now. */
  syncNow: () => Promise<CloudResult>;
  unpair: () => Promise<CloudResult>;
  deleteCloudData: () => Promise<CloudResult>;
}

const offline = async (): Promise<CloudResult> => 'offline';

/** Without a provider (tests of single screens), the device is simply unpaired. */
export const SyncContext = createContext<SyncState>({
  paired: false,
  pair: offline,
  syncNow: offline,
  unpair: offline,
  deleteCloudData: offline,
});

export const useSync = (): SyncState => useContext(SyncContext);
