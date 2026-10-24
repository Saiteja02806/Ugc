# Wall of Text and Slideshows functional audit — 14 October 2026

The live image pipeline and the ordinary two-slide editing/saving workflow worked. The Wall of Text editor also worked with an owned video. The audit found a missing empty state, slow slideshow saving, two saved-result recovery defects, and misleading account labeling. These findings remain open; this audit did not change or deploy product code.

## Scope and evidence

Checks used the authenticated production site, `https://www.getugcpilot.com` (redirecting to `https://getugcpilot.com`), read-only production database queries, isolated snapshots of the deployed source, existing regression tests, and real local FFmpeg exports. The user's approved live test used one AI credit for one slideshow image and one authored upload fixture. It created private audit assets and a saved slideshow; it created no scheduled or published post.

The website changed while this audit was running:

- Initial website snapshot: `5fe99ee3c6c1449b20901cdb7ea592a505ed9b54`.
- Final production website: `585f40422f1d859e052c0e154993a5066252eec3`, READY deployment `dpl_5Ycj52ZnJnBzZNY8eQU964uatEFL`, with both production domains aliased to it.
- Final worker: `ugc-video-render-worker-00104-dnm`, 100% traffic, image digest `sha256:03741177c98efba44a7bb4decf31cbfa842c4a9fb0280f8997fb99db78ea2feb`.

The intervening release changed workflow account replacement and subtitle finishing/storage. The Wall workspace, slideshow editor/API, image-generation worker, and Omni video-reference implementation were unchanged. The affected scheduling/storage/export checks were repeated against the final snapshot. Existing changes in the shared working folder were left untouched.

## Findings to address

### 1. Wall of Text has an empty Edit sidebar before video selection — P2

This is reproducible on production. Clicking Edit without a selected video leaves the controls card with only Create/Edit/Schedule tabs and no guidance or editing controls. The right pane does show “No video selected” and “Go to Create.” There is no evidence of a component crash.

The source deliberately mounts `FormatVideoEditor` only when `selectedVideo` exists. Meanwhile the Edit panel contains an empty portal target. This explains the blank sidebar; the missing fallback inside that panel is the UX defect. Requiring a video for trim and timed overlays is reasonable. Leaving the controls card empty makes the feature appear broken.

Recommended change: put a concise “Choose a video to start editing” state inside the sidebar, with direct Create/Upload/Creative Assets actions. Handle a restored video's loading and failure states there as well. Allowing text drafting before video selection would be a separate product decision.

Source: `components/explore/format-workspace.tsx:462`, `:498`, `:526`. Proof: `wall-empty-edit-production.png` in the audit artifact folder.

### 2. Saving edited slides takes time before scheduling can begin — P2

Saving the two-slide audit sequence took **22.62 seconds** from the Save click to the Library receipt. Both slides had added text. Edited slide uploads completed at 14:28:25.710 and 14:28:36.517 IST; the Library item was created at 14:28:40.394 IST. The save began at 14:28:17.776 IST.

`FormatSlideshowEditor.save()` processes each slide in a sequential loop: fetch the owned source, render text into a PNG in the browser, upload that PNG, then move to the next slide. Only after those operations does it create and persist the idempotent Library save request. The UI reports “Saving…” without per-slide progress. This is a confirmed pre-scheduling wait; it is not a measured social-platform publishing delay.

Recommended change: use bounded parallel preparation for independent slides while preserving their exact order, show progress such as “Preparing slide 1 of 2,” and preserve per-slide preparation receipts so a reload during this early phase does not unnecessarily repeat completed uploads. Keep the existing owner checks, fingerprint and Library save identity.

One measurement cannot establish typical or worst-case time for every slideshow. The current sequence and timing prove this specific delay. Source: `components/explore/format-slideshow-editor.tsx:275–302`.

### 3. Older saved Explore slideshows can fail to recover — P2

