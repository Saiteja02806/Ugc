# Idle navigation and background network audit — 5 November 2026

Status: read-only production observations and local tests. No application code changed, no build, push, deployment, generation, publishing or configuration change.

## Findings in simple terms

1. **Explore prepares too many other pages before a click.** A live reload with the pointer at (1,1) fetched route data and JavaScript for workflows, Analytics, Scheduling, Library, Settings and other destinations. Requests carrying `next-router-prefetch: 1` confirm speculative route warming. Repeated path names can represent different Next router stages; they are not proof of duplicate business API operations. Local intent-only prefetch work already exists in `components/layout/workspace-navigation-feedback.tsx`, but this observation does not establish that candidate is active on the deployed site.
2. **Some status reads are slow despite small responses.** On the live Hook page, `/api/jobs` resource timings included 11,053ms and 10,861ms, with 327 transferred bytes each; other reads were approximately 0.5–1s. This establishes variable end-to-end latency, not its exact server/database/authentication cause. Response size is not the explanation for those waits. Request-stage/server tracing is still required.
3. **Opening-frame preparation can also wait.** One `/api/explore/hook-starting-frame` resource took 8,147ms and transferred 755,721 bytes. Local code identifies this POST as a source-frame read with authentication/provenance checks, not paid image generation. Pointer/focus intent can trigger it; two speculative frame requests maximum and client caching exist locally. Do not describe this as arbitrary idle generation or a catalogue-wide extraction loop.
4. **There is background polling, but the observed rate is bounded.** Local active-job queries poll every 30 seconds when empty and every 5 seconds when active. Individual unfinished jobs poll every 5 seconds, terminal jobs stop, and some consumers reuse active-list receipts. A measured 30-second Hook window issued one active-job read plus the frame-preparation request. A separate 30-second Explore idle window issued no requests. No continuous request storm was reproduced in those windows. Several open tabs multiply per-tab polling; cross-tab deduplication was not established.
5. **Five Explore cover videos load at entry.** Combined observed transfer was 1,590,013 bytes, about 1.59 MB. They completed quickly on this connection, but add initial bandwidth use. Cached JavaScript entries often reported zero transferred bytes; resource count alone must not be reported as fresh bandwidth or CPU cost. CPU saturation was not measured.
6. **Two Scheduling media reads are intentional.** Source loads `collection=influencer` and `collection=video&purpose=scheduling` in parallel. Identical pathname does not make them duplicate requests. Its 30-second drawer timer updates local preview time; it is not itself a network poll.

## Why buttons might appear unresponsive

Shared guarded routes wait for authentication and business-profile readiness. A URL can change while the screen still says `Opening your workspace...`; that differs from a click handler failing. The profile read locally has a 20-second deadline covering token, fetch and body; query retry can extend the overall experience. Existing authentication fixes and prior idle-read deadlines are local evidence, not proof that the original production idle failure is resolved.

Live warm clicks reached Hook, Analytics, Scheduling and Settings. An additional Settings click changed the URL in 100ms, initially showed the shared workspace loader, then rendered Settings/Account. Early automation attempts used an overly strict link name and an ambiguous nested-main locator; these locator errors were corrected and are not application failures. The actual 10–30-minute idle freeze was **not reproduced or ruled out**. No claim that every screen was exhaustively tested.

## Wiring evidence

| Boundary | Result | Evidence |
| --- | --- | --- |
| Actual navigation click → destination | VERIFIED, live warm session | Four representative destinations and a repeated Settings click |
| Auth/profile → workspace display | VERIFIED for successful Settings path; failure case OPEN | Temporary loader then Settings/Account; source guard/query inspection |
| Workflow polling → authenticated API → job list | VERIFIED in source and live network | `lib/jobs/background-job-client.ts`, `app/api/jobs/route.ts`; observed status reads |
| Exact slow-read server stage | NOT TESTED | Need correlated server request timing; browser duration alone insufficient |
| Frame preload → selected source read | VERIFIED in source; latency observed live | `use-starting-frame-preload.ts`, `hook-starting-frame-client.ts`, `hook-source-frame-api.ts` |
| Writes/jobs/provider execution | N/A | This audit does not create or replay writes or generate media |
| Real 10/30-minute background return and network loss | NOT TESTED | Essential remaining reproduction, including whether auth, route payload or main thread stalls |

## Recommended order

1. Verify the existing local intent-prefetch candidate against the deployed request pattern before releasing it. Preserve hover/focus warming and normal navigation; do not remove all prefetch indiscriminately.
2. Capture a real long-idle failing click with request method/path/status, queued time, TTFB, auth/profile state and long-task timings. Keep credentials and response bodies out of the report. Separate click failure, route loading, auth restoration and main-thread blocking.
3. Correlate the slow job/frame reads with server timings before changing queries or infrastructure. Assess narrower job projections only after checking all recovery consumers; full job inputs can be required elsewhere.
4. If multiple-tab polling materially contributes, use visibility-aware/backoff or coordinated reads without blocking independent generation, losing job recovery or replaying submissions. Do not blindly stop all polling.
5. Measure before/after on a slower connection and after 10 and 30 minutes idle. Include reconnect, unavailable auth, aborted reads, retry and account-switch cases. Keep saved edits and accepted jobs unchanged.

## Local verification and scope

Command: `node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/idle-navigation-reads.test.mjs lib/auth/session-refresh.test.mjs lib/auth/session-sdk.test.mjs lib/business-profiles/profile-gate-query.test.ts`.

Result: **24 tests passed, 0 failed**. Transcript: `outputs/idle-network-check-tests.txt`. These cover installed-SDK/session restoration and bounded token/header/body reads with account-switch protection. They do not reproduce a real 30-minute suspended browser.

Preflight: repository AGENTS, global mistake ledger, relevant Explore/context and incident history (including UGC-AUTH-001 and existing preload incident), protected contracts, Verify Feature Wiring, context-memory, immutable-contracts and UI-clarity skills; read-only preflight script ran. Large historical files were consulted by relevant sections under prior scoped-history authorization, not represented as newly reread line by line. Existing unrelated worktree changes preserved. Documentation/log artifacts only in this audit; no runtime rollback required.

Incident: UGC-PERF-20261105-IDLE-NETWORK. Remaining production acceptance stays OPEN.
