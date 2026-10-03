# AI character builder

Implementation and internal release, October 3, 2026.

Explore is hidden in production: its navigation entry is omitted and `/explore`
and every nested route return HTTP 404, including `preview=1`. The character
APIs retain normal verified-account authentication and ownership checks. This
release includes the character workspace and backend; the development Explore
catalog, other workflow previews and unrelated unfinished checkout changes are
deferred. Existing production image workers remain unchanged.

## Experience

Explore has a compact, linked character card with three supplied example
portraits. The development Explore layout places the card on the left and six
Quick start links in three columns on the right. Existing unfinished workflow
previews remain gated to development.

`/explore/build-character` opens directly into the image workspace. It uses the
existing AI Studio composer, image-model setting and accessible dialog. Above
the composer, a dismissible suggestion contains only “Let UGCpilot create your
first influencer” and “Create it for me.” The assisted action remains in the
composer after dismissal. A fresh visitor is asked Male/Female once on entry,
with Continue saving the preference. Closing the dialog also records that it
was seen; an unchosen gender remains available inline rather than reopening
the dialog. Later assisted generations reuse the saved choice. Existing saved
characters or generation sessions skip onboarding. The composer shows the
generation count and any credit cost. No business-context panel, internal brief
or generated prompt is shown.

The character chat has no character-count limit or counter. Full descriptions
reach the planner, including inputs longer than the previous 1,000-character
and 12,000-character guards. A 1 MiB API transport bound protects request size;
the planner still produces concise structured instructions for the image worker.

The owner clarified that free users get one free AI image generation. The
character flow implements one assisted image per Firebase account. An active
paid plan generates three candidates using its shared image credits. Custom
prompts and saved-character variations require a paid plan. This is a dedicated
character allowance; it does not change the generic AI Studio or Trending trial.

The allowance is claimed only when a durable image job is admitted. Planner or
job-creation errors leave it available. Worker retries recover the same job; a
terminal failed/cancelled generation retains the claim. Replaying an admitted
request recovers that same job without another allowance or credit reservation.

Completed candidates can be saved using “Use this influencer.” My influencers
lists saved references. Selecting one lets a paid user request a new setting,
outfit or pose while preserving its facial identity. Reference images help the
selected model keep identity; visual similarity still depends on model output.

## Server flow and contracts

1. Verify the Firebase account and strict request schema.
2. Recover an existing batch for the same account/request key before planning.
3. Determine free/paid access and required credits, then load the owned business
   profile and, for variations, a saved owned reference.
4. Reduce the profile to relevant creative facts. The Character Planner produces
   a short private brief and three structured adult specifications. Free jobs use
   the first candidate; paid jobs use all three.
5. Render fixed realism instructions with natural skin texture, ordinary clothing,
   everyday settings and smartphone framing. The existing worker handles GPT Image
   or Nano Banana 2. Every prompt respects its 2,000-character limit.
6. Reserve paid credits and create all jobs in one database transaction, or claim
   the one free allowance and create one job. Dispatch the durable jobs through
   the existing queue recovery path.
7. Return only safe status and owned durable image outputs. Save selected identity
   by promoting the existing media asset into the influencer collection.

| Endpoint | Contract |
| --- | --- |
| `GET /api/characters/access` | Owned paid/free eligibility, count and cost |
| `GET /api/characters/preferences` | Owned `{seen,gender}`; wait for this before first-visit onboarding |
| `POST /api/characters/preferences` | Strict `{gender?}`; `{}` marks seen without clearing a saved choice |
| `POST /api/characters/generate` | `{mode,model,idempotencyKey,gender? ,prompt?,referenceCharacterId?}`; returns HTTP 202 with one or three `{jobId,generationId}` receipts |
| `GET /api/characters/status?jobId=…` | Owned character job status and public image output; no planner input |
| `POST /api/characters/select` | Strict `{jobId,name?}`; never accepts URL, owner or specification |
| `GET /api/characters` | Owned `{id,name,url,model,gender,createdAt}` records |

Assisted requests require gender and forbid custom prompts/references. Custom
requests require a prompt. Both supported image models are explicit enum values.
Client-provided business facts, image URLs, candidate counts and identity specs
are rejected. Business facts and user descriptions are data in the planner's
instruction boundary. Specifications require visibly adult creators aged 21–80.

## Persistence and ownership

Migration `20261002192039_character_generation_batch.sql` adds the private
`character_free_generation_allowances` table and service-role-only atomic batch
RPC. The table has RLS enabled and no browser-role grants. The privileged
function has an empty search path and explicit revocation of PUBLIC, anon and
authenticated execution. Firebase verification supplies the server-owned user ID.

Migration `20261002200207_character_preferences.sql` adds the private,
RLS-enabled `character_preferences` table. Only the service role can read or
write it. Preferences are per Firebase account, so they survive a browser or
device change. Account-scoped local storage avoids repeated questions during
temporary network failures; guests have a separate browser-only preference.
Authentication must settle before either onboarding scope becomes active.
Migration `20261003041318_character_allowance_privileges.sql` narrows inherited
Supabase service-role allowance-table grants to SELECT and INSERT.
Slow reads cannot overwrite a new local choice. Preference save failures offer
an explicit retry and leave the local choice intact.

Batch fingerprints bind mode, gender, model, custom prompt and reference ID.
Each candidate has its own durable job and reservation. The RPC uses consistent
batch/user advisory locks and creates one or three jobs transactionally. A
failure creating/reserving any child rolls back the entire admission. Existing
billing settlement charges completed paid jobs and refunds failed/cancelled ones.
Free jobs have no credit reservation or Dodo usage event.

The selected character ID is the existing media asset UUID. Compare-and-set
promotion makes repeated/concurrent selection idempotent. Selection verifies
owned completed character provenance, generated-image source, storage key, URL,
model and generation ID. The immutable source job retains the specification,
internal brief, business-profile ID/version and chosen model. Subsequent requests
derive the trusted image/specification from that source; the browser supplies
only the saved character ID. Refinement freezes gender, age and appearance.

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

Release prerequisites: apply both reviewed character migrations to the target database
before releasing the app; keep existing Firebase, business-profile, image-worker,
OpenAI planner, image-provider, storage and Cloud Tasks configuration available.
The optional `OPENAI_CHARACTER_PLANNER_MODEL` defaults to the project's business
context planner model. No worker deployment or new worker job type is required.

Final hosted acceptance must use `https://www.getugcpilot.com`, per AGENTS.md:
verify a real free account creates one image and cannot claim another; verify a
paid account gets three distinct realistic candidates and the expected credit
cost; select a candidate, refresh, refine and confirm identity continuity;
exercise a failed job and retry; confirm an unrelated account cannot read or
select those jobs/references. Confirm the first gender question stays dismissed
after reload and a device change, and that a long description reaches the planner.
Local layout and fixture tests do not confirm
provider quality or hosted integration behavior.
