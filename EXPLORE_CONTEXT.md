# Explore context and UI decision record

### Trending same-quota older-post recovery — 19 October 2026, local correction

- Recovery scope is the same quota/delivered feed, including posts viewed hours
  earlier. Browsing them again must not consume quota or mix other quota feeds.
- User supplied a recording and clarified that recent swipe-back works but a
  slideshow reviewed about two hours earlier cannot be reached. Production
  records retain older skipped/ready slideshows; the connected browser stops at
  a later historical post. Deployed backward navigation read only local browser
  snapshots and cannot retrieve older account history from the server.
- No two-hour expiry was found. Seven-day/120-entry/serialized-size limits and
  browser-specific storage do not provide complete account history. Prior
  gesture and refresh tests did not cover earlier decisions missing from the
  browser. Keep this acceptance gap explicit; do not repeatedly adjust gestures
  to address missing historical data.
- Required correction is paginated, authenticated recovery of existing reviewed
  records, stable merging and an explicit older-history loading/error boundary.
  It is now implemented locally through `GET /api/trending/feed/history` using
  the saved feed ID and original slot order. The gallery preloads pages, merges
  pending local reviews without moving the current post, scopes storage to
  owner + quota, and exposes loading/retry/unavailable states. Revisiting is
  read-only; normal feed preparation and decision writes are unchanged.
- Local regression and browser checks passed for empty-cache +2h recovery,
  pagination, reload/navigation, quota isolation, empty feed, retry and blocked
  storage. The final quota browser rerun passed on the isolated release.
  Read-only production-service verification recovered all eight reviewed
  slideshows, denied a different owner, and left quota unchanged.
  Authenticated deployed-browser acceptance remains pending.
  Diagnostic evidence and limits, including the
  different Comet/in-app browser contexts, are in
  `docs/trending-older-history-investigation-2026-10-19.md`.



### Hook audit approval and manual audio collection — 19 October 2026

- User reviewed the scene findings, explicitly chose to keep Hook 18 unchanged,
  and approved all 18 clear end trims. No uncertain scene decision remains.
  The derivatives are verified locally; catalogue activation/deployment is still
  separate. The full original Hook 18 stays bound to its existing prompt/text.
- User requested all background audio together for their own listening review,
  with names that map each track to its reference and original import folder.
  `outputs/Hook Reference Audio Review/` contains 98 descriptively named Hook
  folders, each with its complete byte-identical paired MP3, an original frame,
  source mapping and editable review notes. Eight embedded native audio tracks
  are also extracted by packet copy with payload-hash verification. No AI audio
  analysis, transcription, classification or paid model call was performed.
- Example: `Hook 003 - Pillow - wide-eyed reaction` retains the original source
  folder `New folder (3)`, `ReelAudio-77704.mp3`, permanent reference ID and source
  link in `mapping.json`. Every file includes the stable three-digit Hook number.
  The parent `index.html` has thumbnails and separate background/native players;
  `AUDIO-MAP.json` maps all files. Original soundtracks, including Hook 03's
  previously rejected pairing, remain available for explicit manual review.
- The exporter `scripts/export-hook-reference-audio-review.mjs` uses the scene
  labels in `scripts/data/hook-reference-audio-review-labels.json`. It verifies
  original hashes, refuses to replace differing existing media/mappings and
  preserves user-written `REVIEW-NOTES.txt` on rerun. It performs no upload or
  production write. Music remains acceptable; user is checking spoken commentary.

### Complete Hook frame audit and staged cleanup — 19 October 2026

- User explicitly rejected unrelated demo/screen tails in generation references.
  This supersedes earlier instructions to preserve even single-frame screen cuts,
  including the Hook 03 entry below and the earlier all-frame prompt review.
  Keep the influencer performance; a physical laptop/phone beside the performer
  is not automatically unwanted. Prior prompt review observed tails correctly
  but accepted the wrong product behavior by instructing generation to retain them.
- Three agents inspected all 9,773 decoded frames of the 98 active Hook references.
  79 have no unrelated scene cut; 18 have clear unwanted tails (22 frames total):
  ordinals 1, 2, 3, 4, 6, 7, 20, 30, 39, 40, 42, 43, 53, 54, 71, 78, 88, 89.
  These ordinals are audit identifiers, not new product-facing catalogue labels.
  Exact permanent IDs, source hashes, removed ranges and prompt proposals are in
  `scripts/data/hook-reference-scene-audit-2026-10-19.json`.
- Hook 18 continuously pans from an airplane window to a seated smiling performer.
  It is an authored reveal, not an inserted demo. User asked for the original
  video and labelled frames at the end of the chat for manual guidance; leave it
  unchanged until that guidance. Do not choose a crop/trim based on elapsed time.
- User deferred ALL audio analysis to avoid provider cost. Background music is
  acceptable; the concern is spoken commentary. No paid audio/model calls were
  made. Existing Hook 03 silence decision remains separate. The new video audit
  neither certifies soundtracks nor globally removes singing, music or native audio.
- `scripts/trim-hook-reference-frames.mjs` creates new lossless H.264 derivatives,
  checks source SHA before/after, exact decoded retained pixels, frame count,
  relative PTS and end boundary. Preserve the last performer's display hold up to
  the first excluded frame PTS; packet-duration-only cuts shorten VFR holds.
  Disable B frames and set final packet duration without duplicating frames.
  Native audio in four affected sources is explicitly packet-copied and checked
  by payload hash/timestamp, without listening or re-encoding. Account for FFmpeg
  input normalization by container start when aligning nonzero video timestamps.
- All 18 derivatives and exact revised prompt/Remix-timing proposals are staged
  in `outputs/hook-reference-audit-2026-10-19/`. Original videos, soundtracks,
  active catalogue and production remain unchanged by this audit. The review HTML
  puts ambiguous cases last. Trimming retains baked-in captions; the existing
  generation text-removal instruction remains. Do not claim pixels were de-texted.
- Before activation, upload/verify content-addressed derivatives and paired previews,
  then release matching generation video, duration, prompt source hash and caption
  source hash/timing together. Keep old media/provenance available for historical
  jobs. New prompt paragraphs remove discarded-cut instructions. Staged cleanup
  is not evidence that the current deployed catalogue already uses cleaned inputs.
- Validation includes real media pixel/PTS/packet checks on all derivatives and
  regression cases for non-keyframe head/tail trims, VFR holds, nonzero starts,
  native-audio preservation, invalid ranges, hash mismatches and repeat writes.
  No paid generation, provider-quality test, deployment or authenticated
  production workflow acceptance is part of this local audit.

### Hook 03 spoken soundtrack removed — 19 October 2026, local

- User rejected the spoken background audio on Instagram reel `Dd394l1gRWG`,
  reference `explore-paired-hook-ef59f4b5e69bc9e125f8ada7`. Its 3.766992-second
  source MP4 is already silent; the audible preview and generated Hook instead
  attach `ReelAudio-77704.mp3` (31.63425 seconds). Frame review alone never
  establishes soundtrack suitability. The speech complaint is user-reported;
  this audit did not transcribe or independently listen to its words.
- This exact release item now has `audioPolicy: silent`. Catalogue/MCP omit its
  automatic paired audio and preview the existing silent source. Generation
  strips provider audio using video stream copy, rather than merely lowering
  playback volume or relying on a prompt. New outputs omit soundtrack receipts
  and do not infer a track from this reference ID. Explicit historical receipts
  retain their immutable mappings for recovery/editing; old rendered media is
  not automatically rewritten. Other references retain their existing policy.
- Rechecked all 110 decoded frames in sequence. The performance paragraph is
  accurate: reclining, blink, widening eyes, right/left glances, return to lens
  and final sideways glance. Frame 109 at 3733 ms cuts to hand/stylus and screen;
  keep that single-frame tail brief. Added explicit silence, no speech/voiceover/
  singing/lip-sync/music, while retaining naturally parted lips. Overlay removal
  and separate Remix caption wording/timing remain unchanged.
- Review, exact prompt, silent output and receipt: `outputs/hook-03-review/`.
  The actual audible preview was stripped and all 110 decoded pictures and
  timestamps match the silent source; ffprobe confirms zero audio streams.
  Local source hashes match production catalogue object names read through MCP.
  Direct production byte fetching failed DNS in this shell. No paid generation,
  deployment or authenticated production acceptance is claimed. Release worker
  and web/MCP together; already selected browser state may require reload.
- Worker build, app TypeScript, scoped lint and focused catalogue/prompt/audio/
  generation checks pass. The wider release test still expects Hook 01's old
  final-frame Remix block, conflicting with the earlier caption normalization;
  that unrelated expectation was left unchanged. Full audio suite passes when
  run independently (an initial concurrent run exited before completion).

### Single Hook opening text follows trim — 19 October 2026, local

- Root cause: shared trim handling uses `min(previous text end, new length)`.
  Shortening a 3s clip to 1.5s overwrites the text end with 1.5s; extending to
  3s leaves it at 1.5s. The shortened interval can survive draft recovery,
  manual styling and Remix because those paths retain previous timing.
- User explicitly limited this correction to the Hook Video workflow's opening
  editor. `FormatWorkspace` opts that opening into `fullDurationHookText`.
  Never infer this policy from `format: hook`: Talking Head opening/demo and
  other shared editor callers also use that render format but MUST retain
  independent timing. Hook's separate demo editor is not opted in either.
- With exactly one text block, timing is normalized to 0–selected duration on
  local/server/receipt/metadata restoration, editing, trim changes, Remix and
  drag updates. Preview, saved draft and final composition use the same JSON.
  A short explanation replaces the single block's separate timing inputs.
  Multiple blocks retain authored per-block timing; adding a second block
  restores the timing inputs. Removing down to one restores full-clip coverage.
- Keep copy, position, font, preset, sound, trim and legacy draft shape. No
  worker/global parser policy or database schema change; no provider requests
  or existing rendered-media rewrites. Changed recovered timing still needs an
  explicit Save edits and final preparation to replace previously saved output.
- This specific exception overrides the general instruction to carry shared
  editor fixes across workflows. Wall, Talking Head, demo and slideshow timing
  behavior stays as it was. This correction is local and not deployed.
- Validation: 216 focused checks pass, including repeated shrink/expand/shift
  cycles, local/server/receipt/metadata recovery, style/copy preservation and
  negative checks for Talking Head/demo callers. Actual-component desktop and
  phone browsers verify end-of-clip visibility, reload and switching between
  one and multiple blocks. Real exports show Hook text at 2.8s after expanding
  1.5s back to 3s while independently timed demo text still ends at 1.5s.
  App TypeScript and scoped lint pass. These are local checks, not authenticated
  production acceptance. Evidence: `.tmp/hook-text-timing-tests-20261019.log`
  and `.tmp/explore-demo-loading-browser/hook-single-timing-*.png`.

### Trending history survives leaving and refreshing — 19 October 2026, local

- User clarified that the repeated scroll-back failure occurs after leaving
  Trending or refreshing, not during the same visit. React-only review snapshots
  disappeared on unmount; gesture-only fixes did not address that lifecycle.
- Authenticated Trending opts into owner-scoped browser history for up to 120
  recent posts/seven days, including the selected historical post. Recovery
  lives above the gallery's empty/loading branches so an empty server feed cannot
  hide View previous posts. Other accounts never receive those previews.
- Browsing recovered posts does not replay a decision, Library save or scheduling
  action. Demos remain visit-local. This does not recover visits already lost
  before the change or synchronize between devices. See CAROUSEL_CONTEXT.md for
  storage bounds, failure handling and the exact acceptance boundary.
- Actual-component browser checks cover leaving/returning, refresh, backward and
  forward browsing, final-post recovery, account switching and unavailable
  storage. Local only; no deployment or authenticated production acceptance.

### Edit-screen space usage correction — 19 October 2026, local

- Repeated mistake reported by the user: the focused Hook/demo edit screen
  reserved a full-width bottom row for Back and Save, repeated the edit title
  inside a padded tools card, and left a broad empty band above those tools.
  Shrinking buttons alone did not fix the unnecessary layout containers.
- Focused Hook opening/demo actions now live in the compact editor header.
  The bottom action container is removed. The duplicate tools heading is hidden
  in that frame; the nested tools border, background and padding are removed.
  The outer editor keeps one short title, then starts preview/tools directly.
- Talking Head's shared focused panel places supplied clip actions above its
  scrollable tools and omits its bottom footer. Duplicate clip headings are
  hidden there too; the preview identifies the current clip. Wall's actual
  FormatWorkspace uses a separate action target, now also above its tools with
  the legacy footer hidden during Edit. Keep Wall's Back to text control.
  Panel border/padding are removed only during focused editing. Create, Demo
  setup, Schedule and slideshow retain their own layout and action behavior.
- Carry corrections across shared workflow editors automatically. Preserve
  mounted preview/tool/draft targets, Back/Save handlers, disabled/error states
  and reachable actions while scrolling. Do not create empty header/footer rows
  or duplicate cards merely to hold actions; use compact controls and measure
  usable space with long text/block lists on laptops as well as mobile.
- This correction is local, not deployed. Isolated component/browser checks
  do not constitute authenticated production acceptance.
- Validation: 197 editor/navigation/source/draft/drag checks pass. Browser
  checks cover Hook demo upload/edit continuity at 1280×720 and 1536×864,
  seven text blocks and 390px mobile scrolling, paired opening/demo and Wall
  at 320–1920px. Hook's header actions measure 44px, nested tools padding/border
  and initial tools gap measure zero; shared top actions use 56px including
  spacing. TypeScript and scoped lint pass. Evidence screenshots are in
  `.tmp/explore-demo-loading-browser/` and `.tmp/talking-head-editor-layout/`.

### Trending slideshow shared styling and history edit — 19 October 2026, local

- These changes belong to Trending Carousel Edit, not manual Explore Slideshows.
  Body style/position changes share by default; hook and per-slide copy/media
  stay separate. Individual styling is persisted and protected from future
  shared changes unless the user explicitly rejoins that slide. Existing manual
  styles without metadata are treated as individual to preserve authored work.
- New manual text motion reaches canvas edges without the former fixed inset,
  while glyphs/panels stay contained. Body overflow is surfaced for individual
  review. Existing generation typography and Explore image pixels are unchanged.
- Existing owned Carousel edits can reopen from Trending review history; other
  formats retain current restrictions. This requires a local trigger migration
  as well as UI/API changes, with no automatic skip/schedule state changes.
  See CAROUSEL_CONTEXT.md for the exact access boundary and release requirements.
- No deployment or production mutation; local fixtures are separate from final
  authenticated production acceptance.

### Drag text directly on clip previews — 19 October 2026, local

- Text in the focused Hook, Wall, Talking Head opening and demo editors can be
  dragged horizontally and vertically on the live preview. Starting a drag
  pauses video/audio; pointer capture supports mouse, pen and touch. Arrow keys
  move focused text in small steps; Shift uses larger steps. Read-only overview
  and sequence previews retain their playback behavior without drag targets.
- Only the visible text region intercepts input. A subtle boundary appears on
  hover/focus. Movement uses the displayed frame scale and clamps the complete
  text within the video. Existing timing, copy, style and other blocks remain.
- The optional normalized text `x` field is parsed and saved through existing
  clip drafts; absent `x` retains legacy shape and centered rendering. The same
  layout drives browser SVG, bundled glyph outlines and legacy FFmpeg text.
  Snapchat's full-width background remains full width. No saved media is
  rewritten; users save edits and prepare the resulting video as usual.
- Deployment must release the updated worker parser/renderer before the website
  can submit edits containing `x`. This change is local, not deployed. Browser
  fixtures and local real-video exports are distinct from authenticated
  production acceptance.
- Validation: 165 focused checks pass, including strict draft round trips,
  blank/neighbor block preservation, all 160 font/size/preset/frame boundary
  combinations, and actual video exports through all three text render paths.
  Actual-component browsers pass mouse/keyboard and saved-position recovery at
  laptop/desktop/phone sizes, touch on phone, and the complete Talking Head
  opening/demo and Wall editors at 320–1920px. App TypeScript, worker build and
  scoped lint pass. Screenshots: `.tmp/talking-head-editor-layout/` and
  `.tmp/explore-text-fonts-browser/`.

### Video text preset switching — 19 October 2026, local correction

- Reproduced Snapchat Classic → Bold white staying on Snapchat in the shared
  dropdown. `applyFormatTextPreset` correctly removes `preset` and
  `backgroundOpacity` for Bold, but the editor's partial-update merge restored
  both from the previous text object. This kept the Snapchat background and
  selected option even though some typography changed.
- Preset changes now replace the selected text block with the helper's complete
  result. Individual field changes still merge only their changed fields. Copy,
  selected font, other blocks and timing remain; Wall retains full-clip timing.
- The same control is used by Hook, Wall advanced styling, Talking Head opening
  and demo editors, and Hook demo editing. No slideshow preset behavior changes.
  Existing persisted/rendered content is not rewritten; users can change the
  preset through the corrected editor. This fix is local and not deployed.
- Validation: the new dropdown regression failed before the fix with Snapchat
  still selected. All 107 focused editor/draft/export/finishing checks now pass.
  Actual-component browser checks verify Snapchat → Bold, removed preview
  background, retained copy/font, and saved/reopened Bold in Hook at laptop,
  desktop and phone sizes, plus Wall advanced styling on phone. TypeScript and
  scoped lint pass. These are local fixtures, not production acceptance.

### Generation image picker multi-selection — 19 October 2026, local correction

- Hook/Wall-of-Text's Choose image popup and Talking Head's shared creator
  picker remain open after choosing saved or catalogue images when multiple
  references are supported. Each thumbnail shows an empty square or a ticked
  square; pressing a selected thumbnail again deselects just that image.
- A selected-count row and Done close action replace duplicate selected-image
  previews inside the popup, keeping the grid stable while selecting. The
  existing sidebar tile still displays the selected-image mosaic.
- At the model's image limit, unselected tiles cannot add images; selected tiles
  remain removable. Saved images still resolve their current owned record;
  catalogue copies retain their existing upload scope. Pending work, errors,
  account guards and generation reference delivery are preserved. Single-image
  callers retain their existing close-on-selection behavior.
- This correction is local and is not deployed. Browser fixtures use isolated
  auth/storage boundaries, without paid generation or production changes.
- Validation: 121 reference/collection/generation regressions, TypeScript and
  scoped lint pass. The actual Hook and Talking Head pickers pass six browser
  scenarios at 1536×864, 1366×768 and 390×844: checked multiple selections,
  individual deselection, catalogue/saved-image mixing, Done/reopen persistence
  and unchanged instructions. Screenshots: `.tmp/workflow-image-library-browser/`.

