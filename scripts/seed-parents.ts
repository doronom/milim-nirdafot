/**
 * npm run seed:parents
 * Writes the parent allowlist (config/parents) from PARENT_EMAILS in .env (comma-separated). The addresses are never
 * printed, logged or committed; no client can read or write this document (see firestore.rules), so this script (or
 * the Firebase console) is the only way to change it.
 *
 * Credentials: Application Default Credentials. One-time setup on this machine:
 *   gcloud auth application-default login
 *   gcloud auth application-default set-quota-project word-quest-512809
 * (or point GOOGLE_APPLICATION_CREDENTIALS at a credentials file).
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { existsSync, readFileSync } from 'node:fs';
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

initializeApp({ credential: applicationDefault(), projectId: PROJECT });
try {
  await getFirestore().doc('config/parents').set({ emails, updatedAt: new Date() });
} catch (error) {
  console.error(
    `Could not write config/parents: ${(error as Error).message.split('\n')[0]}\n` +
      'Set up Application Default Credentials once: `gcloud auth application-default login`, then ' +
      `\`gcloud auth application-default set-quota-project ${PROJECT}\`.`,
  );
  process.exit(1);
}
console.log(
  `config/parents in ${PROJECT}: ${emails.length} allowlisted parent account(s) written (addresses not shown).`,
);
