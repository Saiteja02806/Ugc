# Background website analysis during onboarding

Status: implemented locally on 2026-09-09. Database transitions, real PostgreSQL concurrency, and related regressions are validated. Production migration, rollout, and authenticated acceptance are pending.

## User experience

After the website submission is validated and its analysis job is durably accepted, advance to the business identity screen. Keep a compact status strip above the identity and goal screens. The user can save both screens while analysis runs.

- Queued: "Your website analysis is queued. Keep going with your setup."
- Running: "Analyzing your website in the background. Keep going with your setup."
- Ready: "Website analysis complete."
- Failed: "We couldn't analyze your website." Provide retry and a manual-entry recovery path that retain the other answers.
- Status request unavailable: "We couldn't update the analysis status. Your saved details are safe." Do not treat a polling failure as an analysis failure or claim that the job is still running without evidence.

Use an accessible status region and an indeterminate activity indicator. No invented percentage or completion time. Ordinary polling must not repeatedly announce identical text to assistive technology.

If the user clicks the final submit button before analysis is ready, persist the submitted answers and display "Your details are saved. We're finishing the website analysis." Complete setup automatically when both inputs are ready, including when the browser has closed. Opening the dashboard continues to require a completed profile. Analysis completion alone never submits the user's form.

## Findings that constrain implementation

| Evidence | Consequence |
| --- | --- |
| `app/api/business-profile/route.ts` already returns a job ID with HTTP 202 through `enqueueBusinessProfileSetupJob`. | Reuse the existing durable queue; the analysis engine does not need replacing. |
| `components/business-profiles/business-profile-onboarding.tsx` waits for a terminal job, hydrates all fields, and calls `moveToStep(2)`. | Separate analysis status from form-save status; remove completion-driven navigation and unconditional field hydration in the new flow. |
| The PATCH handler requires an existing profile before any identity or goal save. | Introduce server-owned draft persistence before allowing the next screens to save. |
| `lib/business-profiles/setup.ts` always calls `saveBusinessProfile` after analysis. Its update replaces context and resets completion, version, and step. | A draft-aware analysis job must persist analysis independently and must not use that profile-reset path. Fence legacy writes as well. |
| `lib/website-analysis/supabase.ts` already stores/retrieves analysis by source job and user, including duplicate-insert recovery. | Reuse saved analysis on retries. The relationship between active draft and accepted analysis still needs validation. |
| `lib/business-profiles/onboarding-access.ts` checks completion, name, and goals; it does not independently require an analysis ID. | Do not expose a placeholder profile as completed. Finalization must explicitly require persisted, validated analysis for the current attempt. |
| The database completion trigger creates the free-trial entitlement using `onboarding_completed_at`. | Mark completion only after the user submits and usable analysis is persisted. Repeated completion must retain the original timestamp and entitlement. |
| The completion route currently calls `prebuildTrendingAfterOnboarding` after the profile write. | Persist a recoverable finalization request before this boundary so a process failure cannot silently lose content preparation. |
| The existing paid prebuild endpoint requires an active matching paid subscription. | It cannot be used unchanged to finish onboarding for free-trial users. |
| Job tracking in the onboarding UI currently relies on a URL parameter; goal autosave requires a profile and idle status. | Resume from server-owned draft state, and decouple draft autosave from analysis status. |

## Proposed persistence and execution contract

1. Add an onboarding-draft record separate from the production business profile. Store authenticated owner, protocol version, active source attempt, source/job references, saved step, validated identity/logo data, goals, timezone, answer revision, submission state, and finalization reference. Use separate source-attempt and answer-revision fields: typing a name must not invalidate the analysis job.
2. Keep analysis status authoritative in the existing job/analysis records. The API returns a derived view of draft progress, analysis progress, and completion. A draft that has no completed production profile is a normal response in this protocol, not a profile-loading error.
3. Persist the job-to-draft association before dispatch can start execution. Make draft/job creation retryable after an interrupted request. Repeated submission with the same owner and persisted request identity must recover the same attempt; it must not depend solely on a browser `useRef`.
4. Route identity and goal writes for the new protocol to the draft. Authenticate using the existing Firebase user and retain logo ownership/content validation. Apply field-specific writes with revision checks; stale autosaves cannot overwrite newer answers or reopen a submitted draft.
5. On analysis completion, persist the analysis and attach it only if owner, source attempt, and job still match. Keep the analysis result separate from user answers. Prefill an analyzed name only if the user has not edited that field, including edits still in the browser.
6. Both the final form submission and accepted analysis completion perform the same atomic readiness check. Under a consistent lock/version policy, create one durable finalization request only when the active draft is submitted and its analysis exists. Creating that request must commit with the readiness transition. This covers either arrival order and eliminates the gap where neither side schedules completion.
7. Implement an idempotent server finalizer, using the existing durable job infrastructure. In one database transaction, verify the active attempt/submitted revision and ownership, apply the validated user name and goals to the saved analysis using existing normalization semantics, preserve the optional validated logo and timezone, and write the completed profile plus the draft's completion reference. A replay returns the same completion; it must not increment profile versions or reset the trial again.
8. The durable finalizer also attempts the existing onboarding feed preparation and records its outcome. If the process fails after profile completion, retry the remaining preparation using the committed profile. `prebuildTrendingAfterOnboarding` currently returns a failed result after catching an error; the finalizer must recognize that result and retain retryable work rather than reporting successful preparation. Profile completion and feed readiness remain distinct, as they are today.
9. Do not keep a database transaction open while crawling, calling AI, inspecting an uploaded image, or dispatching Cloud Tasks. Validate external inputs first, then verify the expected revision inside the transaction. Queue publication failures remain recoverable from persisted work.