### Approved reusable backgrounds workflow — 19 October 2026, local

- The user confirmed Settings collection management followed by applying images
  to the existing Trending slideshow through its Edit screen. Removed the local
  libraryImages URL/import handoff to Explore; it was the wrong destination for
  that requirement. No standalone library action creates/replaces an Explore draft.
- Existing Explore background and Add slides pickers still work. The shared
  background picker now selects images/collections, then Preview backgrounds,
  then Use these backgrounds. Normal Save remains separate. Multiple images fill
  all slides in selection order, repeating; collections follow saved order.
- Shared selection/preview is full width, with no preview side panel or up/down
  reorder buttons. Collection use appears above its grid, selection survives
  management, and management uses Done with immediate-save wording. Thumbnail
  crops affect browsing only; composed previews retain each editor's renderer.
- Source rechecks, unchanged target guards, text preservation and draft/save
  boundaries remain. Shared music behavior is unchanged. See CAROUSEL_CONTEXT.md
  and docs/media-library-trending-flow-2026-10-19.md for the approved workflow.
  Local browser evidence is distinct from signed-in production acceptance.

### Shared text glyph serialization fix — 18 October 2026, local

- Trending's missing letters were reproduced in saved glyph output with intact
  input copy. OpenType.js `toPathData(3)` can emit NaN from near-integer floating
  coordinates, damaging character segments. The shared finite SVG serializer
  now replaces both Carousel manual and Explore bundled-font video callers.
- Preserve text, font, wrapping and layout; reject invalid geometry. Regression
  coverage verifies visible glyph ink in all 12 faces and real video exports,
  including the existing fallback/timing behavior. No generation prompt, image
  input, schema, saved receipt or publishing behavior changes.
- See CAROUSEL_CONTEXT.md for exact reproduction and validation. This fix is
  local; old rendered media is not repaired automatically. Existing immutable
  finish receipts remain recoverable; a new explicit edit/render uses the fix.

### WAN/ReAPI completed-output collection — 18 October 2026, local correction

- Production WAN job `56b8b792-b13f-448d-9fed-8e14b4cf9c52` completed at
  ReAPI but returned `file.deepytb.com`, while the adapter admitted only
  `cdn.reapi.ai`. Recovery exhausted three attempts and reported a generic
  failure. The provider video already exists; do not submit another generation
  as its recovery. See `docs/video-generation-quality-audit-2026-10-18.md`.
- Admit those two exact HTTPS hosts with no embedded credentials/nonstandard
  port; reject lookalikes and redirects. Keep API credentials off CDN requests.
  Record provider completion/settlement before collection, without persisting
  untrusted links. Retries poll the same saved task and refresh the output URL.
- Collection failures now retain a safe `PROVIDER_OUTPUT_COLLECTION_FAILED`
  reason through worker retries and website/MCP reporting. Historical pending
  failures explain recovery of the existing request instead of an unknown cause.
- Targeted API/worker/recovery checks, 12 MCP-operation tests, worker build and
  scoped ESLint pass. The corrected local adapter also collected the actual
  existing production task with two GETs, no POST or database write; its bytes
  match the previously audited video. This is live read-only adapter validation,
  not acceptance of a deployed fix. The website job remains failed/exhausted.
- Full app TypeScript currently reports an unrelated readonly-array assignment
  in `components/media/image-library-browser.tsx:85`. No deployment, production
  job reset or billing change was made. Worker deployment and website/MCP error
  rollout, followed by controlled recovery of the original job, remain separate.

### Seedance 2.5 in Explore video model selectors — 18 October 2026, local correction

- The modern Hook and Wall-of-Text composer had an explicit model allowlist
  containing only Omni and WAN. Seedance was supported by generation settings
  and the API but absent from this dropdown. Include Seedance 2.5 there, using
  the existing provider availability flag. The production website's public
  Seedance flag was checked and is already enabled; no flag change was needed.
- Talking Head uses the shared workflow creation form, whose model list already
  includes enabled Seedance. Preserve its model normalization, saved settings,
  reference policies and existing provider routing. The modern composer's default
  remains Omni; selecting Seedance uses its own duration and quality options.
- This correction is local, not deployed. Component request tests exercise the
  model actually offered in the dropdown and its submitted settings. No paid
  generation or signed-in production visual acceptance was performed.
- Validation: 147 model/settings, composer, client and API contract checks pass,
  including Talking Head saved settings. Full TypeScript and scoped ESLint pass.

### Stable generation reference controls — 18 October 2026, local correction

- The compact video-workspace override forced two columns even when Image,
  Video and Audio were all visible. Audio consequently appeared on a second
  row. The shared generation reference component now exposes its visible slot
  count, and three visible controls use three equal shrinking columns, capped
  at the existing 128px tile width. Selected images remain a mosaic inside the
  single Image tile; adding images does not add controls or displace Audio.
- Applies wherever the shared control is used, including Hook, Talking Head
  and Wall-of-Text configurations that expose audio. Two-control layouts retain
  their existing dimensions. Generation inputs and selection handlers are unchanged.
- This correction is local and is not yet deployed. Signed-in production visual
  acceptance remains separate from local source/component checks.
- Validation: 72 reference/upload/workflow regressions, full TypeScript and
  scoped ESLint pass. Covers zero, one, two and six images, unchanged slot order,
  two-input configurations and selected audio retained after a model change.

### Hook generation references — 18 October 2026, redundant library entry removed locally

- Optional references uses the existing Choose image and Choose video tiles.
  Removed the separate Choose reference from library button and its unused
  picker state/import from the shared generation-reference component. Choose
  image still opens upload, Your images and UGC Pilot images; reference selection,
  removal, ownership validation and generation delivery retain their handlers.
- This also removes the duplicate entry wherever that same component is used.
  Slideshow background libraries and other independent library pickers remain
  available. No assets, saved references or generation data are deleted.
- This is a local UI removal; no deployment or production write was performed.
- Validation: 103 existing reference-upload, generation-flow and creation-form
  checks pass, including saved image reuse, upload failure recovery and delivery
  of image/video references. Scoped ESLint passes. Production UI was not tested.

### Library picker clarity and upload continuity — 18 October 2026, local

- Image selection is focused on choosing media. Management is reachable within
  the same dialog through Manage library; collection rename/removal/new-collection
  controls are no longer mixed into the selection grid. Upload stays direct.
- This slide/All slides is chosen up front, images preview immediately, and Apply
  stays outside the scroll region. Explore's preview uses the same SVG text
  function and actual loaded image dimensions as its editor/export. Trending
  supplies its separate EditorPreview renderer with the proposed background.
- One Apply resolves every used image before an atomic draft update. Failed
  validation/cancel retains the current sequence. Existing dirty/save/recovery
  boundaries are unchanged. The earlier multi-screen image→Use→scope→review
  interaction is superseded by this single selection/preview workspace.
- Whole collections retain deterministic order and repeat behavior, with visible
  image/slide/repeat counts. Earlier/later controls adjust this slideshow's
  proposed image order only, not the saved collection. Mobile uses a compact
  collection dropdown; portrait thumbnails preserve the complete source image.
- Music panels retain state between tabs and pause hidden/competing previews.
  Library upload/update work blocks tab switches, dismissal and selection Apply
  until settled. Failed image/music files can retry without uploading successful
  siblings again. Saving music still does not attach it automatically.
- 313 regression checks, TypeScript, scoped ESLint and isolated actual-component
  browser checks pass. See `docs/library-ui-clarity-2026-10-18.md` for laptop/mobile
  evidence. No deployment or authenticated production acceptance was performed.

### Library image hover controls — 18 October 2026, local

- The reported image-with-search overlay is consistent with Edge Visual Search,
  not an app-owned library action. Library thumbnails contain no outbound links.
- Library and image-picker dialog images no longer receive pointer hit testing;
  their containing selection buttons retain pointer/keyboard interaction. This
  suppresses image-hover browser controls without removing library selection,
  collections, preview or upload. Scope stays inside shared library surfaces.
- This is a local browser-overlay workaround, not a browser preference change.
  Browser-provided overlays are outside the page DOM; headless checks verify
  hit targets and selection, not all browser versions' native chrome.
- The actual library browser fixture passes pointer hit-testing over thumbnails,
  click/Space selection, no new tab/navigation, and its existing collection,
  replacement, music and mobile checks. No deployment was performed.

### New workflow edit text defaults — 18 October 2026

- New manual overlays and Remix-created text with no previous authored style
  default to Inter Bold (700) across the shared Hook, Talking Head, Demo and
  Wall-of-Text video editors. Keep existing size, position and compact controls.
- Existing saved font/weight choices and explicit text preset selections remain
  authoritative. Do not rewrite old drafts or alter the baked-in footage text.

### Automatic 4:5 slideshow uploads — 18 October 2026, local implementation

- Edit slides → Add slides → Upload images and Replace image automatically
  prepare non-4:5 photos on a 1080×1350 canvas before uploading. This includes
  9:16, square and landscape images. Exact 4:5 files pass through unchanged.
- Preserve the full, orientation-corrected image without stretching or cutting
  off existing text. Center a proportionally fitted foreground over a soft
  blurred cover copy. This is deterministic canvas processing, with no AI
  generation, credits or additional manual step. The user's local file is not
  modified. Conversion errors block that upload and retain the existing draft.
- Upload the actual fitted bytes as the owned source asset, so preview, text
  overlays, saved Library output and scheduling use the same ratio. Process at
  most two images at a time; retain successful files in source order and existing
  partial-upload/retry guards. No historical saved or scheduled image is rewritten.
- Scope is new device uploads/replacements in the manual Explore editor. Existing
  generated images, selected reference originals and Library selections retain
  their current contracts. Generation's reference uploads are not normalized.
  4:5 is this product decision, not a claim that TikTok prohibits other ratios.
- Verification is local; no production image, schedule or migration is written.
- Local results: 130 focused tests, TypeScript and scoped ESLint pass. The actual
  editor/Add slides browser suite passes marked 9:16 upload, square replacement,
  saved asset/reopen, partial failure, ordering, retry and mobile/touch checks.
- Broader `explore-slideshow.browser.cjs` passes upload/save/retry/owner checks
  but fails its final image-panel recreation assertion: after changing the edit
  target, the generation request omits the previously attached owned IDs. A
  temporary fixture restoring the pre-conversion upload function fails at the
  same assertion. This is separate from fitting and remains unresolved; do not
  report full generation acceptance from the passing conversion tests.
  No deployment was performed for this change.

### Shared image collections and music library — 18 October 2026, local

- Settings → Media library and Trending's Library pill share owned image
  collections and music management. Explore slideshow Add slides, selected-slide
  image replacement and Your slides → Library backgrounds open the shared picker.
  Optional generation references can also reuse a saved image.
- Preview one image on the selected slide/every slide, or a collection in its
  displayed order, repeating from the beginning if needed. Apply rechecks every
  used source before one draft change; cancellation/failure preserves the draft.
  Slide identities/order and editable text survive, and changes invalidate the
  saved output so normal Save still gates scheduling. Collection membership
  changes never update an existing draft or post automatically.
- Image collections reuse existing asset groups. Removing a collection/member
  keeps original files; archive hides future image selection but preserves existing
  draft/saved sources. Collection order uses added time plus asset ID; manual
  collection reordering is not implemented.
- Music management accepts uploads up to 25 MB/10 minutes. Existing edit audio
  pickers expose Add music to library in place and list those owned tracks.
  Whole-video background music can reuse a verified media ID directly, without
  another upload or implicitly enabling music. Dedicated speech/voice-reference
  libraries and demo/whole-video audio scope remain separate. Native image
  slideshows do not acquire a new music publishing/composition stage.
- No migration, worker release or production write. Local API/component tests,
  TypeScript, scoped ESLint and isolated browser checks pass; hosted authenticated
  acceptance remains pending a website deployment. See
  `docs/media-library-collections-2026-10-18.md` for the validation evidence.

### Trending slideshow text controls — 18 October 2026, scope clarification

- Follow-up correction: movement must not introduce a white background. Trending
  now separates position from explicit None/Per line/Text box styling and uses
  compact controls, multiline hooks, wrapping width, alignment, weight and line
  spacing. Saved styles and line breaks share preview/worker geometry. See the
  latest CAROUSEL_CONTEXT.md entry for compatibility and local validation. The
  user-reported implicit panel and single-line input were implementation defects;
  compilation alone did not establish that these controls were usable.
- The requested advanced text controls belong to Trending → Carousel Edit,
  which has a different persisted edit contract and worker from manual Explore
  Slideshows. Added per-slide typeface, size, color and free text-group placement
  there. See CAROUSEL_CONTEXT.md for the rendering/persistence decision.
- Explore's generated image text remains baked into the image. This change does
  not turn those pixels into editable text or change Explore generation, its
  existing added-text overlay tools, or the preview Save/Schedule correction.

### Simple scheduling and repeat posts — 19 October 2026, local

- The user-approved flow is accounts/caption/date/time → **Schedule post** →
  **Post scheduled** with **View in Scheduling** → **Schedule another post**.
  The last action opens a fresh intent for the same content and keeps the form
  settings available to edit. This applies to background-prepared video,
  prepared Hook/Wall/Talking Head/Phone video, and Explore slideshow scheduling.
- Remove the user-facing Check saved request / Confirm the same saved request
  controls. After a lost POST response, reconcile the exact receipt with a
  read automatically. If it is still unconfirmed, expose one **Try again**
  action that preserves the original request; do not invent success or silently
  create a replacement. Hydration and preparation polling remain read-only.
- Retain time/account validation, receipt verification, cross-tab locks and
  double-click protection. Local fixtures are distinct from production
  acceptance; this change has not been deployed by this task.

### Repeat scheduling — 18 October 2026, local

- A confirmed schedule is a completed post, not a permanent lock on its media.
  Hook, Wall-of-Text, slideshow, Talking Head and background-preparation
  workflows now show **Schedule another post** after confirmation. The user can
  choose a different date, time, caption or account and create another post
  from the same completed content.
- Confirmation remains intentionally different from an interrupted request. A
  network-uncertain request keeps its exact idempotency key and is checked
  automatically or retried through Try again; it cannot be replaced by editing
  the form. A confirmed request is
  archived locally before a new intent is opened, so a late response or another
  tab cannot replace the active request or create a duplicate post.
- Background preparation retains its durable request and delivery guarantees.
  A newly requested repeat is a separately recorded schedule intent; successful
  posts remain available in Scheduling. Local regression coverage includes an
  hour-later repeat, double clicks, tab races and owner-scoped cache updates.
  No production post or media generation was made by this verification.

### Slideshow preview Save and Schedule — 18 October 2026, local implementation

- Create → Your Slides exposes the existing Save slideshow action below its
  current sequence. After a confirmed save it becomes Schedule slideshow;
  users no longer have to enter Edit slides just to save or continue.
- Reuse the same mounted editor, save receipt, retry identity and dirty state.
  Reordering, removing or adding slides invalidates the saved sequence and
  restores Save. Never schedule unsaved edits or silently save on navigation.
- Show one action footer in the visible surface: preview when Create is active,
  inspector when Edit slides is active. Keep progress/errors and pending-save,
  upload, generation, recovery and minimum-slide protections in both surfaces.
- Scope is Explore slideshow UI only. Scheduling still opens its existing
  account/date confirmation step; no post is submitted by this action.
- Entering Schedule from the preview reveals the scheduling controls on compact
  screens, instead of leaving the saved-post preview selected.
- Validation: 189 focused workspace/editor/generation/import tests, TypeScript,
  scoped ESLint and actual-editor desktop/mobile browser checks pass. Covered
  save/retry identity, duplicate clicks, preserved text/order, dirty invalidation,
  reload and the scheduling handoff. No production save or post was submitted.
  This implementation is local; deployment and authenticated production
  acceptance have not been performed for this change.

### Scheduling navigation freshness — 18 October 2026, local fix

- Confirmed schedules from Format Hook/Wall/Slideshow, Talking Head finishing
  and background preparation now update and invalidate the current owner's
  shared schedules query. Unconfirmed requests never create calendar rows;
  restoring a verified receipt updates the cache without another POST.
- Scheduling keeps cached rows visible but always reconciles the schedule list
  on entry, bypassing its 30-minute freshness window. Media and connection
  catalogues retain their existing caching. Existing focus/visibility refresh
  and bounded preparation/publishing polling remain intact.
- This fixes the workflow → View in Scheduling handoff that otherwise needed
  a browser reload. Router refresh alone does not invalidate React Query data.
  Exact request identity, duplicate protection, saved drafts and account cache
  isolation are retained. Local regressions are separate from deployment and
  authenticated production scheduling acceptance; no real post is scheduled by
  this verification.

### Source-post entitlement loophole — 17 October 2026, production audit

- Audit of deployed commit `a493dbd6` found that Talking Head and Hook reference
  source icons use `useAIStudioAccess() === "pro"`. That flag comes from
  `isAIStudioProUser`, which admits inactive/free subscriptions whenever their
  lifetime free-generation grant is positive, even after the grant is spent.
  Such free users receive real TikTok/Instagram links instead of Upgrade to Pro.
- The button/dialog component correctly blocks a locked access value, but prior
  mocked free/Pro browser checks did not verify the actual entitlement resolver.
  Passing those tests is not proof that a real free subscription is restricted.
- Source-post access needs its own active-Pro entitlement, separate from free
  AI generation eligibility. Preserve free generation credits and apply the
  source restriction to Talking Head, Hook Format and Recreate entry points.
  Wall-of-Text reference cards currently render no source-post icon at all.
- Executing the deployed resolver with inactive/free fixtures confirmed grant
  zero → locked; positive grant with remaining credits OR remaining zero → pro.
  This is an audit finding, not a fix: no entitlement or production change was
  made in this turn. A complete regression must cover free accounts with grants,
  spent grants, active plans, checking/error states and both social platforms.

### Source-post entitlement fix — 17 October 2026, local

- `ReferenceSourceAction` now needs a fresh, verified active Starter or Growth
  billing subscription before it renders an external TikTok or Instagram link.
  Free generation credits, whether remaining or spent, retain generation access
  but show the social icon as an Upgrade to Pro control.
- The inherited generation-access flag remains an extra fail-closed condition.
  This covers Talking Head, Hook Format and Recreate galleries through their
  shared source action. Wall-of-Text still renders no source-post icon.
- Regression checks cover free grants, spent grants, valid active plans, and
  unavailable billing states. Local coverage is distinct from authenticated
  production acceptance; deployment evidence belongs in the release record.

