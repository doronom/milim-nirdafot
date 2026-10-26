/** Talks to the local emulators directly (the "owner" token bypasses the rules, like the admin script does). */
export const PROJECT = 'demo-word-quest';
const FIRESTORE = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;

/** Placeholder parent accounts: the real allowlist is never in the repository. */
export const PARENT_A = 'parent-a@example.com';
export const PARENT_B = 'parent-b@example.com';
export const STRANGER = 'stranger@example.com';

export async function resetEmulators(): Promise<void> {
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, {
    method: 'DELETE',
  });
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  const res = await fetch(`${FIRESTORE}/config/parents`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: { emails: { arrayValue: { values: [PARENT_A, PARENT_B].map((stringValue) => ({ stringValue })) } } },
    }),
  });
  if (!res.ok) throw new Error(`seeding the allowlist failed: ${res.status}`);
}
