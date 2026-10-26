/** Audio switches from the parent settings, mirrored here so plain functions like `speak` can read them. */
export const audioPrefs = { voice: true, sound: true };

export function setAudioPrefs(next: Partial<typeof audioPrefs>): void {
  Object.assign(audioPrefs, next);
}
