# The Choir Chug

A production-oriented Next.js system for the Choir Chug: public landing page, electronic registration and signed agreements, private parent schedules, student and payment administration, printable documents, yearly records, creative prompt tools, email delivery, and protected backups.

The repository supports two runtimes:

- Vercel: Next.js + Neon Postgres + private Vercel Blob (the recommended production setup).
- ChatGPT Sites: Vinext + Cloudflare D1/R2 for the private review deployment.

## Vercel deployment

1. Upload this folder to a private GitHub repository and import it into Vercel as a Next.js project.
2. In the Vercel project, connect a Neon Postgres database and a **private** Vercel Blob store.
3. Generate application secrets locally:

   ```bash
   npm run secrets:generate
   ```

4. Add the generated values to Vercel for Production, Preview and Development:

   - `CHOIR_DATA_KEY`
   - `CHOIR_TOKEN_SECRET`
   - `CRON_SECRET`

5. Add `CHOIR_ADMIN_PASSCODE=0331` as the initial administrator code. On first successful sign-in an administrator record is created; change the code in Settings and keep it somewhere safe. If it is ever forgotten, set `CHOIR_ADMIN_RESET_PASSCODE` in Vercel, sign in with it, choose a new passcode, then delete that variable.
6. Optional but recommended: connect Resend and set `RESEND_API_KEY` plus a verified `CHOIR_FROM_EMAIL` address. Parent agreement, schedule and registration-return messages are still recorded in the outbox when email is not connected.
7. Deploy. When `DATABASE_URL` is available, the Vercel build applies every checked-in PostgreSQL migration before compiling the application.

The hidden administrator entry is the top-right corner of the public header. It opens a passcode-only dialog. The administrator dashboard itself is protected by rate-limited, expiring server sessions.

## Local Vercel-style development

Copy `.env.example` to `.env.local`, connect a development Neon branch and private Blob store, and replace every example secret.

```bash
npm install
npm run db:migrate:postgres
npm run dev:vercel
```

To validate the production Next.js build without a live database migration:

```bash
VERCEL=1 npm run build
```

## Data architecture

- Neon Postgres stores school years, immutable agreement versions, drafts, registrations, section approvals, students, group assignments, monthly payment items, calendars, custom links, audit history, encrypted notes, email outbox records and backup manifests.
- Private Vercel Blob stores payment proofs, signatures, signed PDFs, uploaded document logos and encrypted database snapshots.
- Medical details, private notes, return-link material and queued email contents are encrypted with AES-256-GCM before database storage.
- Private link and session tokens are stored as keyed hashes. Uploaded images are checked by file signature and size rather than trusting the filename.
- A Vercel Cron task runs daily to create an encrypted backup, retry queued mail, expire old drafts and remove expired sessions/recovery tokens.
- Important administrator changes also request a protected backup, with a server-side five-minute deduplication window.

## Main capabilities

- Responsive landing page with a continuous, reduced-motion-aware hero choreography.
- Save-and-continue registration with a private 30-day return link.
- One `I understand` acknowledgement per complete agreement section.
- Active agreement editor with immutable version publishing and signed snapshots.
- Custom registration links for discounts, monthly overrides, one-time adjustments, payment methods and proof rules; the exact custom amounts flow into the approved and signed agreement.
- Touch, pointer and accessible typed signatures; generated color-logo A4 PDF and protected download.
- Private parent schedule links with Gregorian/Hebrew dates, English/Hebrew holidays, group announcements, calendar notes and future month navigation.
- Groups, manual students, birthdays, search, archives, private notes, payment tracking and history.
- Per-year recurring or manual schedules, finalization, live parent updates and printable schedule PDFs.
- Excel export, merged signed agreements, class lists, blank agreements, A4/A5 lyrics sheets and replaceable document logo.
- Flyer/detail-sheet/custom image-generator prompt studio with style refresh and attachment checklist.
- Daily encrypted backups, JSON export, protected restore and activity logs.

## Useful commands

```bash
npm run lint
npx tsc --noEmit
npm run db:generate:postgres
npm run db:migrate:postgres
VERCEL=1 npm run build
npm run build
```

`npm run build` produces the ChatGPT Sites/Vinext worker unless the `VERCEL=1` environment variable is present. Both builds are intentionally kept working from one source tree.

## Before accepting real registrations

The code is production-oriented, but the operator must complete these non-code launch items:

- Add the full registered-business identification, service address, privacy email, accessibility contact and verified sender details to the legal copy.
- Obtain Israeli legal review of the agreement, cancellation wording, privacy notice, consumer disclosures, security-check arrangement, media permissions and retention schedule.
- Obtain written parent authorization before publishing the supplied photographs of children.
- Run an accessibility review of the final domain, generated PDFs, registration flow and third-party email templates.
- Test one complete real-device flow with a test child record: save/resume, custom pricing, proof upload, all agreement sections, signature, PDF download, parent schedule, administrator approval, payment change, export and restore.

Do not commit `.env.local`, database exports, uploaded proofs, signed documents or any other real participant data to GitHub.