### TikTok slideshow publishing and stale status — 17 October 2026

- Accept PNG uploads and create platform-compatible JPEG publishing copies
  automatically. Do not make users re-upload JPG/WebP, overwrite originals,
  replace Library slide URLs or reorder their sequence. The shared publisher
  covers manual Explore slideshows and automatic Carousel Library items.
- A failed physical publishing job must settle its currently linked owned
  platform target, clear its retry date and retain any other platform success.
  Retry budgets cannot advertise attempts beyond the worker's actual limit.
  Upcoming and overdue retry times have distinct neutral UI wording; photo
  failures must not claim that a video failed or that retrying unchanged helps.
- Production migration `20261017105341` repaired the reported TikTok target to
  Failed with no retry date; the overall schedule is Partially failed because
  Instagram published successfully. Original 11:10 IST time and the Instagram
  receipt remain unchanged. No historical publishing attempt was submitted.
- Conversion, worker retry-limit handling and revised UI wording are tested
  locally and await worker/website release. Database status protection is live.
  Keep this distinct from successful end-to-end TikTok publishing acceptance.
  See `docs/tiktok-slideshow-publishing-fix-2026-10-17.md`.

### Complete TikTok mark in references and scheduling — 17 October 2026, local

- The shared TikTok SVG path extends to y=25.522, beyond its former 24×24
  viewport. This clipped the lower curve in reference source buttons and
  Schedule platform choices. Pad the full mark with `viewBox="-1 -1 26 28"`
  and prevent flex shrinking; retain the existing size/color at each use.
- The complete-workflow browser regression reproduces the old clipping by
  comparing the path's measured bounds with the SVG viewport. With the fix,
  the path fits fully inside reference icons and selected/unselected Schedule
  icons at laptop and mobile widths. This fixes all consumers of the shared
  icon, including other scheduling/account interfaces. No platform gating,
  publishing permissions, destinations or source-link behavior changes.
- Older section tests assumed Demo had a separately conditional overview;
  check the single shared Create/Demo overview instead. Visibility rollback
  tests inspect TikTok choice attributes rather than rejecting a preserved
  saved TikTok draft's required music-agreement notice. These are fixture
  updates to current product behavior. Local checks remain distinct from
  authenticated production acceptance; this change is not deployed.

### Talking Head gallery simplification and complete-screen review — 17 October 2026, local

- The user rejected the reference gallery's repeated card names, duration/type
  rows and long limitation paragraphs. Keep References / Your videos above
  the gallery, portrait previews, source icons over the footage and one compact
  action button per card. Remove the additional gallery heading and description.
  Preserve accessible video names. Preview only is a working playback action;
  its generation-limit explanation belongs in accessible text/title, not a
  paragraph repeated beneath every long clip.
- Match Hook's 200px minimum responsive gallery grid instead of fixed three
  columns: 1366/1536 laptop layouts show four cards, approximately 209×371 and
  245×435 respectively. Mobile keeps two columns. Retain the original files.
- Recurring review mistake: a gallery-only fixture omitted the real Create /
  Demo / Schedule navigation and References / Your videos, leaving the user
  unable to assess the actual screen. Present screenshots of the complete
  `HookWorkflowPreview` component and label local previews accurately. The new
  full-workflow browser fixture verifies both navigation sets, empty and selected
  Your videos states, Demo setup, in-place Saved demos Change, demo text editing
  and return to the same Create overview at 1366, 1536 and 390px.
- Talking Head's focused editors intentionally hide Sound setup, but that also
  left no original-demo-volume control in the Demo sidebar. Mount the demo's
  existing edit draft immediately and portal its original-volume slider into
  Demo; use the same edit JSON, preview and Save demo edits operation. Keep
  uploaded demo audio separate from whole-video background music. Returning to
  the clip editor must preserve the sidebar volume and other text/trim edits.
- Local acceptance uses browser-only media uploads with generation disabled;
  no production/API writes. Full-workflow checks prove live demo-volume preview,
  text edits, correct Saved demos inventory and compact cards. Production still
  requires authenticated verification after deployment.
- Final local checks: 101 focused regressions, TypeScript and scoped ESLint
  pass. Full-workflow browser screenshots use the actual component at laptop
  and mobile sizes; shared Hook/Demo/Wall editor checks also pass from 320–1900px.

### Talking Head references and Create overview — 17 October 2026, local

- Talking Head + Demo uses References / Your videos in the first-screen right
  workspace, matching Hook's navigation. Your videos reuses the **one mounted**
  hook/demo overview from Demo, including empty, opening-only, demo-only and
  two-clip states, independent text/trim drafts and in-place Change menus.
  Generated videos opens existing generation results/progress; returning to
  Your videos does not stop generation or unmount the clip editors. Demo setup
  and audio controls remain in Demo. Wall remains a single-video workflow;
  Slideshow already has its analogous current-sequence overview.
- The separate Talking Head catalogue contains the nine explicitly selected
  nonignored MP4s from folders 24, 25 (including child folders), 35, 37, 38 and
  41. Folder 40 contains no selected video. Ignore `fullvideo_ignore` originals.
  The user said **keep them** when offered opening excerpts: preserve all nine
  supplied files byte for byte, including mixed/long clips; do not silently
  cut them to ten seconds. Each has a poster and its matching TikTok source.
- Video-reference inputs currently support at most 30 seconds with Seedance
  and 15 with WAN. The 35.267s and 46.416s examples remain full-length previews
  with an explicit Preview only reason. The 27.867s example requires Seedance.
  Keep a compatible selected model; otherwise choose an available compatible
  one. Round generation duration to the nearest supported whole second, respecting
  model bounds (WAN 3.3 → 3; Seedance minimum 4). Display source and generation
  durations separately; reference length is not a promise of output length.
- Use as reference attaches the actual clip and editable reference directions.
  Keep the user's own instructions and demo untouched; submit both instruction
  fields together. Directions guide a talking-head opening and explicitly omit
  source phone demos/overlays. Never insert a reference into Demo/Saved demos.
  Persist the catalogue ID and edited directions in verified workflow sessions;
  reacquire the exact static clip on return. Recovery must preserve directions
  typed during download. Failed replacements retain the prior attachment but
  block generation until retried, replaced or removed.
- Reuse custom reference playback without a Download option and the existing
  free-user Upgrade to Pro source-link gate. Original source links open for Pro.
- Verification is local: 117 focused regressions, TypeScript (after Next route
  type generation) and scoped ESLint pass. Catalogue/source hashes, authenticated catalogue reads,
  model limits, exact attachment, prompt composition, reference recovery and
  shared overview navigation are covered by focused regressions. Subsequent
  browser verification plays all nine originals, checks decoded frames/full
  durations, picker thumbnails, laptop/mobile layouts, in-place Change, pending
  demo uploads and shared hook/demo/Wall editors. The production browser reaches
  sign-in; authenticated production acceptance is still pending. Not deployed.

### Reference videos inside the workflow preview — 17 October 2026, local

- The isolated Talking Head gallery initially looked correct, but the surrounding
  workflow's broad `.preview video` rules capped its footage at 300px: a 281×499
  card contained only 169×300 media. Reproduce sizing checks inside the actual
  workspace/stage/preview CSS, not only a standalone gallery wrapper.
- Mark reference-card footage with `data-reference-preview-video` and exclude
  it from the shared output/editor caps using zero-specificity `:where`. Cards
  retain their own full portrait frame. Keep existing editor/player sizing
  specificity, natural aspect ratios and whole-frame rendering intact.
- Added a browser assertion for card/media geometry within the surrounding
  workflow CSS at laptop and mobile widths. All nine reference previews decode
  and play without native controls; their supplied full durations remain intact.
  Shared Hook/Demo/Wall tests cover paused edits and portrait/landscape/square
  edges. Local display regressions pass (155 tests); production remains separate.

### MCP finishing fixture font dependency — 17 October 2026, local

- `scripts/mcp-video-finishing.test.mjs` sandboxes the shared
  `explore-format-edit` module to validate the MCP finisher. When that module
  gained the bundled Explore-font metrics dependency, the harness failed before
  registering any finishing tools because it only mocked the overlay-width
  module. Load the real, static font-metrics module through the same sandbox
  before loading the editor contract.
- This is test-fixture dependency wiring, not a change to rendering, font
  choices, saved drafts, MCP permissions, or customer media. Keep the fixture
  loading the actual metrics JSON so a missing or malformed bundled metrics
  resource fails the focused MCP regression.

### Slideshow Create overview and cross-workflow follow-through — 17 October 2026, local

- Recurring mistake: fixing Hook's Create → Your videos without checking the
  equivalent Create → Your Slides left slideshows showing generation's generic
  placeholder instead of the current edited sequence. For workflow corrections,
  check Hook, Talking Head + Demo, Wall of Text and Slideshow applicability in
  the same task; preserve meaningful workflow differences and record exceptions.
- Slideshow Create → Your Slides now uses the same mounted editor preview,
  ordered sequence and text overlays as Edit slides. Add slides, preview,
  reorder and removal operate on that one draft. Edit slides opens its text
  inspector; Create keeps its existing generation instructions in the sidebar.
- Generated slides opens the existing generated versions and History. New or
  recovered jobs reveal generation results/progress; explicit Your Slides
  returns to the current sequence without stopping polling. Recreate slide
  reveals generation results. Selecting a generated version remains explicit
  and continues to archive earlier edited drafts; generation never replaces a
  current sequence automatically. References remains the reference gallery.
- Scope is manual Explore presentation/navigation. No Carousel planner, slide
  generation, saving, scheduling or slideshow data contract changes.
- Local verification: 180 workspace/editor/generation/grouping tests pass;
  TypeScript and scoped ESLint pass. The real editor/Add slides browser fixture
  passes Create/Edit text continuity, adding from Create, save/reload, reorder,
  recovery and mobile checks; Create preview screenshots inspected at laptop
  viewport sizes (1366 and 1536). These are isolated fixtures, not authenticated
  production acceptance. Not deployed.

### Hook Create Your videos overview — 17 October 2026, local follow-up

- In Hook Video, Create → Your videos shows the same mounted Hook/Demo clip
  overview as the Demo stage, including no footage, demo-only, opening-only and
  two-clip states. Do not show the generic generation empty-state placeholder
  merely because Generate is selected and no opening has been chosen yet.
- Keep source cards, selected media, independent edits, in-place Change and
  Saved demos identical between these views; switching Create/Demo must not
  mount another demo draft. Demo setup/audio controls still belong to Demo.
- References retains its gallery. Generated videos stays available from the
  overview even before a clip is selected and reveals the existing results/
  History. Starting a generation reveals progress; explicitly clicking Your
  videos returns to the cards while the generation component/polling remains
  mounted. Do not discard pending jobs, results or prior selections.
- This view decision is specific to Hook's existing Create → References/Your
  videos tabs. Wall stays a single-video workflow; slideshows are unchanged.
  Local validation and deployed acceptance remain separate.
- Local verification: 122 workspace/demo regressions, TypeScript and scoped
  ESLint passed. Checks exercise empty Create cards, the shared Demo portal/
  draft identity, References, generation progress, results/History access and
  return while generation is busy. No new CSS/layout is introduced; this reuses
  the existing Demo cards. A fresh production interaction check and deployment
  of this follow-up have not been performed.

### Slideshow thumbnail arrangement — 17 October 2026, local implementation

- Your slides exposes a small, always-visible bin on every thumbnail and a
  separate drag handle. Removing a thumbnail removes it only from this draft;
  it does not delete the owned image or submit generation. Keep the existing
  Earlier/Later controls as an additional keyboard-friendly way to arrange slides.
- Mouse and touch dragging commit one reorder on drop. Show the destination,
  scroll a long filmstrip at its edges, and cancel without changing the draft
  when Escape is pressed or the pointer is cancelled/released outside the rail.
  Handles also support Left/Right and Home/End, with a screen-reader announcement.
- Move stable slide identities, not image URLs or text positions. Keep the
  selected image and all its text/appearance/provenance together when moving
  another slide or removing a preceding slide. Deleting the selected slide
  selects its nearest remaining neighbor. Preserve existing draft recovery,
  save invalidation and the two-slide minimum for saving.
- Lock ordering/removal during save, upload, recovery and active generation.
  Verify actual pointer/touch gestures, cancellation, saved order and reload;
  passing pure move-array tests alone does not establish usable dragging.
  Local implementation and production deployment remain separate.

### Demo inventory correction — 17 October 2026, local follow-up

- Repeated mistake: copying a Hook source menu into Demo exposed Creative
  Assets, even though reusable demo footage belongs to the **Demo** screen
  (`/library`), not Creative Assets. Never infer the demo inventory from the
  fact that both are represented as playable media assets.
- Hook Video and Talking Head + Demo now show **Saved demos** in both sidebar
  setup and empty/selected preview-card menus. Keep direct Upload video and
  in-place Change. Saved demos opens the content picker using
  `/api/demo/sources`, owner-scoped Content demo records with ready `demo_upload`
  playable projections. It must exclude ordinary creative/generated videos.
  Hook/opening selectors continue to use Creative Assets.
- New Talking Head demo uploads and its edit-preparation fallback use the same
  Demo upload pipeline as Hook: MP4/MOV/WebM, 1–60 seconds, up to 100 MB.
  Uploads appear on the Demo screen and can be selected later through Saved
  demos. Do not keep a generic `explore-demo` upload hidden in Creative Assets.
  Already accepted legacy workflow media/edits remain recoverable; no automatic
  migration, deletion or re-upload of earlier files is performed.
- Preserve independent Talking Head demo audio and whole-video music. Wall of
  Text has no Demo stage; its single background/opening source still uses
  Creative Assets. The storage boundary is a workflow difference that must
  survive shared UI work. Local verification is separate from deployment.
- Local verification: 143 targeted tests, TypeScript and scoped ESLint passed.
  Actual-component browser fixtures verify Saved demos in the sidebar/Change
  menu, separate picker inventories, poster/first-frame selection, draft
  retention and laptop/mobile fit. These tests use isolated account/API data;
  no production upload, migration, publishing or deployment was performed.

### Hook Remix final-frame captions — 16 October 2026, local fix

- The reported 3.167s Hook switched from “SaaS founders!! / This app is a game
  changer” to a smaller “I used to think marketing my SaaS / would take so much
  time” caption. Production Remix receipts confirm two blocks. The reference's
  second block occupies only its final 3067–3100ms screen-cut frame; scaling
  moved it to 3133–3167ms. The generated raw footage contains no captions.
- Hook remix excludes the reviewed one-frame screen-cut captions for paired
  references 4585ee949081c4e5cd835cd3 and 7c53cba88343579e7e15c8b0 only when
  their exact two-block timing signature matches. Extend the main caption to
  the full clip. Keep catalogue transcriptions unchanged; do not globally drop
  short captions, rewrite Wall/slideshow copy, or flatten authored sequences.
- Apply this to reference text shown for Remix, new server requests, legacy
  completed Remix recovery and explicit Apply. Reuse immutable paid receipts;
  cleanup must not trigger another model request. An older applied clip draft
  with the exact inherited timing signature is repaired in its derived editor
  state, preserving main copy, font, weight, size, position/color, trim/audio.
  Explicit Save persists the corrected draft; existing exported media is not
  rewritten. Manual timing changes and unrelated reference identities survive.
- Keep full-duration text visible over the last paused clip frame, including
  the exact endpoint; intentionally earlier text end times remain respected.
  Preview, clip-save content and final sequence all use the corrected edit.
- Local implementation and production acceptance are separate. No production
  data was modified and no generation or deployment was performed for this fix.
  The 53 focused checks, TypeScript, scoped ESLint and actual-component ending/
  legacy-recovery browser test passed. Broader slideshow mock and older preset
  browser failures are recorded in `docs/hook-remix-final-frame-2026-10-16.md`.

### Scheduling preparation timing failure — 16 October 2026, local fix

- Production Hook + demo posts selected for 20:18 and 20:37 failed before
  platform scheduling with `COMPOSITION_TIMELINE_UNSUPPORTED`. The uploaded
  opening `06 Hook07 Detailed` starts its pictures at 25 ms and audio at zero;
  the demo starts both tracks at zero. Unchanged retries repeat this failure.
- Local composition now accepts nonnegative input starts up to 100 ms and
  preserves relative timing: first-frame padding for delayed pictures, sample
  silence for delayed audio, and bounded end-frame padding for its audio tail.
  Common origins normalize together. Zero-start filters, duration/file limits,
  source ownership/hashes and strict zero-start output validation are retained.
  Larger, negative, nonfinite or inconsistent timelines remain blocked.
- Unsupported timing now has an allowlisted actionable message instead of
  silently falling through to generic finishing failure. Never expose arbitrary
  worker errors or suggest unchanged retries will repair a deterministic file.
- The exact production hook/demo/music, saved trims and text rendered locally
  with unchanged input hashes using bundled and installed media tools. Synthetic
  checks verify event timing and leading silence, not just successful encoding.
  This is not deployed production acceptance. Do not auto-retry past schedules
  or publish during verification. See the investigation/fix report in
  `docs/scheduling-video-preparation-failure-2026-10-16.md`.

### Slideshow attachment/history correction — 17 October 2026, release preparation

- Preserve the product flow: selected reference slides, ONE editable prompt and
  optional attached images go to AI image editing. Generated images remain
  ordered/grouped by version. The star receives text only; generation receives
  the actual references and attachments. Do not add per-slide prompt forms,
  corner selection, manual placement or automatic compositing to this release.
- The rejected manual placement/area editor and unfinished automatic vision
  placement experiment have been removed, including worker helpers and tests.
  They were local experiments, not a production correction.
- Composer drafts now retain prompt and ordered uploaded-asset IDs by owner and
  reference selection. Restore revalidates owned ready assets; failed recovery
  blocks submission and offers retry or clearing attachments while keeping text.
  Explicit uploaded-screenshot requests without an attachment fail before billing.
  This conservative English preflight does not interpret every possible request.
- Image history recovers prompt/model from the owned saved job, including legacy
  images lacking prompt metadata. Worker output records submitted/effective text.
- Local flow tests establish input delivery/recovery, not visual fidelity. A prior
  production request included the screenshot yet the model redesigned it; exact
  screenshot reproduction remains unproven until inspecting a real provider result.
  Track deployment and production acceptance separately in the release report.

### Slideshow live recurrence — 16 October 2026, investigation only

- Distinguish individual batches: the 14:46 IST Sunburst v3 jobs included the
  uploaded Explore screenshot; the 20:45 IST Flare v3 jobs contained only two
  catalogue originals and zero attachment references. The screenshot still
  exists as ready owned media. Upload inventory is not current selection.
