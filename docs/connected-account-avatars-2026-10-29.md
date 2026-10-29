# Connected-account profile photos — 29 October 2026

## Scope implemented
Use the existing SocialAccountAvatar next to each connected social account name in five formerly missing areas: shared workflow Schedule account selector, Trending slideshow automation destinations, main scheduling editor account tiles, legacy Analytics connection summary, and generic connected-account management cards. Other platform-specific Settings, Analytics and post-scheduling pickers already use profile avatars and are preserved.

Workflow account parser now retains bounded optional HTTPS profile-picture URL, connectedAt and authorizationRevision display fields; credentials/arbitrary properties are still discarded. Shared avatar/hook input type accepts that safe display subset, using the same owner-scoped picture endpoint, cache key and fallback. No new photo service or endpoint. Missing/failed image uses the existing platform fallback and still shows the account name.

No change to selected account IDs, disabled/reconnect rules, date/time/timezone, schedule payloads, backend persistence, queues, provider calls or saved edit formats. Prior uncommitted direct photo-dialog patch is preserved. No deploy, build for MCP, generation or publication.

## Files for this change
components/explore/workflow-connected-accounts.tsx
components/trending/trending-slideshow-automation-workspace.tsx
components/scheduling/schedule-editor.tsx
components/analytics/analytics-dashboard.tsx
components/social/connected-accounts-workspace.tsx
components/social/social-account-avatar.tsx
components/social/use-social-account-picture.ts
lib/explore/workflow-connected-accounts.ts
scripts/workflow-connected-accounts.test.mjs
scripts/connected-account-avatars.browser.cjs
scripts/trending-automation-ui.browser.cjs
EXPLORE_CONTEXT.md
docs/ai-context/clear.md
docs/connected-account-avatars-2026-10-29.md

## Preflight and boundaries
Current AGENTS instructions, relevant Explore/history sections under existing relevant-sections authorization, nonnegotiables and scheduling-contract read; context-memory, immutable-contracts, UI-clarity and regression-gate skills read in this session, plus scheduling skill for this task. Current shared-avatar, profile-photo hook, account parser/callers and tests inspected. Next use-client guide previously read in this session. Read-only tools/preflight.py passed. UGC-UI-059 recorded OPEN before application changes. Rollback boundary is these display components/type/parser changes; no database or production changes.

## Verification
- 29/29 account selection/parser and server profile-picture tests PASS, including authentication, cancellation, independently selected accounts, blocked states and display fields. Command: node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/workflow-connected-accounts.test.mjs lib/social/profile-picture.test.mjs.
- Actual WorkflowConnectedAccounts + SocialAccountAvatar + real useSocialAccountPicture browser fixture PASS at 1280/390px: owner-authenticated local picture GETs, correct account binding, successful photos, 404/no-photo fallback, broken YouTube URL fallback, two selected Instagram accounts and independent deselection, long username wrapping, bounds. All requests are fixture/local or locally intercepted; no external provider operation.
- Actual Automation UI browser suite PASS at 1440/390px, including two destination avatars and independent checkbox changes; no activation. This fixture supplies local photo URLs; the actual authenticated hook is covered by the separate workflow fixture.
- TypeScript --noEmit PASS. Scoped ESLint and diff checks recorded under .tmp/account-avatar-*.
- Existing scheduling-account-ui-contract suite: avatar contract and five other tests PASS; one unrelated old Hook layout assertion FAILS because it expects schedule-caption-heading. The drawer and contract file are unchanged by this patch. Do not interpret this as a fully passing broad scheduling suite.

## Protected behavior status
VERIFIED locally: account/photo binding, authenticated read path, platform fallback, multiple-account selection/deselection and disabled rules, empty/error states, responsive workflow/automation rows, no implicit activation. Scheduling/backend code unchanged.
NOT TESTED: authenticated hosted profile photos with real connected accounts, live publication/scheduling, full production build. No deployment authorized or performed.

## Visual evidence
.tmp/account-avatars/accounts-1280.png
.tmp/account-avatars/accounts-390.png
.tmp/trending-followup/ui-after/posting-avatars-1440.png
.tmp/trending-followup/ui-after/posting-avatars-390.png
Local sample photos demonstrate layout/fallback behavior, not users' real profile images. User-supplied screenshot documents the missing-photo baseline. Existing unrelated direct-dialog evidence remains in its separate receipt.
