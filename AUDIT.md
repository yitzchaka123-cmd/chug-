# System Audit — Broken and Incomplete Features

Audit date: 2026-08-16. Scope: full repository — both runtimes (Vercel/Neon/Blob and
ChatGPT Sites/Vinext/D1/R2), all app routes, API handlers, libraries, tests, and
build/verification tooling.

## How the audit was run

- `npx tsc --noEmit` — clean, no type errors.
- `npm run lint` — passes; 22 warnings, all `@next/next/no-img-element` (see F-08).
- `npm run test:domain` — 5/5 pass (pricing, payment plans, calendar, encryption, token hashing).
- `npm run test:postgres` — passes; the generated PostgreSQL migration applies cleanly to PGlite.
- `VERCEL=1 npm run build` — passes; all pages and API routes compile.
- `npm run build` (worker) — **failed twice on a fresh clone** (F-01, F-02), passes after the fixes in this branch.
- `npm run test:worker` — passes; end-to-end flow (registration → custom pricing → agreement PDF →
  parent schedule → admin approval → schedule finalize/PDF → prompts → backups) works on the D1 runtime.
- `npm test` (rendered HTML) — **failed** before this branch (F-03), passes after.
- `npm run verify` (all of the above in sequence) — passes with this branch's fixes.
- Manual code review plus a systematic cross-check of every client fetch against every API
  handler (URLs, methods, request fields, response fields), SQL dialect portability, auth,
  and the Neon/Blob adapters.

## Broken — fixed in this branch

### F-01 · Worker build broken on fresh clone: scripts missing executable bit
`scripts/sites-env.sh`, `scripts/build-verified.sh`, `scripts/install-ci.sh` and
`scripts/validate-artifact.sh` were committed without the executable bit. `npm run build`
runs `bash scripts/build-verified.sh`, which then `exec`s `scripts/sites-env.sh` directly and
died with `Permission denied`. Every fresh clone hit this. **Fixed:** executable bits committed.

### F-02 · Worker build broken on fresh clone: `.openai/hosting.json` missing
`vite.config.ts:3` hard-imports `./.openai/hosting.json`, which was not in the repository
(the ChatGPT Sites control plane injects it in that environment, but a plain checkout —
including CI and `npm run verify` — cannot build without it). The error message in
`db/index.ts:8` itself instructs setting `d1` to `DB` in this file. **Fixed:** a default
manifest `{"d1": "DB", "r2": "BUCKET"}` matching the binding names expected by
`worker/index.ts` and `db/index.ts` is now committed; the control plane still overwrites
it with real values at deploy time.

### F-03 · `npm test` fails: test asserts a meta tag the app never renders
`tests/rendered-html.test.mjs` required a `<meta name="codex-preview" content="development">`
tag in the rendered homepage. Nothing in the codebase emits that tag (leftover from the
vinext-starter template), so `npm test` always failed. **Fixed:** the test now asserts real
landing-page content (title, register link, admin hotspot) with the same status/content-type checks.

### F-04 · No `.gitignore`
The repository had no `.gitignore` at all, so `node_modules/`, `.next/`, `.sites-runtime/`,
`tsconfig.tsbuildinfo` and — most importantly — `.env.local` (secrets, and the README warns
never to commit participant data) were one `git add .` away from being committed.
**Fixed:** `.gitignore` added.