- The production star receipt confirms a text-only Luna rewrite (979 to 620
  characters), and both latest job inputs equal the rewritten text exactly.
  Do not diagnose this as an unused rewrite or assume the star removed images.
  Its hook changes text only. Current attachment selection is component state;
  the specific browser action preceding the omission is not established.
- Prompt history really lacks job-backed image prompt enrichment: completed
  media metadata omits prompt/model, `/api/media` adds only slideshow position
  for image jobs, and browser-local fallback can conceal the gap. Original and
  rewritten text remain recoverable from server receipts/jobs.
- Full-image generation still has no screenshot compositor. Prompt wording and
  successful reference delivery are not exact-placement acceptance. These
  findings justify attachment draft recovery/admission validation, history
  recovery and separate exact placement; this audit implements/deploys none.
  Evidence: `docs/slideshow-live-root-cause-2026-10-16.md`.

### Shared video-workflow parity — 16 October 2026, local follow-up

- Apply meaningful common improvements across Hook Video, Talking Head + Demo
  and Wall of Text without waiting for separate requests for each caller.
  Slideshow editing remains separate. Audit actual caller/state paths rather
  than assuming a shared editor updates every surrounding screen.
- Talking Head's older creator picker lacked Your images. Its shared creation
  form (also used by creator/phone) now offers Your images / UGC Pilot images,
  refresh/retry, rounded source tabs, Add images and thumbnail clipping. Use
  the same owner-scoped uploaded-image inventory as Hook/Wall. Opening a picker
  or selecting a reference must never generate a video.
- Saved image selection resolves the current owned record, stays pending from
  the click, preserves existing references on failure, and obeys model limits.
  Talking Head/phone generation revalidates the saved image ID under the owner
  and uses its current URL, without uploading another copy. Local uploads and
  catalogue references retain their existing generation/upload behavior.
- Talking Head overview uses the same in-place Hook/Demo source menus as
  Hook Video, with direct upload and the appropriate inventory: Creative Assets
  for the opening and Saved demos for Demo; Generate alone navigates
  to Create. Preserve independent demo-only audio and whole-video music.
  Do not clear accepted demo audio or leave a rejected demo pending indefinitely.
- Wall exposes Change directly in its text editor: upload or Creative
  Assets stays within Edit; Generate goes to Create. Its top-left Create return
  matches its footer and retains the draft; Explore remains a separate exit.
  Keep text-first editing, advanced-only trim/style/audio, full-duration text,
  one complete background track, and no Demo stage or clip.
- Shared font/weight presets, compact style controls, custom preview playback,
  removed Hook/Talking Head Crop/Sound panels, and retained drafts already use
  shared clip components. Do not add redundant controls while closing parity
  gaps. Record local validation separately from deployed production acceptance.
- Local verification: 293 regression tests passed, plus TypeScript and scoped
  ESLint. The actual Talking Head form/library passed saved/catalogue selection,
  unchanged instructions and popup bounds at 1536×864, 1366×768 and 390×844.
  Shared Hook/Demo/Wall editor fixtures passed in-place menus, keyboard dismissal,
  retained trim/text/fonts and layout checks across eight laptop/mobile sizes.
  Auth/storage/API boundaries were isolated; no paid generation or scheduling
  was performed. This follow-up is not deployed or accepted in production yet.

### Contextual Remix emojis — 16 October 2026, local implementation

- Hook and Wall of Text generated remixes choose emojis for the rewritten
  line's meaning, emotion, business context and requested style. Do not retain
  reference emojis automatically. Replace or remove mismatched emojis, keep
  usage sparse and allow none. Positive discoveries/free resources should not
  inherit crying/distress merely because the original caption used it.
- Explicit requests to keep particular emojis or omit emojis take priority.
  Original catalog transcriptions retain their exact emojis; this policy changes
  generated copy only. Existing saved remix results recover without regeneration.
- The shared provider prompt records version 2 for new requests. Both workflows
  use the same prompt/service; timing, styling, review-before-Apply and saved
  business-context behavior are unchanged. Local checks do not establish live
  model quality or deployment; no paid generation was requested for this change.

### Contextual editor return and in-place Hook replacement — 16 October 2026, follow-up

- In Hook Video and Talking Head + Demo focused clip editors, the top-left
  arrow is labelled **Videos** and returns to the current workflow's video
  overview, using the same close action as the footer's Back to videos.
  Keep the selected clips and mounted editing drafts. Returning is not saving
  or preparing a video. The overview's normal exit remains unchanged.
- Keep a separate Explore link in the editor header for leaving the workflow;
  a Content Demo entry retains its separate Demo/library destination instead.
  Talking Head retains its existing unsaved-work warning on the external exit.
- Hook Video's overview **Change** buttons open a compact anchored menu in
  place, rather than redirecting to Create or focusing the Demo sidebar.
  Hook offers Upload video, Creative Assets and Generate video; only choosing
  Generate moves to Create. Demo offers Upload video and Saved demos only.
  Reuse the existing owned-media selection/upload handlers, limits and filters.
  Cancel leaves the current clip and edits intact; failed replacement restores
  the accepted demo. Accepted replacements invalidate stale final output.
- Talking Head and Wall now also use in-place replacement menus as documented
  above. No tab, Edit button or workflow names are renamed.
  Avoid repeating the mismatch between the editor header exit and its footer
  return, or making Change navigate before the user chooses a source.
- The preceding preview/picker UI release is live at commit 702fe9d3. These
  navigation/menu changes are subsequent local work; production acceptance
  and deployment of this follow-up remain pending.
- Local verification: 134 selection, clip-draft, navigation and source-menu
  regressions passed, along with TypeScript and scoped ESLint. Real-component
  isolated browser checks cover Demo Change/keyboard dismissal at 1280×720 and
  1536×864, plus retained trim/text/font drafts after the Videos action across
  the eight laptop/mobile editor fixture sizes. These fixtures disconnect live
  authentication/storage and are not production acceptance.

### Recognizable clip selection and balanced Demo previews — 16 October 2026, local change

- Keep Create → Demo → Schedule for Hook Video and Talking Head + Demo. Demo
  is the setup stage; Hook video and Demo video identify the two preview cards.
  Do not rename the stage to Edit, Play Demo or Attach during visual work.
- Latest user decision: keep **Edit hook video**, **Edit demo video**, **Change**
  and **Demo** unchanged. The suggested Text & trim / Text & edit names were
  not approved. Deployment of the completed UI changes is now authorized again.
- Remove the visible Optional badge from Hook/Demo video headings and Demo
  upload. This is a presentation rule, not a new validation requirement: keep
  existing one-clip paths, demo-only Hook scheduling, ownership and limits.
  Demo sound remains a separate optional audio feature for Talking Head only.
- The shared Creative Assets/Demo video picker must show a recognizable poster
  or the video's first decoded frame beside its name and duration/ratio. Load
  footage only for visible rows; use a neutral icon if media genuinely fails.
  A missing saved thumbnail must not reduce every selectable video to an icon.
  Preserve owner filtering, ready-only selection, demo inventory separation,
  retry and refresh. Thumbnail loading must not block choosing a valid video.
- Hook overview media uses available viewport height instead of the former
  180–360px height/328px card caps. Wider/taller laptop workspaces get larger
  previews; compact/short windows remain bounded. Physical laptop inches are
  not detectable: test CSS viewports (1280×720, 1366×768, 1536×864, 1920×1080)
  and mobile. Preserve natural video aspect ratio; never stretch footage.
- Talking Head overview cards share header and preview-slot sizing, including
  empty/one-clip/two-clip states. Keep Edit and Change together beneath the
  selected clip. Empty hook has Add hook video; empty demo has Upload demo video.
  The newer shared in-place Change menus are documented above. Do not couple
  these actions to playback load.
- Recurring mistakes to prevent: generic media icons hiding identity; fixed
  tiny portrait caps leaving wide gaps; inconsistent header buttons shifting
  video tops; oversized Remove text competing with filenames; duplicate or
  misleading Optional badges; casual stage renaming; replacing source-change
  actions with edit actions. Preserve the established audio ownership rules.
- Local checks and deployed acceptance are separate. These changes were made
  after the user paused release 24a6faa4; they are not included in that frozen
  release, and deployment must not resume without the user's request.
- Local verification: TypeScript (after Next route type generation), scoped
  ESLint and 117 workflow regressions passed. Actual-component browser checks
  cover visible first frames/failed posters/lazy rows/keyboard selection and
  separate inventories; aligned previews at 1280–1920px and 320/390px mobile;
  empty/uploaded/cropped demos; Edit/Change before upload confirmation; retained
  pending edits; and existing Hook/demo/Wall advanced editing controls. These
  are isolated fixtures, not signed-in production acceptance.

### One-box slideshow prompt rewrite — 16 October 2026, local implementation

- Latest user correction supersedes the per-slide improvement dialog proposal:
  keep ONE prompt field. A sparkle button inside its lower-right corner rewrites
  the existing conversational text in place. Do not add separate prompts,
  per-image forms, attachment checkboxes or another review dialog. The rewritten
  text stays editable; Undo restores the exact pre-rewrite text. Generation
  remains a separate explicit action and uses the current text-box contents.
- Icon clarification: show one four-point star only, without extra sparkles,
  surrounding circles, visible border or button background. Keep an accessible
  label and keyboard focus indication. Reserve a footer in the prompt box so
  text cannot scroll underneath the star or attachment controls.
- The text-rewriting endpoint accepts only {prompt}. No selected-slide numbers,
  attachment metadata, business profile, image URLs, OCR or pixels are sent.
  User-typed URLs remain ordinary text; the rewriter does not browse or claim to
  inspect images. Preserve exact wording, URLs, exclusions, per-slide scope and
  reference labels as authored. Do not invent scenes, props, claims or CTAs.
- Return ONE prompt plus optional clarification notes displayed below the input.
  Users resolve those by editing the same prompt; no extra per-slide workflow.
  Duplicate clicks are fenced, and delayed results cannot overwrite text after
  the user changes the request, reference inputs or account.
- The prior per-slide generation compiler and attachmentLabels worker changes
  were removed. Existing image-generation request/worker contracts, reference
  delivery, business context, billing, version grouping and recovery are retained.
  Actual reference/uploaded images are still sent during image generation.
  Exact screenshot compositing remains separate and is not implemented here.
- Private improvement receipts and a service-only invoker claim RPC prevent
  automatic repeated provider calls and enforce 20 attempts per rolling 24h per
  owner. No image-generation credits or image jobs are created by rewriting.
  Browser recovery reuses request identities after uncertain responses. Provider
  SDK retries are off; terminal failure retries require an explicit new click.
- Local tests, browser fixtures and deployment acceptance are distinct. Apply the
  slideshow_prompt_improvements migration, deploy the web API/composer and enable
  EXPLORE_SLIDESHOW_PROMPT_IMPROVER_ENABLED=true. No worker change is required for
  this simplified feature. OPENAI_SLIDESHOW_PROMPT_MODEL optionally overrides the
  existing text-model default. Deployment and actual provider-output quality
  evaluation remain pending. See docs/slideshow-prompt-improvement-2026-10-16.md.
- Local verification passed: 161 focused/regression tests, TypeScript, scoped
  ESLint, desktop/mobile one-box browser checks and full 166-route builds.
  Payload checks confirm no saved business context reaches the text rewriter;
  existing image-generation tests confirm its owner-frozen profile still does.

### Video text fonts and compact inspector — 16 October 2026, local implementation

- The user approved Inter, DM Sans, Roboto Condensed and Montserrat, then
  clarified that the existing compact Text style card must remain. Add only
  one small bottom row with Font and Weight side by side. Do not turn the
  inspector into a wide form or add another section/page. Keep the existing
  preset, position/color and sliders in place. The wide isolated font fixture
  is not the product layout; full-editor screenshots verify the compact card.
- Fonts and weights (Regular 400 / Medium 500 / Bold 700) are independent
  overrides. Both existing presets remain. Selecting a preset resets its weight
  while retaining the chosen family; font/weight changes retain authored copy,
  timing, color, size and position. Original (Arial) preserves legacy appearance
  and offers its existing Regular/Bold weights. New Hook text starts in Inter
  Medium; new Wall text uses Inter Regular. Existing edits gain no new defaults.
- The shared clip editor supplies these choices to Hook and Talking Head/demo
  clip editing. Wall keeps these controls behind its existing advanced Edit
  action and retains full-duration text. Speech-caption styles and slideshow
  typography are separate and are not changed by this feature.
- Optional, whitelisted font/weight fields survive save/reopen, sequences and
  Remix. Missing fields retain old normalized drafts, wrapping, fingerprints
  and rendering paths. New faces use matching bundled WOFF2/TTF assets with OFL
  licenses and pinned-source hashes, prepared by `prepare-explore-text-fonts.py`.
  Their advance metrics drive shared line wrapping. Fonts load locally; no
  Google Fonts request is required when a user edits or exports a video.
- Export draws supported glyphs directly from the bundled face into the existing
  SVG/PNG text layer. Do not rely on runtime system-family substitution: initial
  native-lookup tests produced duplicate faces. Unsupported glyphs retain the
  existing system fallback (including emoji/CJK). Legacy exports are unchanged.
  The worker adds opentype.js; install its locked dependencies before rendering.
- Local verification: worker build, TypeScript and scoped lint passed; 128
  focused tests covered all 12 distinct faces, actual timed video export,
  validation, legacy drafts, blank drafts, Remix and clip behavior. Browser
  checks covered all 12 web faces, save/reopen, Wall advanced-only controls and
  the real Hook/demo/Wall layout at 320–1900px. Font and Weight share one row
  under 65px high; the existing desktop inspector remains at most 300px wide.
  These changes are not deployed. Production acceptance requires the updated
  worker (dependency/assets) before the web release and a signed-in check.
- Final combined Next build compiled successfully, but its TypeScript phase
  failed in concurrent slideshow work: `slideshow-prompt-improver.tsx:35–36`
  passes a number where AbortSignal is expected and assigns unknown to its
  result type. Earlier TypeScript checks passed before that new component
  arrived. Do not report the combined build as passing or deploy on that basis.

### Choose image picker polish — 16 October 2026, local change

- The user's circled Add image and image-source tabs requested UI polish only.
  Keep Choose image, Add image, Your images and UGC Pilot images labels and
  existing selection/upload/generation behavior. Opening the picker or selecting
  an image must not start video generation.
- Add image is a compact rounded button with a plus icon; sources are separate
  rounded tabs with a clear selected state. Use rounder clipping on saved,
  catalogue and selected image thumbnails. Keep keyboard focus, owner scoping,
  limits, pending state and saved-image reuse intact.
- Local checks: 16 existing reference-picker tests, scoped lint and TypeScript
  passed. Actual-component browser fixture checked source tabs, saved selection,
  native upload chooser and laptop/narrow fit. No deployment or authenticated
  production acceptance is claimed for this change.

### Slideshow assembly and Add slides — 16 October 2026, local implementation

- The user authorized only assembly/UI work; exact screenshot placement and AI
  generation-quality corrections remain deferred. Group each generated version
  as one ordered horizontal strip with explicit **Edit these N slides**. Do not
  auto-populate drafts on completion. Whole-version switching archives the prior
  draft; individual Add and Replace labels reflect the actual pending action.
- Add slides opens an in-place picker: Generated images / Original reference /
  Upload images. Create new slides alone navigates to Create. Original selection
  is optional and explicit, includes source numbers and Select all remaining,
  and marks already represented originals/recreations. Never include all source
  slides automatically. Show the 10-slide capacity and block oversized choices
  without truncating a 12-slide master.
- Catalogue originals are registered as owned ready images through the new
  authenticated reference-images endpoint using server-resolved IDs and immutable
  storage objects. Uploaded references reuse owned IDs. No AI generation credits
  are consumed. Keep v2 owned-source save/editable-draft contracts and legacy
  fingerprints unchanged. New originals fill source-order gaps while existing
  slide order, text and edits are preserved; generated/upload additions append.
- Local verification: 150 tests, TypeScript, scoped lint and full 164-route build
  passed. Real editor/picker desktop/mobile checks and existing recovery browser
  regressions passed. These changes are not deployed and signed-in production
  acceptance remains pending. See `docs/slideshow-assembly-ui-2026-10-16.md`.

### Catalogue video previews and source-post access — 16 October 2026, local change

- Hook and Wall reference popups use the shared custom play/pause, seek, mute
  and fullscreen controls. Do not reintroduce native video controls, a Download
  action, picture-in-picture or remote playback here. Suppress the reference
  video's context menu. This concerns catalogue reference footage; owned output
  downloads retain their existing rules. UI restrictions are not copy protection
  for media delivered to a browser.
- Keep the Hook Instagram/TikTok source icon visible for free accounts. Clicking
  it opens **Upgrade to Pro** with a pricing link, without opening the source,
  selecting Recreate or opening the preview. Only verified Pro access supplies
  the external source link. Unverified access must not expose a clickable source
  link. Apply this to both overlay and compact-caption icons and both Explore
  workspace entry points. Wall continues to have no source-post icon.
- Verify mouse and keyboard upgrade actions, Pro navigation, Hook/Wall custom
  playback, close/unmount, and short/narrow viewports. Local checks are separate
  from authenticated production acceptance; the production browser currently
  redirects to sign-in. This change has not been deployed from this chat.
- Local verification passed: 65 focused tests, TypeScript and scoped ESLint.
  The real-component Edge fixture covers free mouse/keyboard gating, Pro source
  links, independent Recreate, play/pause, keyboard seeking, mute, custom-control
  fullscreen, suppressed context menu, close/unmount, 1280×720 and 390×844 fit.
  Wall uses the same dialog/player with Wall format metadata in this fixture;
  this does not establish authenticated production playback or entitlement state.

### Add slides and exact-asset use — 16 October 2026, user clarification

- Retaining unchanged originals is the user's choice: they may add some or all
  remaining master slides. Do not automatically add every ungenerated original.
  Proposed Add slides opens an in-place picker with Generated slides, Reference
  slides and Upload images sources; only Create new slides navigates to Create.
  Reference slides should offer numbered thumbnails, multi-select, select all
  remaining, existing-slide indicators and an explicit Add selected action.
- Generated results remain grouped by batch/version; users can use the version
  or choose individual outputs. Reference identity/source position is distinct
  from output position. Additions retain reference order and existing edits;
  users can reorder/remove before saving. Imports consume no AI generation
  credits and must retain owned-media/readiness validation and the current cap.