The editor verifies a saved result by fetching `/api/library?type=carousel&projectId=explore` and finding its saved ID in the returned list. That route does not pass a larger limit or perform an exact ID lookup. The Library query defaults to the latest 60 records, ordered by `updated_at`.

Once a valid saved slideshow falls behind 60 newer Explore Library carousel items, that list no longer contains it. Reopening or reusing the same saved result can fail verification even though the slideshow and its images still exist. An offline reproduction using the actual deployed verification/output parser accepted the target when present, then rejected the same valid target when the response held only 60 newer Explore items. The live audit's newly saved item recovered successfully. This does not mean every older slideshow is currently failing, and unrelated Trending items in other projects do not count toward this exact filter.

Recommended change: verify the exact owned Library item and request provenance by ID, independent of a paginated browsing list. Add a regression with a valid target beyond the first page.

Source: `components/explore/format-slideshow-editor.tsx:130–138`, `app/api/library/route.ts:80`, `lib/library/db.ts:242`.

### 4. Interrupted save recovery can disagree with another tab's text — P2

An unfinished slideshow save freezes the rendered image IDs and source slide choices. Editable text is stored separately. If another tab edits the same source slide while the first request is unfinished, the recovery branch resumes the earlier immutable request but reconciles only the source slide identities. It can mark the earlier rendered images as saved while the current Edit preview still shows the newer text.

A controlled offline reproduction ran the actual deployed `save()` function and draft/output parsers, replacing only browser, authentication, image and network boundaries. With text A in the frozen rendered images and text B in the current editor, the POST sent A's image IDs, `onSaved` accepted A, text B remained unchanged, and no error appeared. This is a recovery edge case, not a failure in the ordinary production two-slide save. No live multi-tab publishing test was performed.

Recommended change: keep the original save identity for recovery, then restore its exact text/design snapshot, show the recovered saved pixels clearly, or keep the newer editor revision explicitly unsaved. Source choices alone do not prove the text matches the recovered result.

Source: `components/explore/format-slideshow-editor.tsx:55–61`, `:269–272`, `:291`, `:299–303`, `:318`.

### 5. Slideshow confirmation calls the account “Instagram Reels” — P3

The first slideshow scheduling form correctly says Instagram. Its confirmation account tile says Instagram Reels. The shared label helper hardcodes that name for the Instagram platform and the selector uses it for carousel content too.

This is a labeling defect, not evidence that the carousel is sent as a Reel. The review identifies the saved Library item, shows both saved images, and the backend marks a `library_item` schedule as carousel media.

Recommended change: label account tiles by platform (“Instagram”) or derive the media label from the selected content type. Source: `components/scheduling/schedule-editor.tsx:2361`, `lib/scheduling/types.ts:234`, `lib/scheduling/service.ts:312`.

## Functionality checked

