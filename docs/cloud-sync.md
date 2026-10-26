# Cloud sync

Parents can follow a child's progress from their own phones, and set the parent passcode there. The child's device
stays offline-first: the game never needs the network, and if Firebase is unreachable everything works as before.

## Roles

| Who                  | Signs in with                  | Can                                                                                      |
| -------------------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| Child device         | Firebase Anonymous auth        | Write only its own profile (while paired); read its profile and the family passcode hash |
| Parent (allowlisted) | Google, email on the allowlist | Read paired children, create pairing codes, set the passcode hash, unpair/delete         |
| Anyone else          | -                              | Nothing (a Google account off the allowlist sees "not authorized")                       |

Security comes from the Firestore Security Rules (`firestore.rules`) and App Check. The Firebase web config in
`src/sync/config.ts` is public by design.

## Data model (Firestore)

```
config/parents            { emails: string[] }                 no client access; admin script / console only
families/main             { passcode: HashRecord, passcodeUpdatedAt, passcodeUpdatedBy }
pairingCodes/{code}       { family, createdBy, createdAt, used, usedBy?, usedAt? }
pairings/{childUid}       { family, code, pairedAt }
children/{childUid}       { schema: 1, name, updatedAt, appVersion, snapshot }
children/{childUid}/commands/{id}   phase 2, closed for now
```

- **HashRecord**: `{ algorithm: 'PBKDF2-SHA256', iterations >= 600000, salt, hash }` (base64). The passcode itself is
  never stored anywhere; parent mode hashes it on the parent's phone.
- **snapshot** (`src/sync/snapshot.ts`): progress (levels, XP, streak, Leitner boxes, minutes per day, settings without
  the name), per-world and per-station stats, the parent-area activity log, the review queues and the content
  overrides. Never voice recordings, the lockout state, the passcode hash or recovery data. `name` is the first name
  only.
- **Single writer**: only the child's device writes its profile, as a full snapshot (`set`, not merge), so there are no
  conflicts.

## Flows

- **Upload** (child, paired, online): debounced while playing (20 s), immediately at the end of a level and when the
  app goes to the background, and when the device comes back online.
- **Pairing**: parent mode creates `pairingCodes/{code}` (8 characters, shown with a QR code). The child device, in
  one batch, creates `pairings/{uid}` and marks the code used. The rules accept this only for an existing code that is
  unused and less than 10 minutes old, and only together. Then the device copies the passcode hash and verifies it
  locally from then on, offline too. The QR encodes `…/#/parent?pair=CODE`, read by the in-app scanner or the phone
  camera.
- **Passcode**: set or reset only in parent mode; paired devices apply a newer `passcodeUpdatedAt` on their next sync.
  The lockout stays per device. A device with a passcode from before cloud sync keeps it until pairing replaces it
  (logged). A device that was never paired offers only pairing.
- **Unpairing / deleting cloud data**: from either side, deletes the profile and the pairing; the child device notices
  on its next sync and logs it. "Delete cloud data" on the child also deletes its anonymous account. Local progress and
  the passcode on the device stay.

## Phase 2: parent changes pushed to the child (designed, not built)

Parents approving reports or editing content in parent mode will write commands that the child's device applies to its
local state, keeping the single-writer model:

```
children/{childUid}/commands/{commandId}
  { type: 'decide-report' | 'decide-sentence-report' | 'decide-dispute' | 'content-edit' | 'content-revert'
          | 'review-decision' | 'custom-word',
    payload,               e.g. { kind: 'entries', id: 'b031', fields: { synonyms: [...] } } (same shape as overrides)
    createdBy, createdAt }
```

The child reads its commands on sync, applies each through the same code the parent area uses (so the validate:data
rules still run on the device), logs it, and deletes it; the next snapshot shows the result (the snapshot already
carries the overrides and queues parent mode needs to display). Rules to add: parents may create commands for paired
children only; a child may read and delete only its own.

## Setup (one-time, by the project owner)

1. Deploy the rules: `npx firebase deploy --only firestore:rules`.
2. Write the allowlist: put `PARENT_EMAILS=a@example.com,b@example.com` in `.env`, then `npm run seed:parents`. The
   script uses Application Default Credentials; set them up once with `gcloud auth application-default login` and
   `gcloud auth application-default set-quota-project word-quest-512809`.
3. Firebase console, Authentication, Settings, Authorized domains: add the site's domain (for Google sign-in).
4. App Check: create a reCAPTCHA Enterprise key for the site's domain, register it for the web app in the Firebase
   console (App Check), put the site key in `APP_CHECK_SITE_KEY` (`src/sync/config.ts`), deploy, watch the metrics,
   then enforce App Check for Firestore and Authentication.
5. Google Cloud console, APIs & Services, Credentials: restrict the Firebase "Browser key" to the site's domains
   (HTTP referrers; this is why `netlify.toml` sends `Referrer-Policy: strict-origin`, not `no-referrer`) and to the
   Firebase APIs (Identity Toolkit, Token Service, Cloud Firestore, Firebase Installations,
   Firebase App Check, reCAPTCHA Enterprise). The same project has Text-to-Speech enabled; the browser key must not be
   usable for it.

## Tests

- `npm run test:rules`: the rules in the Firestore emulator (needs Java 21).
- `npm run test:e2e:sync`: parent and child in two browser contexts against the Auth and Firestore emulators.
- Unit: `tests/sync.test.ts`, `tests/passcode.test.ts`.
