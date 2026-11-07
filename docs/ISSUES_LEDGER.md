# Reported issues ledger

Record each user-reported issue here when it is received. Assign a stable ID and date, capture the observed and expected behavior, list affected workflows and evidence, and mark the cause unknown until verified. Append updates under the same ID as work progresses. Link related reports and records in the engineering incident ledger, [clear.md](ai-context/clear.md). Keep local checks, manual browser acceptance, live provider output, and deployment status separate. Leave any outstanding acceptance check open.

| ID and date | Report and expected behavior | Evidence and status |
| --- | --- | --- |
| UGC-20261106-SCHEDULE-ACTION-CONTAINER · 2026-11-06 | Explore → workflow → Schedule wrapped the whole action block ("Post scheduled", "View in Scheduling", Back to Edit, Schedule post) in its own rounded bordered card inside the action footer, so the buttons occupied a separate section. The buttons should sit plainly where the workflow already places its actions, without the extra container. Reported for the Schedule section across the Explore workflows. | Fixed locally in the shared schedule action CSS. The inner card chrome (border, radius, background, blur, shadow, inner padding, extra top margin) is removed; the existing footer divider, padding, status row, link, button labels, disabled/busy rules and handlers are unchanged. Before/after computed styles and screenshots at 1000px and 390px verified; 176 schedule/workflow tests pass. Signed-in app and hosted deployment NOT VERIFIED. |
| UGC-20261106-PHOTO-RECEIPT-SIZE · 2026-11-06 | Hook showed a photo storage warning and disabled Generate Video after the frame was approved. Adding or clearing valid photos should save the selection. | Reproduced and fixed locally. A long motion prompt exceeded the selection record limit. Signed-in browser confirmation open. See the engineering incident ledger. |
| UGC-20261106-HOOK-DURATION · 2026-11-06 | Hook blocked a four-second output when the source required six seconds. User wants flexibility to choose a shorter model-supported duration. Recurrence: a 4.1-second source forced 5 seconds and blocked the user's 4-second choice on Kling 4.0. | Full-source duration validation identified in the UI and backend. Shorter-duration behavior implemented locally; see the resolution below. Browser and hosted acceptance open. |
| UGC-20261106-FRAME-IDENTITY · 2026-11-06 | At six seconds, additional identity photos still blocked Generate Video. The approved image should stay the first frame and photos should provide identity guidance. | Resolved locally for every model: Omni keeps the literal first frame, Kling 4.0/Seedance 2.5/WAN 3.0 run one reference job with the frame as Image 1, and Kling 3.0 animates the frame alone with a visible note. Generate stays enabled. Browser-verified; live provider output and hosted deployment open. See the resolution below. |
| UGC-20261106-EXPLORE-MODELS · 2026-11-06 | WAN 3.0 was unavailable locally and Kling 3.0 and 4.0 were missing from Explore workflows. | Kling models added locally. WAN availability depends on its local flag. Manual Kling generation and WAN availability remain open. |
| UGC-20261106-MODEL-PICKER · 2026-11-06 | AI Studio model picker showed provider logos, a PREMIUM tag on Kling 3.0 (user states Kling 4.0 is the premium model), a "— temporarily unavailable" suffix, and the label "Gemini Omni · frame + identity photos". All of that should be removed. | Implemented locally: provider logos and the logo helper module removed from the AI Studio and Viral pickers, PREMIUM tag removed, unavailable models hidden instead of annotated, direct route renamed "Gemini Omni". Browser screenshot confirmed; 103 UI tests pass. Production deployment NOT VERIFIED. |
| UGC-20261106-DURATION-POPOVER · 2026-11-06 | Opening Duration in a workflow showed the full 28-value list below the viewport, and scrolling the menu scrolled the whole page instead. Expected: the menu scrolls inside itself and the page stays still. | Fixed locally in the shared settings popup (all workflows): capped to the available viewport height with an internal scroll area. Measured before/after in the browser; page no longer grows. Mobile-width check and hosted deployment open. See the resolution below. |
| UGC-20261106-RESULTS-BAND · 2026-11-06 | A dark horizontal band/line appeared at the top of the "Your videos" results panel above the History row, in every workflow. It should not be visible. | Cause confirmed: the sticky results toolbar painted the page background over the card-coloured pane. Fixed by matching the pane surface in all workflow results. Computed colours verified; pixel screenshot and hosted deployment open. See the resolution below. |
| UGC-20261107-SLIDESHOW-UI - 2026-11-07 | Explore -> Slideshows looked "crumbled" on laptop screens (15.6-inch and 14-inch): the "Your slideshow" pane did not fill its preview column and the header/actions were squeezed. Follow-up user report (screenshot of `/e2e/explore-format-preview?format=slideshow&generated=1`): (1) remove the redundant `Generated slides` button from the `Your slideshow` header, (2) align `Edit slides`, `Save slideshow`, and `Save & review post ->` on the right side of the `Your slideshow` header row instead of wrapping onto a second line on the left, and (3) show the full 6-slide sequence and more slide thumbnails in the `Your slides` rail instead of only 2 slides. | Fixed locally: (1) removed `previewActions` (`Generated slides` button) from `FormatSlideshowEditor` in `format-workspace.tsx`, (2) ordered `Save slideshow` before `Save & review post` in `format-slideshow-editor.tsx` and aligned `.headerActions` to the right (`margin-left: auto`, `align-items: center` on `.previewHeading`, `gap: 8px` on `.saveActions`) so all three header controls sit on the top header row on laptop/desktop viewports, (3) expanded `.filmstrip` `max-height` from `clamp(144px, 28dvh, 280px)` to `clamp(244px, 38dvh, 340px)` (and `clamp(208px, 32dvh, 280px)` in compact mode) so 3–4 slide thumbnails are visible in the rail, and (4) updated `previewSlideshow` in `app/e2e/explore-format-preview/page.tsx` from `sample.slides.slice(0, 2)` to `sample.slides.slice(0, 10)` so all 6 reference slides populate `Your slideshow` (`6 slides · Preview your current sequence`, `Your slides 6 / 10`, `1 / 6`). Browser screenshots (`create-overview-1366.png`, `arrangement-desktop.png`) and 255 unit/workspace tests + full Playwright suite (`scripts/slideshow-add-slides.browser.cjs`) verified. Hosted deployment NOT VERIFIED. See the resolution below. |
| UGC-20261106-KLING-WORKER-FAILURE · 2026-11-06 | Hook generation with Kling 4.0 and identity photos failed with "The job failed, but the cause could not be identified automatically." Expected: a clear reason, and no charge for a request that never started. | Root cause verified from worker logs and the job row: the hosted worker runs the pre-Kling policy (no Kling starting frames, zero identity photos) while the local app runs the newer uncommitted policy. No provider call, no usage event, 8-credit reservation released. Not a local-machine problem. Retry will fail identically until the worker is updated. See the resolution below. |
| UGC-20261107-IDLE-COVER-FREEZE · 2026-11-07 | After Explore was left idle for a while with the tab still open and visible, the workflow cover videos looked frozen/stuck. Covers should keep playing or resume on their own while the page is visible, without a refresh or any click. | Code-confirmed recovery gap: the bounded cover reload budget (3) is spent, then no further automatic retry happens until a user-driven focus/hover event. Self-recovery implemented locally; signed-in idle acceptance and hosted deployment open. See the resolution below. |