New draft tables and RPCs need explicit service-role privileges and restricted execution. Client requests continue through authenticated server routes; do not assume a Firebase UID equals Supabase `auth.uid()`. Enable RLS for exposed tables and verify anonymous/other-account access is denied. Browser-visible responses must use the existing safe public error conventions.

## Changes of source, edits, and compatibility

- Replacing the website creates a new source attempt and supersedes the old one. Older results may remain stored but cannot update the current draft/profile or initiate completion. Best-effort cancellation saves work; the server-side attempt check provides correctness.
- Retry the same failed job when retry is supported and the source has not changed. A polling/network error only retries status retrieval. Manual entry supersedes the failed website attempt while retaining the user's name/logo/goals.
- Persist the final submitted answer revision. While completion is pending, an explicit edit action withdraws submission before permitting edits; finishing again submits the new revision. If finalization already committed, return that completion instead of reopening it.
- Return to the last saved step on refresh or reopen. A return without the job URL parameter must still recover the draft. Unsaved file selections cannot survive a browser close; upload and validate the selected logo before acknowledging the identity step as saved.
- On sign-out/account switch, clear the active UI/cache subscription. Every draft, analysis, job, and finalizer lookup validates the authenticated or persisted owner.
- Start rollout with fresh allowlisted accounts. Their website, mobile-app, and manual intake use the same draft protocol and existing analysis engines; manual recovery preserves identity and goals. Existing profiles and accounts with legacy setup jobs stay on the original flow. No completed accounts are migrated.
- Legacy endpoints and worker callbacks must refuse stale writes for an account enrolled in the new protocol. Do not rely only on a browser feature flag. In particular, an old tab or queued legacy job must not call the unrestricted profile-reset writer against a new attempt.
- Use a persisted protocol version per attempt. A rollout flag controls creation of new attempts, not execution/resume of existing ones. Disabling enrollment must leave the handlers needed to finish in-flight attempts deployed.

## Implementation order

1. Add draft persistence, restricted RPCs, revision/attempt checks, and atomic finalization scheduling. Generate an additive migration using the repository's Supabase workflow; do not modify the baseline or backfill completed customers into new onboarding.
2. Add draft-aware analysis processing and the recoverable finalizer with compatibility guards. Update the relevant app/worker operation contracts if introducing a finalization operation; do not repurpose the paid-subscription-only endpoint.
3. Add draft APIs and a versioned resume response. Preserve the legacy response contract for existing sessions. Validate create, save, submit, retry, supersede, and resume behavior before changing navigation.
4. Change the onboarding UI to independent analysis/form states, server-backed progress, and the top status strip. Keep the three-step flow and existing logo/name/goal validation.
5. Verify migrations and backend behavior, then enable the UI only for a controlled production account. Update `CAROUSEL_CONTEXT.md` if implementation changes the profile-to-content preparation architecture described there.
6. Verify the production flow on `https://www.getugcpilot.com`, expand enrollment after acceptance passes, and retain a rollback that preserves in-flight drafts.

## Required acceptance tests