### F-05 · README references `.env.example`, which did not exist
The local-development instructions say "Copy `.env.example` to `.env.local`", but no such
file was in the repository. **Fixed:** `.env.example` added with placeholders for every
variable the code reads (`DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `CHOIR_DATA_KEY`,
`CHOIR_TOKEN_SECRET`, `CRON_SECRET`, `CHOIR_ADMIN_PASSCODE`, optional Resend settings).

### F-06 · Custom registration links priced the whole year at ₪0
The custom-link form promises "Leave any amount empty to use the standard year value", but
the admin UI converts empty fields to `null` (`app/admin/page.tsx:157`) and the handler's
`agorot()` helper (`app/api/admin/custom-links/route.ts:9`) computed `Number(null) === 0`,
storing **0 agorot instead of NULL** for registration, monthly, June, security-check and
one-time amounts. Since `lib/pricing.ts` treats NULL as "standard" and 0 as "free", every
custom link created through the UI with any blank money field offered that fee for free —
and the frozen agreement would have signed it that way. **Fixed:** `agorot()` now returns
NULL for null/undefined/blank input; an explicit `0` still means free.

## Broken or risky — NOT fixed (needs a product/security decision)

These were found by the audit but deliberately left unchanged, because each requires a
behavior decision by the operator. They are ordered by severity.

### F-07 · Resuming a saved draft silently drops custom-link pricing
`app/register/page.tsx:137-140` rebuilds the resume URL as `/register?resume=<token>` only,
discarding the server-provided URL that includes the `offer` token
(`app/api/registrations/draft/route.ts:81`), and never restores the round-tripped
`data.offerToken` into state. After resuming once, a parent who saved from a custom
(discount) link continues — and submits — at standard pricing. Related cosmetic bug: on
first save the client appends `offer=` a second time to a URL that already contains it
(`app/register/page.tsx:327`), producing `?resume=X&offer=T&offer=T`.

### F-08 · Admin can never see medical/emergency details in the UI
`app/api/admin/registrations/[id]/route.ts` decrypts and returns allergies, medical notes,
medications and emergency contacts in `registration.care`, and the client types the field —
but `StudentDrawer` (`app/admin/page.tsx:134-136`) never renders it. The only way to see a
child's allergy information is the signed PDF. The spec's student profile requires it.

### F-09 · "Payments missing" metric undercounts to zero
`statusLabel()` in `app/api/admin/registrations/route.ts:50-55` returns "Approved" before
checking for missing payments, so the dashboard `paymentsMissing` metric counts only
students who are *not yet approved* and also owe money. For the normal case — approved
students with unpaid months — the dashboard tile and the "payments missing this month"
attention row permanently read 0.

### F-10 · Settings PATCH can silently erase the recovery email
`app/api/admin/settings/route.ts:35-43` always runs the `UPDATE admin_users SET email = ?,
recovery_email = ?` statement. When `administratorEmail` is absent or empty in the request
body it writes `NULL`, wiping the recovery address. The current admin UI always sends the
field, but any other client (or a future UI change) that PATCHes settings without it will
destroy the recovery path. Recommend: only update the email when the field is present.

### F-11 · Hardcoded "Cash" label breaks when the method is renamed
`app/register/page.tsx:226-227,267` and `app/api/registrations/submit/route.ts:172,175`
gate the cash-responsibility reminder and the proof-upload exemption on the literal label
`"Cash"`. Payment-method labels are admin-editable; renaming or re-adding the method under
another name (e.g. "מזומן") silently disables the reminder and forces proof upload on cash
payers. Recommend keying on the method's `code` instead of its display label.

### F-12 · Custom-link expiry ignores the Israel timezone
The admin form sends `expiresAt` from `<input type="datetime-local">` without a zone
(`app/admin/page.tsx:157`); `lib/pricing.ts:34` parses it with `new Date(...)` in the
server's UTC context, so links expire 2–3 hours earlier than the administrator intended.

### F-13 · Proof-required toggle always writes to the active year
`SettingsPanel.save()` PATCHes `/api/admin/settings`, whose handler resolves the year via
`ensureCurrentRegistrationConfig` with no `yearId` (`app/api/admin/settings/route.ts:31`).
With a non-active year selected in the header dropdown, the toggle silently changes the
*active* year's setting instead.

### F-14 · Spec §13 security requirements not implemented in Settings
The spec requires that changing the administrator email "requires verification of the new
address" and changing the passcode "requires the current passcode or a verified recovery
flow". `app/api/admin/settings/route.ts` accepts both changes with nothing but an active
session — no current-passcode confirmation and no email verification round-trip. A hijacked
or left-open session can silently take over the account and redirect recovery.

### F-15 · Spec §12 WhatsApp helpers are essentially unimplemented
The spec describes seven prepared WhatsApp message templates (registration received,
missing information, missing proof, payment reminder, payment confirmed, group assignment,
session update) with auto-inserted names/amounts/links and an edit step. What exists is a
single "Copy WhatsApp details" button in the student drawer (`app/admin/page.tsx:136`)
that copies name/parent/phone, plus a cancellation `wa.me` link on the public page.
The templated-helper feature is missing.

## Incomplete features (backend exists, UI never uses it — or vice versa)

- **Registration fee never shown to the parent.** `app/register/page.tsx:34,218` fetches
  the registration fee from `/api/registration-config` but step 4 renders only monthly,
  June and security-check amounts. Parents sign without seeing the registration fee on screen.
- **Server-side student search unused.** `/api/admin/registrations?q=` exists, but the UI
  filters client-side over the first 250 rows (`LIMIT 250`), so search misses older records.
- **No way to cancel a session.** The parent schedule page and the printed schedule both
  render a "Cancelled" state, but the calendar UI never sends `status`, so no event can
  ever reach it.
- **Per-month price overrides unreachable.** `/api/admin/custom-links` accepts
  `monthOverrides` and `privateNote`; no form field exists for either.
- **Not editable after creation:** payment-method label/instructions (PATCH supports it,
  UI doesn't send it), per-year `securityCheck` amount, group weekday (group cards hardcode
  "Wednesday" and ignore `group.weekday`).
- **Nothing can be deleted.** No DELETE handler exists for groups, payment methods, custom
  links or schedule events — they can only accumulate.
- **Unreachable endpoints:** email-outbox retry (`POST /api/admin/email`), saved prompt
  history (`GET /api/admin/prompts`), logo metadata (`GET /api/admin/brand`), custom-link
  token rotation (`PATCH action:"rotate"`) — all implemented, no UI calls them.
- **UI stubs:** the "•••" profile-options button in the student drawer has no `onClick`;
  the proof preview shows a literal "IMG" placeholder instead of the stored image, though
  `/api/admin/files/[fileId]` serves it; the A4 preview on the register page shows
  "✓ I understand" on every section regardless of actual approval state; the parent
  schedule's "next session" data is returned by the API but never rendered.

## Minor / cosmetic

- **Dead code:** `app/chatgpt-auth.ts` (ChatGPT sign-in helpers) is imported nowhere.
- **Lint warnings:** 22 `@next/next/no-img-element` warnings across the landing, register
  and schedule pages. Intentional for the dual-runtime setup (the worker runtime serves
  `<img>` directly), but each `<img>` skips Next.js image optimization on Vercel.
- **Test coverage gap:** the end-to-end suite runs only on the D1/worker runtime. The
  Neon/Postgres adapter (`lib/vercel-runtime.ts`) is exercised only by the schema-migration
  test; its query-translation layer (`?`→`$n`, `INSERT OR IGNORE`→`ON CONFLICT DO NOTHING`)
  has no e2e coverage. Manual review found no dialect-specific SQL outside what it
  translates, and `ON CONFLICT (identifier_hash)` upserts are backed by the required unique
  index — but a Postgres-backed integration test would close the gap.

## Verified working (no action needed)

- Both builds compile every route; type check and lint are clean.
- Full registration flow on the worker runtime: standard + custom-link pricing frozen into
  the signed agreement PDF, draft save/resume tokens, proof upload, parent schedule links,
  schedule generation/finalization/PDF, Excel export, prompt studio, encrypted backups.
- All client fetches match an existing API route and exported HTTP method; all footer and
  navigation links (including `/accessibility`) resolve to real pages.
- All referenced static assets (photos, logos, favicon) exist under `public/`.
- Admin auth: rate-limited lockout, hashed session tokens, `HttpOnly; Secure;
  SameSite=Strict` cookies, server-enforced passcode length, first-login bootstrap from
  `CHOIR_ADMIN_PASSCODE`.
- Cron maintenance route requires `Authorization: Bearer $CRON_SECRET`, matching the
  Vercel cron configuration in `vercel.json`.
- `@vercel/blob` private `get()` usage matches the installed v2.8 API shape.