- A sparkle/prompt-improvement button may offer an editable, optional per-slide
  brief, but cannot guarantee exact screenshot insertion or silently rewrite
  instructions. Recommend a separate Place image operation: choose the uploaded
  asset, target slide and four screen corners; preview a perspective transform
  of actual pixels. Use relevant business facts only, not an automatic request
  to invent a brand interface. These design decisions are not implemented yet.

### Fresh v3 fidelity and master-slide assembly audit — 16 October 2026

- Release `d73ef153` deployed the earlier local v3, notice, provider-error and
  Explore corrections. Historical local/pending notes below describe their
  earlier state; they are not evidence that v3 is still undeployed.
- Fresh batch `09e14462-478d-4a58-af80-d04a2cef4847` completed at 14:47 IST
  with v3 and Sunburst, Marketing slides 1/4 and the uploaded Explore screenshot.
  It still invents a white website instead of inserting the actual dark screen.
  Exact screenshot compositing and visual-fidelity acceptance remain absent.
- The user now requires a version's generated images to appear together and
  a way to retain/add unchanged master-reference slides around replacements.
  Grouping metadata exists, but cards remain individual; image selection appends
  unless an explicit replacement is pending. The current owned-image editor has
  no master-original picker/import. Do not claim these are supported already.
- Marketing 01 has 12 originals; saved slideshows currently support at most 10.
  Preserve original positions and batch provenance; never silently truncate or
  weaken ownership checks. The safe design imports chosen catalogue originals
  as owned media and retains the current editable save contract. These are
  requirements/proposals, not completed implementation. See
  `docs/slideshow-fidelity-and-master-assembly-2026-10-16.md`.

### Nearest-second reference selection — 16 October 2026, latest correction

- The user's latest instruction replaces the earlier round-up policy for new
  Hook/Wall Omni reference submissions. Auto-select the nearest whole second:
  3.3 → 3, 3.49 → 3, 3.5 → 4, 3.7 → 4, 6.3 → 6 and 6.7 → 7. Retain the existing
  three-second minimum. UI seconds, submitted admission duration and the server's
  new credit reservation calculation must use the same rule.
- The Duration field shows this rounded selection. A compact hint retains the
  actual reference length and states that Omni keeps source timing. This request
  changes the seconds selection; it does not authorize silently trimming,
  stretching or padding an Omni source edit. Fractional source metadata and the
  output-duration validation remain intact. Existing admitted jobs/receipts are
  not rewritten. Scratch/WAN output selection remains independent.
- This supersedes references below and in the earlier audit to ceil/round-up
  billing and the previous Reference length field label. These changes are local;
  deployment and authenticated production acceptance remain pending.

### Close-edit slideshow default — 16 October 2026, local clarification

- The user clarified that selected slides should be reproduced as closely as
  possible with only requested changes. New v3 prompts explicitly call this a
  close edit, rather than inspiration or mood-board reinterpretation. A changed
  background does not authorize changing typography, camera or unrelated objects.
- Screen replacements preserve device boundaries, perspective and surrounding
  scene and apply only to the requested output. This is still generative edit
  guidance; exact screenshot fidelity needs a separate compositor, not yet built.
- Existing v2/legacy retry prompts remain frozen for compatibility. V3 is local
  and must deploy worker first, then web. No actual generation-quality acceptance
  is claimed by provider-stub regression tests.

### Latest slideshow quality investigation — 16 October 2026

- Completed batch `2324bf8d-02c7-4010-8b76-19a93fcb94b7` correctly contains
  Marketing slides **1 and 4**, the unchanged user prompt, business snapshot
  and uploaded dark Explore screenshot. Do not apply the earlier batch's 1/5
  mismatch to this request. Both latest outputs were saved and billed.
- The supplied outputs still redesign the reference scene/text treatment and
  invent light dashboards. Saved jobs use v2; preservation v3 remains local.
  Matching fingerprints in a stubbed real-worker replay verifies input delivery,
  not model fidelity. No screenshot compositing or semantic acceptance gate
  exists in this image-worker path. Completed is technical success only.
- Correction needs preservation/scoped prompts plus fresh visual acceptance;
  exact UI insertion requires compositing actual pixels. The audit does not
  change model, quality, provider credits, job records or application behavior.
  See `docs/slideshow-output-fidelity-audit-2026-10-16.md`.

### Slideshow failure-banner dismissal — 16 October 2026, local repair

- The slideshow generation error badge now has an accessible × and disappears
  after three seconds. A stable attempt/job identity prevents unchanged status
  polls from reviving it; a distinct failure gets a new notice and timer.
- Dismissal changes only the banner presentation. Stored job status, generation
  recovery, History, selected references, generated images and credit settlement
  are untouched. Progress remains visible; other workflows retain their existing
  error behavior. Returning in a fresh mounted visit can show the failure again.
- Local API-free browser checks cover timing, mouse/keyboard dismissal, polling,
  replacement/unmount cleanup and desktop/mobile layout. Deployment and signed-in
  production acceptance remain pending. See
  `docs/slideshow-error-notice-2026-10-16.md`.

### Slideshow provider-credit errors — 16 October 2026, local repair

- The two reported Flare slideshow batches reached OpenAI but failed with
  `credit_balance_exhausted`. All four one-credit app reservations were released.
  This is separate from worker capacity, reference delivery and prompt policy.
- Known provider billing failures must be terminal and clearly identified;
  HTTP 429 alone does not imply a temporary rate limit. Genuine rate limits
  retain retries and uncertain submissions retain duplicate-charge protection.
- The local worker/public-error repair requires deployment. It does not buy
  provider credits, switch models or replay historical failed requests. Actual
  recovery needs a funded provider account and a fresh authorized generation.
  See `docs/slideshow-provider-credit-failure-2026-10-16.md`.

### Slideshow reference preservation — 16 October 2026, local implementation

- New Explore slideshow jobs use reference contract v3: each selected slide is
  its output's base. Preserve its visual style, composition and tone by default;
  adapt only relevant business details. Explicit user requests override these
  defaults within their scope. Business brand tone, visual keywords and CTA ideas
  must not silently turn a reference into a redesigned advertisement.
- All selected image bytes and uploaded attachments still reach the provider.
  Numbered attachment roles and output positions identify the intended inputs.
  Prompts scope slide-specific changes to the corresponding selected output and
  ask screenshot replacements to retain the actual uploaded interface. This is
  model guidance, not deterministic instruction extraction or pixel compositing.
- Reference headlines remain editable Remix Text by default. Explicit requests
  for visible image text retain the reference typography/position/boxes and exact
  supplied wording unless the user requests changes to those properties.
- Already-admitted v2/legacy jobs keep their original prompts and fingerprints.
  Deploy the compatible image worker before the web API begins admitting v3.
  Local regressions pass; new model-output visual and authenticated production
  acceptance remain pending. See `docs/slideshow-reference-preservation-2026-10-16.md`.

### Finishing worker warm-instance preference — 16 October 2026

- The user elected to keep Explore finishing warm for faster first-request
  response. Its service-wide minimum is now 1, revision minimums remain 0 and
  unused historical tags remain removed. Request-based CPU/billing and the
  existing authenticated HTTP processing contract are unchanged. This replaces
  the idle-zero preference below; it does not alter heavy Cloud Run Jobs.

### Finishing worker idle-cost policy — 16 October 2026

- The authenticated interactive finishing HTTP service remains enabled with
  the same image, environment, ownership rules, task URL, request timeout and
  one-request concurrency. It can now scale to zero when idle; enabling
  interactive finishing no longer forces a warm instance. Accept the first
  request's startup delay. Heavy rendering retains its existing Cloud Run Job
  launcher, slots and execution lifecycle. No editor, save or schedule flow
  changes accompany this infrastructure-only change.
- Old unused tagged revisions were detached after endpoint checks. Startup and
  authenticated no-work task delivery passed, and 51 related regressions passed.
  This does not constitute a newly rendered customer video or measured cold
  start from zero. Detailed evidence: `docs/worker-idle-cost-rollout-2026-10-16.md`.

Last reconciled: **15 October 2026**.

### Reference prompt submission and fractional timing — 16 October 2026, local follow-up

- Generate video submits the current visible reference instructions followed by
  the user's separate instructions, joined once. Remove prompt omits that block
  while retaining the video. Editing/restoring it changes the submitted prompt;
  recovery reuses the frozen combined request without appending it again.
- Reviewed performance prompts remain a Hook catalogue capability. Wall shares
  the composer but does not acquire invented Hook-style performance prompts.
  Its own instructions still reach the worker, with the existing clean-background
  instruction added by the server.
- Omni source-video edits use the source timeline. A 3.7-second Hook or
  6.7-second Wall reference is not submitted as a fresh fractional-duration
  text-to-video request: the provider receives the source bytes and `task: edit`,
  without an output-duration override. Current app admission allows source edits
  up to ten seconds. Output duration is measured and must stay within 0.25 seconds
  of the source; otherwise the worker rejects it before storage. This is a
  validation contract, not a promise of frame-exact provider quality.
- Display **Reference length** and **Uses source timing** in this mode. The
  rounded duration in admission is the existing credit calculation (ceil, minimum
  three seconds), not permission to stretch/trim the source. Ordinary scratch and
  WAN reference generation retain the selected supported whole-second output
  duration. Do not show fractional source length as their requested output.
- Reference prompt actions use 12px text (32px desktop / 44px coarse-pointer
  targets); the reference text is 13px. Keep user instructions separate and fully
  editable. See `docs/explore-reference-prompt-and-duration-2026-10-16.md` for
  tests, primary provider documentation and local/production limits.

### Video provider routing — 18 October 2026, local implementation

- User clarification: ReAPI means `reapi.ai`, a distinct provider from
  OpenRouter. Every newly admitted Seedance 2.5 and WAN 3.0 request now freezes
  `provider: "reapi"`. Seedance uses `doubao-seedance-2.5-face` with the explicitly
  requested Less Restriction setting (`content_filter: false`). WAN uses
  `wan3.0-video` with `content_filter: true`; never switch review channels on
  rejection. The ordered images/audio/video reach their native `image_urls`,
  `audio_urls` and `video_urls` fields. Existing UI model IDs remain stable.
- Previously accepted OpenRouter, Runway and Higgsfield jobs retain their exact
  provider and fingerprint for recovery. Untagged legacy jobs keep their older
  routing. Lost POST responses stay uncertain and cannot create a second task.
  ReAPI task IDs are saved before polling, costs come from settled usage, and
  completed CDN files are copied into the existing application storage.
- Preserve ownership/readiness and the six-file limit. ReAPI admission permits
  Seedance audio/video 2–30 seconds, WAN 1–15 seconds, MP3/WAV audio up to 15 MB,
  and MP4/MOV video (Seedance up to 200 MB; WAN retains the stricter 32 MB app
  cap). WAN reference video plus output cannot exceed 30 seconds. Validate
  before billing; never silently trim, drop, or reinterpret a reference.
- Migration `20261018062729` adds `reapi` to the provider check without changing
  existing rows or access rules. Release order: migration, funded worker-only
  `REAPI_API_KEY`, compatible generation worker, then web. Historical
  `NEXT_PUBLIC_ENABLE_OPENROUTER_*` flag names remain deployment-compatible.
  Local regressions verify requests and recovery with mocked HTTP; deployment
  and authenticated paid production acceptance remain pending. See
  `docs/reapi-video-routing-2026-10-18.md` for the verified provider contract.

### Slideshow input fidelity audit — 16 October 2026

- Production batch `618eb823-1cb6-4e0d-9456-c2993aedbfb8` contains applied
  business context, selected Marketing slides 1 and 5, and the user's uploaded
  Explore screenshot in both output jobs. Worker replay matches production
  operation fingerprints and passes all three references to the provider.
- Input delivery is not proof of output fidelity: the inspected result invents
  a white dashboard instead of preserving the uploaded dark Explore screen.
  The create prompt describes references as style inspiration, sends all
  multi-slide instructions to every output, and does not promise exact screen
  compositing or minimal-change preservation. The audit itself changes no
  behavior; the local v3 follow-up above corrects the prompt policy, with output
  fidelity still awaiting fresh generation and production acceptance.
- Earlier production slideshow jobs really lack a business-context snapshot.
  Keep historical missing-context behavior distinct from this latest batch.
  Evidence: `docs/slideshow-input-audit-2026-10-16.md`.

### Demo loading and focused-editor footer — 16 October 2026, local implementation

- Hook Demo overview **Edit demo video** and **Change** are navigation actions;
  they must not wait for full playback buffering, another clip's loading or an
  upload acknowledgement. After local metadata validation, trim/manual text can
  be edited while the demo uploads. Save and Schedule still require confirmed
  owned media and their existing validation. Remix generation remains gated
  during an unconfirmed upload; no paid request is triggered by opening Edit.
- Keep pending edits separate from the last accepted recoverable draft. Upload
  confirmation preserves the pending trim/text. Failed replacement restores the
  prior clip, edits, framing and source mode. A newer upload, saved-media choice
  or removal supersedes the pending request; late completion cannot replace it.
  Source controls stay usable during the video upload. This Hook implementation
  does not establish the same pre-upload editing capability in Talking Head.
- Demo upload's additional browser metadata read has a 15-second timeout so a
  missing event cannot leave the upload busy forever. It is not a network-upload
  deadline and does not bypass server ownership/readiness checks.
- Focused Hook/Talking Head/Wall editors omit the routine “Changes appear in the
  preview immediately. Save edits to keep them.” footer row and horizontal rule.
  Keep compact Save/return actions, button saving/saved labels and actionable
  loading/error/retry feedback. Never reserve an empty instruction row after it
  is removed. This does not remove scheduling review or necessary upload errors.
- Evidence and acceptance limits: `docs/explore-demo-loading-and-editor-footer-2026-10-16.md`.
  These follow-up changes are local and are not part of deployed `cdf8c936`.

### TikTok promotional disclosure default — 16 October 2026, local implementation

- Settings → Preferences → Publishing defaults → TikTok defaults now exposes
  **Label posts as promotional content**, off by default for existing and new
  accounts. Enabling it selects TikTok's own-brand disclosure and adds the
  “Promotional content” label. AI disclosure and paid partnerships are separate.
- New Explore schedules use the saved account preference. Trending and the
  scheduler share the same off default. Saved target choices and already queued
  posts retain their settings; changing preferences is not a bulk post update.
- This supersedes the October 9 background own-brand-on default recorded in
  `docs/tiktok-ui-visibility.md`. A new database migration and web release are
  required. Local tests are separate from authenticated production acceptance.

### Influencer workspace references and downloads — 16 October 2026, local implementation

- Build AI influencer results support independent multi-selection. Selected images
  become numbered reference thumbnails beside the composer; My influencers also
  supports selecting up to ten saved images and applying them together with
  **Use images as references**. Each reference can be removed individually or
  cleared together. A selected reference stays attached when its result card is
  dismissed from the workspace. Uploading a reference retains the existing
  uploaded-image mode and replaces the saved-image selection.
- The × on a completed result only dismisses that card from the current visit.
  It never deletes media, removes a saved influencer, or discards job recovery or
  History. Opening an image explicitly from History can show it again.
- Result cards and My influencers provide authenticated image downloads with
  short-lived attachment URLs. Ownership and ready media are verified by the
  server using the saved asset ID; browser-supplied storage URLs/keys are ignored.
- Multi-image requests carry ordered owned influencer IDs through admission,
  durable retries and every supported worker/provider adapter. The user's prompt
  stays unchanged. Reference order participates in idempotency. Partial reference
  restoration blocks generation instead of silently dropping context.
- These changes require both web and worker deployment. Local fixture/API checks
  do not constitute authenticated acceptance on `https://www.getugcpilot.com`.
  See `docs/influencer-image-actions-2026-10-16.md` for verification details.

### Reference performance prompts — 16 October 2026, Hook catalog released

- The user selected the original detailed approach: a short replacement
  instruction, one clip-specific action/expression paragraph and preservation
  priorities. The later numbered five-part template is not the default.
- Selecting a reviewed video exposes an editable **Reference prompt** block
  beside the user's instructions. Remove prompt keeps the video attached;
  Restore prompt restores the approved suggestion. An info disclosure explains
  its purpose. Switching reference replaces its suggestion without overwriting
  the user's separate instructions. The submitted prompt joins exactly those
  visible fields; the server must not secretly append removed suggestions.
- Each suggestion contains overlay text/caption/emoji removal and no-new-text
  instructions. Physical signs/packaging text are preserved. Do not hardcode
  the test influencer's hair, clothing or image into library entries. Identity
  replacement is conditional on an attached influencer image. User instructions
  follow the suggestion and may request deliberate changes.
- All 98 active Hook references have reviewed entries in
  `lib/explore/reference-video-prompts.ts`. The first three were initially sampled;
  all reviewed entries have been inspected through every decoded frame. Hooks 01–09 have
  92, 92, 110, 94, 96, 112, 78, 79 and 85 inspected frames respectively.
  Review method is `all_decoded_frames`, not a claim of real-time playback,
  audio review or generation-quality acceptance. Hooks 01–03 and 06 have
  single-frame screen-view tails; Hook 07 also has a single-frame laptop/pen tail.
  Hook 04 has a brief caption/browser tail; Hooks 05, 08 and 09 stay in their
  original scene. Keep source tails brief; do not extend them or
  silently trim the original. Version 2 paragraphs record the precise gestures.
  Scope clarified by the user: only Hook video workflow references for now.
  Its active catalog contains 98 videos: 98 reviewed prompts and none remaining.
  The earlier 195/192 totals incorrectly included 97 Wall videos. Wall of Text
  and slideshows are outside this prompt rollout. No Wall prompts were prepared.
- Review Remix source captions during the same video inspection. Use the existing
  source-hash-bound `reference-text-catalog.json`, preserving original wording,
  emojis and caption timings; exclude app UI, packaging and incidental text.
  Do not put Remix captions into the footage-generation prompt. Hooks 01–98
  now have all-frame caption checks, including the first three pilot entries.
  Hook 04's final instruction begins at 3033 ms, correcting its earlier 3200 ms
  sampled boundary. Individual caption notes distinguish corrected boundaries
  from retained approximate timing. Original source claims are not fact-checked.
- Additional all-frame caption corrections: Hook 42 changes at 3400 ms; Hook 43
  at 3167 ms; Hook 48's additional caption starts at 2333 ms and its first emoji
  is 🤨; Hook 64's additional caption starts at 1733 ms; Hook 72's first emoji is
  😳; Hook 74's sequence is 👹😨🤯😭 and ends at 3567 ms; Hook 85's caption ends at
  6033 ms before its last two frames. Hooks 94–95 have graphic formulas only:
  retain `no_text` with empty Remix blocks and remove those overlays in footage.
