# Explore overview release — 17 October 2026

Create → Your videos now reuses Hook's two-clip overview even before an opening
is selected. Create → Your Slides reuses the mounted slideshow sequence and its
text overlays. Editing, Add slides and earlier generation results remain
available without replacing an existing draft automatically. Starting/recovering
a slideshow job or recreating one slide reveals generation progress; users can
return to the sequence while polling continues.

The release is based on production main `74370aad`. All 196 intentional changed
workspace paths were audited: 189 already match production, and seven files
contain this follow-up. No intentional source path is deferred. Existing gallery,
font, prompt, saved-demo, image-picker, Trending and thumbnail changes are retained.

## Order and verification

Validate the isolated checkout, hold automatic Git builds, commit and push.
Verify migration ledger and unchanged worker source/digest/readiness, then stage
website and MCP production builds from the exact commit without moving domains.
Only promote after both builds pass, then restore prior Git build settings and
check production identities, domain mappings, public routes and authentication
boundaries. Worker source and database migrations are unchanged; no worker rollout
or SQL execution is needed if the existing production identities verify.

Local checks and fixture browser evidence are separate from production acceptance.
No paid generation, scheduling or publishing is used for deployment validation.
Authenticated UI acceptance is reported only if checked on the real production site.

## Exclusions

No intentional path is excluded. Ignored local-only artifacts stay outside Git:
`.env*` (except tracked `.env.example`), `.tools/**`, `.tmp/**`, `.vercel/**`,
`.release-worktrees/**`, `node_modules/**`, `worker/node_modules/**`, `.next/**`,
`worker/dist/**`, `*.tsbuildinfo`, logs, generated previews, private Terraform
state/variable/plan files and Supabase local state. These contain credentials,
local tools or generated data. Exact deployment/worker receipts are stored under
ignored `.tmp/explore-overview-release-20261017/` after observing each result.

## Completed preflight

The isolated release passed 180 targeted checks, Next.js route type generation,
application TypeScript and scoped ESLint. The actual editor/Add slides browser
fixture passed Create/Edit text continuity, adding from Create, saving/reloading,
mouse/touch reorder and mobile layout. The broader Explore run covered 1,152
cases: 1,149 passed initially; three Windows sandbox process/file-access failures
all passed in the separate 28-test media/staging rerun outside the sandbox.

Production migration parity is verified at 143 entries with no SQL executed.
All six production worker services and both jobs were verified healthy on the
existing immutable image; the release worker tree is identical to its build
commit `92bd33d1797a55cbb9640e5dcd0a57d1146a56cf`.
Local browser access is disabled in Work settings, so signed-in production UI
acceptance cannot be claimed. Hosted build/domain verification is recorded in
local receipts only after completion.