| Function | Result | Evidence and limits |
|---|---|---|
| Wall Create sources | Verified in regression tests | Generated, uploaded and owned asset sources use the same owner-verified source pipeline; production opened an existing owned generated video. |
| Wall image + video references | Verified in production history and current contracts | A completed Wall job contains both one image reference and an actual video reference. Tests preserve both selection orders and submit actual video input. No additional paid Wall generation was started. |
| Wall gallery video reference | Verified in current API/worker tests | The server resolves registered source IDs; the worker receives video bytes rather than silently substituting the poster. Model incompatibility blocks generation rather than dropping the reference. |
| Wall generation failure handling | Earlier error accounted for | An earlier job failed because Omni edit tasks received an aspect ratio. The current Omni edit path omits that unsupported framing/duration override; its 11 focused regressions passed. |
| Wall Edit with no video | Missing sidebar fallback | Right pane explains the prerequisite; left pane stays blank. See finding 1. |
| Wall Edit with owned video | Passed live | Trim controls, multiline text, two independent text blocks, preset, position, text color and original-volume controls updated the preview. |
| Wall text timing | Passed live and actual export tests | Two blocks retained different intervals within a 1–8 second trim. Existing real FFmpeg tests confirmed timed visibility, stacking order, newlines, audio trim/mute and source preservation. |
| Wall preview playback media | Loaded correctly | Owned source decoded at 1280×720, approximately 10 seconds, with no media error. Schedule preview reflected the 7-second edited sequence. |
| Wall save drafts | Contracts/database regressions passed | Draft saving persists editing separately from rendering; replay and stale revision cases are covered. This audit did not click Save on the existing Wall asset. |
| Wall background audio | Contract/render tests checked | Mixing and original-volume handling are covered. No new live audio upload was performed. |
| Wall Schedule entry | Passed live | Settings and composed preview appeared before final rendering. A read-only job query confirmed the audit source had no newly created render job merely from opening Schedule. |
| Slideshow image generation | Passed live | One image completed in 29.14 seconds; owned asset is ready, 1024×1280, 4:5. |
| Slideshow references reach backend/provider path | Passed live for one style reference | The job retained one selected gallery reference and its explicit style-reference contract; the OpenAI operation reached `output_persisted`. Current tests cover multiple style references, uploaded instruction attachments and edit targets separately. |
| Reference selection versus output quantity | Correct by design | The active reference slide is selected initially. Other slides provide context only when checked; selecting a four-slide reference does not mean all four are automatically sent or four outputs are generated. Quantity remains a separate control. |
| Slideshow upload | Passed live | A separate authored 1080×1350 PNG was uploaded and became the second owned slide. |
| Slide heading/body editing | Passed live | Separate text on each slide remained associated with that slide after reordering and returning from Schedule. Explicit body line breaks remained visible. |
| Slide appearance | Passed live, with broader renderer tests | Serif/medium/left/top/rounded background/opacity were retained. Text color reached the SVG preview, then was restored to the saved white design. Other supported combinations are covered by renderer tests. |
| Reorder and per-slide scope | Passed live | Uploaded slide moved before the generated slide; each kept its own heading, body and appearance. |
| Remove/replace/recreate/add flows | Covered in editor/action/API regressions | The live test exercised Add/Upload and reorder. It did not spend credits on a second image recreation or destructively replace the saved audit sequence. |
| Slideshow save/export | Passed live with latency concern | Both rendered text overlays are present in the saved PNG previews. The exact two-slide order and ready assets were confirmed in Library tables. See finding 2. |
| Reload/reuse of current save | Passed live, recovery edges remain | Reload restored both slides and their text. Restoring the original design and saving again reused the same Library item without extra edited uploads. Findings 3–4 cover older-result and interrupted multi-tab recovery. |
| Slideshow empty Edit | Useful fallback exists | Shows “Edit your slides,” upload/add actions, and instructions to generate or upload images. A sequence of fewer than two images cannot save. |
| Slideshow Schedule review | Passed live | Saved two-image preview, selected account, caption, date, 12:00 time and Asia/Calcutta timezone reached confirmation. Back retained the settings. No Schedule post submission was made. |
| Shared time-rejection/retry behavior | Passed regression tests | Wall/Slideshow retain request identity, allow a corrected rejected time, replay uncertain inputs exactly, and avoid automatic publishing during hydration. |
| Account refresh and sidebar width | Passed production layout check | At a 1280px viewport the controls card was 378px wide, following the approved 5% rule. Refresh accounts was 148×36px, 12px type, nowrap; no horizontal page overflow was observed. |
| Text remix readiness | Ready in live slideshow | Reference copy and saved business context loaded, enabling Generate remix. No extra paid remix call was submitted; provider completion is covered by mocked contracts, not this live image test. |

## Expected behavior worth making clear

