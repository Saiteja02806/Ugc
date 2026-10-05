# AI character builder

Latest local change, October 5, 2026: completed AI character images belong to
History rather than being restored into every new workspace visit. This history
and session change is not deployed. It requires no migration or worker change.
The preceding prompt-driven release is deployed at commit `6e82f4c`; its additive
RPC migration was applied as hosted version `20261005140223`.

Local validation for the prompt-driven change passed 59 character/API/session
tests, 8 database tests (including historical credit tests), 3 provider-boundary
worker tests, full application TypeScript, worker build and scoped ESLint. The
provider tests stub external services; no paid image was generated. Commands:

```sh
node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/characters/identity.test.ts lib/characters/identity-routes.test.mjs lib/characters/generation.test.mjs lib/characters/reservation.test.mjs lib/characters/client-session.test.ts lib/characters/access-policy.test.ts components/characters/use-character-builder.test.mjs
node --test scripts/character-prompt-driven-db.test.mjs
cd worker
npm run build
node --experimental-test-module-mocks --test src/jobs/generate-image.test.mjs src/jobs/generate-character-image.test.mjs
```

The previous complete production release, commit f1b5164, includes Explore,
Audio, Trending and shared character credits. Gemini migration 20261003045651
is already applied and must not be replayed under a historical alias.

## Experience

Explore has a compact, linked character card with three supplied example
portraits. The development Explore layout places the card on the left and six
Quick start links in three columns on the right. Existing unfinished workflow
previews remain gated to development.

`/explore/build-character` opens directly into the image workspace. It uses the
existing AI Studio composer, image-model setting and accessible dialog. There
is no first-influencer suggestion or “Create it for me” action. Generation
requires the user's description. The empty workspace pairs a short introduction with
four supplied portrait examples, each retaining its natural 9:16 proportions.
The introduction and portraits are centered; the two captions beneath the
portraits are removed.
These different characters are inspiration, not identity variations or selected
references. On small screens, the portraits appear below the introduction.
The screen does not ask Male/Female, display a Creator pill or submit a hidden
gender preference. User descriptions go directly to the selected image provider.
The composer shows the image model, a fixed 9:16 portrait pill and an image icon
with the selected number. The selector defaults to 1 and offers affordable
quantities up to 3 per batch. Users may submit further batches while credits
remain. The usage line shows the selected quantity, its total credit cost and
the shared available balance. A changed balance cannot silently change the
selected quantity; generation locks until it is affordable again.
No business-context panel, internal brief or generated prompt is shown.

The composer has no character counter. The API, reservation RPC and image worker
accept descriptions up to 32,000 characters, including descriptions above the
old worker's 2,000-character limit. Oversized requests fail before charging
credits rather than being summarized or truncated. A 1 MiB transport bound also
protects the API. Surrounding whitespace is trimmed; all remaining text,
paragraphs and final details are preserved exactly. No business facts, inferred
appearance, creator specification, master prompt or realism instructions are added.

The character model selector offers GPT Image, Gemini 3 Pro, and Nano Banana 2.
The two Google models use the server-side `GEMINI_API_KEY` through Google's SDK,
with no Runway image route or fallback. Gemini 3 Pro selects `gemini-3-pro-image`
independently of the Nano Banana 2 override (`GEMINI_IMAGE_MODEL`, default
`gemini-3.1-flash-image`). Pro stores the accepted Google interaction ID so retries
can retrieve that interaction instead of creating another paid request.

The owner's current policy is two lifetime free generation credits shared
across Explore. At the default cost of 1 credit per image, an unused free balance
funds two individual images or one two-image batch. Active paid and complimentary
plans use their existing shared credit balance. Custom descriptions and owned
saved-character variations also use credits, without a separate paid-plan gate.
Configured image costs still apply; video costs remain duration-based.

Every new character image reserves credits through the same billing RPC as
Explore image/video generation. Admission is atomic for the whole batch.
Job-creation failures do not consume credits. Existing settlement
charges completed images and refunds failed/cancelled images exactly once.
Replaying an admitted request recovers the same jobs without another charge.

Completed candidates are compact, left-aligned portrait cards. Selecting the
image saves it; there is no separate “Use this influencer” button. My influencers
refreshes the owned saved-reference list whenever opened. It shows sign-in,
loading, empty and retry states and stays visible on mobile. Switching saved
influencers is disabled during an active generation. Selecting one lets a user with credits request a new setting,
outfit or pose while preserving its facial identity. Reference images help the
selected model keep identity; visual similarity still depends on model output.

## Current session and history

