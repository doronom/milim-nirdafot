/** Remembers that this browser is a parent's phone, so opening the app goes straight to parent mode. */
const KEY = 'wq:device';

export function isParentDevice(): boolean {
  try {
    return localStorage.getItem(KEY) === 'parent';
  } catch {
    return false;
  }
}

export function setParentDevice(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, 'parent');
    else localStorage.removeItem(KEY);
  } catch {
    // Without storage the parent simply opens parent mode from the welcome screen.
  }
}
