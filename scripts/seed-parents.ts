/**
 * npm run seed:parents
 * Writes the parent allowlist (config/parents) from PARENT_EMAILS in .env (comma-separated). The addresses are never
 * printed, logged or committed; no client can read or write this document (see firestore.rules), so this script (or
 * the Firebase console) is the only way to change it.
 *
 * Credentials: GOOGLE_APPLICATION_CREDENTIALS if set, otherwise the account from `firebase login` on this machine.
 */
import { applicationDefault, initializeApp, refreshToken, type Credential } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

const PROJECT = JSON.parse(readFileSync(resolve(import.meta.dirname, '../.firebaserc'), 'utf8')).projects
  .default as string;

const env = resolve(import.meta.dirname, '../.env');
if (existsSync(env)) process.loadEnvFile(env);
const emails = [
  ...new Set(
    (process.env.PARENT_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  ),
];
if (emails.length === 0 || emails.some((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))) {
  console.error('PARENT_EMAILS in .env must be a comma-separated list of email addresses.');
  process.exit(2);
}

function credential(): Credential {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return applicationDefault();
  const store = resolve(homedir(), '.config/configstore/firebase-tools.json');
  const token = existsSync(store) ? JSON.parse(readFileSync(store, 'utf8')).tokens?.refresh_token : undefined;
  if (!token) {
    console.error('No credentials: run `npx firebase login` (or set GOOGLE_APPLICATION_CREDENTIALS).');
    process.exit(2);
  }
  // The Firebase CLI's own (public) OAuth client, so the CLI login works here too.
  const api = createRequire(import.meta.url)('firebase-tools/lib/api.js') as {
    clientId(): string;
    clientSecret(): string;
  };
  return refreshToken({
    type: 'authorized_user',
    client_id: api.clientId(),
    client_secret: api.clientSecret(),
    refresh_token: token,
  });
}

initializeApp({ credential: credential(), projectId: PROJECT });
await getFirestore().doc('config/parents').set({ emails, updatedAt: new Date() });
console.log(
  `config/parents in ${PROJECT}: ${emails.length} allowlisted parent account(s) written (addresses not shown).`,
);