Results generated during a mounted workspace visit remain visible for that
visit. On reload or leave-and-return, completed results are hidden and the
workspace starts clean. The durable client receipt still recovers uncertain
admissions and unfinished jobs; a recovered unfinished batch stays visible when
it finishes during the current visit. Historical completed batches never become
foreground results merely because a status request completes.

The History button loads completed, owned character jobs in cursor pages of 25,
including candidates that were never selected and images saved to My influencers.
Jobs and ready media are checked against the same ownership and output provenance
as character selection. Deleted images, unrelated AI Studio generations and
untrusted storage URLs are excluded. Legacy planner prompts are not exposed;
prompt-driven history shows the user's own description. No image is copied or
deleted, and viewing history makes no generation or credit reservation request.

Opening a history entry explicitly previews that image. Its existing selection
flow can save the original asset to My influencers without regeneration. Back
to session restores the current foreground batch. New session clears foreground
results, prompt and selected reference while retaining durable history and saved
influencers. Session reset and historical selection are unavailable during an
active or uncertain request.

`GET /api/characters/history` verifies the Firebase account, ignores supplied
owner IDs, validates cursor timestamps and UUIDs before constructing filters,
uses stable `(created_at, id)` ordering and returns `Cache-Control: no-store`.
It uses two bounded queries per page; it does not query each image separately.

Local validation for this history change: all 87 character tests passed, along
with full TypeScript, scoped ESLint and the optimized application build. A
read-only query of hosted storage returned the existing saved portrait and no
images for an unrelated account; no generation, credit or media writes were
performed. Local browser checks covered History opening, signed-out messaging,
desktop and 375px layouts without console errors or horizontal overflow.
Signed-in browser acceptance on the production domain remains pending because
this new change has not been deployed.

## Server flow and contracts

1. Verify the Firebase account and strict request schema. Only `mode: "custom"`
   with a nonempty user prompt is accepted; assisted calls are rejected.
2. Recover an admitted v2 batch for the same account/request key without another
   credit charge. A legacy v1 fingerprint cannot be reused as a v2 request.
3. Determine access and required credits. For a user-selected saved influencer,
   verify the owner's reference image. No business profile or planner is read.
4. Create 1, 2 or 3 jobs with the identical user prompt. New jobs record
   `characterVersion: 2`, `promptSource: "user"`, and null business context IDs.
   They contain no generated character specification, gender or private plan.
5. GPT Image, Gemini 3 Pro and Nano Banana 2 receive that prompt unchanged. If
   the user selected a saved influencer, the image is the only additional visual
   reference; no identity preservation instructions are appended to the text.
6. Reserve shared free/paid credits and create all selected jobs in one database
   transaction. Dispatch the durable jobs through
   the existing queue recovery path.
7. Return only safe status and owned durable image outputs. Save selected identity
   by promoting the existing media asset into the influencer collection.

| Endpoint | Contract |
| --- | --- |
| `GET /api/characters/access` | Owned paid/free eligibility, count and cost |
| `GET /api/characters/preferences` | Legacy owned `{seen,gender}`; no longer read by this workspace |
| `POST /api/characters/preferences` | Legacy strict `{gender?}`; retained for compatibility |
| `POST /api/characters/generate` | `{mode:"custom",model,prompt,imageCount?,idempotencyKey,referenceCharacterId?}`; numeric `imageCount` is 1, 2 or 3; returns HTTP 202 with that many `{jobId,generationId}` receipts |
| `GET /api/characters/status?jobId=…` | Owned character job status and public image output; no planner input |
| `POST /api/characters/select` | Strict `{jobId,name?}`; never accepts URL, owner or specification |
| `GET /api/characters` | Owned `{id,name,url,model,gender,createdAt}` records; v2 gender is null rather than inferred |

Assisted requests allow an omitted gender and forbid custom prompts/references.
Custom requests require a prompt. All three supported image models are explicit enum values.
Client-provided business facts, image URLs, costs and identity specs are
rejected. Business facts and user descriptions are data in the planner's
instruction boundary. Specifications require visibly adult creators aged 21–80.

The prompt-driven release uses the service-only
`character_create_reserved_generation_batch_v2` RPC. Its additive migration leaves
the previous reservation function unchanged so deployment and rollback do not
interrupt the previous web release. New app requests only use v2.

## Persistence and ownership

Migration `20261002192039_character_generation_batch.sql` adds the private
`character_free_generation_allowances` table and service-role-only atomic batch
RPC. The table has RLS enabled and no browser-role grants. The privileged
function has an empty search path and explicit revocation of PUBLIC, anon and
authenticated execution. Firebase verification supplies the server-owned user ID.