### UGC-SEO-20261106-ROOT-NOINDEX · 2026-11-06

| ID and date | Report and expected behavior | Evidence and status |
| --- | --- | --- |
| UGC-SEO-20261106-ROOT-NOINDEX · 2026-11-06 | User reported `vidmake.io/` was a 307 redirect to the disallowed, auth-gated `/explore`, so the root could never be indexed. User decision: keep Explore full-screen at the root for users (no redirect), remove the marketing-restore option, and have crawlers index the guides network through `/guides`. | Implemented locally: proxy rewrite `/` → `/explore` with `X-Robots-Tag: noindex`; `/` removed from the sitemap inventory (124 URLs); SEO gates updated (root check asserts 200+noindex+Explore markup; reachability traversal starts at `/guides`; stale 307 www expectation aligned to the implemented 308 migration). Local GET `/` = 200 + noindex + Explore markup; proxy tests 3/3; lint clean. Production still serves the old redirect and 125-URL sitemap until deployment; hosted and Google indexing acceptance NOT VERIFIED.
Update · 2026-11-06: user connected GSC in-session. Domain property `sc-domain:vidmake.io` verified (added 1 Nov 2026); sitemap submitted 4 Nov, last read 6 Nov, Success with 125 discovered pages (pre-deploy inventory); robots.txt report "All files are valid"; 570 crawl requests/90 days; Search generative AI = Include. Legacy property `sc-domain:getugcpilot.com` is NOT accessible under the signed-in account (chundusrisaiteja49@gmail.com), so Change of Address validation is blocked until that property is verified for this account (DNS TXT at the registrar) or another authorized Google account is used. COA setup page reached but VALIDATE & UPDATE intentionally not clicked without user approval.
Update · 2026-11-06 (user decision: skip legacy COA, focus vidmake.io): brand audit found user-visible "UGC Pilot" already absent from public surfaces; remaining old-domain references are functional (MCP host mcp.getugcpilot.com, contact emails). User approved: swap contact emails to @vidmake.io (7 legal/status/contact pages, mailto+text only; MAILBOX EXISTENCE AT MAIL PROVIDER IS A USER-SIDE PRECONDITION), correct stale "78 tools" claims to the actual 105 public tools (`publicMcpToolCount` from mcp-tool-catalog.json toolCount 106 minus the gated update_publishing_preferences; 12 blog + mcp/docs OG subtitle instances changed; eslint 0 errors/6 pre-existing warnings). MCP cutover feasibility CHECKED: possible; blockers are production 404 block on website deployment (deployment-routing.ts isMcpExclusivePath), app/mcp route origin check vs MCP_PUBLIC_URL/MCP_OAUTH_ISSUER env overrides, and hardcoded mcpEndpoint/mcpIssuer constants plus ~20 blog URL strings; proposed safe bundle = allow protocol paths on the website behind an env flag, set MCP_PUBLIC_URL=https://vidmake.io/mcp + MCP_OAUTH_ISSUER=https://vidmake.io on the website Vercel project, swap constants/copy, deploy website; MCP project untouched so existing connectors keep working. Copy pointing to vidmake.io/mcp must NOT ship before the routing+env change: endpoint copy change is intentionally PART of the cutover bundle, not shipped alone. |