- Words already inside generated or uploaded images/videos are pixels in the source. The manual tools edit added text overlays; they do not automatically extract and replace those original pixels. Empty overlay fields on a selected source can therefore be intentional. That differs from a completely blank controls card.
- Explore Wall of Text uses manual timed text, not Talking Head speech-subtitle styles. It does not expose Serif Black Box speech captions; testing its Bold White and Snapchat Classic overlays is the relevant preview/export comparison.
- Slide references guide generation; they are not automatically included as finished slides. New saves require owned generated or uploaded images. The audit's selected gallery reference was not silently saved as a finished slide.
- Generation, client-side slide preparation, Library saving, background video rendering and eventual publishing are separate waits. A historical published post's total age cannot be treated as scheduling latency.
- Saved titles currently inherit the chosen reference name (“Goal Tracker 01” in this audit). This is intentional source behavior, though naming the finished slideshow separately would improve discoverability.

## Live receipts and timings

All user-facing times below are IST (Asia/Calcutta), 14 October 2026.

| Item | Receipt |
|---|---|
| Approved image request | `45e86701-71cb-4b66-9a98-3c6d674b5dee` |
| Created / started / completed | 14:18:18.496 / 14:18:24.392 / 14:18:47.640 |
| Queue / processing / total | 5.90s / 23.25s / 29.14s |
| Image model selection | `gpt_image_2_5`; completed OpenAI operation. Provider model name was not retained in the inspected final operation metadata. |
| Generated owned image | `21dee44c-2cc2-40fd-9248-490e23e5c053` |
| Uploaded source image | `ef90a6cb-f5e4-4a6f-90bc-7eb34484bdb3` |
| Saved slideshow | `606d776e-4f42-4b2e-bc76-6f563599c753` — ready, two slides |
| Saved slide 1 / slide 2 | `dac4b9da-645a-4a6c-b608-9b6b9d15b739` / `1a17b654-265d-4ec8-8412-4cd8ff701e49` |
| Save request key | `94c51b65-b9ee-490b-a604-d83a832567cb` |
| Save time | 22.62s to Library receipt |
| Final persistence check | One saved Explore slideshow, two edited PNG uploads, zero scheduled posts for this Library item. |

Existing Wall generation evidence: completed job `6de321e4-206f-41aa-910f-72fe8e9a4e1b`, one image + one video reference, approximately 5.97s queue + 108.90s processing; ready asset `cffebae3-1cb0-4525-a961-0e66120f89d8`. Earlier failed job `12e74033-a94a-47fe-b846-5d39a8e5a832` recorded the Omni edit aspect-ratio error. These are historical provider results, not a new paid Wall test.

## Validation and remaining limits

Successful test groups included 107 source/slideshow checks, 121 source/Wall/scheduling checks, 50 generation API checks, 47 worker checks, 11 Omni reference checks, and 47 draft/remix/preferences checks. These groups overlap; they are not presented as a deduplicated total. The final release's worker build passed, its schedule/form checks passed (29), and its storage/real Wall export/single-pass subtitle checks passed (22). Isolated snapshot dependency/loader setup errors were repaired before accepting the successful results.

No full live publishing test was performed. Actual Instagram/TikTok delivery latency and every image model/ratio are not certified by one credit. This audit verifies the successful live path, production state and specific replay/reference/export contracts, and records the remaining recovery/UI defects rather than declaring every possible combination production-tested.

The two recovery findings are reproducible with `node .tmp/wall-slideshow-audit-20261014/recovery-reproductions.cjs`. The artifact executes the actual deployed functions and validators with mocked dependencies. Its three assertions passed: listed saved item accepted, the same target beyond 60 items rejected, and frozen pixels A accepted while current text B remains unchanged. It makes no production calls.

The saved private slideshow and its audit media are retained so the result is reviewable. Temporary Wall text/trim/sound changes were returned to the original values, and no server Wall draft was saved. No product fix, deployment, feature-flag change or publishing request was made by this audit.

Evidence folder: `.tmp/wall-slideshow-audit-20261014/`. It contains initial/final immutable source snapshots, `functional-audit-receipt.json`, and production screenshots of empty Edit, generation, editing, saved previews, confirmation, Wall scheduling and Remix readiness.