- Hook 14 cuts to a calm second take at frame 170 / 5667 ms; the creator caption
  ends there, correcting its prior 5333 ms sampled timing. Hook 27 has a background
  colleague: replace only the foreground performer's identity. Full source takes,
  subtle gestures and brief screen tails must be described as observed.
- Hook 07 retains its original top caption while adding the website instruction
  in the final frame; overlapping caption blocks are intentional. Hook 08 is a
  stretch, not a surprise reaction. Its floating logo equation is transcribed
  semantically in the existing Remix record, while the generation prompt removes
  that added graphic and preserves physical laptop stickers. Hooks 07 and 09
  lift glasses onto the head, unlike Hook 02 which removes and lowers them.
- Suggestions bind to permanent reference ID and content-addressed source hash.
  Changed source bytes invalidate the suggestion. New references require review.
  This local content review does not deploy the website, alter soundtracks or generate
  paid media. Authenticated production acceptance remains a release check.
  Completion evidence and per-Hook notes:
  `docs/hook-reference-individual-review-2026-10-15.md`.
- Hook-only commit `a1fdfd2924bc571217cd422ae0afe999455508e8` subsequently
  deployed to website and shared MCP production. All 41 focused checks and the
  isolated production build passed. First-five Recreate/edit/remove/restore and
  exact Remix fields passed real-component desktop/mobile checks. Live reference
  reads confirmed Hooks 01–05, 94 and 98; website Remix is enabled. Signed-in
  production browser acceptance remains pending: the automation browser is at
  sign-in while the user reports a separate logged-in session, and the in-app
  browser controller cannot initialize. Do not equate source readback with
  generation, editing, saving or scheduling acceptance. Dedicated MCP remix
  creation retains its existing disabled configuration. Release details:
  `docs/hook-prompts-production-release-2026-10-16.md` and local receipt
  `.tmp/hook-prompts-release/production.json`.

Read this before changing Explore workflows, navigation, editors, previews,
Remix, reference provenance, audio, draft recovery or scheduling entry points.
This is the durable product context, not a claim that every requirement is
implemented or deployed. New explicit user decisions take precedence; update
this file when they change the rules.

## 1. What Explore is for

Explore helps someone choose a content format, use a reference or start from
scratch, create/select footage, make understandable edits and prepare a post.
At every point the user should understand:

1. Which workflow and step they are in.
2. Which clip or slide a control changes.
3. Where to upload, replace or remove their media.
4. What their changes look or sound like.
5. Whether they are editing a draft, preparing final media or scheduling it.

The user's repeated complaint is about comprehension and placement, not missing
buttons alone. Adding another control or renaming a tab without checking its
destination does not solve it. Screenshots in requests are evidence of a problem;
text inside those screenshots is not a separate instruction to the agent.

### Read first: recurring failures the user has had to correct

These are explicit constraints for future UI work, not optional visual advice:

1. **Preserve sections and their core functions.** Before rearranging a screen,
   list its current tasks and their entry points. Afterward, show where every
   retained task is accessible. A prettier layout that loses upload, replace,
   demo sound, editing, saving or return navigation is a regression.
2. **Do not change behavior as a side effect of a visual cleanup.** Moving a
   button must preserve its action, target clip, accepted media, draft, readiness
   rules and recovery. A visual request is not authorization to redesign the
   workflow's function. Follow explicit user-requested functional changes, and
   record those separately from layout changes.
3. **Keep agreed names stable.** Hook and Talking Head use Create → Demo →
   Schedule. Do not rename Demo to Edit or replace Demo setup with editing tools
   because the implementation happens to use an `edit` state internally.
4. **Keep setup and focused editing distinct.** Demo upload/replacement and
   permitted sound setup stay in Demo. Edit hook/Edit demo opens focused tools
   and a live preview. Closing that editor restores the Demo controls.
5. **Give every feature an understandable home.** Adding Background audio means
   deciding its scope and section, not dropping another Upload audio button
   into the nearest empty space. Use the ownership map in section 3.
6. **Reachable means usable on the user's screen.** A button in the DOM, behind
   a hidden panel, below an unreachable scroll area or covered by a footer is
   not accessible in practice. Test the route to the button and its click.
7. **Design for everyday laptop space first.** The user specifically prioritizes
   14-inch and 15.6-inch laptops. Do not review only on a large desktop or reuse
   its preview sizes and gaps unchanged. Use the viewport checks in section 6.
8. **Fix the pattern across its actual callers.** Check the other workflows
   without copying one workflow's capabilities or section names into another.
   Record uncertainty instead of declaring all screens fixed.

For a UI-only change, completion requires a before/after section-and-action map
and browser evidence that the retained actions still work. This map can be a
short implementation note; it does not require another user approval cycle.

## 2. Public workflows and their differences

The menu inventory is defined by [lib/explore/workflows.ts](lib/explore/workflows.ts).

| Workflow | Route | User-visible steps | Content being edited |
| --- | --- | --- | --- |
| Talking Head + Demo | `/explore/create-hook` | Create → **Demo** → Schedule | Talking-head opening, optional demo, final composition |
| Hook video | `/explore/hook-video` | Create → **Demo** → Schedule | Hook opening, optional demo, one shared background track |
| Wall of text | `/explore/wall-of-text` | Create → Edit → Schedule | One background video with full-duration wall text; optional advanced video controls; no demo composition |
| Slideshows | `/explore/slideshows` | Create → Edit slides → Schedule | Ordered images with text and appearance per slide |

**Do not mechanically rename every second tab to Demo.** That decision applies
to Hook and Talking Head, which have a demo step. Wall edits one video;
Slideshows edits slides. Extending either with a demo is a separate product change.

Creator Shows App on Phone remains hidden, even though retained components share
some code. Recreate redirects into current workflows; it is not a fifth public
workflow. AI influencer creation, AI Studio and Audio generation are adjacent
tools, not covered end to end by a video-editor check. Explore Slideshows and
the separate Carousel system must not be conflated; Carousel changes also require
reading `CAROUSEL_CONTEXT.md`.

### Naming traps in the implementation

- Talking Head uses `HookWorkflowPreview` and internal section value `edit` for
  the user-visible **Demo** step. A label change need not change saved URL values.
- Hook video uses `FormatWorkspace` with `format="hook"`; its overview uses
  internal step `demo`. A focused clip editor is additional state, not another
  top-level workflow tab.
- Wall uses `format="wall_text"`; Slideshows uses `format="slideshow"`.
- `FormatVideoEditor format="hook"` is also used by Talking Head. This does
  **not** give those products identical reference or audio capabilities.

Preserve existing deep-link/restoration behavior when changing visible labels.

## 3. Screen responsibilities and navigation

### Feature ownership: where controls belong

Choose the user's task and scope before choosing a position. Do not split one
feature across unrelated sections merely to fill space. Related controls should
have one named group with the entry, current selection, replacement/removal and
relevant feedback together.

| Task / feature | Home and grouping | Placement to avoid |
| --- | --- | --- |
| Generation source, references and instructions | Create; group source choices with their accepted selection and status | Putting generation inputs inside a focused clip editor |
| Demo upload, replacement and removal | Demo overview in Hook/Talking Head; selected filename and Replace/Remove next to its source controls; card Change may lead to that same group | Hiding the entire group once a preview exists; replacing it with trim/text tools |
| Edit hook / Edit demo | Compact action attached to the matching preview card; opens that clip's focused editor | Unlabeled Edit far from its clip, or a top-level Demo tab repurposed as editing tools |
| Workflow background audio/music | One clearly named composition group in Demo for Hook/Talking Head, showing the track's whole-video scope; any Create entry must reflect the same choice | Separate competing hook/demo background selections, duplicate Upload audio groups with unclear scope |
| Talking Head Demo sound | Distinct optional group beside Demo setup; clearly says it affects the demo only | Treating it as the whole-video background track or removing it during layout cleanup |
| Hook demo's original volume | Compact original-sound control in Demo setup; preserves the existing footage sound | Sound panels or separate demo-audio upload/library groups in focused editing |
| Text, Remix and appearance | Focused editor; reference Remix prominent, style controls beside the text where width permits | Duplicate Remix on overview; style sliders in a distant unrelated panel |
| Clip Save and return | Stable editor footer with distinct primary/secondary emphasis | Schedule occupying Save's role or a footer covering controls |
| Final preparation and scheduling | Composition overview/preparation status and Schedule review respectively | Repeated preparation/refresh controls overwhelming the clip editor |

For example, “add background audio” must answer: does it span the whole video,
which existing group owns it, how is the current track shown, and where can it
be changed? For Hook, it is one choice spanning opening and demo; Talking Head's
allowed Demo sound remains a separate, explicitly scoped capability. The music
prototype described in section 4 does not create an exception to this rule.

### Create

Keep generation, upload and Creative Assets entry points understandable. A
reference is optional where supported. Generation instructions belong here;
Remix instructions belong with text editing. Keep generation progress and ready
results reachable after selecting a clip.

Talking Head's Create action reads **Continue** and opens Demo. Hook's next-step
action must also lead to its Demo overview, with labels matching the destination.
Do not add a second overview Remix form to make text editing discoverable.

### Demo overview: Hook and Talking Head

- Show separately named opening and optional Demo video previews.
- An absent demo has upload/selection actions; an existing demo has visible
  replacement/removal actions and **Edit demo video**.
- Show **Edit hook video** for the opening. These compact actions edit the
  named clip; replacement selects different footage.
- Keep Demo upload/replacement controls accessible alongside the preview cards.
  Showing cards must never hide every way to replace their media.
- Change opens replacement choices in place, including on mobile. Opening
  footage offers upload/Creative Assets/generation; demo footage offers upload
  and Saved demos from the Demo inventory. Failed replacement retains accepted
  footage and edits. The earlier `chooseDemoInDemo` sidebar-focus behavior is
  superseded; never restore it or direct demo selection to Creative Assets.
- Final composition settings belong here. Apply the workflow's audio rules below.
- Returning from Schedule must retain both clip edit entry points, even when a
  final video has already been prepared.
- Empty Hook/Demo slots use portrait **9:16 upload areas**, with source selection
  centered inside each slot. Center the pair within the available preview panel;
  do not leave two shallow cards anchored at its upper-left with a large unused
  area to the right. Scale placeholders with usable viewport height and wrap when
  two no longer fit. This shape is for empty slots only: selected footage keeps
  its actual ratio and its existing edit/replace actions.
- Apply the same empty-demo canvas treatment in Talking Head's overview without
  transferring its separate demo-audio capability into Hook. The public second
  step remains **Demo**; opening a focused editor does not rename that stage.

### Focused clip editors

Edit hook video, Edit demo video and Wall's advanced editor show the selected clip's tools
and live preview. Hide Create/Demo/Schedule tabs and unrelated upload/composition
settings while focused editing is active. Returning restores the overview and
its controls without clearing the draft.

Use a compact draggable trim timeline, text/Remix controls and a narrower
appearance inspector. Hook and Talking Head's focused clip editors do not need
a Sound panel: audio setup belongs in Demo. Hook's demo editor also has no
Crop & zoom tools; their presence was unnecessary and lengthened the inspector.
Wall remains a single-video workflow, so its one audio group stays in advanced Edit.
On desktop, use the available width deliberately;
on narrow screens keep the preview usable while tools scroll. Do not restore
full-width style selects, two enormous trim sliders or a long unstructured form.

### Wall of text: simple text editing, optional advanced controls

Wall's Edit step first shows the live preview, **Remix text** and **Your wall of
text**. Reference-backed clips keep the reference Remix expanded; scratch/upload
clips retain the nearby optional Remix entry without fabricated reference text.
Keep the text column compact and use its width; do not leave a blank inspector
column beside simple text editing. One compact **Edit** action below the text
opens the full advanced tools (trim, text style and the single video audio group).
**Back to text** returns to the simple view. These views share one mounted editor,
draft and player; opening/closing advanced tools must not clear text, style,
audio or trim, submit generation, save implicitly or restart the preview.
Leaving and re-entering Edit starts with the simple text view and keeps the draft.

Wall overlays cover **0 through the end of the selected trimmed clip**. Do not
show Show from / Until, per-block timing badges or instructions about individual
block timing in Wall, even inside advanced tools. Normalize recovered legacy
Wall text and newly applied Remix/manual text to the whole selection. Shortening
or lengthening trim updates the end of every Wall block. Preserve all existing
blocks and their separate styles/positions; do not drop blocks as a shortcut.
Hook and demo timed blocks retain their existing timing behavior.

### Slideshows: reference, generation and slide editing

Catalogue cards use topic names such as **Fitness**, **Goal Tracker** and
**Interview App**, without import sequence suffixes such as 01. Apply this at
the catalogue-to-reference boundary so gallery cards, selection and dialogs agree.
Keep original catalogue metadata, reference/slide IDs, media URLs and ordering
unchanged. Do not remove slide-position numbers from editing/navigation, rename
user uploads or apply this rule to Hook/Wall reference names.

Create selects catalogue/uploaded reference images and accepts instructions.
**Selected slides × Versions determines output count.** Five selected reference
slides and two versions produce ten independent image jobs, grouped as two
ordered five-slide versions. Each output uses the corresponding reference slide
as its primary layout, the other selected slides as context, and the same frozen
business context/instructions. Quantity is versions, not total images. Show the
total credit estimate before submission. Selecting more than ten source slides
blocks submission rather than clipping the selection. Recreating one existing
slide still produces versions of that single slide. Legacy requests without a
slide count keep their original one-image-per-quantity behavior for recovery.

Business context is loaded server-side from the authenticated owner's applied
Settings profile, whitelisted and frozen into every new slideshow job. Missing or
unavailable context blocks admission before billing; do not silently generate
without it or trust a browser-supplied business profile. The worker builds the
provider prompt from that snapshot; the visible user prompt stays clean. Flare
is the default slideshow image model, with Sunburst and Nano Banana also offered.
The existing `gpt_image_2_5` ID continues to mean Sunburst for saved jobs.

Edit slides supports selecting, reordering, removing, uploading/replacing and
recreating a slide, plus manual/Remix text and appearance with a live preview.
Replacement retains that slide's identity, text and neighbors. Text baked into
image pixels requires Recreate/Replace; added text is directly editable. Save
prepares edited images and stores the exact sequence in Library. Interrupted
saves retain their request identity; editing invalidates the prior schedule output.
Schedule uses the saved image sequence, without a video/demo/audio stage.

The first complete generated version can populate an **empty** editor. Never
replace a user's current draft when another version finishes. **Edit version**
opens all of that version's owned images in source order. The account-owned
**History** entry remains visible even when the current session is empty; new
batch metadata reopens a whole version. Older ungrouped generations remain
individual reusable images, not invented slideshow sets.

Changing versions archives the current editable draft, with an **Earlier drafts
on this device** selector (up to twenty). The active draft also restores on this
browser. **Saved slideshows** opens Creative Assets → Saved, where Explore items
have **Edit slides**. New saves store validated editable source IDs and text in
Library metadata alongside rendered outputs; reopening makes a new editable draft
and never mutates the existing Library item. Original images are rechecked for
ownership/readiness. Legacy saves can reopen their retained owned rendered-image
IDs, but text baked into those images cannot become separate editable text.

Current restriction: the slideshow composer requires a catalogue reference, an
attached instruction image or a regeneration image. Plain prompt-only scratch
generation is blocked. Users can upload their own output slides without a
catalogue. Do not claim prompt-only scratch creation is supported. Saving still
supports **2–10 slides per version**, not all versions combined. Production
saving requires its rollout flag and access. Local tests are not proof of
provider quality, visual acceptance or production execution.

Hook and Wall now also expose their existing account-owned generation History
in Create, without requiring current-session results. Talking Head + Demo retains
its separate Saved drafts entry (`/explore/create-hook?drafts=1`) and Creative
Assets reuse; it does not yet have the same in-workflow generation-history drawer.
Media history, browser-local editable drafts and server-saved outputs are different
recovery capabilities. Never describe one as proof of all three.

Returning to earlier work must be explained per workflow:

| Workflow | Where users resume | Limit to state honestly |
| --- | --- | --- |
| Slideshows | Create → History for generated versions; earlier editable drafts in the editor; Library → Edit slides for saved Explore sets | Older Library images can contain baked-in text; that text cannot become an editable overlay automatically. Device-local drafts are not cross-device history. |
| Hook video | Create → History or Creative Assets to select earlier footage, then Demo → Edit hook video / Edit demo video | Clip edits are scoped to the owned source and editor scope. Generation History is not a gallery of every previous two-clip composition. |
| Wall of text | Create → History or Creative Assets, then Edit for text and optional advanced controls | Reopening the same owned source can restore its saved clip draft. A final rendered MP4 alone does not reconstruct all editable text. |
| Talking Head + Demo | Saved drafts from the workflow / `/explore/create-hook?drafts=1`, or Creative Assets for existing media | Its saved workflow session is different from the Hook/Wall generation-history drawer. Do not claim an equivalent drawer exists. |

### Save, return, final preparation and Schedule

| Action | Meaning and placement |
| --- | --- |
| Save edits | Primary editor action; saves the selected clip draft, not an implicit paid regeneration or final render |
| Back to videos | Secondary editor return to the opening/demo overview; retains draft state |
| Back to Create | Wall/slideshow return where that is the actual destination; never label it Back to previews if it opens Create |
| Prepare final video | Combines the current composition when required; does not replace clip editing |
| Schedule video | Proceeds to review/scheduling under the existing readiness rules; must not obscure or substitute for Save edits |

Keep primary and return actions in a consistent, visible footer. Final-render
status should not flood the clip editor with preparation/refresh buttons. Source
replacement and edits invalidate stale final output as appropriate. Schedule
must use the current confirmed composition, not an older prepared file.

Wall without a selected clip should expose Create's source controls and gallery,
not an isolated full-screen empty editor with all navigation hidden. A saved
`editVideoId` still requires restoration/loading/error handling; do not discard
it just because the asynchronous asset has not arrived yet.

## 4. Audio rules — keep the products distinct

| Workflow | Background music | Demo-specific added audio | Original footage sound |
| --- | --- | --- | --- |
| Hook video | **One track across hook and demo**; reference audio is not a second simultaneous background track | **No separate demo-audio picker**, in overview or focused demo editor | Original footage may have sound; any retained original-volume setup belongs in Demo, not a second editor Sound panel |
| Talking Head + Demo | One optional background-music track across opening and demo | Optional separate **Demo audio** track plays **only during the demo** | Talking-head footage already contains the influencer's speech; no default extra talking-head audio upload is required |
| Wall of text | **One complete background track** for its single video | Not applicable | Single clip's original sound is distinct from its background music |
| Slideshows | Do not infer video/demo music support from shared UI | Not applicable | Not applicable to still-image footage |