### UGC-20261106-EXPLORE-MODELS resolution · 2026-11-06

Root cause found: WAN 3.0 was listed because `video-generation-workspace` renders every `AI_STUDIO_VIDEO_MODELS` entry, but `isAIStudioVideoModelAvailable` returned false because `NEXT_PUBLIC_ENABLE_OPENROUTER_WAN` was never set. There is no WAN 3.2 in the repository; the only WAN route is `wan_3_0` (`wan3.0-video` on ReAPI and `alibaba/wan-3.0` on OpenRouter). Local `.env.development.local` now sets the flag and the picker offers WAN 3.0 with no unavailable text. Production/hosted Vercel env still needs the same flag plus a working `REAPI_API_KEY`; both are NOT VERIFIED here.

### UGC-20261106-FRAME-IDENTITY recurrence · 2026-11-06

User reported Generate Video disabled on local Explore with Kling 4.0, 5 seconds, 720p, 9:16, and retained face photos. Screenshot shows the face-photo compatibility warning. Verified the Kling adapter accepts the approved image alone on the starting-frame path and rejects additional photos on that path. Expected behavior is to keep the approved image and use the additional photos as identity guidance. Kling frame-plus-identity support remains OPEN.

UGC-20261106-FRAME-IDENTITY provider check: ReAPI Kling 4.0 documentation explicitly separates literal frames and reference media into incompatible request modes. Kling 3.0 Elements is a distinct integration to verify for compatibility and photo-count constraints. Exact first-frame plus additional identity photos on Kling remains OPEN. Existing Gemini route supports the required input roles.

UGC-20261106-FRAME-IDENTITY update: User requested approved frame plus all added photos for every model. ReAPI documents separate frame and reference modes for Kling 4.0 and WAN 3.0, and disallows mixed frame/reference roles for Seedance 2.5. Kling 3.0 Elements has a 2–4 photos per element constraint and still needs a verified first-frame integration. Keep exact-frame and all-photo acceptance OPEN for these routes.

UGC-20261106-FRAME-IDENTITY update: User reiterated that approving a generated frame must automatically select the original influencer photos. Historical removal traced to ef3ee9fe per EXPLORE_CONTEXT.md. Current approval and history retain ordered photo IDs and the shared restoration hook uses them for a fresh selection. Explicit edits or clearing take precedence. Signed-in browser verification remains OPEN.

UGC-20261106-FRAME-IDENTITY recurrence: User reports Generate stays disabled when adding photos to an approved frame and requests coverage of all models. Latest model and exact readiness message unknown because localhost was unreachable. Expected: generation uses the approved first frame and the ordered extra photos in distinct roles. Check model-by-model, including freshly added photos, restored photos and explicit clearing. OPEN.