Migration `20261002200207_character_preferences.sql` adds the private,
RLS-enabled `character_preferences` table. Only the service role can read or
write it. Preferences are per Firebase account, so they survive a browser or
device change. The legacy preference APIs and client storage helpers remain
available for compatibility; the current workspace no longer reads or writes
them or displays first-visit gender onboarding.
Migration `20261003041318_character_allowance_privileges.sql` narrows inherited
Supabase service-role allowance-table grants to SELECT and INSERT.

Migration `20261005045851_character_shared_generation_credits.sql` replaces
the fixed paid batch size and separate character allowance with shared-credit
admission for 1–3 images. It preserves existing zero-cost job replays and blocks
new legacy allowance claims. Historical allowance rows remain intact.

Batch fingerprints bind mode, gender, model, custom prompt, reference ID and quantity.
Each candidate has its own durable job and reservation. The RPC uses consistent
batch/user advisory locks and creates one, two or three jobs transactionally. A
failure creating/reserving any child rolls back the entire admission. Existing
billing settlement charges completed jobs and refunds failed/cancelled ones.
Free-credit jobs have reservations but no Dodo usage event. Omitted quantities
retain old-client defaults and fingerprints for replay compatibility.

The selected character ID is the existing media asset UUID. Compare-and-set
promotion makes repeated/concurrent selection idempotent. Selection verifies
owned completed character provenance, generated-image source, storage key, URL,
model and generation ID. The immutable source job retains the specification,
internal brief, business-profile ID/version and chosen model. Subsequent requests
derive the trusted image/specification from that source; the browser supplies
only the saved character ID. New refinements use the saved reference image and
the user's exact description, without a textual identity rewrite. Historical v1
specifications remain readable solely for compatibility with existing identities.

The client keeps a versioned account-scoped session containing job receipts,
selected ID and an uncertain submitted request key. It stores no token, business
profile, private brief or server specification. It retries uncertain submissions
with their original key, checks the expected account when obtaining a token,
polls owned status, preserves successful sibling outputs, and blocks replacement
while a job's outcome is unknown. Synchronous duplicate submissions share a
single request. List-query cancellation protects newly saved identity from stale
responses. Local development `preview=1` bypasses presentation routing only;
all character APIs always verify authentication and policy.

## Validation and release

Reproduce checks from the repo root:

```powershell
npx tsc --noEmit --incremental false
npx eslint components/characters components/explore/ai-character-card.tsx components/explore/explore-workspace.tsx app/explore/build-character lib/characters app/api/characters
node scripts/test-character-generation-migration.mjs
node scripts/test-character-preferences-db.mjs
node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/characters/identity.test.ts lib/characters/identity-routes.test.mjs lib/characters/generation.test.mjs lib/characters/reservation.test.mjs lib/characters/client-session.test.ts components/characters/use-character-builder.test.mjs lib/characters/preferences.test.mjs
```

Validation passed: 58 character behavior tests, 16 local database groups, 24
shared composer checks, existing Hook/Phone preview checks, full TypeScript, scoped ESLint and diff
whitespace checks. All five actual local API routes returned HTTP 401 for
unauthenticated requests before processing any generation or selection.
Browser review at 1280x900 verified the three-column Quick start layout,
Explore-to-character navigation, dismissal recovery, gender selection and
switching image models. At 390x844 and 320x568 both screens retained their
controls without horizontal overflow. The small-screen composer overlap was
fixed by letting the workspace own sticky positioning. No browser warnings or
errors were recorded. Review screenshots are in `.tmp/explore-character-review`.

The follow-up browser review retained a 20,735-character description with no
counter or invalid-input state. Choosing Female and Continue closed first-visit
onboarding; reload and Explore re-entry did not reopen it. The 390x844 composer
review is saved as `character-no-input-limit-mobile.jpg`. Actual local preference
GET and POST routes both returned HTTP 401 without authentication. Cross-device
account persistence is covered by deterministic API/client/database tests and
still requires the new migration and hosted acceptance before release.

The database tests execute the actual migration and current billing/job
functions in local PGlite, including concurrent claims, all-or-nothing rollback,
replay, settlement, function privileges and RLS. Backend/client tests use
deterministic provider/network fixtures, so they spend no image credits.

Release prerequisites: apply the reviewed character migrations to the target database,
including `20261003045336_character_gemini_3_pro_image.sql`,
`20261003110411_one_time_free_generation_credits.sql`, and
`20261005045851_character_shared_generation_credits.sql`,
before releasing the app; keep existing Firebase, business-profile, image-worker,
OpenAI planner, image-provider, storage and Cloud Tasks configuration available.
The optional `OPENAI_CHARACTER_PLANNER_MODEL` defaults to the project's business
context planner model. No worker deployment or new worker job type is required.