### Talking Head: name the three audio layers by scope

The user's latest clarification distinguishes these layers. Avoid using
“Demo sound” to mean both a demo-only track and whole-video music:

1. **Talking-head speech (in the video):** the influencer is already speaking
   in the generated/selected footage. Keep that speech. Do not make an extra
   talking-head audio upload the default or require one to continue.
2. **Demo audio — demo only:** optional user-added audio for the demo segment.
   It starts with the demo, stops with the demo, and is not played over the
   talking-head opening. The current UI's Demo sound control represents this
   capability. Its content may be music or another user-supplied recording;
   the defining rule is its demo-only timing.
3. **Background music — entire video:** optional music underneath the complete
   talking-head-plus-demo sequence. “Background sound” means music in this
   requirement. It is one composition track, not the demo-only attachment.

An optional audio reference in Create, where supported, guides generation; it
is not a required post-generation speech upload or another background track.

Example: with a 3-second opening and an 8-second demo, the opening's speech is
heard from its footage; demo-only audio plays during the 8-second demo; the
whole-video music can span all 11 seconds. Removing demo-only audio must not
remove the whole-video music, and changing the whole-video music must not
replace speech or the demo attachment.

For Hook, the same 3+8-second sequence has one background track spanning the
11 seconds and **no second demo-only added track**. Wall has one background
track spanning its single video's selected duration. Do not infer new soundtrack
capabilities from a shared component or from the ambiguous word “sound.”

### Control location and removal rules

Audio selection/setup belongs in the Demo overview for composition workflows.
Focused Hook/Talking Head editors retain trim, text, Remix, appearance, live
preview, Save and return. They do not duplicate Sound/upload/library panels.
Hook's focused demo editor also excludes Crop & zoom. Removing those panels
must not silently reset existing saved volume/audio/framing data. Legacy Hook
demo framing may be retained and explicitly reset from Demo when necessary;
this recovery action is not a new crop/zoom editor.

This clarification defines product behavior; it does not establish that every
audio combination has been validated in production. Speech preservation and
the separate mix/timing layers require preview/export checks as well as UI checks.

The latest user correction removed Hook's separate demo sound upload/library
controls. `FormatDemoSection` defaults `allowDemoAudio` to false and excludes
legacy demo-only audio when restoring its local/server clip draft. Do not
re-enable that capability simply because generic component tests support it.
Talking Head's separate demo audio is handled through its own composition path.

Music must agree across preview, final preparation, Schedule and reload. Failed
or cancelled replacement must retain the prior accepted choice. Changing music
must not regenerate the video or silently mute speech. Avoid doubled tracks.

Talking Head's Demo overview now offers **Upload music** and the existing
**Audio Library** under Background music, explicitly scoped to the entire video.
The accepted owned track has preview, repeat/play-once and removal controls.
New videos start with music **Off**. Uploading or choosing a track retains the
current On/Off setting; the user turns music on explicitly. Turning it off retains
the choice, while Remove
music clears it and turns music off. The no-custom-track On state uses approved
default music. Demo sound stays independent and demo-only. This is a local
implementation; production acceptance is still required.

**Planned, not fully implemented:** the compact Create music row with reference,
custom and none choices is documented in
[the Hook music plan](docs/hook-background-music-ui-plan-2026-10-15.md). Its
development prototype is not proof that production track replacement/removal
works. Older mixed footage may lack a clean source; changing a button cannot
make baked-in music removable. Preserve reference provenance independently from
the selected playback track.

## 5. Remix: purpose, placement and source identity

Remix adapts a reference's **text**, using the user's business context, to make
a relevant new version. Supplying reference video pixels alone does not fulfill
this purpose. It is not the same operation as video generation or manually
adding an overlay.

| Starting material | Expected editor behavior |
| --- | --- |
| Video linked to prepared reference text | Show the complete expanded Remix box prominently, populated from that video's original reference; keep manual text editing available |
| Scratch generation, ordinary upload or asset with no linked text | Manual editing comes first; keep one compact Remix entry for the user's own text/idea; do not invent reference copy |
| Demo | Independent text/draft/target; never copy the opening's reference or remix into it automatically |
| Slideshow | Resolve original reference and stable slide ID; reordering must not change which source text belongs to a slide |
| Reference explicitly marked as having no text | Request user input rather than fabricate source text |

Rules the user has explicitly established:

- Only one Remix form/entry per focused clip or selected slide. No duplicate
  form on the workflow overview and no second Remix button beside an already
  visible expanded Remix box.
- One **Text to remix** box accepts source copy and any guidance. No separate
  Additional information/Additional instructions disclosure.
- No orange glow or heavy decorative highlight. Emphasize reference Remix by
  position and expansion, not visual noise.
- Keep Generate remix compact and adjacent to the relevant context/input.
- Generate produces a reviewable draft; Apply is explicit before changing the
  video's text. Do not overwrite manual copy just by opening Remix.
- Business context comes from the authenticated owner's settings/server path.
  Missing, loading, signed-out or unavailable context must not say Saved.
- Bind text to the source used to generate that asset. Selecting another gallery
  reference later must not silently change an existing clip's Remix source.
- Preserve trim, timing and style when applying copy; isolate targets and owners.
  Recover accepted requests without duplicating uncertain paid generation.

Known gaps are listed in section 8. Do not describe prepared catalogue text as
automatic transcription of every uploaded video.

## 6. Preview and layout quality floor

- Trim edits immediately seek to the changed boundary and pause; playback
  respects the selected duration. Text edits show their active timing, style
  and position without requiring Save or Prepare final video first.
- Style and supported volume changes update locally. Preserve framing and the
  actual footage aspect ratio; do not stretch or arbitrarily crop the preview.
- Distinguish an editing preview from the final exported mix/subtitles. If an
  effect requires preparation, state that accurately; never promise exact final
  parity for an effect the live preview does not implement.
- Keep the preview and action footer usable at **1280×720**, including after
  scrolling. Check **390×844** and **320px** narrow layouts where relevant.
- Use space for the task: text needs a writing area; presets, color and timing
  need compact fields. Avoid empty columns and excessive nested cards/help text.
- Secondary desktop actions generally use content-sized widths and ~34px height;
  touch/coarse-pointer targets retain at least 44px. Save/Schedule stay prominent.
- Check top and scrolled states, long names, disabled/busy/error states and
  keyboard focus. No horizontal overflow or footer covering the last controls.
- Upload tiles can be larger when they are the actual source entry. Once media
  is selected, Preview/Replace should be compact, not another giant empty tile.

### Laptop-first layout: 14-inch and 15.6-inch users

Physical diagonal size alone does not determine a browser's usable space.
Resolution, operating-system display scaling, browser zoom, browser chrome and
the app's own navigation change the **CSS viewport**. A 15.6-inch laptop can
have less usable space than a 14-inch laptop. Do not infer device inches from
screen width or build a rule called “14-inch mode.” Adapt to measured available
width **and height**, using container queries where panel width matters.

Use the following representative checks; they are layout scenarios, not exact
mappings from inches to pixels:

| Scenario | CSS viewport to review | Required behavior |
| --- | --- | --- |
| Constrained everyday laptop | 1280×720 | Clear task entry, usable preview, reachable upload/replace and visible editor Save/return; no large-screen minimum sizes forcing clipping |
| Common compact laptop workspace | 1366×768 | Check overview cards, reference Remix discoverability, footer and scrolled tools without hiding core controls |
| Wider laptop workspace | 1536×864 | Use extra width for readable preview/tools and useful grouping; avoid simply stretching every field or inserting large gaps |
| Larger workspace / comparison | 1920×1080 | Preserve grouping and bounded control widths; do not let the large layout dictate the smaller laptop layout |
| Short usable browser area | 1280×600 | Reflow/compact media and scroll tools so actions remain reachable; no lost last field or trapped nested scroll area |
| Narrow fallback | 390×844 and, where relevant, 320px wide | Stack or switch panels clearly; retain the preview/controls route and reveal the destination before focusing |

Also check a representative laptop at 125% and 150% browser zoom where tooling
supports it, and record the resulting viewport. Browser zoom checks do not claim
to emulate operating-system scaling or a particular physical laptop. A resized
browser with desktop pointer input does not verify coarse-pointer touch sizing.

At each laptop viewport, inspect both the top and the lower scrolled state:

- **Preview sizing:** portrait, landscape and square media retain aspect ratio.
  A tall portrait must not push its Edit/Change/playback actions out of reach.
  A wide clip must not force an oversized empty video column. Scale within the
  available width and height, not a single fixed video size for all laptops.
- **Space use:** reduce avoidable padding, vertical gaps and repeated headings
  before shrinking readable text. Bound preset/color/time controls; give writing
  and preview areas the useful space. Do not remove functions to make the form fit.
- **Layout change:** use columns only while the preview and tools remain usable;
  reflow when they do not. Shorter screens may need shorter media and independently
  scrollable tools even if the width still supports two columns.
- **Button access:** check the actual viewport intersection and scroll path,
  not only `display`, DOM presence or a full-page screenshot. Save/return must
  remain reachable; Replace must visibly expose its picker/section. Focus must
  not land in a hidden or covered region.
- **Scroll boundaries:** the last control is visible above the footer at the end
  of the tools' scroll area. Avoid multiple nested scrollers that strand an action.
  Browser chrome and app headers consume real height; `100vh` is not all content.
- **State changes:** repeat with a selected demo, long filename, expanded Remix,
  validation/error message and prepared output. Empty screens alone are not enough.

For a layout-affecting change, record viewport dimensions, which workflow/state
was inspected, and screenshots of top/scrolled states. If a size or zoom level was
not checked, list it as unverified. These are acceptance requirements for future
changes; this document update does not mean those sizes have now been tested.

## 7. Mistake log — do not repeat these

Status: **Local fix** means implementation/local checks were recorded, not
production acceptance. **Rule** means a recurring design requirement. **Open**
means unresolved or not established by the evidence. Keep the history when a
mistake recurs; add the recurrence and its cause rather than deleting the row.

| ID | Mistake and user impact | Prevention / current status |
| --- | --- | --- |
| EX-01 | Edit tab mixed demo setup, clip editing and final settings; users could not identify the step | Name Hook/Talking Head's second step Demo; distinguish overview from focused editors. **Local fix** |
| EX-02 | Continue wording/destination did not match what opened | Match the visible action to its actual destination; test the click. Talking Head Continue → Demo. **Local fix** |
| EX-03 | Create/Edit/Schedule tabs appeared again inside a selected clip editor | Hide outer stages while editing; retain a clear return action. **Local fix** |
| EX-04 | Hook and Demo were represented by one ambiguous preview/action | Separate named cards and compact Edit hook/Edit demo actions; show upload when missing. **Local fix** |
| EX-05 | Hiding sidebar demo setup alongside preview cards removed replacement access; Change focused a nonexistent selector | Keep source choices visible; mobile panel reveal plus real focus destination. Recurred after an earlier cleanup. **Local fix, regression added** |
| EX-06 | Talking Head Demo upload/sound disappeared in a simplification pass | Restore task-relevant controls; never equate fewer controls with clearer UX. **Local fix** |
| EX-07 | Remix form duplicated in overview and editor; another Remix button appeared next to the expanded form | One editing entry and one scoped form; remove obsolete portal targets, not just their labels. **Local fix** |
| EX-08 | Remix was closed or below the first visible area, especially at 1280×720 | Reference text leads with expanded Remix; scratch editing has a visible nearby entry. **Rule with local fixes** |
| EX-09 | Separate Additional instructions, orange glow and repeated helper text added complexity | One text/guidance box, neutral styling and concise status. **Local fix** |
| EX-10 | Huge Generate/audio buttons, full-width preset fields and stacked sliders wasted space | Compact secondary actions/inspector; draggable trim with small numeric inputs. **Local fixes; recheck each screen** |
| EX-11 | Oversized selected-demo Preview tile repeated an upload-sized empty box | Use compact Preview and directly accessible Replace controls. **Local fix** |
| EX-12 | Changes did not appear immediately, leaving users guessing about trim/text/style | Wire draft state to player and overlays; verify actual visual updates, not only saved JSON. **Local checks recorded; final-render parity remains effect-specific** |
| EX-13 | Opening optional Remix hid manual text or style controls | Keep manual editing available while Remix opens. **Local fix** |
| EX-14 | Hook and Demo inherited each other's text, reference or audio assumptions | Independent drafts and explicit per-product audio capability. **Regression coverage; provenance gaps still open** |
| EX-15 | Hook exposed separate demo music although one background track should span both clips | Remove Hook-only demo audio controls and reject hidden legacy attachments; retain Talking Head Demo sound. **Local fix after user correction** |
| EX-16 | Back to previews actually returned to Create; Demo used Apply demo edits while others used Save edits | Use truthful, consistent labels; test destination and retained state. **Local fixes** |
| EX-17 | Save, return, preparation/refresh and Schedule competed without a clear hierarchy | Reserve primary Save, secondary return, and composition/scheduling actions in their appropriate screens. **Rule with local fixes** |
| EX-18 | Preparing a final video replaced clip cards, removing later edit entry points | Demo overview keeps editable clips; Schedule owns final output. **Local fix** |
| EX-19 | Wall opened an isolated empty edit screen with no selected clip and hid normal controls/gallery | Source-less entry stays in Create; preserve genuine saved-asset restoration. **Local fix** |
| EX-20 | Slideshow called its source Video reference; business status implied missing context was saved | Use format-specific source names and truthful readiness states. **Local fix** |
| EX-21 | Later gallery selection could supply the wrong source copy; slide position confused source identity | Resolve generated-asset provenance and stable slide ID; never use current selection as a substitute. **Coverage in Hook/Wall/Slideshows; Talking Head gap open** |
| EX-22 | Claimed all workflows were fixed based on shared code, tests or old screenshots | Inventory each route and inspect its actual rendered interaction; report test/visual/production evidence separately. **Ongoing verification rule** |
| EX-23 | A black demo frame was visible but its cause was not established | Inspect loading, source, media errors and playback. Do not assume every black frame is one known codec bug or call it resolved from metadata alone. **Open for the originally reported asset** |
| EX-24 | Huge gaps, nested boxes and long scroll made preview/actions hard to use | Review both top and scrolled states with real content and compact dimensions, not a full-page screenshot alone. **Recurring design rule** |
| EX-25 | Forgot a section's purpose while changing its layout, losing core functionality | Make a before/after map of every retained section, task and action; missing or newly inaccessible functionality blocks completion. **Recurring process failure; preservation rule** |
| EX-26 | Changed what a feature did while attempting to improve how it looked | Preserve handlers, target media, audio scope, drafts and readiness during visual changes; record any explicit functional request separately. **Recurring process failure; behavior-preservation rule** |
| EX-27 | Renamed sections casually or replaced Demo with Edit tools despite the agreed workflow | Treat the public stage map as a product contract. Internal state names do not define user-facing names. Keep Demo setup and focused editing separate. **Repeated user correction; stable naming rule** |
| EX-28 | Buttons existed but users could not reach them at their laptop size | Check on-screen geometry, occlusion, scroll path, focus and successful click at constrained width and height. DOM presence alone is insufficient. **Repeated access failure; viewport acceptance required** |
| EX-29 | Used large-laptop spacing and preview sizes unchanged on a smaller usable workspace | Review constrained and wider laptop CSS viewports; reflow columns and bound media by available height and width. Never use physical screen inches as the breakpoint. **Repeated responsive-layout failure; laptop matrix required** |
| EX-30 | Added audio or other controls in whatever empty space was available, separating them from their meaning | Assign one named group by task and scope; keep selection, change/remove and status together. Background music spans the composition; Talking Head Demo sound is explicitly separate. **Repeated grouping failure; ownership map required** |
| EX-31 | A simplification pass removed or hid working features and was called an improvement | Keep core functions and navigation intact; compare before/after capabilities and test round trips. Fewer visible controls is not evidence of clarity. **Repeated regression; functional and visual evidence required** |
| EX-32 | Kept irrelevant Crop & zoom and Sound panels in focused Hook editing, creating excess scroll and unused inspector space | Hook demo editing excludes crop/zoom; audio setup stays in Demo for Hook/Talking Head. Keep Wall's single-video audio path distinct. Do not restore generic panels simply because a shared editor supports them. **Local implementation and regression checks passed; fresh visual acceptance pending** |
| EX-33 | Used “audio,” “Demo sound” and “background sound” interchangeably, obscuring speech and track timing | Name Talking Head's embedded speech, demo-only added audio, and whole-video background music separately. Hook and Wall each have one complete background track. **Audio-scope contract clarified by user** |
| EX-34 | Treated a Background music On/Off switch as proof that users could upload their own whole-video track | Keep upload/library selection, current track, playback and removal in Background music. Carry that exact owned selection through preview, captions, preparation, recovery and Schedule without reusing demo-only audio. **Locally implemented 15 October; production acceptance pending.** |
| EX-35 | A recovered render/default-music cache could reuse a previously removed custom track | Persist the explicit off/default/custom choice alongside the finishing receipt; require the current choice before reusing an output or default snapshot. Never substitute old custom audio when switching back to default. **Regression covered.** |
| EX-36 | Showed trim/style/audio alongside Wall's primary text tasks, adding complexity and unused inspector space | Default Wall Edit to Remix/manual text and live preview. Place one compact Edit action below text for advanced tools, with Back to text and the same draft/player. Audio remains available in advanced controls. **Locally implemented; fresh visual/production acceptance pending.** |
| EX-37 | Gave Wall text Show from/Until and timing badges even though it must stay to the end | Hide timing UI and normalize Wall text to the full selected duration on recovery, editing, Remix and shorter/longer trims. Preserve Hook/demo timing and legacy Wall blocks/styles. **Functional regression checks passed.** |
| EX-38 | Exposed import names such as Fitness 01 and Goal Tracker 01 as slideshow card titles | Show the category/topic consistently throughout reference selection. Preserve stable IDs and source metadata; slide position numbers remain useful inside editing. **Locally fixed for all 58 catalogue slideshows; production acceptance pending.** |
| EX-39 | Treated five selected slideshow slides as context for two individual images instead of generating two five-slide versions | Freeze slide count and version-major positions into jobs, recovery, result groups and editor selection. Estimate credits for every output. Keep legacy request semantics intact. **Local 5×2 regression passed; production pending.** |
| EX-40 | Assumed slideshow image generation included business context, while only Remix used it | Read the authenticated owner's applied profile on the server before billing, freeze it per job and test the actual provider prompt. Keep private context out of visible prompt labels. **Locally fixed.** |
| EX-41 | Hid History when the current Explore session was empty, and had no way to reopen saved slide sets | Keep History reachable, distinguish generated versions from edited drafts and saved Library items, preserve drafts when switching, and offer Edit slides for saved Explore sets. Do not infer legacy grouping or unbake pixel text. **Slideshow/Hook/Wall locally improved; Talking Head history differs.** |
| EX-42 | On the reported 15.6-inch laptop, two shallow empty Hook/Demo cards stayed at the upper-left of a much larger preview area | Use centered portrait upload slots with centered source actions, bounded by usable height; check empty/one-clip/two-clip and narrow/short viewports. Keep actual media ratios and existing selection actions. **Local layout change; browser screenshot and production acceptance pending.** |
| EX-43 | Exposed Hook 01/02/03 catalogue numbers as user-facing reference names | Show **Hook** consistently for active, archived and development references. Preserve reference IDs, provenance, reviewed prompts and saved-job lookup; automation must identify media by stable identity rather than depend on visible numbering. **Catalogue regression passed locally; production pending.** |
| EX-44 | A playable local demo still had disabled Edit/Change and replacement controls while its upload awaited confirmation | Separate navigation, local editing and source replacement from owned-media Save/Schedule readiness. Preserve pending edits on success and the accepted draft on failure; reject late superseded completions. Bound metadata reads. **Local regressions and delayed-upload browser checks passed; production acceptance pending.** |
| EX-45 | Routine editor footer instructions and a horizontal divider consumed laptop height above Save/return | Remove the repeated instruction row and divider; compact the footer while retaining real loading/error/retry feedback and visible Save/return buttons. Check the bottom of the scroll region and actual footer bounds. **Local implementation; production acceptance pending.** |
| EX-46 | Labeled a fractional source-video length as generic Duration, making Omni source editing look like unsupported fractional fresh generation | Label source length explicitly, distinguish native edit timing from selected generation duration and rounded billing, and verify both prompt fields and decimal timing through admission/provider/output validation. Never round the footage itself or claim every model shares edit semantics. **Local checks passed; no paid production generation submitted.** |
| EX-47 | The opened reference popup kept native video controls and exposed Download even though the surrounding editor used custom controls | Audit the opened popup as well as gallery/editor players. Hook and Wall reference playback must use custom controls without download/native menus; preserve ordinary playback and fullscreen. Do not claim browser-delivered media is impossible to copy. **Local change; production acceptance pending.** |
| EX-48 | Hook source icons navigated free users straight to the original social post | Check verified Pro access at every source-icon rendering path. Free clicks open Upgrade to Pro; Pro links retain safe external navigation. Keep Wall source-free and Preview/Recreate independent. **Local change; production acceptance pending.** |
| EX-49 | Font controls were demonstrated as extra full-width rows that made Text style tall and pushed useful controls away | Preserve the compact inspector. Add Font and Weight together in one small bottom row; verify inside the real editor at laptop and narrow sizes. Do not use an isolated wide fixture as the product design. **Compact full-editor checks passed locally.** |
| EX-50 | A font appeared selectable in the browser while native export lookup could silently substitute another face | Bundle matching faces and licenses, validate the saved choice, and render glyphs from that exact file. Verify all four families at all three weights with actual raster/video output and save/reopen. Preserve legacy appearance. **Local checks passed; production pending.** |