### UGC-20261106-FRAME-IDENTITY resolution · 2026-11-06

User decision: the approved frame and all added identity photos must both be sent, on every model. Implemented locally as three routes, selected by shared policy (`hookStartingFrameFaceReferenceLimit` and `hookStartingFrameFaceReferenceRoute` in `worker/src/lib/hook-starting-frame-video.ts`):

- **Gemini Omni direct** (`first_frame_with_identity`): literal first frame plus up to five ordered identity photos.
- **Kling 4.0 / Seedance 2.5 / WAN 3.0**: one reference job with the approved frame as Image 1 and the photos after it, up to five photos. Kling 4.0 and Seedance 2.5 send `omni_reference_task_type: "reference"`; WAN 3.0 sends `generation_type: "reference"`. Those providers still forbid mixing the strict frame family with reference media, so the opening is reconstructed from Image 1 rather than pinned.
- **Kling 3.0**: exactly two image slots (first frame, last frame) and no reference mode. It animates the approved frame alone; the composer explains this, does not upload the unused photos, and Generate stays enabled.

The animation prompt now names Image 1 as the opening authority and Images 2..N as identity-only references when photos are forwarded, so extra photos cannot drive scene, clothing or pose.

Verification (local signed-in browser, `http://localhost:3000/explore/hook-video`): a restored Seedance 2.5 draft with one approved frame and one identity photo keeps **Generate video** enabled; adding a second photo keeps it enabled on Seedance 2.5, Kling 4.0, WAN 3.0 and Gemini Omni (direct), and Kling 3.0 stays enabled with its frame-only note. The model list still renders six name-only options. No paid generation was submitted; the draft was returned to its original selection.

Automated checks: `npm run test:explore` 1424/1424, `npm run test:wan-video` 143/143, `npm run test:workflow-video-references` 257/257, plus the targeted admission, request-builder and worker-job suites. App and worker `tsc --noEmit` clean, scoped ESLint clean.

Remaining OPEN: live provider acceptance (no `REAPI_API_KEY` locally; the worker dispatches to hosted GCP workers) and hosted deployment. The reference-mode opening on the three ReAPI models is approximate by provider design.

### UGC-20261106-HOOK-DURATION resolution · 2026-11-06

User decision: the user chooses the duration. A source of 4.1 seconds may be generated at 4 seconds; the app must not force 5 or block Generate.

- Removed the composer gate in `components/video/video-generation-workspace.tsx` that disabled Generate whenever the selected duration was shorter than the measured source.
- Removed the matching backend rejection in `lib/ai-studio/video-generation-api.ts` (`createHookSourceTimeline` is no longer called with `preserveFullSource: true`) and dropped the now-unused option from `worker/src/lib/hook-source-timeline.ts`.
- The frozen timeline still retimes the source action into the chosen duration (`actionDurationSeconds = min(source, generated)`, initial trim end = chosen duration), so a shorter output is coherent and reversible in the editor.
- The automatic default remains the smallest supported duration that covers the source (5 seconds for a 4.1-second source). Only the block was removed; the user can freely change to 4.
- Cross-workflow audit: Text on screen and Talking Head never had this gate. They default to 4 seconds (3 for WAN) and retime directions into the selected duration, so the issue does not repeat there.

Remaining OPEN: local signed-in browser confirmation and hosted deployment. No paid generation was submitted.

Verification (local): `npm run test:workflow-video-references` 258/258 and `npm run test:explore` 1425/1425 pass. The new UI regression covers Hook and Text on screen for all five models: 4 seconds stays selected for a 4.1-second source, Generate stays enabled, no minimum-duration message appears, and the submitted `durationSeconds` is 4. The admission regression covers 4.3→4 and 8→4 with `trimEndMs` 4000, and equal/longer durations still keep the full-source trim. Worker timeline and app/worker TypeScript are clean, focused ESLint clean.

### UGC-20261106-DURATION-POPOVER resolution · 2026-11-06

**Cause.** Every workflow model/duration/quality/videos/ratio control is the shared `AiStudioSettingSelect` in `components/generation/ai-studio-composer.tsx`. Its popup had no height cap and no scroll container, so Kling 4.0's 28 durations rendered a 1062px list in a 718px viewport, pushed the document to 1081px, and wheel scrolling over the menu scrolled the page behind it. `WorkflowDurationControl` wraps the same component, so Hook, Text on screen, Talking Head, Phone, Slideshow and the Explore creation form all shared the defect.

