# AI Studio image history

Images now follows the dated History behavior in the released Videos implementation (`origin/main`, `lib/ai-studio/video-history.ts` and `components/video/video-generation-workspace.tsx`). Previously, Images mapped every saved result directly into the workspace grid.

- The default workspace shows today's images, based on the browser's local calendar day. A midnight timer and window-focus check update this view when the day changes.
- The History drawer includes all ready generated images returned by the existing authenticated media API, grouped by Today, Yesterday, Last week, and older dates. Search matches titles and aspect ratios.
- Selecting a history item opens it in the workspace with the existing download/open actions. Back to today restores the default view; starting a new generation also restores it.
- Image loading and completed-job reconciliation retain more than 24 results. Saved media is not deleted or rewritten.
- The drawer uses the existing Base UI dialog for focus trapping, Escape/backdrop closing, and focus restoration. It fills a narrow screen and is 460px wide on desktop.
- Generation requests, references, credits, job polling, cancellation, retries, and the Videos implementation retain their existing behavior. Explore Recreate's reference and composer controls remain intact.

## Validation

- `npm run test:ai-edit`: 57 tests passed, including local-day filtering, date grouping, search, invalid dates, and retaining 30 existing assets when another generation completes.
- `npx tsc --noEmit --incremental false`: passed.
- ESLint on the changed image/history/result components and helpers: passed.
- Isolated local browser verification at 1440×1000 and 390×844 used mocked media, billing, access, and generation/job responses. Verified that older images do not appear by default; 31 history entries remain accessible; search and its empty state work; history selection retains download/open links; Back to today and Escape work; focus returns to History; an older-only library has a clean workspace; queued generation shows progress and completed generation enters the workspace and history. No horizontal overflow, runtime error overlay, or browser errors appeared after the fixture routes were configured correctly.
- Browser fixtures and screenshots are in ignored `.tmp/image-history-verification/`. All displayed images there are test placeholders. These checks did not call the live generation service or spend credits.

## Release status

Implemented and verified locally. No push or deployment was performed for this change. Production acceptance should check the authenticated Images screen on `https://www.getugcpilot.com` after deployment.