| Scenario | Required result |
| --- | --- |
| Queue accepts slowly or rejects the request | Advance only after durable acceptance; show a useful retry state on rejection. |
| Analysis finishes before identity is entered | Status changes to complete; current step stays put; untouched fields may prefill. |
| Analysis finishes during typing, logo upload, or a goal autosave | No local edit loss, backward navigation, or stale field replacement. |
| User submits before analysis finishes | Answers are saved; a later result schedules completion without another click. |
| Analysis completes before final submit | No trial or completion until final submit; submit schedules the same finalizer. |
| Analysis and submit commit concurrently | Exactly one durable finalization request and one logical profile completion. |
| Refresh, browser close, reopen without job parameter | Saved step, logo, answers, job state, and submitted state recover from the server. |
| URL A is replaced by URL B; A finishes last | Only B can finalize. A cannot change the profile or restart onboarding. |
| Two tabs, duplicate clicks, duplicate queue delivery | Stale writes are rejected; no duplicate profile version, trial, or feed reservation. |
| Analysis fails, retries, or switches to manual input | Preserve answers, distinguish failure from status-fetch errors, reject superseded results. |
| Process dies at each persistence/dispatch boundary | Recover committed work; do not lose accepted answers or required finalization/preparation. |
| Failure after profile commit but before feed preparation | Resume preparation from the completed profile without restarting analysis or trial. |
| No business name/goals, invalid logo, or no validated current analysis | Server refuses completion regardless of client state. |
| Account switch or forged draft/job/logo identifiers | Deny cross-account read/write and prevent stale cache display. |
| Existing completed account, legacy pending job, old client tab | Preserve existing access and prevent legacy callbacks from resetting a new profile. |
| Feature flag disabled mid-onboarding | New enrollment stops; existing protocol sessions still resume and complete. |
| Production mobile and desktop | Top strip remains visible and readable without obstructing inputs; screen-reader announcements are restrained. |

Use behavior tests around database state transitions and fault injection, not only source-text regex assertions. Exercise true simultaneous database sessions for concurrency acceptance; an in-memory sequential state model alone is insufficient. Check type/build/lint for touched code and run the existing related regression suites.

## Validation completed and limits

- Reviewed the UI, API, analysis persistence, worker callback, profile writes, access gate, logo ownership validation, schema baseline, free-trial trigger, and job recovery interfaces.
- The prior review ran 40 onboarding/analysis tests: 40 passed. This review ran 25 additional account-isolation, free-trial, public-job-contract, and delivery tests: 25 passed. These are existing regression tests, many using source contracts; they do not validate unimplemented concurrent behavior.
- Read the installed Next.js route-handler and `after` guides. `after` remains bounded by route duration; retain durable worker execution for required setup work.
- Checked official Cloud Tasks documentation: executions are not ordered, and duplicates can occur. Therefore correctness depends on persisted attempt identity and idempotent finalization, not queue ordering.
- Checked current Supabase function/security guidance and changelog. Explicit grants for the new table/RPC are part of migration verification. Local Node is v24.13.1.
- Implementation now includes the additive migration, authenticated draft API, draft-aware analysis worker callback, durable finalizer, top status strip, and versioned resume flow. Production schema/data and deployments have not been changed.
- Fifteen database behavior tests cover service-role execution, ownership, both completion orders, manual recovery, legacy compatibility, stale writes, and injected queue-insert failure. Three tests using independent PostgreSQL sessions pass for concurrent saves, simultaneous submission/analysis, and duplicate finalizers. Fifty-eight onboarding/auth/job/trial and rollout tests pass. These tests use synthetic data, not production customers.
- The production build (including TypeScript) and targeted ESLint pass. Browser previews at desktop and mobile sizes render the status strip and editable identity/goals without browser errors; the strip stays at the top while scrolling. Preview checks do not exercise the authenticated API-to-worker flow. That final acceptance remains a production release gate.

## Release and rollback

1. Keep new enrollment disabled (the default) while deploying the compatible application and additive migration `20260909165333_add_background_business_onboarding.sql`. Deploy all new handlers together; the existing GCP media-analysis worker forwards the unchanged operation and needs no new task type.
2. Leave `BUSINESS_ONBOARDING_BACKGROUND_ENABLED` unset and add one fresh test account's Firebase UID to server-only `BUSINESS_ONBOARDING_BACKGROUND_USER_IDS`. Explicit `false` disables even the allowlist; `true` enrolls all fresh accounts.
3. Verify the full authenticated flow at `https://www.getugcpilot.com`: website acceptance opens identity before analysis finishes; name/logo/goals persist; refresh resumes; errors preserve answers; exactly one completed profile/trial and recoverable feed preparation result. Verify desktop and mobile using the deployed UI.
4. Enable wider enrollment only after that canary passes. For rollback set the enrollment flag to `false` and retain the new handlers and migration so existing drafts can finish. Do not roll back to application code that cannot resume draft sessions.

The final step may still briefly show “Your details are saved” when the user finishes all forms before analysis. It is no longer necessary to block the first screen for the full analysis. Unsaved typing and unsubmitted logo selections are warned about on page close; acknowledged identity and goal saves survive refresh.

## References

- [Cloud Tasks execution ordering and duplicates](https://docs.cloud.google.com/tasks/docs/common-pitfalls)
- [Supabase database functions and privileges](https://supabase.com/docs/guides/database/functions)
- [Supabase changelog](https://supabase.com/changelog)
- Installed framework docs: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md` and `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`.