**Fix.** The popup is capped with `max-h-[min(var(--available-height),24rem)]` using Base UI's documented positioner variable, and the listbox is now `min-h-0 overflow-y-auto overscroll-contain`. `components/pricing/pricing-model-select.tsx` had the same unconstrained popup and received the same cap. No option, label, order or selection behaviour changed.

**Measured, same page and viewport (718px tall, Kling 4.0):**
- Before: 28 options, list 1061px tall, `overflow-y: visible`, document 1081px.
- After: popup 365px at y=347–712, list scroll area 370px with `scrollHeight` 1062, last option "30 sec · 60 credits" reachable, page `scrollY` 0 and document height 718px.
- The Explore creation form's duration popup also stays inside the viewport, and short lists (model, videos, ratio) are unchanged.

**Regression.** `lib/ai-studio/composer-ui.test.ts` asserts the bounded popup and internal scroll container. `npm run test:ai-edit` 112/112, `npm run test:wan-video` 143/143, app `tsc --noEmit` and scoped ESLint clean.

**Also corrected in the same pass (pre-existing, unrelated to scrolling):** three `test:ai-edit` assertions still described the old toolbar, which now renders `generationActions` (including Cancel) for workflow surfaces instead of beside the settings. `lib/ai-studio/video-presentation-ui.test.mjs`, `lib/ai-studio/image-presentation-ui.test.mjs` and `lib/ai-studio/video-failure-ui.test.mjs` were updated to match that existing behaviour; no product code changed for them.

Remaining OPEN: mobile-width visual check (the browser tooling cannot emulate a viewport here) and hosted deployment. No generation, billing or provider request was made.

### UGC-20261106-RESULTS-BAND resolution · 2026-11-06

**Cause.** `components/generation/ai-studio-results.tsx` painted its sticky results toolbar with `bg-background/90` plus `backdrop-blur-sm`. Explore from the results pane (`.main`) on the card surface (`--card` = `rgb(23,23,28)`), while `--background` is darker (`rgb(16,16,20)` / `rgb(18,18,18)`). The toolbar therefore rendered a strip several shades darker than its pane, and the strip's top edge read as a stray black line above the History row. Because the strip begins inside the results padding, the line starts slightly in from the panel edge (unlike the tab bar's edge-to-edge border).

**Fix.** `AiStudioResults` gained an optional `toolbarClassName`. `components/video/video-generation-workspace.tsx` and `components/workspace/ugc-chat-workspace.tsx` pass `bg-card` when `workflow` is set, and the default background tint plus backdrop blur is skipped in that case. Standalone AI Studio panels keep the original styling because their surface really is the page background. No layout, control, label or behaviour changed.

**Measured (local browser, Hook workflow):** before the fix the toolbar computed to `oklab(0.17491 ...) / 0.9` over `rgb(23,23,28)`; after the fix it is `rgb(23,23,28)` with `backdrop-filter: none`, and a scan of the top 140px of the results section finds no other painted background, border or gradient.

**Regression.** `lib/ai-studio/video-failure-ui.test.mjs` asserts both workflow callers pass the card surface and that the darker default is not baked into the toolbar. `npm run test:explore` 1425/1425, `npm run test:ai-edit` 113/113, `npm run test:wan-video` 144/144, app `tsc --noEmit` and scoped ESLint clean (two pre-existing warnings in `ugc-chat-workspace.tsx`).

Remaining OPEN: pixel screenshot at the reporter's viewport and hosted deployment. Applies to Hook, Text on screen, Talking Head, Phone and Slideshow because they share the results pane; standalone AI Studio is intentionally unchanged.

### UGC-20261106-KLING-WORKER-FAILURE resolution · 2026-11-06

**Verdict: not your machine, not the prompt, not the provider.** The request was created by the local dev app and rejected by the hosted worker because the two are on different versions.

**Job evidence** (read-only production records, job `51029447-4b3b-4c70-a10e-7caab4c49191`):

| Field | Value |
|---|---|
| Status | `failed` in 2.6 s (created 17:37:31Z, updated 17:37:34Z) |
| Stored error | `JOB_FAILED` — "Starting-frame animation requires its owned image receipt and a supported model/duration…" |
| Input | `kling_4_0`, provider `reapi`, Hook, `animate_starting_frame`, 4 s / 720p / 9:16 |
| Media | one approved frame with receipt + two ordered identity photos (`personReference` set) |
| Provider operations | **0 rows** |
| Billing usage outbox | **0 rows** |
| Credit reservation | 8 credits, status **released** at 17:37:34 |