Final hosted acceptance must use `https://www.getugcpilot.com`, per AGENTS.md:
verify a real free account can spend two shared credits on images and cannot
overdraw; spend a credit in another Explore generator and confirm the character
screen reflects the lower balance. Verify paid quantities 1, 2 and 3 charge the
expected total cost and can repeat while credits remain. Select a candidate,
refresh, refine and confirm identity continuity;
exercise a failed job and retry; confirm an unrelated account cannot read or
select those jobs/references. Confirm no gender question appears on entry,
reload or device change, and that a long description reaches the planner.
Local layout and fixture tests do not confirm
provider quality or hosted integration behavior.

## Google model follow-up verification, October 3, 2026

The local character UI and API now accept all three models. The additive model
migration was applied to the shared database; browser RPC permissions remain
revoked. This follow-up did not deploy the frontend or change Explore visibility.
The hosted worker already supports both Google model identifiers.

Validation passed: 59 character behavior tests, 12 generation database groups,
19 worker/provider/image tests, Next.js type checking, worker compilation, and
scoped ESLint. Tests cover Google character selection and restored references,
long prompts for all models, one free image regardless of model, paid candidate
counts, exact Pro model routing, and recovery without duplicate submissions.

Two isolated verified free test accounts created real images through the local
character API and hosted Google worker, one per model. Both completed with a
720×1280 PNG, Gemini provider record and Google interaction ID. Generation replay
reused the job; another free request was denied. Saving twice preserved the media
ID, and fresh sign-in returned the saved influencer with its selected model.
Temporary Firebase accounts and business profiles were removed. Job IDs:
`277b97b6-3cf5-4742-916a-93caaca89cd7` (Pro) and
`e7db0cd6-bc0d-4e9a-bbef-a0b516ffe4f4` (Nano Banana 2).

An optional direct interaction lookup with the local operator key returned 404;
the completed worker records and character API responses were verified instead.
Browser automation remains unavailable for the local screen under its URL policy,
so the updated dropdown needs a manual refresh in the open tab. Production checks
still return 404 for Explore and its nested routes, including `preview=1`.

## Character-screen refinement, October 5, 2026

Added the four-portrait inspiration strip and explicit 9:16/image-count pills,
removed gender onboarding, and refreshed the library when My influencers opens.
Assisted requests now work without a gender input; the server still owns free
allowance, paid count, credit cost, adult specifications and identity preservation.
Generated result previews retain the full 9:16 image without cropping.
The four approved workflow-cover videos and their catalog mappings are unchanged.

Validation passed: full TypeScript, scoped ESLint, and 48 deterministic
generation, identity, ownership, session and client-hook tests. The new test
checks free and paid assisted requests with no gender override, including batch
size, credit/allowance policy and idempotent recovery. Local browser checks cover
all four loaded portraits, mobile layout without horizontal overflow, image-model
selection, the image-count explanation and signed-out My influencers behavior.
Review images are in `.tmp/explore-character-review/2026-10-05`.

This refinement is local and has not been deployed. The live production
character URL redirected to sign-in during this review; the browser had no
authenticated session. This differs from the current checkout's production
Explore gate. Authenticated hosted acceptance of the updated screen remains
pending its eventual release. Fixture tests do not establish real provider
quality or production library contents.

## Shared credits and centered layout, October 5, 2026

This revision supersedes the older one-image character allowance and fixed
three-image paid batches described in historical validation above. The default
UI quantity is 1; the icon-and-number selector offers affordable counts up to 3
per request. Free accounts with an unused two-credit balance can choose 1 or 2
at the default image cost. Paid accounts can repeat their selected batch while
their balance permits it. No credits or requests are created by the selector.

The actual billing and character RPC migrations passed 11 local PostgreSQL
tests covering shared image/video spending, whole-batch rollback, replay,
legacy-job compatibility, per-image settlement, refunds and restricted RPC
permissions. Character access, generation, ownership, session and hook tests
passed, including configured costs and restoration of the selected quantity.
The existing five shared-subscription access tests passed as well.

TypeScript and scoped ESLint passed. Local browser review confirmed the centered
intro, removal of both portrait captions, numeric quantity selection and no
horizontal overflow at 390px and 320px. My influencers opens its signed-out
state correctly. Screenshots: `character-centered.jpg` and
`character-centered-mobile.jpg` in `.tmp/explore-character-review/2026-10-05`.

The new migration is prepared but has not been applied to production. Release
it before the updated API/frontend. Real authenticated production generation
and saved-library acceptance remain pending; local tests spent no user credits.