Process incident: an intermediate edit introduced an invalid UTF-8 byte and
temporarily broke local compilation. It was corrected. Preserve UTF-8 and check
the actual page after edits; tests that transpile source alone can miss this.

## 8. Known gaps and verification limits

1. Uploaded video references, including Talking Head uploads, do not have a
   general automatic OCR/transcription path into Remix. Users currently need to
   supply copy. This remains open, not an accepted permanent product limitation.
2. Talking Head's shared editor does not receive the same reference catalogue
   wiring as Hook/Wall. Reusing a catalogue-generated asset may lose usable
   reference-text association despite provenance in owned-media metadata.
   Recheck and fix that path before claiming all reference cases are supported.
3. The new music reference/custom/none row is a prototype/implementation plan;
   clean-source retention and the complete replacement/removal pipeline must be
   verified before release. The music plan reports a Hook 76 HEVC compatibility
   issue; investigate that exact asset rather than generalize the diagnosis.
4. Latest recorded local suite: **380 tests passed**, with targeted ESLint,
   TypeScript and whitespace checks. This is dated evidence, not a permanent
   test count or proof of first-time-user comprehension.
5. Actual local browser checks covered Hook demo replacement (desktop/mobile),
   Talking Head upload/replacement and restored sound controls, and Wall's
   source-less entry. Earlier reports contain additional editor/slideshow checks.
   Earlier browser quota/compiler failures are historical; later local checks
   succeeded. Do not copy an old blocker forward without rechecking it.
6. Production Explore redirected the checked browser session to sign-in. These
   local UI changes were not deployed as part of these checks. Authenticated
   generation → edit → preparation → Schedule/publication acceptance remains
   outstanding. Do not silently submit paid jobs or publish posts as UI checks.
7. Latest audio-scope/editor-panel follow-up: 243 targeted tests passed, with
   11 additional clip-control/Talking Head checks; the final Demo/Talking Head
   rerun passed 62 tests (overlapping the earlier checks). TypeScript, targeted
   ESLint and whitespace checks passed. Logs are in
   `outputs/explore-editor-scope-tests.log`,
   `outputs/explore-editor-scope-extra-tests.log` and
   `outputs/explore-editor-scope-final-tests.log`. Fresh full-page browser
   acceptance remains pending: the local application bundle reported Invalid
   or unexpected token and stayed on Opening your workspace; an isolated local
   fixture was not reachable by that browser. Do not reuse earlier screenshots
   as evidence for the newly removed panels. The temporary helper was stopped.
8. Talking Head custom whole-video music is now locally implemented through
   `use-workflow-background-music.ts` and the existing Audio Library picker.
   Owned asset ID and playback are saved in workflow session options separately
   from demo-only audio. Missing music blocks preparation until replaced or
   removed. Failed replacement retains the prior selection. See
   [the music implementation report](docs/talking-head-background-music-2026-10-15.md)
   for evidence. Production acceptance remains outstanding; the older scope
   audit's missing-upload finding describes the state before this change.
9. The 15 October scope recheck confirmed the current local callers hide Sound
   in both Talking Head clip editors and Hook opening editing; Hook demo's
   focused controls contain no Sound or Crop & zoom. Wall intentionally retains
   its single-video audio controls; Slideshow is images-only. See
   [the scope recheck](docs/explore-workflow-scope-recheck-2026-10-15.md) for
   current verification evidence and limits. Local removal is not proof the
   deployed authenticated editor contains the change.
10. Wall now defaults to text-only controls with optional advanced video tools.
    The shared focused editor remains mounted between modes; text, style, audio,
    preview and draft ownership are retained. Local functional suites (96 tests),
    TypeScript and targeted ESLint passed. Fresh browser/laptop screenshots and
    authenticated production acceptance are still pending. See
    [the Wall simplification report](docs/wall-text-simple-editor-2026-10-15.md).
11. Slideshow naming and flow recheck: 137 local checks passed across generation
    admission/recovery, image results, editing, save/recovery and schedule inputs;
    TypeScript and targeted ESLint passed. These include stubbed service boundaries,
    not paid provider execution. Production `/explore/slideshows` redirected to
    sign-in on 15 October, so authenticated generation, deployed saving enablement
    and publication remain unverified. Prompt-only scratch generation is blocked
    by the current composer; output sequences have a ten-slide maximum. See
    [the slideshow report](docs/explore-slideshow-flow-2026-10-15.md).
12. The subsequent user correction supersedes that audit's single-image quantity
    semantics. Selected slides × versions now generates grouped image jobs;
    business context, Flare, history and editable Library reopening are locally
    implemented. **249 application tests and 20 worker/provider tests passed**,
    with TypeScript, worker build and targeted ESLint. Network/provider/database
    boundaries are stubbed in these suites. The local browser fixture compiled,
    but Edge launch failed and the MCP browser could not reach its local server;
    fresh laptop screenshots and signed-in production acceptance remain pending.
    A final production navigation retry reported the browser profile already in
    use; the shared browser was not closed or reset.
    See [the versions/history report](docs/explore-slideshow-versions-and-history-2026-10-15.md).

### Portrait overview and recovery follow-up — 15 October 2026

- Local changes center Hook's overview cards and give empty Hook/Demo source
  slots a viewport-bounded 9:16 shape with centered source selection. Talking
  Head's empty overview canvas uses the same portrait treatment. Selected video
  ratios, focused editors, replacement handlers and audio ownership are retained.
- Hook reference labels now read **Hook** for published, staged and archived
  references. Browser-card checks target stable reference IDs so duplicate
  display labels do not select the wrong media.
- **236 targeted tests passed** across source/replacement, demo state, saved
  Talking Head composition, slideshow editing/recovery, workflow sessions,
  live clip controls, catalogue identity, reference actions and previews.
  TypeScript, targeted ESLint, CSS parsing and whitespace checks passed.
- Fresh visual acceptance is **pending**: the production browser retry reported
  its profile already in use; a separate headless Edge launch then failed during
  profile initialization. The shared browser was not reset. This pass therefore
  does not claim screenshots, laptop/zoom interaction acceptance, deployment or
  authenticated production end-to-end success.
- Recovery is available through the distinct paths listed in section 3. A
  universal gallery of every historical editable composition across all video
  workflows is not implemented; do not describe generation History that way.
- Release review on 16 October found that legacy slideshow reference-role paths
  could drop frozen business context/output position. Every provider-prompt path
  now uses the contextual slide prompt; all three legacy roles have a regression.
  See `docs/production-release-2026-10-16.md` for ordered rollout and actual
  deployment evidence; older local reports are not production acceptance.

## 9. Where the implementation lives

Paths below are pointers, not an excuse to treat every shared component as the
same product. Inspect current callers and props before editing.

| Concern | Main files |
| --- | --- |
| Menu and route inventory | `lib/explore/workflows.ts`, `app/explore/` |
| Hook/Wall/Slideshow workspace, stages and portal ownership | `components/explore/format-workspace.tsx` |
| Talking Head entry, composition and clip integration | `hook-workflow-entry.tsx`, `hook-workflow-preview.tsx`, `talking-head-clip-editing.tsx`, `workflow-composition-panel.tsx` under `components/explore/` |
| Shared clip editor / separate Hook demo editor | `components/explore/format-video-editor.tsx`, `components/explore/format-demo-section.tsx` |
| Trim, playback, text and appearance | `clip-trim-timeline.tsx`, `clip-preview-controls.tsx`, `format-video-text-fields.tsx`, `format-text-overlays-editor.tsx` under `components/explore/` |
| Remix UI and source resolution | `components/explore/remix-text-section.tsx`, `lib/explore/remix-source.ts`, `reference-text-store.ts`, `remix-text-edit.ts`, `remix-text-draft.ts` under `lib/explore/` |
| Slideshow identity/text/preview | `components/explore/format-slideshow-editor.tsx`, `format-slideshow-text-tools.tsx`, `lib/explore/slideshow-draft.ts` |
| Preview vs final composition | `components/explore/workflow-sequence-preview.tsx`, `workflow-edit-workspace.tsx`, `format-schedule-panel.tsx`, `pending-schedule-panel.tsx`, `lib/explore/wall-pending-composition.ts` |
| Layout/button behavior | `format-workspace.module.css`, `workflow-video-layout.module.css`, `workflow-section-layout.module.css`, `format-video-editor.module.css`, `workflow-creation.module.css`, `workflow-secondary-action.module.css`, `remix-text-section.module.css` under `components/explore/` |
| Draft lifecycle and media ownership | `components/explore/use-workflow-source-video.ts`, `use-local-workflow-media.ts`, `use-clip-draft-save.ts`, `lib/explore/clip-draft-contract.ts`, `workflow-draft-lifecycle.ts` |

Historical evidence, in order of relevance:

- [Demo step/replacement/audio follow-up](docs/explore-demo-step-fix-2026-10-15.md)
- [Workflow recheck and overview cleanup](docs/explore-workflow-recheck-2026-10-15.md)
- [Reference/scratch edge-case audit](docs/explore-remix-edge-case-audit-2026-10-15.md)
- [Earlier UI review](docs/explore-workflow-ui-review-2026-10-15.md)
- [Earlier clip editor review](docs/explore-clip-editor-clarity-2026-10-15.md)

Older reports contain superseded choices such as calling Demo Edit, hiding
sidebar upload controls, or permitting separate Hook demo audio. Follow this
document's current decisions and the latest user instruction, not those lines.
Media inventory counts and exact reference batches change; inspect current
catalogue/release records rather than copying counts from historical audits.

## 10. How to change Explore without repeating the mistakes

1. Read this context and relevant repository instructions. State the specific
   workflow, screen and scope being changed; inspect its actual caller/state.
2. Sketch the responsibility split: source setup, overview, focused editor,
   preparation, Schedule. Record current section names, tasks and entry points,
   then map each retained function to its new location. Do not solve
   discoverability with duplicate forms or silently replace Demo setup with Edit.
3. Trace actions through handlers, visibility conditions and real DOM targets.
   A button existing in JSX does not mean it is visible or usable.
4. Check reference-backed and scratch content, no media, existing media,
   replacement failure/cancel, restore/reload, and prepared output → edit again.
   Keep accepted media/drafts on failed changes and invalidate stale outputs.
5. For a shared change, examine all four public workflows. Include independent
   Demo text/audio and slideshow reorder/source identity where relevant.
6. Run meaningful existing regressions. Useful suites include
   `scripts/explore-format-source-workspace.test.mjs`,
   `explore-format-demo-state.test.mjs`, `explore-format-common-editor.test.mjs`,
   `explore-clip-live-controls.test.mjs`, `explore-slideshow-editor.test.mjs`,
   `explore-slideshow-text-tools.test.mjs`, `workflow-composition-panel.test.mjs`,
   `explore-background-composition.test.mjs` and `workflow-sections.test.mjs`
   under `scripts/`. Add a regression for a repeated functional defect; avoid
   brittle tests that merely assert decorative CSS or mirror implementation.
7. Inspect actual browser interactions using the laptop matrix in section 6,
   plus narrow layouts, scroll and error states. Verify preview sizes and button
   reachability, not just CSS presence. Capture screenshots of the final code.
   Label isolated fixtures honestly; do not present a mockup or old image as a
   current app capture. Report untested sizes and zoom states explicitly.
8. Record what changed, evidence, remaining gaps and deployment status. Final
   authenticated acceptance uses the production domain per `AGENTS.md`.
9. Update this context and the mistake log when a decision changes or a defect
   recurs. Do not close a mistake just because code compiled or tests passed;
   record visual verification and production acceptance separately.

### Decision history

| Date | Decision |
| --- | --- |
| 2026-10-15 | Focused clip editing hides workflow tabs; keep immediate preview, compact controls, truthful return actions and independent drafts. |
| 2026-10-15 | Reference-backed text leads with expanded Remix; scratch uses optional Remix; source copy and guidance share one input; remove glow and duplicate forms. |
| 2026-10-15 | Restore visible Demo upload/replacement; label Hook/Talking Head's second step Demo. Wall remains a single-video text workflow. |
| 2026-10-15 | Hook has one shared background track and no separate demo audio picker; Talking Head retains optional Demo sound. |
| 2026-10-15 | Establish this file as the durable Explore context, with explicit historical mistakes, open gaps and verification limits. |
| 2026-10-15 | Strengthen recurring-mistake prevention: preserve section identity/core functions during visual work, map feature ownership, and require constrained/wider laptop viewport checks rather than assuming a single desktop layout fits both 14-inch and 15.6-inch users. |
| 2026-10-15 | Remove irrelevant Crop & zoom from Hook demo editing and duplicate Sound panels from Hook/Talking Head focused editors; audio setup stays in Demo. Wall keeps its single-video audio path. Preserve existing saved edits and explicit legacy-framing recovery. |
| 2026-10-15 | Clarify Talking Head's embedded influencer speech (no default extra upload), optional demo-only audio attachment and optional whole-video background music as three distinct layers. Hook and Wall each use one complete background track. |
| 2026-10-15 | Implement Talking Head whole-video music upload and Audio Library selection in Demo, with independent owned-track recovery, repeat/play-once, removal and preview/preparation/Schedule plumbing. Preserve embedded speech and separate demo audio; guard old custom-track render reuse. |
| 2026-10-15 | Whole-video Background music starts Off for new Talking Head videos; selecting/uploading a track preserves On/Off until the user explicitly enables it. Existing saved choices retain their setting. |
| 2026-10-15 | Wall Edit leads with Remix/manual text and preview. A compact Edit action opens advanced trim/style/audio; Back to text retains the same draft. Wall text spans the whole selected clip and has no per-block timing UI; Hook/demo timing stays independent. |
| 2026-10-15 | Slideshows generate selected slides × versions, with server-owned business context and Flare default. Compact reference selection retains direct thumbnail toggles; History, full-version editing, earlier drafts and saved Library Edit slides restore prior work without overwriting it. |
| 2026-10-15 | Hook/Demo empty overview slots use centered portrait upload areas with viewport-bounded sizes; Talking Head's empty-demo canvas follows the same principle. Hook reference captions omit catalogue numbers while keeping stable media IDs. Recovery entry points and their distinct limits are recorded per workflow. |

### Rejected Hook background soundtracks — 19 October 2026

- User rejected ONLY Hooks 3, 13 and 59 background tracks as incomplete. Removed those three MP3s from the manual audio-review collection; retained all other background/native tracks and all 98 videos. Exporter tombstones prevent accidental re-export.
- Production policy is audioPolicy: silent for the three permanent reference IDs. New generation strips provider/native sound and does not attach a catalogue soundtrack; gallery metadata omits pairedAudio. Historical renders/explicit saved audio receipts are retained.
- Native audio means sound embedded in the original MP4. It exists for Hooks 6, 53, 54, 55, 69, 73, 74 and 88; Hook 78 has none. Extracted review M4As are manual-review artifacts, not production inputs. Providers currently receive original MP4s, including embedded sound; normal final output replaces provider sound with the separate catalogue MP3.
- All 18 trimmed MP4s were independently verified in the exact original D: import folders; Hook 18 stays unchanged. This soundtrack release does not switch production video source URLs to the local trimmed derivatives.