**Root cause.** The worker ran revision `ugc-ai-generation-worker-r-9d840243` (created 2026-11-05T21:47Z, commit `9d840243`). At that commit `isHookStartingFrameVideoModel` accepts only `google_omni`, `seedance_2_5`, `wan_3_0`, and `hookStartingFrameFaceReferenceLimit` returns `0`. A `kling_4_0` job with two identity photos therefore fails the guard before any provider work. The deployed API at the same commit rejects the same request up front, so only the local app running the newer uncommitted starting-frame policy could create this job. No provider operation was reserved, no usage event exists, and the reservation was released — **no video was generated and nothing was charged**.

**Why the message was vague.** The worker persisted `error_code: JOB_FAILED`; the public job contract only translates known signatures, so the UI fell back to "The job failed, but the cause could not be identified automatically."

**What to do.** Do not retry this job on the current worker — it will fail identically. Verify the new Kling/identity-photo behaviour only after the web app and worker are deployed together; until then, local acceptance is not proof. A local starting-frame test **without** identity photos on Omni/Seedance/WAN exercises the deployed worker's supported path. Optionally, map pre-submission validation failures to an explicit message so version skew is obvious.

This was a single occurrence (`1` job with the message), not a production pattern.

### UGC-20261107-SLIDESHOW-UI resolution - 2026-11-07

Root cause (verified by measurement, not hypothesis): the Slideshows "Your slideshow" editor (`<section aria-label="Slideshow edit preview">`, `slideshow-editor.module.css` `.editorPreview`) is rendered inside the shared `.savedPreview` container, which is a centred column flex (`display: flex; flex-direction: column; align-items: center`). `align-items: center` overrides the default stretch, so the editor collapsed to its intrinsic width: 237 px content inside a 648 px preview pane at a 1000 px viewport, with a fixed 136 px slide-sequence column eating most of it. That is the "crumbling" state.

Fix (scoped to the slideshow editor, shared shell untouched):
- `.editorPreview` now declares `width: 100%` and `align-self: stretch`, so it fills the preview pane instead of shrinking to max-content.
- `.previewHeading` now wraps by default (`flex-wrap: wrap; min-width: 0`), so the "Your slideshow" heading and the action row stack instead of overflowing the pane on narrower laptops (previously wrapping existed only below 1023 px).
- `.headerActions` gained `min-width: 0` so its buttons can wrap cleanly.

Verified locally (read-only preview fixture plus the real route CSS, layout measured with computed geometry because the screenshot tool needs a visible desktop window):
- 1920, 1536, 1440, 1366, 1280, 1100, 1024 px: editor fills the preview column (1281 / 896 / 799 / 744 / 691 / 576 / 540 px), no horizontal document overflow (`scrollWidth == clientWidth`), header wraps at <= 1100 px.
- 996, 830, 600, 390 px compact/mobile: editor 938 / 773 / 542 / 332 px, no overflow, no clipped children.
- Create stage at 1536/1366/1280 px: controls 405/378/378 px, preview 1073/930/843 px, no overflow.
- Regression test: `scripts/explore-slideshow-editor.test.mjs` "the slideshow preview fills its pane and the header wraps instead of overflowing" (58/58 pass). App `tsc --noEmit` clean.

Still OPEN: hosted deployment; no backend, generation or publishing behaviour changed.

**Follow-up update · 2026-11-07 (user screenshot of `/e2e/explore-format-preview?format=slideshow&generated=1`):**
- **Observed**: With `More` unwrapped into inline actions, 4 buttons (`Edit slides`, `Save & review post ->`, `Save slideshow`, `Generated slides`) exceeded the single-row width inside `.editorPreview` on laptop viewports and wrapped onto a second line on the left. Additionally, `app/e2e/explore-format-preview/page.tsx` sliced the 6-slide `Fitness` reference to 2 slides (`sample.slides.slice(0, 2)`), showing `2 slides · Preview your current sequence` and `Your slides 2 / 10` beside `Fitness · 6 slides`, while `.filmstrip` (`max-height: clamp(144px, 28dvh, 280px)`) only fit 2 thumbnails on laptop heights.
- **Fix**:
  1. Removed the `Generated slides` button (`previewActions`) from `FormatSlideshowEditor` in `components/explore/format-workspace.tsx`.
  2. Placed `Save slideshow` before `Save & review post` in `components/explore/format-slideshow-editor.tsx` and added `align-items: center` on `.previewHeading`, `margin-left: auto` on `.headerActions`, and `gap: 8px` on `.saveActions` in `components/explore/slideshow-editor.module.css` so `Edit slides`, `Save slideshow`, and `Save & review post ->` stay right-aligned on the top header row.
  3. Increased `.filmstrip` `max-height` to `clamp(244px, 38dvh, 340px)` (and `clamp(208px, 32dvh, 280px)` under `@container workflow-video (max-width: 1023px)`) so 3–4 slide thumbnails fit visibly in the rail.
  4. Updated `previewSlideshow` (and `previewFinalSlideshow`) in `app/e2e/explore-format-preview/page.tsx` from `sample.slides.slice(0, 2)` to `sample.slides.slice(0, 10)` so all 6 reference slides appear in `Your slideshow`.
- **Verified**: 255 tests across `scripts/explore-slideshow-editor.test.mjs`, `scripts/explore-format-source-workspace.test.mjs`, `scripts/explore-format-generation-ui.test.mjs`, and `scripts/slideshow-idle-editor.test.mjs` pass; full Playwright browser suite `scripts/slideshow-add-slides.browser.cjs` passes with visual screenshots inspected (`create-overview-1366.png`, `arrangement-desktop.png`, `preview-save-1366.png`); `npx tsc --noEmit` clean. Hosted deployment remains NOT VERIFIED.

### UGC-20261107-IDLE-COVER-FREEZE resolution · 2026-11-07

**Cause (code-confirmed recovery gap).** Explore workflow and AI character cards call `useCoverPlayback(source, "a", true, true)` in [`components/explore/use-cover-playback.ts`](../components/explore/use-cover-playback.ts). When a continuous cover froze or errored while the tab remained visible, `reload()` capped recovery attempts at `COVER_MAX_RELOADS = 3` and then returned unconditionally. The 4-second watchdog (`COVER_WATCHDOG_MS = 4_000`) kept firing, and `visibilitychange` reassigned `src` via `sync()`, but neither reset `reloads`. Once those 3 fast reloads were spent, the cover stayed frozen until a user-driven `resume` event (`focus`, `pageshow`, `online`, `document "resume"`, or `pointerenter` on the card) reset `reloads = 0`.

**Fix.** Added a bounded cooldown (`COVER_RETRY_COOLDOWN_MS = 30_000`) in [`components/explore/use-cover-playback.ts`](../components/explore/use-cover-playback.ts):
- After `COVER_MAX_RELOADS = 3` back-to-back reloads without a `playing` event, `reload()` waits until `Date.now() >= retryAfter` (`30_000` ms) before resetting the counter and probing the source again.
- A visible cover that froze while the page sat idle now self-recovers on the next watchdog tick after the cooldown, without requiring hover, focus, tab switch or page refresh.
- An unreachable/offline source remains bounded (at most one probe per cooldown window after the initial 3-reload burst) and cannot loop tightly.
- `playing` and user-driven `resume` events still reset `reloads = 0` immediately. Hover-only reference gallery behavior (`continuous = false`) and hidden-tab decoder release are unchanged.

**Verification (local).**
- `scripts/explore-navigation-ui.test.mjs` ("a visible cover that stays frozen after the fast reload budget is spent recovers on its own, without focus, hover or refresh") and `scripts/reference-cover-playback.test.mjs`: 23/23 pass.
- `npx tsc --noEmit` and scoped ESLint on `components/explore/use-cover-playback.ts` and `scripts/explore-navigation-ui.test.mjs`: clean (0 errors).

**Remaining OPEN.** Live 5–10+ minute idle observation in a signed-in browser session and hosted production deployment (`NOT VERIFIED`).

### UGC-20261107-SLIDESHOW-PROMO-REGENERATE-KEYCAP · 2026-11-07 (LOCALLY VERIFIED; Build Influencer follow-up OPEN)

- **User report**: User supplied a custom HTML/CSS button concept (`.cta` skewed parallelogram `transform: skewX(-15deg)`, counter-skewed `900 italic` text, `6px 6px 0 black` → `10px 10px 0 #FBC638` hard offset block shadow, expanding chevron wrapper `margin-right: 0 -> 45px`, and 3-path SVG chevron cascade `path.one` `-60% -> 0%`, `path.two` `-30% -> 0%`, `path.three` with staggered `#FFFFFF` ↔ `#FBC638` `color_anim`) and asked to adapt it for the `Regenerate` button in the Slideshow promo (`remotion/SlideshowPromo.tsx`). Follow-up after Slideshow: review and refine the Build Influencer (`remotion/AICharacterPromo.tsx`) promo video.
- **Resolution & verification**: Implemented the Skewed Triple-Chevron CTA (`data-cta-button="skew-chevron"`, `#FF1E6E` face, `#000000` → `#FBC638` hard offset shadow, `PATH_ONE_D` / `PATH_TWO_D` / `PATH_THREE_D` chevron cascade, physical shadow-press on click, plus the screen-wide tactile click reaction across the stage and 6 cards) in `remotion/SlideshowPromo.tsx`. Encoded the new `768x432` 30fps H.264 cover MP4 and wired `/explore/covers/slideshow-promo-61d9b7aebe9a.mp4` for `id: "slideshows"` in `lib/explore/workflows.ts` per user instruction ("okay use this as cover video for slideshows"). `node --test scripts/verify-slideshow-promo.test.mjs scripts/explore-navigation-ui.test.mjs scripts/reference-cover-playback.test.mjs` passes 29/29 (including all 145 frozen unaffected frame hashes and content-hash verification on `slideshow-promo-61d9b7aebe9a.mp4`); rendered `public/explore/covers/slideshow-promo-v1.mp4`, `output/remotion-review/slideshow-promo-contact-sheet.png`, and 6-frame close-up sheet inspected.
- **Linked incident**: `UGC-VID-20261107-SLIDESHOW-REGENERATE-KEYCAP` in `docs/ai-context/clear.md`.

### UGC-20261107-AICHAR-TRAIT-OUTCOME-ALIGNMENT · 2026-11-07 (OPEN)

- **User report** (with 2 annotated screenshots of the Build AI influencer cover video):
  1. The finale card on the right shows a cropped, exaggerated split-hair shocked face (`aichar-final-outcome.png`) instead of a good-looking full character portrait from the generated character catalog.
  2. The 6 trait selections made during the video (and stacked in the left recipe list) do not match the generated character shown at the end — specifically, Beat 5 selects a female brown curly hairstyle (`hair-voluminous-curls.png`) and Beat 6 selects a female white-tee & jeans outfit (`outfit-white-tee.png`), Beat 4 selects a different man with a handlebar mustache (`head-chiseled.png`) and blue eye (`eye-round.png`), Beat 3 selects another man (`eth-middle-eastern.png`), and the finale shows a different split-hair shocked face.
- **Linked incident**: `UGC-VID-20261107-AICHAR-TRAIT-OUTCOME-ALIGNMENT` in `docs/ai-context/clear.md`.
- **Resolution & local verification (2026-11-07)**:
  1. Built the 2-part `900`-frame (`30.0s` @ `30fps`) AI Character cover video in `remotion/AICharacterPromo.tsx` (`Part 1: Male Build → Male Finale` with `aichar-part1-male-final.jpg` (`media_1794036783876_80d2553b.jpg`), followed by `Part 2: Female Build → Female Finale` with `aichar-part2-female-final.jpg` (`media_1794036004429_a1030191.jpg`)), encoded `/explore/covers/ai-character-promo-1fa7b02dc144.mp4` (`768×432`, H.264 `faststart`), and wired `CHARACTER_COVER` in `components/explore/ai-character-card.tsx`.
  2. Uploaded all 7 user-provided influencer images to the Google Cloud Storage backend (`gs://ugcsaas-media/catalog/character-studio/showcase/v1/<sha256>.<ext>`) and replaced the plain empty state in `/explore/build-character` (`components/characters/influencer-canvas.tsx`, `lib/characters/studio-showcase.ts`, `components/characters/influencer-studio.module.css`) with the Higgsfield-inspired AI Influencer Showcase (5-card fanned hero deck, `YOUR INFLUENCER, / YOUR VIRAL HIT` heading, filter pills, and 4-column responsive showcase gallery grid).
  3. Verified: `node --test scripts/explore-navigation-ui.test.mjs components/characters/influencer-canvas.test.mjs components/characters/influencer-studio.test.mjs` passes 34/34; `npx eslint` and `npx tsc --noEmit --incremental false` pass with 0 errors/warnings; desktop (`1440×920`) and mobile (`390×844`) Playwright screenshots and rendered 30s MP4 visually verified. Hosted deployment remains NOT VERIFIED.




