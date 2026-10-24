# Carousel System Context

## 2026-10-24 Shared manual typography released with combined changes

- Website/MCP app source `4cb252d5` and all eight existing worker targets with
  image source `5f7b7747` are deployed; the worker trees match exactly. Shared
  Poppins/TikTok Sans faces and outlined manual export changes are included.
  Existing Carousel sourcing, schema and automatic-generation typography remain
  independent. No new Carousel migration or sourcing decision in this release.
- Combined regression/build checks pass; hosted private-media delivery checks
  pass. The user will verify the signed-in galleries. Do not treat local font
  fixtures as paid generation quality qualification. Rollout/evidence/exclusions:
  docs/combined-release-2026-10-24.md.

## 2026-10-24 Poppins correction in the shared manual font list (local)

- User rejects TikTok Sans as the matching reference font and requests the closer
  Poppins Bold appearance. The shared manual font list now includes actual
  Poppins Regular/Medium/Bold, using pinned static TTF sources and matching WOFF2
  preview faces. Manual slideshow tests cover Poppins in both aspect ratios and
  at canvas edges. Automated generation typography stays independent.
- The optional outlineWidth control added to Hook/Wall video edits belongs to
  that video-edit format. Slideshow manual typography retains its existing
  outline controls and saved schema. Local addition; not deployed. Evidence:
  `docs/poppins-font-correction-2026-10-24.md`.

## 2026-10-24 Shared manual font addition (local)

- The user requests the font shown in a Hook reference. TikTok Sans is added to
  the shared manual typography list, so Trending slideshow editing also offers
  its Regular/Medium/Bold faces. Preview metrics, WOFF2 and outlined TTF exports
  come from one pinned source. Automated generation typography, existing saved
  styles, legacy layout and defaults are unchanged. All manual typography tests
  pass, including the new family in square/portrait exports and at canvas edges.
  This addition is not deployed. Evidence and font-identification limitation:
  `docs/hook-remix-brand-and-tiktok-font-2026-10-24.md`.

## 2026-10-24 User resumes combined deployment

- Saved-caption production migration is applied as `20261024061601`; RLS and service-only privileges verified. Current release includes all intentional worktree changes, including slideshow Save recovery, paired slide rendering and dedicated edit-worker/queue concurrency of two. Deployment and hosted acceptance are in progress; do not describe the earlier local fixture checks as final production acceptance.

## 2026-10-24 Trending edit recovery and rendering latency (local; release paused)

- Repeated report: Save edit appears reset after navigation/tab return and final
  slideshow output is slow. Production read-only evidence: a six-slide edit took
  9.48 seconds before worker start and 17.34 seconds in the worker; a separate
  stale render waited 39.76 seconds. The service has one warm instance (service
  minScale=1; revision minScale=0 is not evidence of scale-to-zero), one active
  instance/request and one queue dispatch. Cold starts are not established.
- Carousel PATCH skips its redundant initial editor read and returns the durable
  queued snapshot after dispatch. A post-dispatch editor read can no longer mark
  a successfully accepted render failed. Ownership/source/revision checks remain
  in the existing save service; no schema or generation change.
- Owner/scope-bound in-flight saves survive route remounts; small PATCH requests
  use keepalive for document navigation. Lost responses get one read, never an
  automatic second mutation. Reopened pending edits show Rendering and prevent
  duplicate saves. Foreground status recovery preserves new unsaved typing;
  unchanged completed edits show Edits saved. Initial feed recovery retries
  transient read failures instead of silently retaining the original slides.
- Changed slides render/upload in pairs, maintaining ordered immutable output,
  fingerprint reuse and revision fencing. Each pair drains before failure, and
  partial output is never published. Infrastructure proposes two edit instances
  and two queue dispatches, retaining one warm instance and one job per instance.
- Real-component Edge fixtures verify desktop/mobile Save -> document navigation
  during PATCH -> retry failed recovery read -> tab return -> new rendered image,
  with exactly one PATCH. This is isolated local acceptance, not production UI
  verification. No production mutation, deployment or new paid generation.
- Details and deployment requirements: `docs/trending-edit-recovery-2026-10-24.md`.

## 2026-10-23 Saved post captions in shared scheduling UI (local)

- Trending Carousel/Wall/Reaction publishing uses the shared saved-caption library
  also available in Explore scheduling. Users can save multiple exact captions,
  pick a default for untouched new posts, clear the current caption, or remove a
  saved entry. Intentional blank drafts and accepted schedule snapshots remain
  independent of later library/default changes. This is post metadata only;
  generated slideshow copy, on-media text, rendering and content allocation do
  not change. No provider receives the saved-caption library.
- Owner-authenticated storage uses a separate service-only, revision-fenced row.
  Additive migration `20261024061601_saved_post_captions.sql` and website release
  are pending; production was not modified. Local browser fixtures cover default
  reuse, save/clear/delete, account isolation, concurrency and lost responses.
  Details: `docs/saved-post-captions-2026-10-23.md`.

## 2026-10-23 Trending feed idle-return request boundary (local)

- Feed reads now bound owner-scoped browser authentication, HTTP and parsing
  together to 20 seconds. Late tokens cannot issue cancelled navigation reads;
  typed timeout errors use the existing retry schedule. Feed cache, content
  allocation, generation and scheduling behavior are unchanged. Local recovery
  checks pass; real production idle latency remains unmeasured. See
  `docs/idle-navigation-investigation-2026-10-23.md`.


## 2026-10-23 Manual Explore slideshow reference additions (media uploaded; release paused)

- Four supplied uncategorized references retain their own ordered image sets
  (3/6/2/2, thirteen original files). User requested image-only import and
  explicitly omitted `New folder (2)/middle.mp4`. This is Explore reference
  content, separate from automatic Trending Carousel sourcing or generation.
- The shared Explore gallery puts the latest published upload batch first and
  badges it `New` until the next slideshow batch is fully published. Hook or Wall
  uploads do not retire these badges. Category interleaving runs before batch
  priority; source slide identity/order and category filtering remain intact.
- Media is uploaded and verified; application/worker release remains paused.
  The earlier staged slideshow additions and automatic Carousel pipeline remain
  unchanged. See `docs/explore-new-content-batches-2026-10-23.md`.

## 2026-10-22 Shared browser font preload optimization (local)

- Root editor/monospace font declarations now use `preload: false`. Exact files,
  family variables, weights and worker font registration remain unchanged;
  browsers load these faces when rendered text needs them. Keep these variables
  available to legacy Carousel/Wall previews; do not replace them with OS fonts.
- The production-mode local homepage preloads only primary sans faces; all six
  legacy editor families load on demand. Existing font/export and actual editor
  browser regressions pass. No deployment or worker/database change. Evidence:
  `docs/homepage-cost-optimizations-2026-10-22.md`.

## 2026-10-22 Named slideshow release approved (in progress)

- User approved deployment of all intentional changes and the additive private
  plan migration. Production ledger records `20261022092140`; RLS and service-only
  access were verified. The user subsequently paused deployment. The 23 October
  final review re-verifies that migration and its access grants read-only; worker
  and website deployment remain pending fresh authorization, in that order.
- The automatic Trending Carousel pipeline and previously deferred default
  content-mix migration are unchanged. Release evidence:
  `docs/hook-workspace-slideshow-release-2026-10-22.md`.

## 2026-10-22 Manual Explore named inputs and per-slide plans (local)

- Manual Explore keeps one input bar, stable original source numbers, persistent
  Upload A/B names and an explicit Current slide base for revisions. A private,
  durable image-aware planning step binds uploaded images to semantic roles and
  target slides before image credits. Clarifications stay in the existing flow.
- New v4 generation requests isolate each target's base, assigned uploads and
  instructions. Existing v2/v3 retries remain unchanged. Automatic Trending
  Carousel planning, sourcing, matching, rendering and scheduling are unchanged.
- Local implementation only; migration, generation worker and website deployment
  are required before hosted acceptance. Input-boundary tests do not establish
  generated visual fidelity or exact screenshot placement. Receipt and limits:
  `docs/slideshow-named-plans-2026-10-22.md`.

## 2026-10-22 Approved manual Explore slideshow sources (local)

- The user approved the supplied folder mappings. Manual Explore adds 38 source
  mappings with post/profile labels and separate outbound actions; existing Pro
  source entitlement is retained. Automatic Trending Carousel is unchanged.
- 13 additional references / 60 images are staged separately. Existing 59
  references and the three folder-absent sets are preserved. Local preview merges
  72 sets; generation cannot resolve staged IDs before verified media publication.
- 86 focused checks, types/lint and actual-component browser source clicks pass.
  Production remains paused. Automatic approval review blocked the public media
  upload pending explicit payload/destination approval; no successful upload or
  deployment. New-source Remix transcripts remain unreviewed. Details:
  `docs/slideshow-source-links-2026-10-22.md`.

## 2026-10-22 Shared library and idle-tab performance (local)

- Recurrent user latency report covers Trending slideshow Library, image upload,
  editing and long-idle return, alongside Explore. Shared manager uploads two
  files concurrently and writes ordered collection membership once. Apply batches
  owned source admission, preserving archive/readiness checks and authoritative
  generated-image provenance before one atomic background change.
- List refresh follows mutation completion without holding the operation lock;
  failed background refresh retains cached tiles. Stale open-library queries
  revalidate on return. Query cache remains account-scoped; no global TTL change.
- Trending queued/rendering edit-status reads pause while hidden/offline and
  resume once, without overlap/catch-up. Existing revision fencing, render state,
  text/slide identity, worker queues and Save-before-scheduling remain unchanged.
- Website-only local correction, no worker/migration/production mutation. The
  deliberate deployment pause blocks final hosted acceptance. Actual-component
  Explore/Trending library desktop/mobile tests pass, including partial retry,
  ordered concurrency, atomic admission, retained text and stale-cache recovery.
  Evidence/limits: `docs/ui-performance-2026-10-22.md`. Expanded shared Demo,
  job recovery and Scheduling audit: `docs/app-loading-audit-2026-10-22.md`.

## 2026-10-21 Manual Explore slideshow fidelity recurrence

- Manual Explore audit visually verifies latest v3 Flare batch uses the laptop
  scene in both output positions and has no screenshot attachment. Earlier v3
  Sunburst output has the attachment but invents its UI. Automatic Trending
  allocation/planning/matching/rendering is unchanged by this investigation.
- Local shared missing-screenshot preflight now scopes negation to the placement
  action, so “use my screenshot, do not change anything else” cannot bypass
  client/API checks before billing. This guard is not a visual-fidelity solution.
- Proposed image-aware conversation should maintain a per-slide edit plan and
  route precise assets/text to compositing/layers, generative scene edits to
  isolated image requests. Chat/planner/compositor are not implemented here;
  current one-box rewrite and v2/v3 durable retries remain the implementation.
- 71 local regressions, build/types and isolated browser checks pass; existing
  stored images inspected, no new paid generation or deployment. Authenticated
  production acceptance remains pending. Evidence and design:
  `docs/slideshow-workflow-recreation-audit-2026-10-21.md`.

## 2026-10-21 Trending defaults to Structure 2

- Supersedes the initial 50/50 default from 14 October: unsaved Trending
  slideshow preferences now use 0% Helpful tips (Structure 1) and 100% Product
  stories + CTA (Structure 2). Existing Adjust controls remain editable.
- The shared application default is used by the preference API fallback and
  dialog initialization. Migration `20261021131000` aligns defaults on account
  preferences and both daily feed tables. It does not update existing rows,
  override saved choices, or rewrite generated/reserved feed snapshots.
- Local allocation/editor and isolated PGlite migration checks: 20 passed,
  including all-Structure-2 Starter/Growth packs, saved-mix preservation and
  later percentage changes. Production migration/deployment and signed-in
  acceptance remain pending; this entry does not claim the default is live.

## 2026-10-20 Complete removal of two rejected source images

- User explicitly superseded historical preservation for source assets
  `6e07f2d4-3d18-413a-be31-0e29604671e2` and
  `c8b4cefd-4905-433e-aa2f-e71e258fc3de`. Production tombstones now have
  rejected review status, permanent-removal reason and preservation disabled.
- Removed 25 historical slide previews across 24 generations, archived two
  saved Library entries, and removed the matching image from one saved edit.
  Quota/decision records remain unchanged. The two associated social posts
  were already published; this action does not delete social-platform posts.
- Deleted and verified absent 31 exact GCS objects (originals, base images,
  thumbnails and rendered slide variants). Retain only metadata tombstones
  and exact hash/path denylisting to prevent reimport.
- Cached Trending history rejects these exact asset IDs or deleted object
  keys, including saved-edit snapshots, without clearing unrelated history.
  Cache-code rollout is recorded separately from completed data removal.


## 2026-10-20 Second rejected source: exhausted-at-laptop body slide

- Traced “I felt drained trying to keep up with trends. The constant pressure
  left me exhausted.” to slide 2 (`ffb65e6d-d4d3-423c-a246-fbabe0de71df`) of
  generation `4b7c163f-9505-4502-b08e-a696b7aa4a79`. Visually verified the original
  1440×1920 JPEG `productivity-human/Pinterest_2026-08-16 (74)/pinterest_002.jpg`.
- Production asset `c8b4cefd-4905-433e-aa2f-e71e258fc3de` and all exact-hash
  matches were retired at 10:39 UTC; zero matching active assets remain. Hash:
  `3046ddbc7ac7584172f6b98ec839e18f7aaed7e0684f9337ddb4f3de27aed2a9`.
  Historical source bytes/renders remain available. The previously rejected
  cover source was read back and is also still inactive/archived.
- Local import/reconciliation denylist updated by exact path and hash; all 12
  source-retirement checks pass. This local policy addition is not a website
  deployment. Production pool retirement is already effective through the DB.
  Receipt: `outputs/trending-exhausted-source-retirement-2026-10-20.json`.

## 2026-10-20 Revisited slideshow first-edit fix — production release receipt

- The exact hook “if you’re stuck on creating fresh content, read this.” uses
  source asset `6e07f2d4-3d18-413a-be31-0e29604671e2`, a 736×919 JPEG enlarged
  to 1080×1350. It is archived/inactive and denied by hash/path during import
  and reconciliation. Existing historical bytes/renders remain available.
- A completed_skipped assignment with no saved edit was incorrectly blocked
  by the UI, API and database trigger. Owned revisited Carousel assignments
  now allow a first edit; ownership, immutable scope, revision checks and
  Hook/Wall restrictions remain. Edits do not replay decisions, consume quota,
  or rewrite previously saved/scheduled snapshots.
- Database migration `20261020102121` was applied before website deployment.
  PR #77 merged as `d70541952ee42538265f2e95e11d3942d94ddc76`; its tree matches
  validated source `ba8b2a8aaa6969d3907746a87adf5df8b046f819`.
- Production deployment `dpl_56RnJrvJ6MR63KAoWhpp3ewfnQb9` is READY and both
  getugcpilot.com and www.getugcpilot.com aliases resolve to it. Build settings
  were restored; MCP production and workers were unchanged by this patch.
- 25 focused checks, application TypeScript, scoped lint and production build
  passed. Database retirement/migration/function readback passed. Signed-in UI
  acceptance is still unverified because Work local browser access is disabled.
  Receipt: `outputs/trending-source-and-first-edit-release-2026-10-20.json`.


## 2026-10-20 Repeated library-background text loss: missed dedicated worker repaired

- The 19 October rollout receipt incorrectly treated video-render service/job
  deployment as sufficient for slideshow edits. The real route is
  `render_trending_carousel_edit` → `carousel-edit` →
  `GCP_CAROUSEL_EDIT_TASK_URL` → `ugc-carousel-edit-worker`. That dedicated
  service still served `release-771878a1` at 100% traffic; the new 20 October edit
  `b464c4e1-dc75-456d-93b0-c28af2fa0994` therefore rendered with the old v3 mapping.
  This was a deployment-target omission, not lost copy or a new prompt failure.
- Repaired the dedicated service using the already tested immutable image
  `sha256:96afdde1f42c980281c3b68182ad91874c41c997d9d20219bd472f8d0f15a36d`, source
  `fac61da3`. Ready revision `ugc-carousel-edit-worker-bodycopy-fac61da3` now
  receives 100% traffic. Queue/job restrictions, ingress, scaling, concurrency,
  resources and unrelated environment settings were verified unchanged.
- Saved the affected in-progress edit through the signed-in production UI with
  no copy/background changes. Revision 2, job
  `ed04de7b-f9ea-4e8c-80e2-1d7c6fe49d6e`, completed with
  `normalized-edit-v4-body-copy`. Slides 2/3 visibly recovered in Trending;
  all six actual stored 1080×1350 output images were downloaded and visually
  checked with visible copy. Browser access was disabled afterward, so final
  inspection of slides 4–6 used those exact output images, not a local render.
- Future worker releases must derive targets from queue routing, including the
  dedicated Carousel edit service. Do not use video-render readiness as Carousel
  edit acceptance. Read back a fresh edit job's renderer version and inspect all
  saved slides. A fingerprint bump alone does not repair existing image bytes.
- Receipt: `outputs/carousel-edit-worker-repair-2026-10-20.json`; evidence montage:
  `outputs/carousel-repair-all-six-2026-10-20.png`. Earlier claims of complete
  Trending body-copy deployment are superseded by this verified repair.

## Trending body-copy correction deployed — 19 October 2026

- The completed library-background body-text mapping fix shipped with PR #75,
  main `93df700e`, tested source `fac61da3`. Video render service and render job
  use verified digest `96afdde1f42c980281c3b68182ad91874c41c997d9d20219bd472f8d0f15a36d`;
  the service is READY with 100% traffic on `hookfix2-fac61da3`.
- `normalized-edit-v4-body-copy` resolves body-only text from current subtext,
  then legacy headline, and invalidates the old blank-render cache signature.
  Existing blank saved images need a new edit/save/render. Existing scheduled
  snapshots were not rewritten. The earlier quota-history release is preserved.
- Combined 182 regressions, web/worker builds and application types passed;
  six-slide real-render/editor-browser checks passed in the originating task.
  Final deployment/source/settings readback passed. Receipt:
  `outputs/combined-hook-seedance-trending-release-2026-10-19.json`.

## 2026-10-19 Library backgrounds lost body text (local worker correction)

- Confirmed from an owned production edit: all six saved slides retained copy
  and changed backgrounds, but Structure 1 body-only copy was in the legacy
  `headline` transport with empty `subtext`. The normalized plan instead had
  `body`/`subtext`. The edit worker compared these different representations,
  treated empty `subtext` as deletion, and rendered blank body slides. The hook
  uses separate mapping. The library picker did not discard the copy.
- Body-only mapping now uses current nonempty `subtext`, then `headline`, matching
  the editor preview. Structure 1 edit fingerprint advances to
  `normalized-edit-v4-body-copy` so a new render cannot reuse the bad output.
- Worker build, 16 worker render tests, 14 image access/save checks, and the actual
  editor browser suite pass. A real six-slide raster test checks text pixels on
  every output and fails with the old mapping. Browser coverage now includes six
  fresh body-only slides without manual styles and six selected library images.
- Local only: requires render-worker deployment and signed-in production check.
  Existing blank saved images need a new render after rollout; retained copy and
  scheduled snapshots were not modified. See
  `docs/carousel-library-background-text-2026-10-19.md`.

## 2026-10-19 Quota-history release verification

- PR #74 merged as `283afc17`; staged production build `4c22c19e` has the identical Git tree and is live on both `getugcpilot.com` and `www.getugcpilot.com`.
- Deployment `dpl_Dfbks1DRK3L4AMnmWQRJFU9ohNSM` is READY. No migrations or worker changes; MCP production unchanged. Deployment build settings restored.
- Final history (22), interaction (88), TypeScript, lint, full browser and quota browser checks passed. The service recovered all eight reviewed production-quota slideshows, denied a different owner and left quota unchanged. Both live history endpoints reject anonymous requests with 401 and private/no-store caching.
- Authenticated production-browser acceptance is still pending: the available browser is signed out. Deployment success does not establish that final user-session check. This entry supersedes earlier local-only/blocked-rerun status below.
- Receipt: `outputs/trending-quota-history-release-verification-2026-10-19.json`.


## 2026-10-19 Explore Focus reference addition

- Explore slideshow catalogue adds `explore-slideshow-nota-f79553cb5f15c74e`:
  six 1320×1760 JPEGs in supplied numeric order, first image as cover, topic Focus.
  The user renamed the source folder and corrected the category to `focus`;
  keep the existing internal reference ID and asset keys stable.
  Uploaded immutable objects are hash-verified; reviewed captions support Remix.
  No Trending Carousel planner, rendering or publishing behavior changes.
- Catalogue activation on the frontend still requires the web release; media
  upload is complete and distinct from deployed catalogue acceptance.


## 2026-10-19 Explore slideshow added-text symbol colors (local)

- Explore's manual added-text SVG now shares deterministic colored cross,
  check and right-arrow artwork with its video overlays. The same SVG supplies
  preview and PNG export, and wrapping preserves full emoji graphemes.
- This corrects the Explore symbol-color bug without changing generated/baked
  slideshow content or Trending Carousel's independent manual glyph renderer.
  Trending manual glyph export still rejects unsupported characters explicitly.
  Production rollout and authenticated acceptance remain pending.



## 2026-10-19 Same-quota older-post recovery (local correction; production pending)

- User subsequently clarified the required scope: previously viewed posts from
  the same quota/delivered feed, even hours later. Recovery must preserve that
  feed's ordering and not consume another slot or mix unrelated quotas. This
  requirement now has a local server-history implementation; it is not deployed.
- Latest user recording distinguishes immediate swipe-back (now possible) from
  returning to a slideshow reviewed roughly two hours earlier. Read the evidence
  in `docs/trending-older-history-investigation-2026-10-19.md` before another
  gesture-only fix or declaring full history acceptance.
- Production database reads confirm earlier skipped assignments/ready slides
  still exist. The connected production browser reaches a newer historical post
  with no previous item despite those older account records. The normal daily
  feed excludes completed assignments; the deployed backward browsing had no
  server-history fetch and relied solely on local snapshots. Comet's exact lost-snapshot cause
  was not observable from the recording or the separate in-app browser.
- There is no two-hour cache timeout: current limits are seven days/120 posts/
  one million serialized characters. An actual parser probe preserves +2h
  history. The missing capability is owner-scoped recovery/pagination from
  existing server decisions, merged with local pending reviews without replaying
  decisions or disturbing the active post. Loading failure must not masquerade
  as the end of history.
- Local `GET /api/trending/feed/history` checks feed ownership, pages existing
  decisions in original quota-slot order, and hydrates available Slideshow,
  Hook, Wall and Reaction previews. It never prepares replacements, marks a
  post shown, reactivates assignments or records decisions. No migration.
- The gallery receives the persisted feed ID, scopes its cache to owner + quota,
  preloads earlier pages and merges them without moving the selected post or
  overwriting local edit snapshots. Failed recovery has a Retry action;
  unavailable creatives are reported. Empty and storage-blocked browsers can
  recover server decisions. Existing unscoped snapshots are not mixed in.
- Local checks: `npm run test:trending-history`, the interaction suite, TypeScript
  and scoped lint. The actual Gallery/Deck browser fixture passed empty-cache
  +2h recovery, slow pagination, refresh, leave/return, quota isolation, empty
  quota, retry and blocked storage, with zero decision/save/schedule writes.
  The final quota browser rerun passed on the isolated release checkout.
  The new service also recovered all eight reviewed production-quota
  slideshows (six slides each), denied a different owner, and left quota
  unchanged. Authenticated deployed-browser acceptance remains pending.

- Earlier immediate swipe/reload acceptance remains valid within its tested
  scope; it does not prove older account-history recovery. No production writes
  were made during this investigation.


## 2026-10-19 Same-visit finger swipe-back correction (local)

- User clarified the remaining failure: swipe a Reel upward with a finger, then
  pull/swipe downward to return to it during the same visit. Deployment of browser
  history recovery does not establish that this native touch gesture works.
- Reproduced with the actual Trending gallery/deck, Reaction Reel and native
  Chromium touch events: long upward travel advanced to post 2, but a 120px
  downward swipe stayed on post 2, despite the previous entry remaining present.
  Long downward travel worked. The prior browser test used keyboard advance and
  an 85%-height downward touch, missing this normal shorter reversal.
- The touch path previously relied on native mandatory scroll-snap selection;
  it had no explicit distance/speed-based adjacent-post target. Mouse dragging
  already had a separate release policy. History storage was not this failure.
- Touch now tracks a single finger through TouchEvents (native scrolling can
  cancel PointerEvents). Native panning remains; native snap pauses during a
  deliberate vertical drag. On release, bounded travel of 48–100px depending
  on viewport, or a directional flick with nontrivial travel, chooses exactly
  one adjacent post. The existing settle/decision locks perform the hand-off.
  This is a distinct touch policy; mouse and wheel thresholds are unchanged.
- Tiny/horizontal/reversed/cancelled gestures, pinch/multitouch, controls,
  tutorial acknowledgement, missing previous history and disabled interactions
  cannot create a touch history transition. Taps still use existing double-tap
  behavior. Resize, blur, item changes and cancellation clean gesture state.
- Local acceptance covers long/120px up-down sequences on actual Reels at phone
  and tablet widths, reduced motion, repeated backward/forward history, mouse
  drag, exact IDs and decision counts. Unit tests execute the real touch handlers
  for double taps, jitter, direction, cancellation and interaction guards.
  The fixture accepts existing Reaction presentation telemetry separately from
  decisions; no paid generation, social publish, save or scheduling is submitted.
- Release checks now pass: 86 interaction tests, application TypeScript, scoped lint, and the complete actual-gallery browser run including native touch at phone/tablet sizes, reduced motion and desktop mouse reversal. The prior desktop fixture started below the clipped feed; its coordinates now use the visible media/feed intersection with an explicit hit-target check. Product mouse behavior is unchanged.
- Signed-in production browser access is available during the release. Local Chromium checks remain distinct from deployed-site acceptance and physical-device verification. See `docs/trending-touch-swipe-back-2026-10-19.md`.

## 2026-10-19 Trending review recovery after navigation or refresh (local)

- Recurring root cause: `usePostReviewHistory` was explicitly visit-local React
  state. Earlier gesture checks proved backward scrolling only within one visit.
  Leaving Trending/reloading removed the snapshots, while the server correctly
  excluded already-decided assignments from the new-post feed. An empty feed
  could also return before mounting any history controls.
- Authenticated Trending now opts into account-scoped browser recovery of up to
  120 reviewed post snapshots and the selected historical post, retained for
  seven days and bounded to one million serialized characters per account.
  Saving is synchronous in the history action, before navigation can unmount.
  Landing/Try demos remain visit-local. No credentials or image bytes are added
  to this cache; previews retain their existing media URLs and edit snapshots.
- The gallery owns recovery above its loading/empty branches and Hook composer.
  A recovered history keeps the real review deck mounted when the server returns
  no new posts. View previous posts remains available after reviewing the final
  post. Account changes hide the old snapshots before recovering the new owner.
- Recovery and backward/forward browsing do not replay outbox decisions, saves,
  likes, scheduling or generation. An explicit user action still uses existing
  ownership/assignment checks and scheduling flows. Cached edits refresh through
  the existing owned API. Other tabs' reviews merge on the next history action;
  an existing liked decision is not downgraded by a stale skip snapshot.
- Invalid versions, malformed entries, expired snapshots and missing positions
  recover safely. Blocked/quota-failed browser storage keeps current-visit history
  working and shows a concise explanation. This is same-browser recovery, not
  cross-device server history or a backfill of previously lost visits. Clearing
  site data removes this cache; historical media deletion/access expiry still
  follows the existing media/preview renewal rules.
- Local checks: storage/gesture/decision tests plus a headless Edge fixture using
  the actual Trending gallery/deck, full document navigation, reload while
  browsing, wheel-back/forward, empty server feed, account switching, corrupt and
  blocked storage, and React StrictMode. `docs/trending-history-recovery-2026-10-19.md`
  records the acceptance boundary. Not deployed; authenticated production-domain
  acceptance remains pending. Earlier visit-local history notes are superseded
  only for authenticated Trending opting into this recovery.

## 2026-10-19 Shared body styling, protected overrides and reopening edited history (local)

- Trending Carousel Edit defaults to sharing changed style fields and placement
  across body slides. The hook remains separate. Each slide keeps its copy,
  source image, ID and order; shared typography wraps its own copy. A visible
  checkbox switches to individual edits. Use this layout on shared body slides
  explicitly copies the complete selected layout to unprotected body slides.
- Individually changed body styling persists as `textStyle.bodyStyleMode:
  individual` and is excluded from later shared updates, including full-layout
  copies. Previously saved manual styles with no mode are conservatively treated
  as individual. Shared styles carry explicit `shared`. The UI identifies custom
  layouts and lets the user explicitly include one in shared styling again.
  Text/copy edits remain local regardless of styling scope. Scope defaults to
  shared on reopening, while persisted individual protection remains in force.
- New manual text placement uses actual canvas edges instead of a fixed 96px
  inset. Only full text/glyph/panel containment limits motion. Position sliders
  span the usable travel distance from 0% to 100%; corner intent survives changes
  to the other axis and wraps independently per slide. Unchanged old styles keep
  their previous inset until moved. Renderer v4 fences cached manual output.
- Overlong body copy is flagged with per-slide Review actions. Those actions
  switch to individual editing, so corrections need not affect other slides.
  No AI inference, automatic copy rewriting, truncation or hidden font reduction.
- The disabled Edit control was caused by a blanket review-history UI guard.
  Existing edited Carousel history can now reopen using click or E, while
  transitions and other formats keep their existing guards. API access verifies
  owner/creative/assignment and requires an existing edit in terminal history.
- Local migration `20261019061132_allow_existing_carousel_history_edits.sql`
  permits only UPDATE of the same Carousel edit in completed_skipped/saved/
  scheduled assignment states. Scope immutability, revision fencing and source
  validation remain. New history inserts, reassignment and Hook/Wall history
  writes remain rejected. No assignment state or scheduled snapshot is rewritten.
  This supersedes earlier blanket read-only-history rules for existing Carousel
  edits only; history browsing does not create a new edit or unskip a post.
- Local validation covers shared/individual persistence, legacy protection,
  one/two/five/ten-slide sequences, hook isolation, overflow and all canvas corners.
  Pixel tests draw on an enlarged canvas to detect clipped glyph/panel pixels.
  The actual editor browser verifies manual overrides after reopen, explicit
  rejoining, distinct copy, corner movement, normal Save and library flows at
  laptop/mobile sizes. PostgreSQL PGlite executes the old/new trigger behavior
  and owner/scope/state/revision/other-format negative cases.
- No deployment or production mutation. Rollout requires the local migration,
  compatible renderer worker and website. Authenticated production acceptance
  remains pending; production trigger inspection in this task was read-only.
- Results: 99 focused checks pass (62 worker/rendering, 19 style/persistence/
  containment and 18 history/decision/database checks), along with the actual
  editor browser suite, worker compilation, application TypeScript and scoped
  ESLint. Body-scope controls were visually checked at 1366×768, 1536×864 and
  390×844; other zoom levels remain untested.

## 2026-10-19 Approved library workflow — existing Trending slideshow (local)

- Settings → Media library creates/manages image collections. Upload inside a
  collection adds membership; existing images can also be added. Management
  explains where these backgrounds are used. Trending's header pill is labelled
  Manage library so organization is distinct from changing a particular post.
- The approved apply path is Trending → Edit → Choose backgrounds from library.
  One image defaults to the selected slide; All slides supports multiple selected
  images in click order or a whole collection in saved order, repeating as needed.
  Collection use is beside its name, before the grid. Unselected thumbnails no
  longer display competing order numbers; thumbnail frames fill without side strips.
- Preview backgrounds opens the actual proposed composition. Use these
  backgrounds revalidates owned sources and changes only the editor draft. Normal
  Save persists that same assignment/creative through existing revision/render
  handling. Text, styling, original sources, slide IDs and order are preserved.
  Cancelling preview leaves the creative unchanged. Library edits do not update
  existing/scheduled slideshows automatically.
- Removed the attempted standalone library → Explore editor URL handoff. It did
  not implement the approved purpose. Existing Explore library picker integrations
  remain; no new slideshow/navigation is initiated by background selection.
- The picker has full-width selection and a separate explicit preview, without
  side panels or reorder arrows. Management retains the selection and uses Done
  with automatic-save wording. Scoped scrollbar arrows are suppressed. Narrow
  dialogs restrict transitions to opacity/transform so viewport resizing does not
  animate dimensions outside the screen. This supersedes the earlier library
  picker entries' side-by-side preview and up/down proposal-order controls.
- Local actual-editor browser checks verify collection preview/cancel, separate
  Use and Save boundaries, the same creative/revision, preserved text/style/order
  and reopening. Shared component checks cover single/multiple images, repeats,
  source-check failure, collection creation/membership/upload, music reuse and
  32-image mobile collections at 390px and 320px. Production acceptance is separate;
  no deployment, worker change, migration or production mutation was performed.

## 2026-10-18 Missing glyph segments in edited slides — confirmed worker serialization defect (local fix)

- Read-only inspection found the matching saved first slide: the full headline
  `5 websites I wish I knew before launching my SaaS` was intact. Its style was
  Montserrat Bold, 40px, 431px wrapping width, yellow, with fractional position.
  Reproducing that exact style in the worker damaged `s`, `a` and `u`, while the
  live browser font rendered the same text correctly. A saved-render preview
  can therefore show the defect inside Edit as well as on the Trending card.
- The installed OpenType.js 2.0.0 `toPathData(3)` rounds fractional coordinates
  using decimal-string exponent arithmetic. Near-integer values such as
  `83.00000000000001` can produce `NaN` tokens. SVG rasterization then damages
  parts of the glyph. Font glyph availability, prompt rewriting and text saving
  were not the cause; affected characters depend on placement and font metrics.
- Both callers now use a shared finite-coordinate SVG command serializer:
  Carousel manual text and Explore's bundled-font video overlay renderer.
  It preserves every M/L/Q/C/Z command, rounds with numeric `toFixed`, and
  rejects nonfinite coordinates rather than writing malformed SVG.
- Manual renderer version advances to v3 so new saves do not reuse v2 damaged
  output. Existing assets/posts/receipts are not rewritten; after worker rollout,
  affected Carousel edits must be saved again to generate corrected pixels.
- Local validation: 60 worker/renderer tests and 9 font/export/persistence tests
  pass. Includes per-glyph raster ink across 12 font faces (letters, numbers,
  punctuation, accents), the exact reported cover, 48 font/weight/size cover
  combinations and invalid-coordinate rejection. Worker compilation, application
  TypeScript, scoped lint and actual-editor save/reopen browser checks pass.
  The standalone browser fixture needed Next's client env substitution after
  unrelated library navigation introduced Next Link; no app runtime change.
- Production reads only; no deployment or customer edit mutation. Exact source
  background/style were rendered locally for visual comparison. Signed-in
  production acceptance remains pending because local browser access is disabled.

## 2026-10-18 Trending text editor correction — compact controls and explicit styling (local)

- Moving a text group previously initialized a manual preset that always drew
  white heading panels. Position and background are now independent. New edits
  default to no panel unless the source explicitly uses pill treatment; saved
  v1 styles retain their existing panels until the user selects None. This
  supersedes the unconditional white-background rule in the earlier entry below.
- Hook/headline is multiline. Enter creates an intentional line break; text
  width controls automatic wrapping. Explicit newlines activate the shared
  manual layout so preview, saved JSON, reopening and exported glyphs agree.
- The compact toolbar provides font, separate heading/body size, color and
  weight, alignment, outline, wrap width and line spacing. Background is an
  explicit per-block choice: None, Per line, or Text box. Background color and
  opacity appear only when needed; position sliders are collapsed by default.
  Native font/select menus use explicit dark foreground/background styling.
- Desktop keeps the slideshow preview visible when lower controls are scrolled
  into view. Phone controls wrap within the modal and retain its save footer.
- Optional style fields are strictly validated in the shared parser. Manual
  renderer v2 includes them in shared layout and existing render fingerprints;
  browser text and worker glyph outlines use the same measured font advances,
  line breaks, alignment, backgrounds and geometry. No migration is required.
- Validation: 45 renderer/worker tests and 19 persistence/containment/schema
  tests pass, as do worker compilation, application TypeScript and scoped lint.
  Actual-editor browser fixtures cover three lines, movement without adding
  panels, explicit background choices, compact/dark fields, style persistence,
  failed-save recovery and mouse/touch/keyboard movement. Laptop/mobile visual
  checks remain distinct from authenticated production acceptance.
- Not deployed in this task. Website and rendering worker must be released
  together, with the compatible worker available before exposing new controls.

## 2026-10-18 Library picker clarity and composed previews (local)

- Background selection now shows This slide/All slides before choosing an image.
  Selection updates a proposed composition immediately; one fixed Apply action
  revalidates used sources before updating the draft. Library management uses an
  in-place Manage library view, without opening a second library dialog. Upload
  remains available directly in selection. Saving/scheduling stay explicit.
- Trending's proposal reuses EditorPreview with a temporary copy of the current
  slide and the same server-normalized centre-crop/original-role values as Apply.
  Text cannot be dragged inside the proposal. Saved edit/render identities are
  not changed or submitted merely by viewing it. Explore uses its own SVG overlay.
- Collection image order/repeat counts are visible, with earlier/later controls
  for this proposal only. These controls do not persist collection membership
  order or alter other posts. Full membership is used despite search filters.
- Images use contained portrait thumbnails; mobile has a collection selector.
  Music tab state survives navigation, previews play one at a time, and busy
  uploads/updates block library dismissal/tab changes. Failed uploads can retry
  only failed files. Existing ownership, archive and save guards remain in place.
- 313 focused regressions, application TypeScript, scoped ESLint and actual
  library/editor browser fixtures pass. New browser checks include text/crop,
  proposed reorder, failed rechecks, laptop/mobile footer bounds, upload retry
  and interruption, and native audio preview pausing. No migration, worker change,
  deployment or production mutation. See `docs/library-ui-clarity-2026-10-18.md`.

## 2026-10-18 Library image hover control suppression (local)

- Shared library thumbnails/previews route pointer interaction to their containing
  controls instead of the image element, suppressing the reported browser image
  search hover affordance. No app-owned outbound image link was present. Image
  selection and keyboard controls remain available; no library entry point is
  removed. This CSS-only change requires a website release. Browser-specific
  native overlay acceptance remains distinct from DOM hit-target checks.

## 2026-10-18 Shared manual-text production bundling correction

- The staged production Turbopack build exposed a shared worker import using
  a `.js` source path. Webpack fixture aliases and TypeScript resolved it, but
  Turbopack did not. Shared manual text now imports the real `.ts` font module;
  the worker's existing `rewriteRelativeImportExtensions` emits `.js` for Node.
- Validate this boundary with the actual production bundler as well as worker
  compilation and browser fixtures. Do not treat fixture builds as a substitute
  for a passing staged production build. Domains were not promoted on failure.

## 2026-10-18 Shared media library and background collections (local)

- Settings → Media library and Trending's new Library pill manage reusable
  images, named image collections and music. Trending Edit can choose one image
  for the selected slide, one image for every slide, or a whole collection in
  displayed order, repeating from the beginning as needed. Preview and explicit
  Apply precede draft changes; normal Save still gates the saved output.
- Collections reuse owned Creative Asset image groups. Removing a collection
  keeps its images. Image archive hides future selection through metadata while
  retaining sources for existing drafts/saved posts. Collection edits never
  change saved or scheduled slideshows automatically. Manual collection reorder
  is not included; added time/asset ID gives a stable displayed order.
- Manual save normalization accepts other ready owned uploads and generated
  images. Foreign, deleted, unready, unsupported and imported catalogue media
  remain rejected. Server-owned URLs, centre crop, original roles and existing
  special screenshot/reviewed-hook rules remain authoritative.
- Music can be uploaded from the header library and existing edit audio pickers.
  Saving a track does not attach it automatically or add photo-slideshow music
  publishing. Existing supported video audio controls can reuse the track.
- No migration or worker change. 312 focused tests, TypeScript, scoped ESLint
  and both isolated browser suites pass. No deployment or production mutation
  occurred; authenticated production acceptance is pending. See
  `docs/media-library-collections-2026-10-18.md` for scope and evidence.

## 2026-10-18 Trending slideshow manual text controls (local)

- Trending's Carousel Edit screen now exposes per-slide font (Inter, DM Sans,
  Roboto Condensed, Montserrat), hook/heading and body sizes (24–120 px), separate
  heading/body colors, horizontal/vertical position sliders and Reset text layout.
  The text group supports pointer/touch dragging and keyboard arrows on both
  structures. Structure 2 manual edits no longer quantize movement to upper,
  middle or lower positions or lock the horizontal coordinate.
- Optional `textStyle` travels through PATCH validation, owner/revision-fenced
  content JSON, reopening, preview dirtiness and the edit worker. No schema
  migration is required. Old edits with no style retain their existing rendering
  unless the user changes appearance or moves the text; generation typography,
  planners, slide copy and original assets are unchanged.
- Manual styling has one shared bundled-font layout for browser SVG and worker
  glyph outlines. Export uses the requested size without automatic shrinking or
  truncation, keeps the complete text group inside the canvas, and rejects
  overflowing copy before saving. Font/color inputs are strictly allowlisted;
  unsupported font glyphs return a useful render error instead of missing boxes.
  Headings retain white line backgrounds. Manual render fingerprints include
  typography/version so saved pixels cannot be reused after a style change.
- Reset removes the manual style and centers the text group. This does not
  change the original generated image, slide copy, or other slides' settings.
  Browser tests use actual Trending editor components and local API fixtures;
  they do not publish or write production data. A worker and website release
  are required together; the updated worker must precede UI availability.
- Validation: 61 focused persistence/containment/renderer regressions, application
  TypeScript, worker build and scoped ESLint pass. Actual-editor browser checks
  cover mouse, real touch and keyboard placement, independent per-slide styles,
  failed saves, reopen, reset and laptop/mobile fit. Raster export tests confirm
  untouched background pixels remain. An older containment test expected two
  generic drag overlays before Wall moved to its dedicated component; updated
  that assertion to verify one Hook overlay and one Wall overlay explicitly.
  These checks are local; this change is not deployed.

## 2026-10-18 Helpful Tips metadata repair and failure diagnostics (local)

- Production v58 is deployed (successful generation provenance and revision
  `ugc-carousel-worker-publish-a493dbd6` verified), superseding the deployment
  status in the 17 October local planner entry below. Candidate failures remain
  concentrated in Helpful Tips. The reported account ultimately has complete
  daily packs, despite 45 failed candidate attempts out of 110.
- A live fictional-business reproduction completed only 2/5 plans: hidden
  image descriptions tripped the existing object-only rule. Parsing stopped at
  the first unsafe direction, and isolated repair rewrote entire valid decks
  without reporting all offending fields. Malformed repair output could also
  escape before the existing second attempt. Generic aggregate errors then
  discarded failed-slot diagnostics. Exact causes of old generic failures are
  unavailable; do not attribute every historical failure to this reproduction.
- Local Helpful Tips v59 collects every unsafe visual direction with its slide
  number and repairs only those image fields (plus specifically rejected body
  fields for mixed failures). All visible copy, facts, roles and other fields
  stay frozen and the complete publishing checks still run. The object-only
  safety policy, model, image sourcing, actual font fit and recovery budgets
  are unchanged. Shape-error recovery uses the existing second repair budget.
- Failed candidates persist original/final issues, slot and initial/repair
  responses in existing server diagnostics before job settlement; logs expose
  issue codes and slide numbers without raw provider copy. Completed siblings
  and reservation consumption/release behavior remain intact. No migration.
- The exact same synthetic initial output passed 5/5 after scoped repair;
  repair time was 5.752s versus 25.665s, tokens 7,474 versus 25,721. This is one
  controlled reproduction, not a production success-rate guarantee. Worker
  compilation and 122 focused tests pass, including 60 real renders of the
  repaired 30 slides in both ratios. All 30 sampled existing hosted slides
  are accessible; the production worker and queue are healthy. The fix is
  not deployed and authenticated acceptance with v59 remains pending.
- Details: `docs/carousel-reliability-investigation-2026-10-18.md`.

## 2026-10-19 Explore slideshow scheduling confirmation (local)

- Explore's shared slideshow scheduling form follows Schedule post → Post
  scheduled / View in Scheduling → Schedule another post. A repeat opens a
  fresh request for the same saved slideshow; edits to date/time remain the
  user's choice. No extra saved-request confirmation controls are shown.
- A lost creation response triggers a read to recover its verified receipt.
  An unresolved attempt exposes Try again with the original idempotency key.
  This changes client recovery presentation only; Carousel generation,
  publishing APIs, source validation and Trending drawer behavior are unchanged.
- Local regression coverage does not establish deployed production acceptance.

## 2026-10-18 Repeat scheduling is an explicit new post (local)

- A completed Trending Carousel can be scheduled again. Opening the scheduling
  drawer creates one fresh idempotency key for that explicit post; retries of
  that open drawer keep the same key. The prior assignment-wide key incorrectly
  treated every future time as the same request.
- The same policy applies to Trending Reaction Reels through a browser-created
  request key. Wall-of-Text already derives its server key from the verified
  time, accounts and settings, while Hook videos already include the requested
  date and time in their idempotency identity.
- This is local code and regression coverage only. It does not submit or alter
  any production schedule.

## 2026-10-18 Workflow-to-Scheduling cache handoff (local)

- Manual Explore slideshow confirmation now updates and invalidates the owner's
  shared schedule list, matching the existing Trending Carousel drawer policy.
  Hook/Wall/Talking Head and background preparation use the same handoff rules.
  Scheduling always reloads its list on entry while retaining cached rows and
  the independent media/connection caches. A recent empty calendar can no longer
  hide a newly confirmed post for the 30-minute account-cache freshness window.
- Validation/recovery and publishing APIs are unchanged. Only verified server
  schedules enter the cache; unconfirmed requests cannot invent entries or
  cause duplicate scheduling. Local tests do not imply production deployment.

## 2026-10-17 TikTok publishing derivatives and terminal schedule status

- PNG uploads remain allowed. TikTok publishing prepares separate JPEG copies
  of saved slideshow/Carousel slides automatically, using actual decoded bytes,
  orientation correction, white transparency flattening and bounded dimensions.
  Originals, Library slide URLs, order, text and saved edits are preserved.
  Instagram retains its existing JPEG preparation. Accepted provider operations
  resume with their saved IDs without preparing or initializing another post.
- Retry decisions now honor the physical worker job's maximum attempts as well
  as the publisher limit. TikTok `file_format_check_failed` is terminal, with a
  media-specific error instead of an unchanged automatic retry or video wording.
- Migration `20261017105341_social_publish_terminal_status_and_tiktok_retry.sql`
  is applied in production. Its invoker trigger atomically settles current
  owned targets when publishing jobs fail, clears `next_retry_at`, and rolls up
  partial failures while preserving publication receipts and cancellations.
  It repaired one stale TikTok target; the reported slideshow is now partially
  failed because its Instagram publication succeeded. No post was retried.
- An explicit retry with a new owned queued job can reset only an inactive,
  format-rejected TikTok operation. It cannot clear an active claim or success.
- Conversion, retry-budget and UI wording changes are local and require worker/
  website release. 86 worker regressions plus 9 database/status tests passed,
  and all five actual affected files converted in memory without uploading or
  publishing. Database correction is verified in production; a new successful
  TikTok publication has not been tested. Details:
  `docs/tiktok-slideshow-publishing-fix-2026-10-17.md`.

## 2026-10-17 Manual Explore current slideshow overview (local)

- Create → Your Slides reuses Edit slides' mounted current-sequence preview
  and text overlays, with Add slides, preview/reorder/removal and an Edit slides
  entry point. It no longer substitutes generation's empty-state placeholder
  for an existing edited draft. Create retains generation controls in its sidebar.
- Generated slides reveals the existing grouped versions/History separately.
  Starting/recovering a job and recreating one slide reveal generation progress;
  users can return to Your Slides while polling continues. Generated versions
  still require explicit selection and archive the previous edited sequence.
- Cross-workflow UI corrections must include checking manual Slideshow's
  equivalent views while retaining its distinct sequence and version model.
  Automatic Carousel generation/planners and persistence contracts are unchanged.
- Local evidence: 180 targeted tests, TypeScript, scoped lint and the real
  editor/Add slides browser fixture pass, including text/draft continuity,
  adding from Create, save/reload, pointer/touch reorder and mobile layout.
  This is not production acceptance and is not deployed.

## 2026-10-17 Trending planner positions and concise copy (local)

- The user approved useful, nonempty follow-up body copy below the previous
  18-word Helpful Tips / 14-word Product Story minimums. Both planners and their
  initial/full/targeted repair prompts now accept shorter complete thoughts,
  with a maximum of 30 body words. Cover hooks retain their 5-14 word contract.
  Optional content headings may wrap onto two measured lines, up to 10 words;
  measured overflow still requires repair rather than font shrinking.
- Helpful Tips batch output now uses `items.first` through `items.fifth`.
  Only the backend maps those keys to the five existing reserved briefs; model
  output cannot select `slotIndex` or `candidateIndex`. Each key has its assigned
  format schema. Missing/malformed items use isolated bounded repairs; valid
  siblings retain their assigned positions. Historical persisted plans and
  reservation/delivery contracts keep their existing shapes.
- Counted body transport permits one complete block and an optional second
  block, with at most 30 words combined. All paths retain actual font-fit,
  maximum lengths, factual checks, slide roles and CTA restrictions.
- Planner versions are Helpful Tips v58 and Product Story v26. Worker build and
  145 local regression tests passed, including both canvas ratios and partial
  batch settlement. Additional database tests and lint were unavailable because
  local PGlite / ESLint dependencies are missing. No deployment, paid generation
  or production retry was performed; hosted acceptance is pending. Details:
  `docs/trending-slideshow-planning-fix-2026-10-17.md`.

## 2026-10-16 Manual Explore one-box prompt rewrite (local)

- Latest user correction removes separate per-slide prompt forms. One sparkle
  button rewrites the text in the existing composer; the text remains editable,
  Undo restores the original, and generation is a separate action. The rewriter
  accepts only user text, with no image/reference/attachment metadata or profile.
- The prior per-slide compiler and optional attachment-label worker modification
  were removed. Existing image-generation APIs/workers, reference inputs,
  business context and automatic Trending allocation/mixer/queues are retained.
- Exact screenshot compositing remains unimplemented. A private prompt receipt
  migration, web deployment and feature enablement are required before production
  acceptance; no new worker version is needed for this feature. Local evidence:
  docs/slideshow-prompt-improvement-2026-10-16.md.

## 2026-10-16 Manual Explore assembly UI (local)

- Manual slideshow results now group one version's images and require explicit
  opening. Add slides offers generated images, chosen unchanged originals and
  uploads; a safe server import turns approved catalogue originals into owned
  ready media without generation. Existing text, drafts, v2 saving, legacy
  receipts and the ten-slide limit are retained. No automatic Trending planning,
  mixer, queue, worker, prompt/model or quality-policy change is included.
- Local build, 150 tests and desktop/mobile editor/recovery fixtures passed;
  deployment and authenticated production acceptance are pending. Details:
  `docs/slideshow-assembly-ui-2026-10-16.md`.

## 2026-10-16 Fresh Explore v3 acceptance and assembly gap

- The preservation policy was deployed in release `d73ef153`. A fresh v3
  Sunburst batch completed technically but still invented the requested laptop
  interface. Exact screenshot placement requires a separate compositor; it is
  not implemented by the deployed prompt policy.
- The user's manual Explore requirement includes grouped version previews and
  mixing selected regenerated slides with unchanged master-reference slides in
  original order. Current owned-media editor/import gaps and the 10-slide limit
  prevent that full flow; Marketing has 12 originals. This does not change
  automatic Trending Carousel allocation, planning, queues or rendering.
  Audit and unimplemented correction design:
  `docs/slideshow-fidelity-and-master-assembly-2026-10-16.md`.

## 2026-10-16 Explore slideshow reference preservation (local)

- Follow-up user clarification: new Explore slideshow prompts explicitly require
  close reproduction of the designated reference with only requested changes,
  without inspiration/mood-board reinterpretation. Screen replacement retains
  device geometry and surrounding scene. Exact UI compositing remains separate
  unimplemented work; this prompt policy alone is not a pixel-fidelity guarantee.
- Explore's image-generation reference contract v3 preserves the selected base
  slide's style/tone, limits business adaptation to relevant details and lets
  explicit user changes override those defaults. Attachments and per-output
  positions remain explicit; existing v2/legacy queued prompts stay unchanged.
- This is the manual Explore slideshow path, not automatic Carousel planning,
  sourcing, matching or rendering. Deploy the compatible image worker before
  web admission of v3. Prompt regressions are local evidence; actual generated
  output and production acceptance are pending. Details are in
  `docs/slideshow-reference-preservation-2026-10-16.md` and `EXPLORE_CONTEXT.md`.

## 2026-10-16 Restore one warm editing/finishing instance

- The user chose faster first-request latency after the idle-cost explanation.
  Carousel editing and Explore video finishing now retain one warm instance
  per service using service-level minimum 1. Their revision minimums stay 0,
  and unused historical tags remain removed. This supersedes the idle-zero
  choice recorded below; it restores two warm service instances, not eight.
- Request-based CPU/billing, current images, task URLs, per-instance concurrency,
  maxima, job handlers, timeouts, queue/retry settings and ownership safeguards
  are retained. Warm minimums incur the reduced idle rate. Carousel generation
  continues its separate 0-2 autoscaling policy.

## 2026-10-16 Edit and finishing idle-cost policy

- At the user's request, Carousel editing and the Explore finishing HTTP video
  service now use minimum zero at both service/revision levels, retaining
  request-based CPU and their existing per-instance concurrency, maximums,
  images, environment, timeouts, permissions, task URLs and job handlers.
  The first task after idle can take longer while an instance starts. This
  supersedes historical requirements to keep editing/finishing workers warm.
- Removed unused old tags from those two services after production environment
  URLs and queued-task targets were checked. A seven-day request-log sample
  contained no tagged operational jobs; one tagged video request was a version
  probe. Revisions are retained for rollback. Current idle-zero revisions are
  `ugc-carousel-edit-worker-r-cdf8c936-idle0` and
  `ugc-video-render-worker-r-cdf8c936-idle0`, each with 100% traffic.
- Before/after runtime configuration hashes match. Both queues remain running.
  Authenticated synthetic missing-job tasks reached the new revisions, were
  safely dropped, and returned HTTP 200. These verify delivery/startup/auth and
  DB access, not a complete customer render or an observed cold restart from
  zero. All 51 edit/render/finishing/routing regression tests passed.
- Zero minimum removes the paid warm-instance floor; actual instance removal
  is asynchronous. Storage and recurring scheduled executions remain billable
  separately. No schedules, customer data, saved edits, media, or heavy video
  Cloud Run Jobs were changed. See the idle-cost rollout report.

## 2026-10-16 Controlled request-based Carousel autoscaling

- Carousel generation retains request-based CPU/billing, HTTP task delivery,
  and one request per instance. Generation now scales from zero to two
  instances; both service/revision maximums and queue concurrency are two.
  The queue remains running at one dispatch per second. Interactive Carousel
  edits retain their separate warm service and single-job queue.
- Before rollout, production synthetic races proved one job from ten duplicate
  ownership calls, ten jobs for ten distinct batches with all 55 ideas correctly
  owned, and one worker claim from ten contenders. Image reservation races
  returned stable six-slide reservations for ten repeated calls and complete
  reservations for ten independent carousels. All synthetic rows and their
  usage-counter increments were removed; no provider requests or tasks ran.
- Revision `ugc-carousel-worker-r-cdf8c936-as2` preserves the current production
  image and serves 100% traffic. Unused old release tags were removed after
  confirming queued tasks use the untagged service URL, allowing old warm
  revisions to retire. Historical revisions remain available for rollback.
  Production observed two simultaneously processing jobs after the change.
- This supersedes historical single-worker and pending-scaling notes below.
  Do not increase above two without observing ownership, provider errors,
  queue age and cost. Roll back queue concurrency to one first if parallel
  processing exposes a conflict. Scale-to-zero is configured; idle behavior
  has not been observed while the current backlog remains active.

## 2026-10-16 TikTok promotional publishing preference (local)

- New slideshow/TikTok targets default own-brand promotional disclosure off.
  Settings → Preferences → Publishing defaults → TikTok defaults exposes
  **Label posts as promotional content**. New targets use the saved value;
  enabling AI disclosure never enables promotional disclosure.
- Existing target settings, published posts and queued schedules are preserved.
  This supersedes the old background own-brand-on default, without changing
  slideshow generation, rendering, content categories or paid-partnership flags.
- Release requires the web changes and
  `20261015190906_tiktok_promotional_content_preference.sql`. Local tests do not
  constitute authenticated production acceptance.

## 2026-10-15 Helpful-tip language acceptance

- At the user's request, planner v57 makes subjective Structure 1 checks
  advisory: nearby word reuse, dictionary-based solution tone, sentence-count
  and punctuation heuristics, generic phrasing, and exact source-keyword overlap.
  These signals remain in accepted plans' validation diagnostics. They cannot
  spend repair calls or reject an otherwise valid plan. This supersedes the
  earlier blanket blocking copy-quality/lexical-grounding policy below.
- Missing or invented source anchors, unsupported claims, promotional CTAs in
  Helpful tips, accidental adjacent duplicate words, actual duplicated slide
  copy, invalid slide roles/counts, image safety and measured text fit remain
  blocking. Verified anchor identity is enforced; lexical overlap is no longer
  presented as proof of semantic alignment. No additional provider calls or
  automatic retry budget are introduced.
- Synthetic regressions cover valid repeated prepositions across sentences,
  paraphrased concepts, useful imperatives mentioning a missing approval, short
  sentences, and all five advisory-only plans surviving a single batch request.
  Structure 2, mixer allocation, reviewed cards, and feed ownership are unchanged.
  This requires only a Carousel worker release; no database or frontend change.
- Production acceptance: worker `9eaedc66` recovered all five missing Helpful
  tips positions with six accessible images each; the feed is ready with no
  failed/planned slots. Four came from the initial retry and the last from
  bounded replacement. The original 45 reviewed assignments are unchanged.
  Some individual plans still fail hard checks, so partial preservation and
  recovery remain necessary. The historical pack remains 5/45, not 25/25.

## 2026-10-15 Helpful-tip delivery and queue recovery repair

- The active-source feed guard is applied in
  `20261015145119_defer_feed_recovery_for_active_carousel.sql`. It defers the
  stale-feed budget only when every remaining unbound position is a Carousel
  and an owner/profile/day-matching active refill has a queued or running job.
  It restores falsely failed unbound Carousel positions to planned without
  touching decided cards. Other formats and genuinely terminal sources retain
  the existing bounded failure handling. Production returned
  `waiting_source_job` and restored the five positions while retaining all 45
  decided cards. The database regression covers owner mismatch, superseded
  refills, terminal sources, mixed formats and service-only execution.
- Structure 1 initial batch plans and full-item repairs now use the counted
  two-block body transport already used by body-only repairs. Each block has
  9-12 words; validated plans still persist the existing body string. Grounding,
  copy quality, render fit, and the prohibition on promotional CTAs remain
  blocking. Structure 2 and saved mix allocation are unchanged.
- An independently valid Structure 1 plan survives a sibling's exhausted
  repair. The worker renders valid siblings, consumes their plan items, and
  marks only unfinished generations failed. Existing bounded, structure-aware
  refill recovers missing slots without replacing delivered or decided cards.
- Recovery checks whether a deterministic Cloud Task still exists before
  recovering an old queued job. A healthy backlog does not consume attempts or
  create duplicate deliveries. Lookup failures leave the job untouched. A
  missing-task recovery uses a service-only locked snapshot comparison, so a
  concurrent claim or recovery cannot be reset. Running-job leases retain their
  existing recovery behavior.
- Trending reports queued, generating, finalizing, or failed status from owned
  background jobs rather than treating placeholder generation rows as proof
  that a worker started. The response addition is optional and backward
  compatible; remaining-slot accounting is unchanged.
- Release `39288aea` applied the migration and queue-scoped read permission,
  deployed the Carousel worker and website, and retained all 45 decided cards.
  Production then exposed phrase-valued word arrays, despite correct array
  lengths. That release is not acceptance evidence for helpful-tip delivery.
- Planner v56 adds a simple no-whitespace constraint to each individual word,
  with explicit transport examples and specific teaching instructions in the
  system message. This is not the earlier whole-body word-count regex that
  stalled the decoder. A synthetic five-plan provider probe completed and all
  five bodies decoded; a focused repair passed the complete publishing checks.
  The existing grammar, grounding, factual, image safety and fit validators
  remain unchanged. This follow-up requires a worker deployment.
- The counted planner selects the existing body-only/list modes for follow-up
  slides instead of creating optional headings that duplicate the advice. It
  does not remove a heading from saved or historical content. One initial batch
  request and up to two isolated repairs per failed slot replace the previous
  two whole-batch passes. A second body-only repair freezes the newly validated
  fields; all-failed work retains the existing structure-aware terminal or
  automatic-rotation fallback rules. Successful siblings are retained.
- Mixed grounding/body failures can now request only concept, strategy angle,
  broad situations, or specific body/list fields. Every unrequested field is
  frozen; changed or extra fields are rejected and the merged plan passes the
  complete existing publishing checks. Generic-copy and disconnected-grounding
  errors include the exact rejected phrase or selected anchor terms, and
  repetition errors name the repeated word. A synthetic full-batch test
  retained one validated plan while four exhausted repairs; this proves
  partial preservation, not reliable completion of every requested item.
- Rollout order: additive migration
  `20261015135636_guard_missing_queued_job_recovery.sql`, queue-scoped
  `cloudtasks.tasks.get` permission for the application identity, worker, then
  website. Local regression checks pass; production delivery acceptance is
  pending until the new release processes the five missing slideshows.

## 2026-10-15 Explore Remix single-input controls (local)

- Shared Explore video/slideshow Remix uses one editable source text box for
  both copy and wording preferences. Separate Additional instructions and
  overview Options controls are removed. Unsent legacy guidance becomes visible
  in the combined field; accepted requests retain their exact payload and key.
- User-edited text is also forwarded through the existing instructions field;
  unchanged catalogue copy remains source data only. The instructions limit is
  now 6,000 characters, matching the existing source-box limit. Server-owned
  business context, output validation, reference identity, receipts and explicit
  review/apply are retained. No automatic generation or publishing is added.
- Reference-first video editors use a neutral Remix surface with fewer helper
  lines and a narrower text column. Trim and compact appearance controls move
  beside it. This change is local and not deployed; automatic Carousel sourcing,
  image generation, matching and rendering are unaffected.

## 2026-10-15 Explore focused slideshow editor (local)

- Edit slides uses a focused editing workspace without Create/Edit/Schedule
  tabs. Back to Create and Add slide return to Create, preserving the current
  sequence. The existing explicit save continues to gate scheduling.
- Desktop places the live slide preview and sequence beside a bounded text
  inspector. Smaller screens keep a compact preview and filmstrip visible above
  the tools. Remix and text appearance start expanded; color controls and the
  Save slideshow action are compact. Text and appearance update the existing
  SVG overlay immediately, without generation or an implicit Library save.
- The slideshow generation, ownership, ordering, save recovery, rendering and
  publishing contracts are unchanged. This frontend change is not deployed.
- Explore reference cards keep labelled Recreate/Selected actions below the
  media so they do not obscure source text. Shared Schedule actions remain
  visible in scrolling desktop forms; short/mobile windows use normal flow.
  Slideshow's return action reveals Create controls on mobile, matching its
  label instead of sending users to an empty image-results pane.

## 2026-10-14 Explore slideshow reference selection layout (local)

- A selected Explore slideshow uses a bounded square preview card with its title
  and slide count below. The card's remove control clears the complete reference;
  the expanded reference-image controls below select individual guiding slides.
- Upload slides remains a compact adjacent action after selection. Only the
  empty upload tile receives the shared reference-tile size rules, preventing
  compact laptop styles from expanding the selected action outside its panel.
- This changes Explore reference presentation only. Image generation, Library
  saves, automatic Carousel sourcing/rendering and publishing contracts are intact.
  It requires a website release; no production data was changed.

## 2026-10-14 Explore scheduling integrity and Talking Head session recovery (local)

- Direct scheduling of saved videos and Library slideshows commits the parent,
  platform targets and their existing publish jobs in one service-only
  transaction. Exact accepted replays reuse those IDs and recover incomplete
  scheduler handoff. Earlier targetless split-write records require explicit
  review/cancellation because their original targets cannot be invented safely.
- Apply `20261014141245_atomic_direct_schedule_creation.sql` before releasing
  the website. Missing atomic storage fails closed; the site does not fall back
  to split writes. The existing scheduled-time recovery/claim guards remain
  mandatory, and a queued publishing job cannot run before its target is due.
- Explore scheduling bounds authentication, request and response-body waits
  without retrying mutations automatically. Pending TikTok receipts compare
  canonical provider options, retaining strict account/time/option verification.
- Talking Head restores an owner-scoped browser session of owned source/demo/
  audio IDs, chosen generated result, current stage, finishing options and unsent
  schedule. Reload performs owned-media reads only. Missing/interrupted media
  requires recovery or replacement; it never selects another video implicitly.
- Save edits persists JSON clip drafts. Final preparation consumes the exact
  raw clips and saved composition independently of background capability.
  An absent demo uses one larger preview; adding a demo makes a two-clip sequence.
  Cropped demo overview uses the opening's output dimensions, and Schedule's
  video stage has a definite height so desktop containment cannot collapse it.
  Preview/export audio timing now agrees for trimmed custom opening/demo music.
- This is local implementation, not a production release. The migration was
  not applied and no live generation, scheduling or publishing was performed.
  See `docs/explore-safe-workflow-implementation-2026-10-14.md` for validation
  and the remaining authenticated production acceptance boundary.

## 2026-10-14 Explore Wall empty state and slideshow save recovery (local)

- Wall of Text's empty Edit controls explain that a video is required and offer
  the existing upload, Creative Assets and generation flows. Loading and failed
  restores also show a status instead of leaving the sidebar blank.
- Explore slideshow saves prepare at most two independent images concurrently,
  retain the exact chosen output order, reuse unchanged prepared images within
  the session, and report per-slide progress. Failed preparation waits for the
  other in-flight work before releasing its cross-tab save lock; it does not
  submit a partial Library sequence.
- Saved slideshow verification reads the exact owner-bound Library item by ID
  rather than searching the newest 60 items. Project, request provenance,
  sequence count and order checks remain required. The authenticated read is
  noncached and does not create, update or remove a Library item.
- An interrupted request retains its immutable key and rendered assets. If its
  recovered result differs from the current source/text fingerprint, the newer
  draft stays visibly unsaved and cannot enter Schedule as the recovered result.
  The next explicit save creates a separate revision for those newer edits.
- Slideshow account tiles say Instagram carousel; video account labels retain
  their existing Reels wording. Automatic Carousel generation, matching,
  readiness, schema and publishing behavior are unchanged.
- These changes are local. See
  `docs/wall-slideshow-fixes-2026-10-14.md` for validation and release limits.

Last updated: 2026-10-14

## 2026-10-14 Captioned Explore schedule receipt verification (local)

- Production scheduling errors at 14:57 IST are caused by a valid captioned
  finishing receipt losing its authoritative speech duration during parsing,
  then being reparsed by the scheduling verifier. The resulting NaN produced
  `VIDEO_DURATION_INVALID` and a generic 500 despite sufficient scheduling lead.
- The shared parser retains validated `speech_duration_ms` with its transcript.
  Malformed speech data fails closed through typed receipt errors. Drafts,
  fingerprints, owner/output matching and existing completed videos are intact.
  No database migration, media regeneration or Carousel rendering change is
  needed. The exact saved production receipt verifies under the local fix.
- Talking Head recovery ignores superseded hydration responses and replaces
  old time-rejection help with uncertainty guidance when a corrected request
  has a server/transport failure. Such retries preserve the exact request and
  identity, without automatic posting or duplicate schedule creation.
- See `docs/explore-captioned-video-scheduling-fix-2026-10-14.md`. These changes
  require a website release and authenticated production acceptance. This
  investigation creates no schedules and enables no recurring monitor.

## 2026-10-14 Shared schedule AM/PM clarity (local, not deployed)

- The shared Schedule editor now displays and selects explicit AM/PM while
  preserving 24-hour draft/API times. It distinguishes past selections,
  shows the current clock and earliest slot in the selected timezone, and
  revalidates elapsed lead at confirmation. This also applies when the
  generic editor schedules a saved Carousel or Explore Slideshow.
- Use next available time updates only the unsent date/time with an extra
  confirmation minute. Accepted and uncertain durable requests retain their
  existing recovery rules; the shortcut never submits a post automatically.
- The reported 02:49 at 14:40 IST was morning, whereas 2:49 PM is 14:49.
  Exact browser reproduction and recovery checks are recorded in
  `docs/explore-schedule-am-pm-fix-2026-10-14.md`. No worker, schema, rendering,
  Carousel sourcing or production publishing changes are required.

## 2026-10-14 Slideshow style mixer (local implementation, not deployed)

- The owner prefers a percentage mixer in Trending's Adjust dialog with the
  user-facing labels **Helpful tips** and **Product stories + CTA**, initially
  50% each. Internal Structure 1/2 names should not be exposed in the product.
  Helpful tips must teach useful information without product promotion.
- This is a mix within Slideshows; the existing slideshow-only format policy
  remains 100% Slideshows. Trending's Adjust dialog and API now save the
  account-scoped percentages. New daily packs snapshot the preference and
  allocate complete five-candidate batches; 20- and 50-slide packs resolve to
  10/10 and 25/25 at 50/50.
- Daily refill reserves style-specific candidates from that pack's inventory.
  Helpful tips use `account_preference` routing, so generic product-story
  takeover cannot silently replace them. Publishing validation rejects CTAs,
  the exact business name and common acquisition language. Existing packs keep
  their prior routing and assigned content.
- Apply `20261014141251_add_trending_slideshow_style_mixer.sql` before releasing
  the website. Local allocation, worker build, focused unit tests and PGlite
  migration/replay checks pass. No production migration or deployment occurred.
  See `docs/trending-slideshow-style-mixer-implementation-2026-10-14.md`.

## 2026-10-14 Structure 1 delivery audit and BOSS collage retirement

- The owner's acceptance definition for active Structure 1 is useful educational
  content actually delivered in Trending, without product promotion. An enabled
  rotation setting, requested batch or successful Structure 2 takeover does not
  establish that result. This is an explicit product requirement for the next
  copy implementation; this audit does not change planner or routing behavior.
- The supplied account's 14 October pack has 50 completed Structure 2 outputs
  and zero Structure 1 outputs. Five requested Structure 1 batches (25 ideas)
  all failed two planning attempts and switched to Structure 2. The account has
  zero completed/shown Structure 1 outputs in its saved history. All 50 current
  final slides promote UGCPilot in their body despite null `cta_text` fields.
  The current optional CTA policy does not enforce the clarified no-promotion
  requirement. See `docs/structure-1-production-delivery-audit-2026-10-14.md`.
- The exact screenshot text identifies Structure 2 generation
  `3857e2ad-e970-45a0-b99b-1a5b0a83e1b7`, slide 3, and background asset
  `64d03b1d-e596-4110-abb6-1afc584c3541`. Its BOSS affirmation collage was
  retired in production on 14 October: inactive/archived, explicit
  `user_requested_retirement`, historical-render preservation marker.
- The source hash
  `11287eed773aa99be929566759cf3d29bbc1635d1fc6912775557e81b9c0ca8f`
  and `productivity-human/Pinterest_2026-08-16 (76)/pinterest_019.jpg` are in
  the import/reconciliation denylist. Zero matching sources remain eligible.
  Both reservation replay guards are installed. All five historical decks
  retain their complete ready slides and original edit backgrounds; source
  bytes and stored historical copy are retained, not physically deleted.
- Twenty-two source-retirement/import/replay/history checks pass, and actual
  application status reads against production preserve all 29 expected slides.
  No paid generation, schedule, publication or generation-policy change was
  performed for this audit/removal.

## 2026-10-14 Trending content-plan partial-reservation reuse (production)

- The deployed idea allocator now treats `released_partial` as a terminal
  reservation eligible for reuse of its already consumed, successful ideas,
  alongside `completed` and `expired_partial`. Both the selection predicate
  and final item-update predicate are changed. Active reservations, original
  request replay, owner/profile/period checks, locking and usage history retain
  their existing behavior; the 30-day plan stays active.
- The 14 October pack requested 50 slideshows but only 43 ideas qualified:
  40 available and three reusable consumed ideas. Another 107 successful ideas
  were incorrectly excluded by their earlier `released_partial` reservations.
  Eight five-item reservations were released before dispatch; no writer jobs
  had been created. Three bounded recovery attempts left all 50 slots failed.
- Migration `20261014034706_reuse_released_partial_carousel_content_plan_items`
  is applied in production. It patches only the two expected predicates and
  refuses an unexpected allocator definition. Its source and permissions were
  compared to the inspected production function before/after application.
- Ten actual PostgreSQL regressions and 49 existing lifecycle/replenishment/
  writer-ownership checks pass. A production verification reserved 50 ideas
  in ten disjoint partitions with exact request replays, then rolled back all
  test writes and verified the original item/reservation/use snapshot.
- The failed pack was restarted through production Trending's Try again
  control. The subsequent delivery audit confirms all 50 candidate generations
  completed and today's feed contains all 50 assignments. All outputs resolved
  to Structure 2; this reservation fix does not establish Structure 1 health. See
  `docs/trending-partial-content-plan-reuse-fix-2026-10-14.md` for evidence.

## 2026-10-14 Hook Remix text overview and readiness (local, not deployed)

- The Hook Demo panel uses the heading **Remix text**. Its introductory helper
  and the explanatory paragraph beneath **Schedule video** are removed. Manual
  text entry and the editable source remain available; the duplicate inner
  Remix text label is removed.
- The overview action is explicitly **Generate remix**. Its status reports
  loading, preview, unavailable, missing context/text, ready, or a saved result
  instead of claiming Available while its button is disabled.
- The reference-text GET enables generation only when the website rollout flag,
  OpenAI credential and receipt-storage credentials are configured. Generation
  still resolves the signed-in account's saved business facts on the server,
  includes the current source copy and optional instructions, preserves immutable
  receipts, and requires review/application before changing the clip text.
- Read-only checks on 14 October confirmed the website project has production
  OpenAI and storage credentials configured, but no production
  `EXPLORE_TEXT_REMIX_ENABLED` variable. Add `EXPLORE_TEXT_REMIX_ENABLED=true`
  to the website's next approved deployment after confirming receipt storage
  and provider/model readiness. The MCP service is a separate deployment and
  reports its own provider unconfigured; its status must not be treated as the
  website's provider status. No configuration change or deployment was made.
- All 35 focused UI/API/source tests, the existing local remix browser suite,
  web TypeScript and scoped ESLint pass. Live website inspection confirms the
  earlier heading/helper copy is still deployed. No real provider generation
  was submitted, so production generation acceptance remains a release check.

## 2026-10-14 Demo library and Explore editing (local, not deployed)

- The former Content screen is named Demo in navigation, its heading/metadata,
  loading states and both editor return links. Explore and Trending demo pickers,
  upload/save messages and edit breadcrumbs use the same name. Existing
  `/library` URLs, API identities and storage contracts remain compatible.
- Hook video's Demo picker is labelled Demo and lists only owner-verified
  Content demo records with ready `demo_upload` media projections. Opening
  selection retains its existing Creative Assets picker. Removed, unfinished,
  foreign and ordinary generated/uploaded videos cannot enter the Demo picker.
- New Demo uploads use the existing Content upload/completion APIs and their
  1–60-second / 100 MB limits. A lost completion acknowledgement recovers the
  same owned projection; it must not delete an already saved Content demo.
  Existing restored Explore clips remain editable and schedulable.
- Apply demo edits retains the full versioned `explore_clip_drafts` record,
  including trim, text, original sound, added audio, crop/pan and music settings.
  The Demo screen discovers those owner-scoped `hook:demo` revisions against its demo
  records, shows saved edits and opens the same Explore editor for that demo.
  Edit original preserves access to the older Content editor and its exports.
  No lossy conversion into the older editor's trim/text-only draft is used.
- Demo entry links select the requested owned demo independently of another
  workflow's browser draft and restore its server-saved edits. A slow restore
  cannot overwrite edits already made in the current session. Reading or
  reopening saved edits does not submit a render or schedule a post.
- Demo draft saving and owned audio restoration work independently of rendering
  availability. Export and scheduling retain their existing capability checks.
- Final opening-plus-demo outputs continue through the existing scheduling
  renderer. This change does not register final posts as reusable demo footage,
  copy historical outputs, change a worker contract, or require a migration.
  Production acceptance remains pending deployment.
- Validation and release boundaries are recorded in
  `docs/demo-library-explore-fix-2026-10-14.md` (169 focused regressions, web
  TypeScript and scoped lint with no errors).

## 2026-10-13 Landing slideshow showcase (local; deployment held by user)

- The landing page's former three-format interactive daily-feed demo is now a
  passive slideshow example. It shows only slideshow images, advances every
  three seconds in a visible tab, and stays still for reduced-motion users.
- Approval copy, double-tap/scroll decisions, history, heart/skip buttons and
  Hook/Wall video previews are removed from this marketing section. The copy
  now describes creating a repeatable content format. Real Trending approval
  and scheduling behavior is unchanged by this presentation-only change.
- The nearby landing comparison copy distinguishes daily Trending slideshows
  from Hook and text-led videos created in Explore; it no longer promises all
  three formats in the daily feed.
- The separate hero retains its three-card layout; its left card uses the
  supplied `landing_page/middle.mp4` as versioned `left_side-v3` media with a
  matching first-frame poster. Center and right hero media are unchanged.
- These follow-up changes are local. The user explicitly requested no further
  deployment while other changes are being prepared.

## 2026-10-13 Trending slideshows only (local, not deployed)

- Trending now exposes only Slideshows. New daily packs and upgrade additions
  use a 100% Slideshow / 0% Hook / 0% Wall / 0% Reaction mix for every plan,
  overriding historical preferences at runtime without deleting or rewriting
  those preferences. Existing allowances and slideshow generation stay intact.
- Adjust remains available and shows only Slideshows at a fixed 100%. Video
  rows and controls are hidden. The first-visit guide previews only slideshows;
  cached feed items and fresh server results obey the same format policy.
- Existing daily snapshots, assignments, creatives and schedules are preserved.
  A runtime view hides video slots and excludes them from remaining/pending
  counts. An existing pack retains its original slideshow allocation until the
  next new pack; hidden video slots are neither replaced nor replenished.
- App generation entry points reject hidden formats before reservation or paid
  work. The worker settles already queued Trending Hook-copy, Wall-plan,
  Wall-copy and Reaction-generation jobs as `trending_format_disabled` before
  calling their handlers. Explore generation and saved publishing/render jobs
  retain their existing behavior. In-flight work is not remotely cancelled.
- All format implementations are retained behind the temporary product policy
  in `lib/trending/format-policy.ts` and its matching worker policy. Release the
  worker and website together for production effect; this entry does not claim
  deployment or authenticated production acceptance. No schema migration or
  destructive database operation is required.
- Focused policy/feed/API/worker checks, TypeScript, worker build, scoped lint
  and isolated desktop/mobile Adjust checks pass. See
  `docs/trending-slideshow-only-2026-10-13.md` for the existing-pack boundary,
  release requirements and the unrelated existing UI assertion failure.

## 2026-10-13 Explore recovery fixes and compact-layout restoration (local, not deployed)

- Ordinary Slideshow image and Hook/Wall video submission saves the exact input
  and owner/workflow request identity before dispatch. Lost acknowledgements
  recover scoped jobs, including terminal jobs. Partial batches keep a separate
  discovery identity; hydration/manual checks only read saved children and merge
  later results without replacing a newer selected output or submitting missing
  slots. Slideshow prompt/ratio browser metadata uses the same owner/workflow key.
- Terminal unconfirmed transcription can be left for another saved source or a
  subtitles-off edit while the original exact recovery record is preserved.
  Style-only changes against that old source do not create a paid transcription.
  Recovery history updates share the cross-tab lock; auth/GET waits are bounded.
- Workflow libraries keep account-scoped cached results visible with refresh and
  retry controls. Decorative covers load only near the viewport and pause when
  offscreen, hidden or reduced motion is selected.
- The user rejected the isolated single-page/nine-layout design study and chose
  the earlier compact two-panel design as the base: narrow controls on the left,
  stage navigation within that panel, and a dense media area on the right.
  Shared app colors, preview visibility and functional fixes are retained. This
  is a presentation restoration, not a Git rollback of scheduling or recovery.
- Desktop controls are bounded at 360–440px. Gallery cards fill adaptive tracks
  with a 200px minimum and 16px horizontal gaps. Their separate 44px Recreate
  actions overlay the media, retaining accessible names and the shared Button
  treatment. Overview Edit/Schedule keep controls left; expanded clip editing
  retains its larger preview and wide tools. Narrow layouts still switch panels.
- See `docs/explore-functional-fixes-review-2026-10-13.md` for checks, production
  release dependencies and remaining acceptance limits. No production generation,
  scheduling submission, push or deployment was performed by this task.

## 2026-10-13 Explore scheduling remains in the workflow panel (local, not deployed)

- Hook, Wall of Text, Slideshow and Talking Head + Demo place Back to Edit,
  Review schedule, progress, errors and saved-post links inside the scheduling
  settings card. The separate full-width scheduling action strip is removed.
- Review schedule opens the existing publishing controls inside that same
  right-hand panel. It keeps explicit Schedule post confirmation, provider
  options, account and time validation, exact-output checks, durable receipts
  and duplicate-prevention behavior. General Scheduling and other callers
  retain their existing modal presentation.
- Returning from inline review retains caption, date, time and timezone.
  The previous draft summary is hidden during review; confirmed values become
  the displayed summary. A changed finished output cannot inherit an open
  review for the previous output.
- A saved Slideshow library item is a valid scheduling source without a video
  clip selector. Its submit title no longer dereferences missing video media.
- Ordinary Explore workflow actions use the shared Button treatment, including
  Filter, Clear filters, Try again, slideshow preview Previous/Next and View
  plans. Navigation cards, stage tabs and media selection controls keep their
  appropriate link and selection semantics.
- See `docs/explore-inline-scheduling-update-2026-10-13.md` for local checks
  and limits. No deployment or production scheduling submission was performed.

## 2026-10-12 Explore workflow palette and frame consistency (local, not deployed)

- Hook, Wall of Text, Talking Head + Demo and Slideshow inherit AppShell's
  theme variables. Workflow-only dark palettes no longer override Explore's
  charcoal surfaces, borders and muted text. Shared button corner and focus
  treatment is retained, and selected scheduling platforms retain their tint.
- Create uses the available desktop width with small outer gutters, balanced
  controls/gallery columns and bottom-aligned action areas. Slideshow keeps its
  slide-specific Edit layout and the common Schedule review. Mobile keeps its
  existing single-column and Controls/Preview navigation.
- Talking Head's Create preview is visible by default. Hide/Show preview keeps
  the current instructions and selected clip; selected or generated media no
  longer overrides an explicit Hide preview choice. Edit and Schedule continue
  to show their relevant previews. Generation, image roles, rendering,
  ownership checks, saved posts and publishing contracts are unchanged.
- 143 focused checks, TypeScript and scoped lint pass. Local browser checks
  cover wide desktop and phone reflow. See
  `docs/workflow-theme-spacing-update-2026-10-12.md`. No deployment or paid
  generation was performed.

## 2026-10-12 Combined production release

- Source `4d7947a62b783a93f37d2bc3ceefdc0c1132b1e1` is deployed to the
  website, MCP, all six UGC worker services and both active worker jobs. The
  website and worker now share the slideshow V2 contract. Existing image
  retirement/allocation repairs and the lowercase/list-body validation fixes
  are included. The Inter alias is verified in every worker's startup log.
- Publishing defaults load from Settings in production. The Trending modal
  and Hook drawer use the saved defaults and a Change default settings link;
  account restrictions remain enforced. Explore's separate Schedule editor
  still retains its per-post controls. Existing schedules are unchanged.
- The experimental counted-body repair and reader-scenario voice policies
  remain unselected for customer jobs. Deployment does not establish improved
  AI copy quality or engagement. The evidence/lesson-first proposal remains
  unimplemented. See `docs/production-release-2026-10-12.md` for deployment
  receipts, acceptance coverage and limitations.

## 2026-10-12 Worker Inter font resolution

- Staging revealed that the bundled Inter variable TTF declares its family as
  `Inter Variable`; Linux Fontconfig otherwise resolved the renderer's `Inter`
  request to DejaVu Sans. The worker image now installs an explicit Inter alias
  and fails its build if Fontconfig cannot resolve the bundled family. The
  runtime availability diagnostic accepts the aliased family. Slide text,
  sizing, weight, line-fitting rules and saved historical renders are unchanged.

## 2026-10-12 Copy contract fixes and opt-in voice experiment

Release follow-up: the stable contract fixes below are included in the combined
production release. The optional policies are present in source but remain
disabled for customer jobs; their isolated results do not justify activation.

- Structure 1 now requests `body: null` for configured list slides and removes
  only an exact ordered duplicate of `listItems` from legacy bodies. Distinct
  advice remains validated. Lowercase acceptance is retained. Body-length
  diagnostics report actual field counts; current local planner is
  `llm-carousel-planner-v54-body-count-feedback`. Existing word, grounding,
  layout, grammar and complete-batch rules are not relaxed.
- The optional batch-only `structure-1-counted-body-repair-v1` policy repairs
  eligible body fields using two 9-12-word arrays in the existing repair call.
  Other fields are frozen and full publication validation remains. Customer
  jobs do not select it. Live testing returned no complete accepted batches;
  the one eligible counted repair met its count but failed the existing
  multiple-idea check. This policy has not earned default rollout.
- Structure 2 supports an opt-in `structure-2-reader-scenario-v1` copy policy
  for context without verified personal experience. All story text/headlines,
  including covers and repairs, use reader scenarios or impersonal wording.
  The six roles, product turn on slide 4 and CTA slot remain. Caller absence
  preserves the legacy v24 contract; selected policy records a v25 planner and
  policy metadata. No customer job selects it; versioned job integration,
  rollout and hosted acceptance remain future work.
- Fresh paired tests across UGCPilot, Cal AI, Calendly and MOO accepted 14/20
  legacy Structure 2 plans and 20/20 scenario plans. All 120 accepted scenario
  slides have no personal-narrator matches and pass measured layout in 1:1 and
  4:5 (240 inspections). Unsupported feature/outcome claims, grammar defects
  and generic lessons still occur. Acceptance is not a factual-quality or
  TikTok engagement score. The broader lesson/evidence proposal remains
  unimplemented.
- Three isolated trials requested 160 plans and made 136 live text calls. All
  Structure 1 arms returned 0/20 plans under complete-batch acceptance, including
  improved count guidance and counted repair. No images, production database,
  customer jobs, publication, push or deployment were involved. 78 focused
  worker and 16 application contract checks passed. Full evidence and limits:
  `docs/carousel-copy-fixes-2026-10-12.md`.

## 2026-10-12 Isolated copy-quality comparison (no runtime change)

- A fresh public-fixture test requested 120 plans across four businesses, both
  structures and three variants. Structure 2 returned 15/20 accepted plans with
  the current local writer, 20/20 with experimental sourced facts/scenario voice,
  and 9/20 when a separate lesson-planning call was added. A failed retail outline
  blocked ten requested plans before writing; these remain in the denominators.
- Structure 1 returned no complete tested batches in any variant despite the
  lowercase fix. Remaining list/body, layout and copy checks still block batches;
  one failed candidate can withhold valid siblings. No Structure 2 takeover was
  allowed in this isolated comparison.
- The facts/scenario candidate still produced first-person covers, unsupported
  conclusions and generic takeaways. The complete lesson-first proposal has not
  earned implementation. These are AI-agent editorial observations, not human
  preference scores or measured TikTok performance. Application source, customer
  jobs and deployments were unchanged by the experiment.
- Full results and limits: `docs/carousel-copy-comparison-audit-2026-10-12.md`.

## 2026-10-12 Structure 1 lowercase body validation (local, not deployed)

- Structure 1 accepts lowercase body openings as requested by the shared text
  presentation guidance. Capitalization alone no longer produces a grammar
  failure. Existing repeated-word, repeated-copy, agreement-pattern and
  punctuation-spacing checks remain, as do word counts, grounding and layout
  checks. Planner version is `llm-carousel-planner-v52-lowercase-body-validation`.
- Regression coverage exercises lowercase prose in all fifteen educational
  formats and confirms repeated words and incorrect punctuation spacing still
  block validation. The worker build and all 24 Structure 1 grammar checks pass.
  Offline replay of 72 saved live-provider drafts reduces grammar flags from
  232 to 65; other grammar checks can still flag lowercase copy with defects.
  This repairs one confirmed cause of failed Structure 1 batches; it does not
  establish that other live-test failures are resolved.
- Structure 2 quality improvements remain a proposal for discussion. No change
  to its story voice, evidence requirements, format rotation or runtime is made
  by this fix. The prior live test and its evidence remain the baseline.
- The user's intended distinction is Structure 1 useful teaching without a
  compulsory product introduction; Structure 2 an everyday scenario followed
  by a useful lesson and a natural, relevant product mechanism. Evidence-aware
  story voice and copy evaluation are discussed in
  `docs/carousel-structure-2-quality-proposal-2026-10-12.md`, not implemented.

## 2026-10-12 Explore Slideshow reference roles and composition (local, not deployed)

- Explore Slideshow now shares the focused workflow shell: Create, Edit and
  Schedule sit in the left side of the page header; app navigation is available
  through the menu. Schedule uses the common review cards and bottom action bar.
  Edit places the live slide preview on the left and a text inspector on the
  right, with the slide sequence and ordering actions below the preview. Text
  appearance and image replacement/recreation use expandable groups. Create
  uses a compact selected reference and an expandable reference-image selector.
  Stage changes reset the controls and preview scrolling while retaining drafts.
  Owned slide identities, saved Library slideshow, generation jobs and
  Instagram/TikTok image-post contracts are unchanged by these layout updates.

- New Slideshow generation jobs carry `slideshowReferenceContract.version: 2`.
  Selected gallery images guide style and composition; prompt attachments supply
  content or other guidance according to the user's instructions. Attachment
  numbering is explicit and independent of gallery numbering. The API derives
  roles from owned, canonical references and freezes them into every output job.
  One physical image may serve several roles without being sent twice.
- Recreate slide always sends its owned existing image as the main edit target,
  including requests without attachments or selected gallery images. Edits
  preserve that image except for requested changes. Replacing a slide retains
  its editable Remix Text, slide identity and neighboring slides.
- Default visual generation omits reference captions, headlines and text
  overlays. Remix Text remains separate. Explicit instructions to render text
  override this default, requesting readable placement, preferably central,
  with comfortable margins and no obstruction of the subject. This is provider
  guidance, not an automated guarantee of generated text accuracy.
- New Slideshows default to 4:5. GPT Image 2.5 requests the selected dimensions
  directly: 1024x1280 (4:5), 1024x1024 (1:1), 720x1280 (9:16) or 1280x720
  (16:9). Nano Banana receives the selected ratio. V2 output processing preserves
  the full returned composition; an unexpected provider ratio uses containment
  with white margins instead of cropping. Matching native dimensions add no margins.
- The complete composed prompt is checked against 32,000 characters before
  credit reservation and again before provider submission. Instructions are not
  truncated. Existing reference ownership, size limits, paid-request fencing and
  staged-output recovery remain in effect. No database migration is required.
- Jobs without the V2 contract keep their existing provider prompts, request
  fingerprints, image sizing and output processing. Deploy the updated worker
  before the website can enqueue V2 jobs. Drain V2 jobs before rolling the worker
  back; an older worker does not understand their roles or native sizing.
- Local verification: 171 focused checks pass; the isolated real-component
  browser regression, website TypeScript, scoped lint, worker build and website
  production build also pass. No paid generation or deployment was performed.
  Signed-in acceptance and visual instruction compliance on the deployed site
  remain release-time checks. See `docs/slideshow-generation-fix-2026-10-12.md`.

## 2026-10-11 Trending publishing defaults (local, not deployed)

- New Trending Carousel, Reaction, Text Reel and Hook schedules use the account's
  saved AI disclosure without a repeated checkbox. TikTok uses saved visibility
  and comments; YouTube uses saved visibility, made-for-kids and notifications.
  Initial defaults are TikTok Everyone/comments on, AI disclosure on, YouTube
  public, made-for-kids off and subscriber notifications off. Existing schedules
  and legacy missing-setting
  publisher fallbacks retain their previous behavior; no stored target is rewritten.
- Trending shows a small "Change default settings" link to Settings > Preferences
  instead of repeated visibility/comment questions. It opens separately to keep
  the current post; returning refreshes defaults without losing the caption.
  The additive migration
  `20261012135300_expanded_account_publishing_defaults.sql` extends the existing
  service-only preference table, preserving disclosure values and row isolation.
  Older AI-only PUT requests update only that field and preserve newer preferences.
  Apply this migration before releasing the updated website. It is local only.
- This Settings-only TikTok behavior follows the user's explicit local product
  request but differs from TikTok's published Direct Post UX requirements: manual
  per-post visibility with no preset and interactions off until manually enabled.
  It carries app-review risk and must not be described as provider-approved.
  Current creator capabilities, disabled interactions, audit limits and final
  consent remain enforced. Unsupported saved visibility blocks publication;
  it is never silently switched to another audience. Creator-disabled comments,
  Duet and Stitch are forced off without changing saved defaults. There is no supported
  age-restriction preference in this integration; restrictions and moderation
  remain managed on the destination platform, independently of made-for-kids.
- Trending blocks confirmation when account preferences are unavailable and
  offers a retry. Closing/reopening, retrying or switching accounts invalidates
  prior responses. Returning from Settings also refreshes the preference read.
  Instagram-only submissions remain independent of the preference service.
- This supersedes the repeated Trending AI controls and fallback-on-error
  behavior documented on 10 October. Explore and generic existing-schedule
  editing retain their per-post controls and stored settings. Carousel generation,
  slide sourcing, rendering, readiness, ownership and worker publication are unchanged.

## 2026-10-11 Delivery-aware image rotation and reviewed Hook choices

- Image rotation now ranks successful feed delivery per business profile instead
  of treating every reservation as exposure. Terminal failures can contribute
  images to a successor; existing reservations, completed slides and stored
  renders stay immutable. Outstanding current-version inventory is protected.
- When eligible alternatives exist, selection avoids images already allocated
  for the same feed date, including across a rotation-cycle boundary. Small
  pools allow bounded reuse between carousels while keeping each carousel's
  slides distinct. Profile-specific ordering diversifies initial selections.
  Delivery means a completed carousel linked to either supported feed; it is
  not a claim that a person viewed the image. Global equal usage and perceptual
  duplicate exclusion remain outside this guarantee.
- Explicit `source_metadata.reviewedRoleCategories` can make one canonical
  shared source eligible in an additional reviewed category without creating
  duplicate bytes or changing historical category/role identity. The exact
  Gym-hook source also supplied in productivity is approved for both categories;
  the six part-3 sources already classified as human remain human. Refreshes
  retain this explicit review metadata. Retired sources remain excluded.
- The authenticated Hook picker resolves the owned completed carousel's category
  and offers its active, reviewed hook images before the existing packaged
  choices. Save resolves each image ID and URL server-side and limits catalogue
  hooks to slide 1. Manual uploads remain available independently on every slide.
- Structure 2 takeover uses nonblocking profile/batch locks and covering foreign
  key indexes. The worker retries the same atomic RPC at most three times for
  lock contention, statement timeout, serialization failure or deadlock, with
  500ms and 1500ms waits. It does not rerun planning or rewrite existing output.
- Production database migrations are `20261011095743` and `20261011095929`.
  The website Hook-picker change and worker RPC retries remain local at the
  user's request; no GitHub branch, Vercel build or Cloud Run image was published.
  Rollback-only live probes selected 30 distinct images for five six-slide
  carousels, including five part-3 hooks, and successfully took over the previously
  timed-out five-item batch. Retry outputs matched. All generation, slide,
  usage and user-assignment checksums were unchanged after both probes.
  Fifty-six focused regression checks, both editor browser fixtures, main
  workspace TypeScript and worker builds pass. The isolated repair website
  build passes with Webpack; a local Turbopack run cannot follow the dependency
  junction outside its workspace root. Signed-in acceptance on the deployed
  website remains a deployment-time check.


## 2026-10-11 Productivity part-3 hook intake

- The user supplied `produtivity_hook_part3` as replacement source material for
  the depleted productivity first-slide hook pool. This is an additive intake
  alongside the remaining 21 active hooks, with no reactivation of part-2 assets.
- Review of 48 files found two exact duplicate pairs. The user approved omitting
  the unrelated painting and lower-resolution café duplicate. Six hashes already
  belong to active productivity human records; those existing roles and historical
  references are preserved. The resulting scoped intake contains 38 new unique
  productivity/hook backgrounds.
- The legacy full-tree classifier still excludes the misspelled folder. This
  batch uses an explicit reviewed additive manifest and source metadata rather
  than changing global duplicate arbitration or running destructive reconciliation.
  The retained source bytes, base and thumbnail use the current library contract;
  two reviewed crops align to the top to preserve the person's head.
- The batch enters automatic Carousel hook rotation through production data.
  It does not change the editor's separately packaged, static Hook library
  catalogue or the Hook-video workflow. Website/worker rendering and allocation
  rules are unchanged. See `docs/productivity-hook-part3-import-2026-10-11.md`
  for production completion and verification.
- Production intake completed: 38 new hook rows and 114 source/rendition
  objects verified. Active productivity pools are now 59 hook, 239 human and
  132 static. All 438 pre-existing source records retained their metadata,
  all 40 retired sources remain inactive, and all 417 checked completed
  carousels retain their previous application-visible slide counts.

## 2026-10-11 Productivity source retirement and allocation audit

- The user rejected all 39 images under
  `productivity_humanhookpart-2/human` and the specific
  `productivity-human/Pinterest_2026-08-16 (61)/pinterest_029.jpg`.
  Exact SHA-256 matching identifies 40 canonical production assets: 39 hook
  backgrounds and one human background. Eleven local copies outside the named
  paths share rejected hashes; the import denylist covers these copies too.
- These are Carousel still-image roles, not Hook-video footage. Runtime roles
  are hook, human and static; source batch folders do not create an Other role.
  The misspelled `produtivity_hook_part3` is unsupported by the standard importer.
- Safe removal uses inactive, archived source tombstones with
  `runtime_exclusion_reason=user_requested_retirement` and explicit
  `source_metadata.retirement.preserveHistoricalRenders=true`. Approved review
  metadata and source bytes are retained for existing completed rendered
  slides and owned edits. All fresh selection remains strictly active/ready;
  generic rejected or archived sources never receive this historical exception.
- Migration `20261011081756_guard_retired_carousel_reservation_replays.sql`
  fences both existing-reservation replay branches without deleting assigned
  usage, rotation state or source provenance. A failed generation whose source
  was retired must use a successor rather than replaying that retired source.
- Role-library preparation excludes retired paths and hashes. Import and
  reconciliation reject stale manifests, preserve historical tombstones and
  recheck locked rows before any destructive reconciliation. Originals needed
  by old slides are not physically deleted from storage.
- Production retirement completed after the website safeguard was READY:
  39 hook and one human source are inactive/archived, and the 40 specified
  local files were deleted with verified backups. Ordinary productivity pools
  now contain 21 hook, 239 human and 132 static images. All 417 affected
  completed carousels retain their previous application-visible slide counts;
  all 40 original background URLs remain available for existing owned edits.
- The live pre-removal audit found 60 hook, 240 human and 132 static assets;
  every eligible image appeared in completed output, and no profile reused an
  eligible role image while another was unseen. Fresh selection is newest-first,
  then per-profile/category/role shuffle cycles. Usage is reservation-based:
  failed generations consume rotation, and shown/saved/published image exposure
  is not tracked. Global equal usage and perceptual-duplicate exclusion are not
  current guarantees. See `docs/productivity-image-cleanup-2026-10-11.md` for
  rollout status and `docs/carousel-image-allocation-audit-2026-10-11.md` for evidence.

## 2026-10-11 Inter Medium slideshow typography (local implementation)

- The supplied typography brief supersedes the 84px Inter Tight Bold cover
  decision. Both Trending Carousel structures and the edit preview use one
  bundled Inter variable face: 72px Medium 500 hooks, maximum hook weight 600,
  centered single blocks, at most four lines, with 1.08 line height. A thin
  black outline supplies contrast over the existing backgrounds.
- Real headings remain black 50px SemiBold 600 on fitted white rounded pills.
  Body copy is white 48px Regular 400 under a heading, or Medium 500 for short
  statements without a heading. Authored thought blocks retain their 32px gap;
  no heading or supporting hook paragraph is invented. Body outlines remain.
  Existing 1080x1080 and 1080x1350 outputs, roles, copy grounding, image
  sourcing and measured overflow rejection stay in force.
- Renderer versions are Structure 1 v27 and Structure 2 v14; planner versions
  are v51 and v24. Intentional cover edits use the current 72px contract even
  when their source used an older renderer. Untouched saved slide bytes remain
  immutable; existing edit fingerprints include the renderer version.
- Browser previews and the worker image package the same Inter file. Worker
  font diagnostics now inspect Inter Medium instead of the retired Geist face.
  This typography change is local and is not yet active in production. Rollout
  needs the website plus both generation and edit workers. See
  `docs/carousel-inter-typography-2026-10-11.md` for validation and scope.

## 2026-10-11 Trending slide-upload latency repairs (local, not deployed)

- Pending Carousel edits poll the authenticated editor GET with `view=status`.
  Readable owned assignment access is still required, including visit history.
  The query returns only edit ID, revision, render state/error and timestamp;
  it does not rebuild default editor content or resolve images. A full history
  read follows completion (or discovery of a newer revision). Only a current
  full record with complete rendered slides can become ready for scheduling.
  Polls do not overlap; removal aborts pending requests and revision/timestamp
  checks reject stale responses, including pending responses after readiness.
  While already polling an update, a transient `draft` from another save is
  retried until job attachment or failure; it cannot stop pending polling.
- Save verifies replacement media IDs in one owner/deletion-scoped query,
  bounded to 20 distinct IDs. Ready/image/upload-purpose/MIME/dimension checks
  and existing original, Hook-library and app-screenshot resolution remain.
  The submitted expected revision is checked again immediately before the
  guarded write, so slow verification cannot overwrite a newer tab's save.
- Choosing a slide image immediately shows a temporary object-URL preview on
  the captured slide, labelled **Uploading image…**. Temporary previews are
  separate from editable/saved content. Save and dialog dismissal remain blocked
  until confirmation; failure restores the prior image. Slide switching does
  not retarget uploads; unmount ignores late completion and revokes previews.
- Worker progress checkpoints return only the job ID instead of full payloads.
  Claim-token/status predicates, heartbeat, cancellation/lost-claim fallback,
  checkpoint frequency and final revision/readiness fencing are retained.
- Incident profiling now also confirms five PostgREST connection-pool acquisition
  timeouts alongside database lock waits. Historical CPU/I/O and pool occupancy
  remain unavailable; no schema, pool-size or worker-capacity change is justified
  from this evidence alone. See `docs/trending-body-slide-upload-latency-2026-10-11.md`.

## 2026-10-10 Explore Remix Text (local implementation)

- Remix Text is a compact collapsed row after Trim in the Hook, Wall of Text and
  Demo clip editors, and alongside each owned slideshow output's text tools.
  Manual text tools remain the default. Opening the row automatically shows the
  chosen post's extracted caption and saved Business Context's name/readiness;
  there is no reference or source-slide picker. Only additional instructions are
  tucked into an optional disclosure. The original generation job supplies the
  source identity; owned-media reads opt in to an owner-scoped job lookup to
  restore it. Reordering slides never selects source text by display index.
  Uploaded or unlinked outputs use manual text. Unknown sources cannot generate.
  Receipts are scoped to account, output, reference and original slide; matching
  older receipts remain recoverable. Source/account changes ignore late replies.
  The editable generated draft replaces the form. **Use this text** applies it,
  collapses the row and restores manual controls. Demo request recovery uses its
  owned demo ID; applying copy retains the existing hook-format demo render
  contract in both video workflows. User changes may expand the draft within editor bounds; AI
  output still has the original similarity/length checks. Current styles,
  positions, audio and trim are preserved when copy is applied.
  The clip editor follows the visible video ratio: a narrow portrait preview in
  an 856px frame, or a landscape preview up to 480px wide in a 1040px frame,
  without cropping or distortion. The large nested preview card and repeated
  labels are removed. Remix has no sparkle icons; source copy is a readable,
  scrollable quote preserving line breaks. Workflow controls remain mounted
  behind their toggle at every editor width. Demo trim is a small disclosure,
  and a single reserved footer places Back and Apply beside each other on the
  right, or Back above Apply on mobile. No header Back button is duplicated.
- Video text presets include **Snapchat Classic**: regular Arial, white text,
  a full-width black strip at 58% opacity, 56px type at 1080px width and initial
  placement 7.5% from the top. Position, size, wrapping width, color, timing and
  opacity remain editable. Preview and PNG export share SVG layout; Sharp renders
  transparent caption PNGs and FFmpeg composites them in the same overlay order,
  including mixed presets. Legacy bold exports and draft fingerprints stay
  compatible. The worker image includes an emoji fallback font; glyph appearance
  still depends on installed fonts. No production image was rebuilt in this turn.
- Original visible text is stored in `lib/explore/reference-text-catalog.json`,
  linked to the exact catalogue reference ID, slide ID and source SHA-256. Local
  Windows OCR processed all 326 slides and 127 videos from 185 references,
  including the 16 references with paired audio. The completed local audit has
  441 reviewed text entries, 12 without eligible Remix Text and zero awaiting
  review. All source mappings/fingerprints match; all 19 prior reviews are unchanged.
  V2 re-extracted 434 unreviewed units at up to 4fps with real timestamps and final
  frames, retaining complete raw transcripts separately. All new sampled frames
  were visually inspected; changing-caption boundaries checked on native frames.
  The ten known priority cases are corrected. Timing still has frame/sampling
  limits; this is transcription review, not verification of source claims.
  Creator captions are eligible; app UI, screenshot text and incidental text are
  excluded. Infographic/poster slides are excluded entirely, including titles,
  instructions and added Study tips captions, under the user's latest decision.
  Five posters, six app-screen-only slides and one no-caption photograph have
  empty active blocks. Historical raw OCR is audit evidence only; reviewed and
  excluded entries are protected from re-extraction, even with force enabled.
  See `docs/explore-remix-text-accuracy-audit-2026-10-10.md`.
- Authenticated remix requests resolve original copy server-side and use only the
  current account's saved Business Context. The prompt keeps the hook, sequence,
  paragraphs and approximate length while requiring supported business facts.
  Similar structure does not promise equivalent reach. Uploaded references are
  outside this initial catalogue extraction path.
- Migration `20261012135237_explore_reference_text_remix.sql` adds private,
  service-role-only request receipts. An atomic per-account claim precedes each
  paid request, bounds requests to 20 per 24 hours and rejects changed payloads
  under an existing key. Completed replies return the frozen source snapshot.
  Pending/uncertain replies never submit the same paid request again. Browser
  recovery keys include account, format and output target; applying copy or an
  explicit new remix clears that request. Stale replies cannot change other slides
  or accounts.
- `EXPLORE_TEXT_REMIX_ENABLED=true` is required for generation. Migration, rollout
  flag and production acceptance are pending; no deployment or paid AI call was
  made. Automatic approval review rejected the optional external extraction pilot
  because the media destination and paid processing were not specifically
  approved. Local OCR completed without uploading media to an AI provider.
- Remix adds editable overlays to the existing rendering path. Text already
  baked into source pixels still requires a clean generated/uploaded background.
  See `docs/explore-remix-text-2026-10-10.md` for verification and review commands.
  The 11 October section/preset update and its checks are recorded in
  `docs/explore-remix-text-ui-2026-10-11.md`.

## 2026-10-10 Generation acceptance and actionable copy repair

- The `bb83ce3` production release includes the six-slide screenshot migration,
  v22 measured copy planner, independent reconciliation and dedicated edit queue.
  A subsequent real run completed nine six-slide Carousels, including nine final
  product screenshots. The previously exhausted October 10 feed now has seven
  ready and three decided Carousel slots, with no ownership/output mismatch.
- One candidate still failed because repair attempts repeatedly reused a blocked
  phrase without identifying it. The v23 worker repair names the exact rejected
  phrase and gives the same quality guidance to initial and repair requests.
  Fixed typography, word ranges, grounding and measured rendering remain gates.
- A second production response contained all five complete plans but omitted an
  outer closing brace and emitted whitespace until its token limit. The worker
  can append at most the two outer object terminators; exact batch keys and all
  existing candidate parsing/validation remain mandatory. It never reconstructs
  missing text or fields. `providerEnvelopeRepaired` records this syntax repair.
  Compact JSON and real scene descriptions are explicit model instructions.
- The v23 repair is released in `9e3a130`. Generation revision
  `ugc-carousel-worker-00110-lpb` is ready at 100% traffic; startup logs verify
  matching build/runtime commits and the v23 planner. The production website
  also serves that commit. See `docs/carousel-generation-repairs-2026-10-10.md`
  for acceptance evidence. Existing saved images are not rewritten.

## 2026-10-10 Explore slideshow multiple instruction references (local implementation)

- The instructions plus button accepts multiple JPG/PNG/WebP uploads and multiple
  owned saved images. It appends references rather than replacing the prior image.
  A compact overlapping card stack sits inside the writing box. Hover, keyboard
  focus or tap reveals only the image, bounded to 160px wide / 200px high, with no
  header, numbering, filename or side padding. Remove images through the plus
  picker. The textarea reserves space below the user's writing for the stack.
- Layout context retains its existing explicit selection: the active selected
  slide is first, followed by the other chosen slideshow slides. Instruction
  attachments follow in their selected order and are general image references
  interpreted according to the user's prompt. Six chosen layout slides and two
  attached images therefore become eight image inputs, not two replacement inputs.
  Each requested version generates one image using this complete context.
- Requests use owner-verified `referenceImageAssetIds`; a regeneration target is
  sent separately as `regenerationImageAssetId`, appended after the visible user
  references and given an explicit existing-slide role. New jobs freeze reference
  order, `additionalReferenceStartIndex` and optional `regenerationReferenceIndex`
  into the paid-operation fingerprint. Existing scalar requests, queued jobs and
  their fingerprints remain compatible. Empty scalar fields are omitted.
- The application retains its 14-image total bound (layouts, attachments and any
  regeneration target), 25 MB per image and 50 MB combined. Invalid, unavailable,
  foreign, oversized or excess attachments fail before billing or dispatch. The
  worker also bounds actual downloaded bytes before contacting an image provider.
  Successful uploads survive a later file failure; pending work and errors block
  generation. Account changes clear attachment cards and prior upload errors.
- GPT Image 2.5 already routes to `gpt-image-2.5-sunburst`; Nano Banana 2 also
  receives the complete ordered image list. No automatic business context is
  inserted into this manual Explore generation path.
- Local verification commands and limitations are recorded in
  `docs/explore-slideshow-references-2026-10-10.md`. These changes have not been
  deployed or exercised with a paid provider generation.

## 2026-10-11 Productivity source retirement and allocation audit

- The user rejected all 39 images under
  `productivity_humanhookpart-2/human` and the specific
  `productivity-human/Pinterest_2026-08-16 (61)/pinterest_029.jpg`.
  Exact SHA-256 matching identifies 40 canonical production assets: 39 hook
  backgrounds and one human background. Eleven local copies outside the named
  paths share rejected hashes; the import denylist covers these copies too.
- These are Carousel still-image roles, not Hook-video footage. Runtime roles
  are hook, human and static; source batch folders do not create an Other role.
  The misspelled `produtivity_hook_part3` is unsupported by the standard importer.
- Safe removal uses inactive, archived source tombstones with
  `runtime_exclusion_reason=user_requested_retirement` and explicit
  `source_metadata.retirement.preserveHistoricalRenders=true`. Approved review
  metadata and source bytes are retained for existing completed rendered
  slides and owned edits. All fresh selection remains strictly active/ready;
  generic rejected or archived sources never receive this historical exception.
- Migration `20261011075309_guard_retired_carousel_reservation_replays.sql`
  fences both existing-reservation replay branches without deleting assigned
  usage, rotation state or source provenance. A failed generation whose source
  was retired must use a successor rather than replaying that retired source.
- Role-library preparation excludes retired paths and hashes. Import and
  reconciliation reject stale manifests, preserve historical tombstones and
  recheck locked rows before any destructive reconciliation. Originals needed
  by old slides are not physically deleted from storage.
- The live pre-removal audit found 60 hook, 240 human and 132 static assets;
  every eligible image appeared in completed output, and no profile reused an
  eligible role image while another was unseen. Fresh selection is newest-first,
  then per-profile/category/role shuffle cycles. Usage is reservation-based:
  failed generations consume rotation, and shown/saved/published image exposure
  is not tracked. Global equal usage and perceptual-duplicate exclusion are not
  current guarantees. See `docs/productivity-image-cleanup-2026-10-11.md` for
  rollout status and `docs/carousel-image-allocation-audit-2026-10-11.md` for evidence.

## 2026-10-10 Generation acceptance and actionable copy repair

- The `bb83ce3` production release includes the six-slide screenshot migration,
  v22 measured copy planner, independent reconciliation and dedicated edit queue.
  A subsequent real run completed nine six-slide Carousels, including nine final
  product screenshots. The previously exhausted October 10 feed now has seven
  ready and three decided Carousel slots, with no ownership/output mismatch.
- One candidate still failed because repair attempts repeatedly reused a blocked
  phrase without identifying it. The v23 worker repair names the exact rejected
  phrase and gives the same quality guidance to initial and repair requests.
  Fixed typography, word ranges, grounding and measured rendering remain gates.
- A second production response contained all five complete plans but omitted an
  outer closing brace and emitted whitespace until its token limit. The worker
  can append at most the two outer object terminators; exact batch keys and all
  existing candidate parsing/validation remain mandatory. It never reconstructs
  missing text or fields. `providerEnvelopeRepaired` records this syntax repair.
  Compact JSON and real scene descriptions are explicit model instructions.
- The v23 repair is released in `9e3a130`. Generation revision
  `ugc-carousel-worker-00110-lpb` is ready at 100% traffic; startup logs verify
  matching build/runtime commits and the v23 planner. The production website
  also serves that commit. See `docs/carousel-generation-repairs-2026-10-10.md`
  for acceptance evidence. Existing saved images are not rewritten.

## 2026-10-10 Slideshow latency, screenshot persistence and history repairs (local implementation)

- Interactive slideshow renders now target `carousel-edit` / `ugc-carousel-edit`
  and a dedicated `ugc-carousel-edit-worker`. Terraform defines one warm
  instance, one concurrent request and a one-instance maximum. Full generation
  retains its serial queue and service. Provision the edit service/queue and set
  `GCP_CAROUSEL_EDIT_TASK_URL` before deploying this routing change; a generic
  generation URL is deliberately not a fallback for edits.
- A terminal `generate_carousel` request dispatches feed admission to
  `ugc-trending-reconciliation` instead of awaiting the app's slow reconciliation
  call. Tasks have a retry-stable source-job/terminal-revision identity and use
  verified scheduler OIDC. The app checks terminal job ownership, claims the
  durable database outbox and only acknowledges completed/absent work. Busy
  claims and temporary failures retry; the existing scheduled outbox recovery
  remains available if task creation fails. Existing signed callbacks remain
  compatible. Deploy the API before the dispatching generation worker.
- Migration `20261009202401_align_six_slide_product_screenshot_metadata.sql`
  widens only the live metadata check's product slot set from 4/5 to 4/5/6,
  preserving every other predicate and validating existing rows. This aligns
  persistence with the existing six-slide final screenshot reservation; it does
  not change crop/rendering or rewrite earlier slideshows.
- Read-only Carousel status access accepts owned `completed_skipped` assignments;
  mutations retain active/selected access. Cards prefer the latest edit revision
  and timestamp over their captured history snapshot. Refresh failures show
  `Checking update` and retry automatically, with a ten-second request bound.
  Wall text reads continue through their existing history preview accessor.
- Saves retain server-written prior Carousel output for per-slide reuse, while
  resetting readiness. Workers reuse a prior edited slide only when its complete
  input/renderer fingerprint matches. Changed copy, background, position or
  renderer invalidates reuse. Edit renderer revisions are Structure 1 v3 and
  Structure 2 v4; automatic generation keeps its current v13 renderer.
- Structure 2 v22 planner prompts and schemas explicitly distinguish the
  single-statement cover from body paragraphs and final takeaway word counts.
  Existing font sizes, publishing validation and bounded repair attempts remain.
  Before accepting initial or repaired copy, the planner now also checks actual
  renderer font metrics and the combined heading/body/CTA safe area in the square
  format. This catches overflow missed by estimated widths before image work.
  Failed dispatched reservations wait for an eligible successor instead of
  replaying the old reservation; jobless preparation recovery remains supported.
- Implementation tests, an isolated live text-only repair probe and rollout
  prerequisites are recorded in `docs/trending-slideshow-repairs-2026-10-10.md`.
  These new repairs have not yet been pushed, migrated or deployed; historical
  production findings below describe the inspected release.

## 2026-10-10 Deployment verification and follow-up production diagnosis

- The October 9/10 local Trending changes below were subsequently pushed and
  deployed in `3f352026e9ecefeba5877242738efdc65b3d86b1`. The production website
  later advanced to descendant `526f26a20ca50326220d87885c033393addafcaf`; worker
  source is unchanged between those commits. Carousel revision
  `ugc-carousel-worker-00107-qd5` serves the released image at 100%, with minimum
  and maximum instances 1 and concurrency 1. Historical pending/local rollout
  statements below describe their original implementation stage.
- Real Hook library edit records demonstrate an approximately four-second
  update when idle, and a separate 230-second queue wait behind full generation.
  Warm instances remove scale-from-zero delay, but edits and generation still
  share a single dispatch slot. Terminal generation requests can also retain
  that slot while awaiting reconciliation.
- The live Structure 2 metadata constraint still restricts product screenshots
  to slides 4/5, conflicting with the established six-slide final-slot contract.
  Recent screenshot generations render and then fail persistence. Existing
  slides generated before screenshot upload correctly retain their saved images
  during hook-only edits. The intended slide-6 product placement is unchanged;
  no repair migration has been applied during this read-only follow-up.
- Additional diagnosed defects are captured edit snapshots overriding newer
  ready history state, edit-status polling rejecting skipped Carousel
  assignments, unnecessary rerenders of unchanged previously edited body slides,
  exhausted copy repairs, and production reservation replay conflicts. Existing
  bounded recovery is already present live; exact conflict guard/request pairing
  still needs tracing. No new application or production repair was made.
- See `docs/trending-slideshow-production-root-causes-2026-10-10.md` for timing,
  persistence evidence, repair priorities and acceptance limits. Production
  generation is not fully healthy merely because the release deployed.

## 2026-10-10 Manual image uploads on every Trending slideshow slide (local implementation)

- Edit creative offers an independent image upload for the selected slide in
  both structures, including the hook and all body/final slides. JPG, PNG and
  WebP files up to 25 MB retain their original dimensions. Each slide can be
  restored to its generated background without resetting its text or other slides.
- Manual uploads use the existing owner-scoped signed media upload/completion
  flow with project purpose `trending-carousel-slide`. They are separate from
  the Settings app screenshot library and are not included in automatic image
  matching. The existing Hook library and eligible app screenshot pickers remain.
- The edit save service accepts ready owned images with that purpose on every
  slide, deriving URLs and a centre crop from server records. Client URLs, crop
  metadata and roles cannot override this validation. Automatic Structure 2
  product eligibility and the single app screenshot rule remain intact; manual
  backgrounds retain the source slide's role/layout. No database migration.
- Both preview and export fill the frame proportionally without stretching.
  Structure 2 manual backgrounds explicitly use centre cropping instead of the
  attention crop used for normal catalogue backgrounds. Its edit output is now
  `normalized-edit-v3`; automatic generation keeps its existing v13 renderer.
- Pending uploads block save/close and other image pickers. Users may switch
  slides and edit text; completion targets the captured slide ID with a functional
  state update. Failure preserves the previous background and displays recovery.
- Local validation covers all six uploads, asynchronous selection/text races,
  ownership/readiness and save normalization, original restoration, signed PUT
  and completion acknowledgement recovery, both worker structures and six
  manual-upload crop pixel checks. Shared editor parts are visually checked at
  1366 × 680 and 1536 × 776 in a browser-only fixture. This is not authenticated
  production acceptance. See `docs/trending-slide-image-uploads-2026-10-10.md`.
  No changes have been pushed or deployed for this feature.

## 2026-10-10 Trending history text and scroll settlement (local fixes)

- Saved Wall-of-Text overlays use a read-only assignment lookup that accepts
  `active`, `selected` and `completed_skipped`. It still verifies the exact
  assignment, creative and authenticated owner, plus the requested edit
  revision. Editor draft previews and save operations retain active/selected
  access. Browsing history does not select a card or replay its decision.
- The former overlay GET reused editing access, so a successfully persisted
  skip made its text preview return 404 when that card remounted in history.
  Preview access is now separate from editing access.
- Native `scrollend` at the resting position no longer clears a newly armed
  wheel gesture. Only the 160ms idle fallback expires a gesture that stays at
  rest. This fixes a reproduced event-order race in both browsing directions
  while preserving held-touch, drag, modal and duplicate-decision guards.
- The development fixture contains 20 posts. Four forward and four backward
  native wheel scrolls reach every earlier post at 1366 × 680 and 1536 × 776;
  a repeated history cycle preserves the four-review count. The browser layout
  check uses local DOM text, and separate route/database regression tests cover
  the shared-PNG preview access repair. No authenticated production flow was
  exercised. See `docs/trending-history-text-and-scroll-2026-10-10.md`.

## 2026-10-10 Slideshow edit responsiveness (local implementation)

- An image-only or position-only hook edit preserves the original 72px cover
  typography for known Structure 2 v11 and Structure 1 v25 sources when the
  saved headline/subtext are unchanged. The worker derives this eligibility
  from authoritative source rows; submitted metadata cannot enable it.
  Changed hook copy and current/unknown source renderers retain fixed 84px.
  The editor uses the same rule, and edit renderer output is versioned v2.
- Trending shows Updating for queued/rendering edits, Update failed with a
  persistent recovery message for failures, and Edited only for ready renders.
  Polling runs once per second without overlapping requests and rejects older
  revision/timestamp responses. Unchanged slide assets are still reused.
- Carousel worker configuration now prepares one warm instance, with the
  existing maximum of one and concurrency of one. This addresses the measured
  cold start at the expense of idle hosting charges once applied. Infrastructure
  and application rollout remain pending; no live minimum-instance setting has
  changed. Generation/edit backlog and render/upload time still remain possible.
- This preserves existing copy for the diagnosed image replacement failure;
  it does not add synchronous pre-save text-fit validation or silently shrink
  edited copy. Later render failures are displayed clearly. Evidence and rollout
  limits are recorded in `docs/trending-slideshow-hook-edit-latency-2026-10-09.md`.

## 2026-10-09 Full-frame app screenshots (local implementation)

- The owner confirmed that landscape app screenshots should zoom to fill a
  slideshow slide instead of appearing as a smaller image over a blurred
  duplicate. Structure 2 product slides now use a proportional centre crop
  for all uploaded ratios, including 16:9, 4:5 and 9:16. Excess edges may be
  cropped; images are never stretched. This supersedes the contained product
  screenshot composition in the August 23 editor-fidelity entry.
- The live editor uses the same full-frame centre crop, without the former
  padded screenshot, blurred backdrop or preview-only inset border. Uploads
  retain their original bytes and dimensions, and Settings continues showing
  the complete image in its library thumbnails.
- The Structure 2 renderer is `story-native-full-frame-product-inter-tight-v13`.
  Existing saved images remain immutable; new generation and changed-slide
  edit renders use this composition. Normal library background crops, text
  rules, output sizes, sourcing, ownership and scheduling remain unchanged.
- Six pixel checks cover all three source ratios in both 4:5 and square exports;
  each failed on the preceding layout and passes on the full-frame crop. All
  37 scoped rendering, edit reuse, sourcing and upload contract tests pass,
  along with web TypeScript, worker build and scoped lint. Rendered before/after
  evidence is recorded in `docs/app-screenshot-full-frame-2026-10-09.md`.
  This change is local; deployment and authenticated production acceptance
  remain pending.


## 2026-10-09 Explore slideshow ownership and reference guidance (local revision)

- The owner confirmed that catalogue slides guide layout, while a separate
  image attached through the Instructions plus button guides subject/style.
  Those roles reach both supported image providers in that order. Explicit
  instructions remain intact; business context is optional and is not silently
  injected into this manual workflow.
- Edit slides contains only the owner's generated or uploaded output images,
  with an independently ordered 2-10 image sequence. Selecting catalogue
  guidance does not insert it into the final post. This supersedes the October
  8 complete-reference-sequence behavior below. Regeneration replaces its
  selected owned slide; generating a new slide appends one output.
- The v2 save validates ready owned assets and preserves the existing atomic
  Library RPC and publishing contract. Interrupted saves retain the exact
  sequence and request identity; legacy v1 receipts remain recoverable.
  A newer owned draft takes precedence over an older completed legacy receipt.
  Automatic Trending Carousel architecture is unchanged.
- After the local A/B trial, the owner chose preview-side editing for Hook.
  Hook keeps Create / Demo / Schedule; each clip's preview opens its explicitly
  named editor. Returning from hook edits opened in Demo restores the two-clip
  preview. Hook and demo share the responsive editor frame and compact actions.
  A remains available in the development comparison fixture.
- One empty text box appears on opening a video editor. Additional blocks keep
  independent timing/style. Blank blocks are local draft state and are excluded
  from preview/export; legacy no-text receipts retain their original shape.
  Local checks cover playback, trim, text, separate hook/demo drafts, reload,
  preview/reopen and 320-1440px layouts. See
  `docs/explore-workflow-audit-2026-10-09.md` for findings and limitations.
  Deployment and authenticated production acceptance are pending.

## 2026-10-08 Explore format workflows (local implementation)

- Explore now separates Hook video, Wall of text, and Slideshows. The first two
  generate videos; Slideshows generates images. The former talking-hook and
  creator-phone entries and standalone audio page are hidden. AI character
  creation and existing Trending workflows retain their behavior.
- The studio follows the older workflow shell: compact Create / Edit / Schedule
  tabs within one left control card, one shared action footer, and right-side
  References / Your Video (or Your Slides). Submitting generation
  selects results immediately. Subsequent job updates do not change that view.
- Hook and Wall of text also accept uploaded or owned Creative Assets videos,
  including ready legacy creator footage. All sources use the same trim/text/
  audio editor. Uploads use the existing owned-media completion path; selected
  source IDs and edit drafts restore with owner checks. Video-only generation
  and image-only slideshow generation retain their original boundaries.
- Reference cards use a top-right Recreate icon with an accessible name and
  keyboard focus; selected references have an orange check, outline and caption.
  Preview stays a separate card action. One footer button shows the current
  model, duration, ratio and count, and opens generation settings in a popover.
  Step controls scroll above the same desktop action footer. Hook and Wall use
  a compact optional style-example row, a 72px instructions field, and separate
  image/video guidance tiles. Custom media overrides the gallery poster;
  one guidance attachment is active at a time, and generation waits for upload
  completion. Removing the style example also permits prompt-only generation.
  Short video guidance uses the existing Runway path, accepts at most three
  seconds, displays the actual source length and reserves three seconds of
  credits; image/text generation remains Google Omni. The legacy Recreate
  image requirement is retained outside these two new formats. Wall prompts
  reserve room within the worker's 1,000-character limit for the background-only
  instruction. Preview references stay local and generation is always locked.
  Mobile actions reveal their target. Settings
  close when leaving Generate/Create without interrupting background job polling.
- Explore covers now follow the older Recreate presentation: one example at a
  time fills the landscape card, with top/bottom cropping and a brief zoom
  between examples. Both Hook and Wall clips play in full; the slideshow cover
  includes both decks in numeric order. These are cover-only crops; reference
  images and editor framing are unchanged. Versioned v2 media retains all
  fourteen source hashes and preserves the previous covers.
- Quick start has six entries: AI Studio, Trending content, Library, Video
  generation, Image generation and Schedule a post. The two generation links
  open the existing AI Studio mode; scheduling opens the existing calendar.
- Explore slideshow edits preserve the complete reference sequence and its
  order. A generated image replaces one selected slide. Authenticated saves
  use an idempotent, service-only RPC and existing Library carousel publishing;
  they do not create synthetic automatic Carousel generation records.
- Migration `20261008001500_explore_format_workflows.sql` permits nullable
  automatic generation IDs for these Library slide rows and tags owned
  generated media from the matching background job. Automatic Carousel
  generation, image sourcing, rendering and readiness rules are unchanged.
- New saves require `EXPLORE_SLIDESHOW_SAVING_ENABLED`. Video trim, manual text
  and audio edits require `EXPLORE_FINISHING_ENABLED` plus
  `EXPLORE_FORMAT_EDITING_ENABLED` and the matching worker release. Neither
  editor offers subtitles. The preexisting production Explore visibility gate
  remains. Deployment and authenticated production acceptance are pending.
- See `docs/explore-format-workflows-2026-10-08.md` for scope, assets, validation
  and rollout dependencies.

## 2026-10-08 Trending requested 10% laptop reduction (local implementation)

- The owner explicitly requested a further 10–15% reduction for 14-inch laptops
  and 10% for 15.6-inch laptops. The implementation uses 10% for both, meeting
  both requests without inferring physical screen size from browser width.
  A shared desktop media factor of 0.9 applies after the preceding viewport
  constraints, including the previously protected short-window sizes. This
  supersedes the sizing in the preceding entry.
- At 1366 × 680 the portrait changes from 270 × 480 to 243 × 432; at
  1366 × 768 from about 286 × 509 to 258 × 458; at 1536 × 776 from about
  290 × 515 to 261 × 464. The effective desktop portrait cap is 288px and
  slideshow cap 342px. The loading frame receives the same factor. Media and
  saved text retain their proportions, and Skip/Schedule stay below the card
  with their original targets and captions. Mobile and interaction code are
  unchanged.
- All 39 local format/viewport checks and 66 interaction tests passed again.
  Browser scroll-back restored the selected third slideshow image without
  another decision. The current report and full-screen evidence are in the
  final section of `docs/trending-laptop-layout-2026-10-07.md`. Deployment and
  authenticated production acceptance remain pending.

## 2026-10-08 Trending final visual size review (local implementation)

- A repeated full-screen visual review found the short 14-inch HD portrait
  reasonably balanced, while taller HD and scaled FHD cards could lose a little
  more visual weight. Growth is now 87% of available media height instead of
  92%; portrait width caps at 320px instead of 340px, and slideshow width at
  380px instead of 400px. This supersedes the preceding sizing entry.
- Preferred 270px portrait and 360px slideshow widths remain protected when
  space permits. The 1366 × 680 portrait stays 270 × 480 with 13px sample Wall
  type. The 1366 × 768 portrait becomes 286 × 509, and 1536 × 776 becomes
  290 × 515, about 5.4% smaller than the preceding pass. Both actions remain
  below the card, visible without document scrolling. Source ratios and saved
  text proportions remain intact; no interaction or persistence code changed.
- All 39 desktop format/viewport checks passed again, as did 66 interaction
  tests. Browser forward/back navigation restored the saved slide selection
  without another review. Full-screen screenshots and current measurements are
  recorded in the final section of `docs/trending-laptop-layout-2026-10-07.md`.
  Deployment and authenticated production acceptance remain pending.

## 2026-10-08 Trending restrained laptop sizing (local implementation)

- The owner asked for a modest size reduction after the enlarged cards felt
  too heavy. Below-card Skip and Schedule remain the presentation contract.
  Desktop portrait cards now cap at 340px wide and 4:5 slideshow frames at
  400px. Growth uses 92% of available media height, with preferred width floors
  of 270px and 360px when the actual viewport permits; the complete card and
  both decisions still take precedence over those floors.
- At 1366 × 680, the portrait is about 270 × 480 instead of 280 × 497. At
  1536 × 776 it is about 307 × 545 instead of 333 × 592. The shorter 600px
  windows retain their height-constrained size to avoid another readability
  regression. Saved text scales with the complete media; mobile is unchanged.
- The existing compact header treatment is retained. Feed height caps follow
  the new media caps so below-card decisions stay close on taller windows.
  This supersedes the sizing measurements in the previous entry, while keeping
  its action placement, interaction handling, and persistence behavior.
- All 39 local format/viewport geometry checks and 66 interaction tests passed.
  Scroll-back restores the selected slide and history. The current full build
  is blocked by unrelated Explore imports (`./edit-overlay-render-spec.js` and
  `@/lib/supabase/env`), outside this CSS-only presentation change. Measurements
  and screenshots are recorded in `docs/trending-laptop-layout-2026-10-07.md`.
  Deployment and authenticated production acceptance remain pending.

## 2026-10-08 Trending below-card laptop actions (local implementation)

- The owner rejected the compact side-action presentation. Skip and Schedule
  stay together below the active card at every desktop size. This supersedes
  the side-button decision in the 2026-10-07 compact laptop entry below.
- Short desktop windows still prioritize the card over the introductory
  subtitle and visible remaining count. Reduced outer/header-to-feed spacing,
  28px feed padding, and an 8px format-label gap reclaim space above the card.
  The format pill stays attached to its post, complete media and saved text
  proportions are preserved, and both 56px-minimum actions retain captions.
- At 1366 × 680, the portrait starts near y=83 instead of y=136 and measures
  about 280 × 497, versus 230 × 409 in the earlier below-action layout. The
  card and both button captions fit without document scrolling. Progress
  remains in the feed label and live announcement. Taller desktop and mobile
  presentation, interaction handling, and persistence remain in place.
- Local browser, interaction, and lint validation is recorded in
  `docs/trending-laptop-layout-2026-10-07.md`. Next compiled the application, but
  the current full build's type check is blocked by video-generation types
  outside these layout files. Deployment and production acceptance are pending.

## 2026-10-07 Hero source-folder media restoration (local implementation)

- Supersedes the 2026-10-03 hero media replacement below. The homepage hero
  now uses `landing_page/heeo_Section/left_side.mp4` (Wall of Text),
  `middle.mp4` (Hook+Demo), and the six ordered `right_side/image_*.jpg`
  slideshow images. Public copies live under `/marketing/showcase/hero-restored`;
  the videos are losslessly prepared for fast start with matching posters.
- The slideshow restores automatic advance, arrows, and pagination inside the
  existing right card. Card sizes, tilt, hero crop, and straight section cutoff
  remain unchanged, as do all sections below the hero and the separate daily-feed
  demo. Mobile retains its center-only preview. No product Carousel pipeline or
  publishing behavior changes. Deployment and production acceptance are pending.

## 2026-10-07 Trending compact laptop card priority (local implementation)

- At desktop widths of at least 1024 CSS pixels and browser heights up to
  820 CSS pixels, the active Trending post takes priority over the introductory
  subtitle and visible remaining count. Those two secondary text elements are
  hidden while the feed label and live announcement retain progress information.
- Skip and Schedule move beside the post in a vertical pair, retaining their
  captions, keyboard hints, accessible names, and at least 56px targets. The
  feed column follows the media's height-limited width so the controls remain
  close to the card. Both buttons and the complete source content fit without
  document scrolling. This supersedes below-card control placement for short
  desktop windows only; taller desktop and mobile presentations keep their
  existing arrangement.
- Local checks at 1366 × 650 enlarged the 9:16 card from about 214 × 380 to
  296 × 526, with sample Wall type increasing from 10.3px to 14.3px. At
  1366 × 680 the card is about 313 × 556. The existing feed's next/previous
  transitions, saved slide selection, scheduling handlers, and source ratios
  are retained. Measurements and verification are in
  `docs/trending-laptop-layout-2026-10-07.md`; deployment and authenticated
  production acceptance remain pending.

## 2026-10-07 Trending available-height layout and scroll settlement (local implementation)

- Desktop Trending uses the actual remaining workspace height after its header,
  decision buttons, captions, and progress count. The post window measures that
  remaining space through CSS size containment; portrait and 4:5 media use its
  width and height, including the existing 52px label clearance. Reduced outer
  spacing enlarges laptop cards while keeping Skip and Schedule visible without
  page scrolling. Larger windows cap and center the complete review unit. This
  supersedes the fixed desktop viewport deductions and prior laptop width curves
  for the scrolling feed. Mobile presentation and complete-image containment
  remain in place; Wall overlays continue scaling with their saved media layout.
  The loading layer uses its available height too, preventing an invisible
  placeholder from extending the page behind the ready feed.
- The shared scrolling feed retains native scrollend and also schedules a
  debounce fallback in browsers that support it. A completed touch can therefore
  settle after a native event fired while the finger was still held. Wheel input
  also arms the fallback when reversal produces no new scroll event at a boundary.
  Held gestures, animations, disabled actions, and the existing commit lock guard
  settlement. Backward browsing still only changes visit-local history.
- These are local application changes. Authenticated production acceptance is
  pending: https://www.getugcpilot.com/dashboard redirected to sign-in in the
  available browser. No deployment or migration is included in this change.
  Local validation and measured viewport sizes are recorded in
  `docs/trending-laptop-layout-2026-10-07.md`.



## 2026-10-09 Social slideshow hook contract (local implementation)

- Slide 1 communicates one main idea as one curiosity-driven statement in one
  text block, normally 6-14 words over 2-4 lines. No subtitle, supporting
  paragraph, second sentence, motivational ad-copy explanation, or body-style
  cover copy. Explain the idea on Slide 2 onward. This supersedes the cover
  wording and 72px hook treatment in the September 30 text-presentation entry.
- Both existing structures use fixed 84px Inter Tight Bold 700 cover text,
  larger than the unchanged 50px content headings and 48px SemiBold bodies.
  Four measured lines remain the maximum; overflow requires shorter copy.
  The publisher accepts 5-14 words to retain compact hooks. First-person
  problem/changed-belief hooks are explicitly allowed. List promises must
  match the value actually delivered by the assigned six-slide format.
- Both generation validators block separate sentences/paragraphs with
  `hook_structure`. Semantic single newlines, common abbreviations, domains,
  and decimals remain valid. Curiosity and one-idea resonance are prompt
  guidance, not a keyword blacklist or a claim to predict performance.
  Structure 2's bounded targeted repair includes this issue and replaces only
  the rejected cover while freezing valid Slides 2-6.
- Initial, batch, complete-plan, targeted and native-cover repair writers
  receive the same hook guidance. Structure 1 is v50 and Structure 2 v21;
  renderers are `social-single-statement-hook-inter-tight-v26` and
  `story-native-single-statement-hook-inter-tight-v12`. The editor inherits
  the shared 84px constant. Existing saved render bytes remain immutable.
- Validation and preview evidence are recorded in
  `docs/slideshow-social-hook-2026-10-09.md`. Deployment and authenticated
  production acceptance on https://www.getugcpilot.com remain pending.

## 2026-10-09 Trending outer focus outline removal (local fix)

- Removed the orange focus ring around the scrolling post viewport. The ring
  came from its `focus-visible:ring-focus` styling when keyboard navigation or
  programmatic focus activated the feed. The viewport remains focusable with
  the same scrolling and double-tap handlers; individual button focus indicators
  retain their existing styling. Card size and below-card spacing are unchanged.
- Local 1366 × 680 and 1536 × 776 checks show no outline or box shadow while
  the viewport matches `:focus-visible`. All 66 Trending interaction tests and
  scoped lint passed. This presentation change has not been deployed.

## 2026-10-09 Trending scheduling after revisiting a post (local fix)

- Visit-local `liked` history means the user opened the composer/scheduler; it
  does not establish that a schedule was saved. Double-tap and Schedule may
  reopen that post after cancellation or failure. Reopening reuses the exact
  assignment and does not append history, replay the outbox, reconsider an
  already accepted decision, or decrement the remaining content count.
- Explicit Wall-of-Text schedule confirmation resolves the assignment and
  creative under the authenticated owner, then persists acceptance before
  loading the selected draft. If an original skip won the outbox race, only
  this explicit action uses the existing reconsideration RPC. Ordinary outbox
  decisions keep their conflict checks; a delayed skip cannot undo recovery.
- Schedule creation still precedes server-side render delivery. Selection
  does not save content to Creative Assets, generate a replacement, allocate
  another daily slot, or charge another generation. Card dimensions and
  below-card controls are unchanged by this repair.
- Production logs contained a Wall schedule 404. The active deployment was
  `bd352b7e52ce87f1e046dca8ad2ce6788280d545`; its revisit endpoint and database
  RPC were present. A rollback-only production diagnostic verified the
  skipped-to-selected transition without persisting any changes. Regression
  tests reproduced the disabled liked-history action and selected-draft race
  before the fix. See `docs/trending-revisited-scheduling-2026-10-09.md` for
  local validation and release status. This new repair is not deployed yet.

## 2026-10-08 Trending closer below-card controls (production release)

- Skip and Schedule now sit about 12px below the current card on desktop.
  The preceding 10% card reduction remains intact. Previously, unused space
  below the centered post increased the visible gap to about 44px at
  1366 × 680 and 75px at 1536 × 776.
- A presentation-only ResizeObserver measures the post and snap-window
  heights, then lifts the existing decision row and visible progress together
  into that unused space. Their layout space stays reserved, preserving media
  dimensions and scroll-snap geometry. The calculation ignores scroll position;
  history browsing and gestures do not move the controls. Mobile is unchanged.
- All 39 local format/viewport checks confirm unchanged card dimensions,
  roughly 12px gaps, visible captions, clickable targets and no page overflow.
  Forward/back browser checks retain selected slides without duplicate reviews.
  TypeScript, scoped lint and 66 interaction tests passed. Screenshots and
  measurements are in the report's final section. The isolated production
  release `591da964e3afb32a40b19a638a9f85fe2912d5da` was built successfully and
  promoted to getugcpilot.com as `dpl_9vnrJiJYmruBizdZeCTzkoEUDQeF`. Live
  JavaScript and CSS contain the spacing implementation; all 24 dashboard
  assets respond successfully. The immediate deployment error scan is clear.
- The owner's subsequent large-gap screenshot was confirmed to come from the
  live site before this release. The development fixture
  now also covers the real Reel Hook renderer with local edited media. All 13
  additional Hook viewport checks retain the 12px gap and current card sizes.
  The owner could not sign in through the verification browser and requested
  local visual checks. Fresh 1366 × 680 and 1536 × 776 checks confirm 12.2px
  gaps, visible captions and no page overflow using the exact release files.
  Authenticated production visual acceptance remains unperformed. The scoped
  release is documented in `docs/trending-controls-production-release-2026-10-08.md`.
  Direct push to main is awaiting explicit approval after automatic review
  rejected it; production deployment has completed independently.

## 2026-10-07 complete release reconciliation

- The retired Create Content frontend, exclusive API routes and their support
  files are removed. Its worker handlers and shared job types remain compatible
  with queued and historical jobs. Carousel sourcing, matching, readiness,
  review, rendering and production recovery behavior remain as on current main.
- Explore Hook and Phone now accept an owned uploaded or Creative Assets video
  as their opening segment. Source selection feeds the existing finishing and
  scheduling path; live generation and demo framing remain available. App and
  shared worker deployments must use the same release revision.

## 2026-10-05 Trending manual Wall copy formatting (local implementation)

- Wall manual edits preserve explicit line breaks and paragraph gaps in the
  textarea, browser preview, optional shared PNG preview, saved revision, and
  worker export. Each authored line wraps greedily only when its measured width
  exceeds the safe text width; short entries never merge or rebalance together.
- Manual V13/V9 layouts carry `textMode: manual` and explicit `gapAfterPx`
  per text block. Their box may grow vertically around its center inside the
  existing publishing safe area, with vertical raster padding. Font size remains
  fixed. Browser manual text scales proportionally so preview and export wrap
  at the same width. Existing generated-card typography remains unchanged.
  Changing only color or position retains the saved rows and typography through
  the shared edit-layout helper used by save and shared PNG preview.
- Manual edits require nonempty text, at most 600 characters, matching measured
  content, safe placement, and render fit. They allow lists, short phrases, and
  omitted terminal punctuation. Automated generation retains its word range,
  balanced 5–8-line contract, sentence ending, and promotional/CTA rules.
- Wall Edit also exposes left/right width handles and a percentage slider.
  Manual width ranges from 40% to 94% of the video with at least 3% padding
  at each horizontal edge. Side drags anchor the opposite edge; the slider
  expands around the center and stays within the margins. Movement and width
  controls support keyboard input. The existing vertical safe area still applies.
  Width edits invalidate measured rows and reflow each authored line at the same
  fixed font size through preview, saved edit JSON, and worker raster export.
  Pending copy/width edits use immediate browser wrapping even when the shared
  PNG feature is enabled; measured saved content can use the shared PNG.
- This requires releasing the app and supporting render worker together.
  No database schema change is required: manual content stays in owner-scoped
  creative edit JSON. Production acceptance remains pending deployment and
  authenticated checking on https://www.getugcpilot.com. Local validation and
  evidence are recorded in `docs/wall-text-manual-edit-formatting-2026-10-05.md`.

## 2026-10-03 Scheduled publication time and account region audit

- Production traces confirmed that generic background-job recovery redispatched
  future `publish_social_post` jobs after the 15-minute stale threshold. The
  stored IANA time zone and UTC conversion were correct; the publisher lacked a
  final not-before check. All 48 early publications found on the reported
  account had a `job_recovered` event before publication.
- Production migrations `20261003121102_prevent_early_social_publishing` and
  `20261003122024_account_timezone_preferences` are applied. Recovery selection,
  locked recovery, and atomic worker claims now require the owner-scoped,
  current target to be due. Recovery also honors `next_attempt_at`. Cancelled
  and published targets remain eligible for idempotent cleanup; superseded or
  orphaned jobs cannot publish. Due jobs and ordinary generation recovery retain
  their behavior. Production transaction tests passed and rolled back all fixtures.
- The local worker adds a `DeferredJobError` before claiming a provider operation
  if the target is still in the future. Waiting cannot contact a social provider,
  fail the target, or consume a provider retry. Database enforcement already
  protects the running worker; this extra worker guard awaits deployment.
- Account publication defaults initialize once from the browser's IANA region
  at the first verified sign-in. Existing onboarding zones are backfilled.
  Later devices or visits do not replace the saved account region. The service
  stores preferences behind the verified Firebase identity; browser roles have
  no direct table/function access. `Asia/Calcutta` is a supported alias for India,
  not a shared hardcoded account default. UTC is only the detection fallback.
- Local Scheduling, inline Carousel, Hook, Reaction, and Wall drawers use the
  account default. Video drawers now expose the same time-zone choice; all
  selectors offer supported IANA regions. Existing schedules keep their stored
  zone, and manual time edits pin the displayed zone so an async preference read
  cannot reinterpret them. Initial slots and date minimums use zoned parts.
- App and additional worker changes remain local, with authenticated deployed
  browser acceptance pending. The production Scheduling URL was checked and
  redirected to sign-in in the available browser. Full evidence and validation
  are in `docs/scheduling-timezone-audit-2026-10-03.md`.

## 2026-10-03 Create Content screen removal (local implementation)

- Create Content is retired from both desktop and mobile navigation. Its page,
  loading state, development preview, copy/card/render API routes, and exclusive
  application helpers are deleted. The internal render canary is also removed,
  so the application no longer produces new Create Content jobs.
- Existing Library media, schedules, database tables, and historical migrations
  remain intact. The worker retains the legacy render job handler and queue/lease
  contracts so already queued jobs can finish and existing rendered videos can
  still be scheduled. This compatibility code does not expose a creation screen.
- Trending, its Carousel editor and scheduler, Library, and other creation tools
  retain their existing routes and access rules. Explore retains its development
  visibility gate.
- Local verification passes TypeScript, scoped lint, expanded/collapsed navigation
  in development and production, and 199 focused regression checks covering feed
  decisions, scheduling, queue contracts, and legacy render completion/retries.
  The retired page, preview, nested URLs, and GET/POST APIs return 404 in the
  browser. Deployment and authenticated production acceptance are pending.

## 2026-10-03 Backward post browsing (local implementation)

- Trending, `/try-ugcpilot`, and the homepage daily-feed preview retain up to
  120 reviewed post snapshots during the current visit. Scroll backward, drag
  downward, or press Up/PageUp to revisit; move forward to return to new posts.
  Previous and next media share the same native snap window and mouse release
  easing. Only the active post exposes controls or plays video/audio. Resizing
  cancels an unfinished gesture and restores the active post.
- Revisited posts remain available for video, audio, and slideshow viewing.
  In the demo and homepage, their heart and edit actions are disabled. Trending
  now permits explicitly selecting a skipped post as described below; already
  liked posts retain their decision restriction. The 2026-10-19 correction
  permits reopening existing owned Carousel edits from history; other formats
  retain the history-edit restriction. Browsing by itself never
  repeats a decision, changes daily review counts, or starts a schedule.
- Trending keeps this history above the Hook composer so it survives the deck's
  temporary replacement, including the saved creative edit snapshot. Existing
  owner/day session keys scope the retained history. The final empty state offers
  **View previous posts** in Trending and Try UGCPilot, including while a demo
  refill is pending. Browsing preserves live counts and the existing deferred
  demo-session persistence during refills. A demo reset or successful
  website analysis clears its history. History is not restored after a reload.
- Focused decision hand-off tests and real-browser checks cover backward wheel,
  keyboard, mouse/touch release, unchanged counts, exact media/copy, media controls,
  final-post/refill return, retained parent history, resizing, inactive playback,
  and reduced motion. Existing Carousel
  readiness, save-before-dismiss, outbox, composition, and scheduling contracts
  are retained. Deployment and authenticated production acceptance remain pending.

## 2026-10-05 First-post guidance heart (local implementation)

- Trending and the public demo retain the same shared first-post guide. Its
  heart is now a larger, solid white silhouette with a soft warm shadow, matching
  the white like feedback. Two small scale beats and two staggered ripple rings
  demonstrate double-tapping, followed by a quiet interval for reading.
- The decorative icon ignores pointer events through the existing guide and
  stays hidden from assistive technology. Reduced motion keeps a still heart
  and removes the rings. Guide eligibility, first-tap acknowledgement, completion
  persistence, daily decisions, and scheduling are unchanged. This is a local
  visual change; production deployment remains pending.

## 2026-10-05 Trending skipped-post selection and laptop sizing (local implementation)

- The redundant visible “Previously skipped · Scroll to browse” and general
  scrolling instruction line are removed from Trending. Screen-reader status and
  the remaining-post count are retained. Up/PageUp also revisit history when
  focus is outside the scrolling card, subject to the existing modal/input guards.
- Selecting a skipped post calls the authenticated `/api/trending/feed/reconsider`
  endpoint before opening the existing composer or scheduler. Its service-only
  RPC locks the exact owner/format/assignment/creative scope and changes a recorded
  rejection to acceptance, preserving the decision ID and original review time.
  A `reconsidered_at` marker makes a delayed original skip harmless; ordinary
  conflicting decisions continue to fail closed. A skip still in the outbox is
  persisted atomically first. This consumes no extra daily slot or generation
  credits. The browser clears the superseded queued skip after success.
- Carousel recovery still saves the same content to Library before opening
  scheduling. A failed selection or save leaves the card retryable. Successful
  recovery marks the existing history snapshot liked without appending history,
  replaying the ordinary decision outbox, or decrementing remaining counts again.
  Hook recovery retains its saved edit snapshot through a deck remount.
- Portrait previews gain 16px of height and slideshow previews gain about 12px
  of width at normal laptop sizes. Cards scale with the usable CSS viewport;
  compact action sizing is scoped to Trending. Short windows preserve both
  decision controls and the remaining count without page scrolling.
- Migration `20261005064026_trending_skipped_post_reconsideration.sql` is prepared
  and verified against local Postgres. It must accompany the application release;
  production migration, deployment and authenticated acceptance are pending.

## 2026-10-09 TikTok disclosure controls hidden (local implementation)

- The owner clarified that Your brand, paid partnership, commercial disclosure,
  and Music Usage Confirmation should run in the background rather than appear
  as editable controls. They are removed from the shared Trending Carousel/Text/
  Reaction modal, Explore/Scheduling editor, and Hook drawer. New-target defaults
  stay Your brand on, music confirmed, and paid partnership off. Saved brand and
  partnership choices remain intact.
- Each form shows a short agreement at its final scheduling action. That action
  confirms music in the submitted TikTok payload without mutating the saved draft;
  older false/missing music values no longer block a form with no visible checkbox.
  Hook's extra confirmation popup is removed. The agreement includes the Branded
  Content Policy for selected saved paid-partnership targets.
- Audience, available interaction and AI controls, account errors, creator
  capabilities, backend normalization, Carousel formats, readiness, ownership,
  and rendering rules remain enforced. Other-platform and dormant legacy target
  settings are preserved. Server normalization still rejects missing/false music
  confirmation in direct API requests.
- This supersedes the visible-checkbox and fallback-popup choices below. It is
  the owner's product decision, not a claim that approval waives TikTok's UX
  guidelines. Local verification: 65 focused tests, full TypeScript, and scoped
  ESLint passed. Deployment and authenticated production acceptance remain
  pending. See `docs/tiktok-ui-visibility.md`.

## 2026-10-09 TikTok publishing checkboxes default on (local implementation)

- The owner requested Your brand and Music Usage Confirmation checked for every
  new TikTok target. Your brand and commercial disclosure already default on;
  the shared music default is now on as well. Paid partnership remains off.
  Explore, Scheduling, and Trending's Hook, Text, Reaction, and Carousel flows
  share these defaults; saved post settings and explicit unchecked choices
  remain authoritative when creator capabilities refresh.
- Trending Hook skips the extra music popup when the selected TikTok settings
  already confirm music usage. The agreement is visible above the final Confirm
  schedule button. A target without confirmation still requires explicit consent;
  server normalization continues to reject false or missing confirmation.
- This supersedes the unchecked music default below. It is the owner's product
  choice, not a claim that API approval waives TikTok's UX guidelines. No changes
  are made to account gates, creator capabilities, Carousel formats, readiness,
  renderers, provider scopes, publishing workers, or existing saved schedules.
  Deployment and authenticated production acceptance remain pending.

## 2026-10-09 TikTok UI restored after approval (local implementation)

- The owner confirmed TikTok approval and the required permissions/scopes.
  `socialPlatformVisibility.tiktok` is enabled, superseding the temporary hiding
  below. The shared Trending Carousel scheduler again shows TikTok accounts,
  connection actions, and publishing controls to verified users. Landing,
  Explore, Scheduling, Settings, Connected accounts, and Analytics use the same
  visibility switch.
- Carousel format compatibility and existing publishing consent, creator
  capabilities, ownership, readiness, rendering, and media validation remain
  enforced. YouTube remains video-only. Saved TikTok targets and settings are
  preserved and visible again; no migration or provider scope change is needed.
- This is local implementation. Deployment and authenticated production
  acceptance on https://www.getugcpilot.com remain pending. See
  `docs/tiktok-ui-visibility.md` for coverage and verification.

## 2026-10-03 Temporary TikTok UI visibility (local implementation)

- TikTok is temporarily hidden through `lib/social/platform-visibility.ts`
  while content-posting API access is pending. The shared Trending Carousel
  account modal uses this presentation gate, so Instagram remains selectable
  and TikTok connect/account/settings controls are absent. Existing Carousel
  format compatibility, readiness, rendering, and publishing APIs are retained.
- Saved targets, connections, settings, and provider types remain intact. The
  schedule editor preserves dormant saved targets when other fields are edited.
  Re-enable the single TikTok visibility entry after approval and release the
  frontend. See `docs/tiktok-ui-visibility.md` for the covered surfaces and checks.
- This is local implementation; deployment and authenticated production
  acceptance remain pending.

## 2026-10-03 Hero showcase media replacement (local implementation)

- The homepage's three-card hero uses the owner's supplied positional videos:
  `left_side.mp4`, `middle.mp4`, and `right_side.mp4`, in that order. Its former
  right-hand image slideshow is replaced by video, so slideshow navigation,
  pagination, and the two decorative stack layers behind that card are removed
  only from the hero. The tilted card geometry and
  center-only mobile layout are retained. Matching first-frame posters and
  lossless MP4 fast-start preparation support initial loading.
- Hero overflow, its existing bottom crop, isolation, and an explicit inset
  clip keep all transformed card/shadow layers inside the section divider.
  Hidden desktop-side video sources are deferred on narrower screens.
- The separate homepage daily-feed demo still uses its original Hook, Wall of
  Text, and Slideshow samples. No product Carousel source, render, readiness,
  Library save, daily-feed, schedule, or publishing contract is changed.
  This entry does not assert deployment or production acceptance.

## 2026-10-03 Landing daily feed demo (local implementation)

- The homepage `#interactive-feed` section now demonstrates the same vertical
  scroll, mouse grab/flick, and double-tap heart as Trending and `/try-ugcpilot`
  through `PostInteractionFeed`. The heading and instructions teach double-tap
  approval and scrolling to skip; down-arrow and heart replace the old X/tick.
- Its existing Hook, Wall of Text, and Slideshow samples still loop. Slideshow
  arrows change slides within one post, and only the active video plays. Likes
  hold the post for the shared 720ms feedback with a synchronous duplicate lock
  and timer cleanup. This is an interactive marketing preview; scheduling starts
  in Trending, and the homepage sends no save or publishing request.
- Browser checks exercise the real homepage on desktop/mobile, including
  controls, native touch/wheel, mouse/keyboard browsing, duplicate likes,
  format cycling, inactive playback, and reduced motion. Existing product
  scheduling and Carousel readiness/Library contracts are unchanged.

## 2026-10-03 Scroll motion refinement (local implementation)

- Trending and `/try-ugcpilot` keep native touch/wheel momentum and vertical
  snapping. Scrolling now commits on native `scrollend`, with a debounce
  fallback for older browsers. A held touch or mouse gesture cannot retire
  its post. The next post stays in place through the decision hand-off rather
  than resetting to the previous post during the busy state.
- Mouse release considers a recent upward flick as well as the existing 35%
  distance threshold. Flicks need at least 10% travel; movement speed expires
  after a 100ms pause. Release and keyboard movement decelerate over 180–320ms
  into one post without bouncing. Short/paused drags return smoothly. Escape,
  blur, new gestures, item changes, and busy/unmount cleanup cancel the tween;
  reduced motion moves instantly. No per-frame React state updates are used.
- The existing 720ms heart, like locks, Carousel Library save/readiness,
  scheduling hand-offs, decision outbox, and publishing contracts are retained.
  Real-frame verification checks flicks, cancellation, touch release, continuity
  through retirement, reduced motion, and liking after a scroll. This remains
  local until release and authenticated production verification.

## 2026-10-03 Mouse drag browsing (local implementation)

- Trending and `/try-ugcpilot` show a grab cursor over active post media and
  a grabbing cursor while the primary mouse button is held. Vertical mouse
  dragging moves the shared scrolling feed directly, with native snap paused
  during the drag. Touch, wheel, and keyboard browsing keep their existing
  behavior.
- Mouse movement cannot like a post. A release after at least 35% of a post's
  height snaps to one next post, then uses the existing settled-scroll skip
  and decision outbox. Short, downward, or reversed drags return to the current
  post. No decision is committed while a mouse drag is still held.
- Post controls keep normal clicks. Native image/text dragging is suppressed
  only for post mouse gestures. Pointer capture supports release outside the
  card; Escape, window blur, capture loss, item changes, and busy/unmount
  transitions clear drag state. Cancelled gestures reset without consuming a
  post. The same readiness, heart feedback, duplicate locks, and scheduling
  hand-offs remain in place. This change remains local until release.

## 2026-10-03 Like feedback refinement (local implementation)

- Trending and `/try-ugcpilot` now share a solid white heart with a prompt
  spring pop, restrained overshoot, short settled hold, and soft fade. The
  feedback lasts 720ms; CSS and the existing decision timer share the same
  duration constant so advancing cannot cut off the animation.
- The heart is centered on the post media, including Trending's format-label
  space. Only transform and opacity animate. Reduced motion keeps the heart
  still, and feedback stays decorative and ignores pointer events. Duplicate
  locks, readiness, Library saving, skipping, and scheduling contracts remain
  intact. Local motion frames and the existing regression checks verify this;
  production verification remains pending deployment.

## 2026-10-02 Trending scroll feed and double-tap scheduling (local implementation)

- Trending now presents its ordered daily posts in a native vertical scrolling
  feed. Double-tapping the active post media likes it, shows heart feedback,
  and enters its existing scheduling flow. A completed user scroll to the next
  post skips exactly one assignment through the existing decision outbox.
  Single taps, small movements, controls, programmatic scrolling, and incoming
  feed updates do not decide a post. Upcoming posts remain inert and preload
  without autoplay until active; Carousel slides remain one daily post.
- This supersedes the horizontal swipe deck, stacked preview positioning, and
  primary X/tick review controls below. Explicit accessible controls are now
  a down-arrow Skip and a heart Schedule; keyboard shortcuts remain available.
  Editor save ticks, modal close controls, and internal Carousel slide controls
  retain their existing jobs. The first-post guide teaches the new gestures
  and still consumes its acknowledgement without deciding the underlying post.
  The shared decision component defaults to the existing swipe controls;
  Trending opts into post controls. The former Create Content screen used the
  default X/tick controls until its retirement on 3 October.
- Carousel likes retain the readiness checks and save the exact owner-scoped
  Library item before retiring the daily post. The saved result is passed
  directly into the shared scheduler, avoiding a second save. Failed saves
  leave the post in Trending and release the interaction lock. Text and
  Reaction likes open their existing shared scheduler directly; Hook likes
  retain the required composition step before scheduling. Account settings,
  explicit final scheduling submission, publishing APIs, workers, entitlement
  accounting, idempotency, and immutable rendered media are unchanged.
- `/try-ugcpilot` uses the same gesture component and guide. Its heart and
  down-arrow controls replace the old tick and X. Liking is a demo event;
  the persisted counter keeps its legacy `postedCount` field for session
  compatibility but is shown as Liked. Existing analysis, refill, audio,
  mobile controls, and browser sessions remain supported. Reset and new
  analysis cancel pending decisions so they cannot consume a new deck's post.
- Heart feedback respects reduced motion. Post gestures are disabled during
  saving, scheduling, or editing, and synchronous locks prevent duplicate
  acceptance. The last ready post can be liked or skipped without replenishing
  its daily slot; a scheduling dialog stays mounted after that post leaves.
- Local verification includes gesture/session tests, execution of the real
  acceptance hand-off functions, the existing Trending scheduling suite, and
  desktop/mobile browser checks. Details and repeatable commands are in
  `docs/trending-scroll-feed-2026-10-02.md`. This entry is not a deployment claim;
  authenticated acceptance on https://www.getugcpilot.com remains a release
  verification step.

## 2026-10-01 Seven-day Trending trial (released 3 October)

- The shared Trending trial is seven days from completed onboarding, with
  twenty daily concepts and at most seven reserved daily packs. This applies
  to the shared feed used by Hook, Wall of Text, and Carousel content.
- The new migration extends only unexpired trial records to at least seven
  days from their original start and seven content days. Expired records stay
  closed; onboarding replay cannot reset a trial. Existing usage, daily limits,
  scheduling limits, paid subscriptions, and complimentary grants are retained.
- Pricing derives the duration from the shared policy; Settings describes the
  stored entitlement. Expiry messages also work for legacy closed trials.
- The final reserved pack may still finish during an active trial after its
  seventh allowance is consumed; this does not authorize an eighth pack.
- This supersedes the three-day policy in historical entries below. The database migration was applied on 3 October 2026 with the pricing release.

## 2026-10-01 TikTok slideshow scheduling release

- This release builds on the current production/main source, preserving the
  Runway video-generation update. It includes the requested Everyone / Your
  brand defaults, capability handling in all three scheduling forms, and the
  two photo-publishing fixes below. No additional OAuth scope, slideshow API
  route, database migration, or video conversion is needed for photo scheduling.
- The scheduler saves a ready Carousel Library item and exact per-account
  settings/time; the publish worker loads its stored slides in order and uses
  TikTok's `PHOTO` / `DIRECT_POST` endpoint with `PULL_FROM_URL`. Production video
  `FILE_UPLOAD` does not change this photo path.
- Worker fix: forward the existing `containsSyntheticMedia` setting as the
  photo API's top-level `is_aigc`, preserving explicit false and the existing
  true default. The form previously saved this choice but the photo request
  omitted it. The video disclosure contract is unchanged.
- Worker fix: URL-verification errors refer to the post's media and direct users
  to support, rather than incorrectly calling a slideshow a video or suggesting
  regeneration would repair app ownership verification.
- Live read-only checks: `mrcool9251` has a valid connection and `video.publish`;
  TikTok creator-info returned HTTP 200 and includes `PUBLIC_TO_EVERYONE`.
  The Clara connections remain revoked. All six images in the latest blocked
  slideshow return HTTP 200 without redirects, are WebP, and are below 20 MB;
  their existing 1080x1350 render size is preserved.
- Validation: worker build and 50 focused worker tests pass; 46 Trending
  scheduling tests pass. New regressions cover the photo AI choice, photo URL
  pulling under video FILE_UPLOAD, resuming without duplicate initialization,
  and action-required URL-verification failures.
- Release targets are the production web app and social-publish worker. The
  verified prefix and hostname configuration below are already deployed.
  Production browser verification requires sign-in; no live post was created.
  One explicitly approved photo post reaching `PUBLISH_COMPLETE` and a
  `published` target remains necessary for end-to-end acceptance.

## 2026-10-01 TikTok slideshow URL verification and worker configuration deployed

- Production slideshow images remain under the existing public GCS prefix
  `https://storage.googleapis.com/ugcsaas-media/`. A real image probe returned
  HTTP 200, WebP, and no redirect. The optional custom media CDN stays disabled.
- The photo-post code uses `PHOTO` / `DIRECT_POST` with `PULL_FROM_URL`. Before
  recovery, the worker had no verified media hosts configured and the latest
  six-slide production target failed with `tiktok_url_ownership_unverified`.
  Successful video uploads do not establish that photo URL pulling works.
- Recovery is to verify this exact owned bucket URL prefix in the TikTok app's
  Production URL properties using its generated signature file, then set
  `TIKTOK_VERIFIED_MEDIA_HOSTS=storage.googleapis.com` in the worker and its
  Terraform variables. This hostname allowlist does not verify other GCS
  buckets. No new CDN, image rewrite, or video transfer-mode change is needed.
- Reconnect the exact intended TikTok account, then verify one explicitly
  approved real slideshow on production through provider `PUBLISH_COMPLETE`
  and a `published` target. The inspected Clara connections are revoked.
- The owner supplied `tiktok41KhPT9XDx2y5CeAK5W5o2L5LF1GHnOu.txt` from TikTok.
  Its unchanged 68 bytes are saved in
  `infra/gcp/social-publish-worker/verification/` and deployed at the root of
  `gs://ugcsaas-media`. The public HTTPS URL returned HTTP 200, `text/plain`,
  no redirect, and bytes identical to the original file.
- The owner's screenshot confirms the storage URL prefix under TikTok's
  Verified properties; the `getugcpilot.com` domain also remains verified.
  Deployed worker revision `ugc-social-publish-worker-00057-btp` has
  `TIKTOK_VERIFIED_MEDIA_HOSTS=storage.googleapis.com` and serves 100% of traffic.
  The same host is persisted in the ignored production `terraform.tfvars`.
- Cloud Run confirms Ready and ContainerHealthy after its internal `/healthz`
  startup probe. The image, service account, and all other environment settings
  are unchanged. A real slideshow publishing test remains pending; this
  deployment does not establish `PUBLISH_COMPLETE` or a `published` target.
  Commands and evidence: `docs/tiktok-direct-post-audit-runbook.md`.

## 2026-10-01 TikTok publishing defaults

- Owner-requested shared defaults for new TikTok targets are Everyone
  (`PUBLIC_TO_EVERYONE`) and Your brand (`brandOrganic=true`), with commercial
  disclosure enabled and Paid partnership off. Trending Hook, Text, Reaction,
  and Carousel scheduling use these defaults without requiring users to
  reselect them for each post. Choices remain editable and saved per-post
  settings remain authoritative; no account preference store is added.
- Fresh creator capabilities still validate the audience. If Everyone is
  unavailable, or private-testing mode is explicitly configured, clear the
  unsupported audience and ask for an available choice; never substitute Only
  me automatically. Music Usage Confirmation remains an explicit final consent.
- This supersedes the manual-visibility/default-disclosure behavior documented
  below. It deliberately differs from TikTok's current Content Sharing
  Guidelines, which require no default audience and commercial disclosure off
  by default: https://developers.tiktok.com/docs/en/content-sharing-guidelines.
- This release changes the shared defaults and capability handling in the
  three scheduling forms. Authenticated production acceptance remains separate
  from source/release verification.

## 2026-09-30 Carousel editor drag containment (local)

- Structure 1 and Structure 2 live previews measure the full text group,
  including body blocks, CTA, inline heading-pill padding and text overhang.
  Pointer and arrow-key movement clamp that measured group inside the existing
  renderer safe margins, not merely a 10%-90% centre-anchor range. Structure 2
  remains horizontally locked; both 1:1 and 4:5 sizes are preserved.
- Measurement refreshes after text edits, viewport resize and font loading.
  Preview-only clamping never saves content or marks an untouched slide edited.
  The immutable saved-render preview remains exact until explicit interaction.
  An oversized group shows a shorten-to-fit warning and cannot be dragged into
  a falsely valid position; no font shrinking or copy truncation is introduced.
- This is a Carousel-only browser change. Hook and Wall-of-Text drag controls,
  export renderers, image sourcing/selection, uploaded screenshot composition,
  API/persistence contracts and historical render files are unchanged. Local
  checks do not assert deployment or authenticated production acceptance.

## 2026-09-30 TikTok-style text on the existing slideshow formats (local)

- Owner-confirmed scope: keep only Structure 1 and Structure 2, their existing
  15 educational and eight product-story format IDs, rotation, six-slide roles,
  and slideshow sizes. Output remains 1080x1080 (1:1) or 1080x1350 (4:5), never
  9:16. The three architectures and collage/image proposals in the supplied
  reference are explicitly **not** adopted.
- This supersedes the September 20 single-paragraph/96px-cover/60px-body
  presentation and all-slides-no-CTA decisions below, for new renders only.
  Hooks use one clean-white Inter Tight Bold message at fixed 72px, up to four
  lines. Writing normally targets 6-13 words; the publisher accepts 5-13 to
  retain compact legacy-compatible hooks, with measured fit authoritative.
- A real content heading is optional, normally 4-10 words, at fixed 50px and
  at most two lines. Only that heading gets dark text on the existing measured,
  line-fitted white SVG path. No premade/decorative SVG or body box is added.
  Cover hooks do not receive a pill. Never manufacture a heading to activate it.
- Normal body copy uses fixed 48px Inter Tight SemiBold white text with the
  established dark outline, no background. One or two distinct thoughts are
  transported as body/storyText separated by a blank line; each fits at most
  three visual lines, with 32px separation. Single newlines preserve authored
  semantic line breaks. Existing list modes/counts remain authoritative and
  items remain individual text groups. No shrink, truncation or fallback copy.
- Both initial and repair writers receive the same presentation rules. The
  existing body-word budgets remain: Structure 1 18-30, Structure 2 14-30 total
  body words. Grounding, prohibited claims, ownership and bounded repairs stay
  enforced. Orphan lines containing only for/and/to/the/of/but are rejected.
- An optional short CTA is permitted on Slide 6 alongside useful final value,
  never in place of promised content. It is drawn as plain white text on that
  same slide, not a pill/button; existing authored CTA fields are preserved
  during explicit edits rather than silently suppressed. There is no new CTA
  slide or image-role change.
- Structure 2's plan/schema adds nullable semantic `headline` while keeping
  `storyText` for the body. Persistence reuses existing columns: new cover hook
  in headline; content heading (or empty string) in headline and body in subtext.
  Legacy plans/specs without semantic headline retain their plain story
  treatment. The legacy headline database column alone never implies a pill.
  No database migration or historical-row rewrite is needed.
- Image selection/reservation, safety/relevance, approved uploaded screenshot
  consideration and Slide 6 placement, screenshot containment/blur, image crop,
  brightness/saturation and fallback pools are unchanged. No collages, new
  sourcing strategy or product-in-context replacement is introduced.
- Completed rendered assets remain immutable. Unchanged edited slides reuse
  their exact saved render; intentional re-renders use versioned new keys.
  Browser editing keeps body line breaks and the same packaged Inter Tight
  font/size hierarchy; its temporary layout is a preview, while the worker's
  measured SVG fit remains the export authority.
- Versioned writers: Structure 1 v49, Structure 2 v20; renderers:
  `social-tiktok-text-blocks-inter-tight-v25` and
  `story-native-tiktok-text-blocks-inter-tight-v11`. Full specification:
  `docs/carousel-text-presentation.md`. This is local implementation, not a
  deployment claim. Coordinated web/worker release and authenticated production
  checks on https://www.getugcpilot.com remain separate acceptance gates.

## 2026-09-30 TikTok and YouTube general availability

- TikTok and YouTube connections, scheduling create/edit/finalization/retries,
  and analytics are available to every verified signed-in user. The former
  email allowlists are removed from the shared access helpers used by both
  server routes and frontend controls; their legacy names remain for caller
  compatibility. This supersedes the verified-email beta restrictions below.
- The shared Analytics platform/account selector and existing Instagram,
  TikTok, and YouTube analytics views are available to those same users.
  Owner scoping, genuine provider metrics, snapshot freshness, and per-account
  filtering remain enforced. Older connections missing analytics consent
  must reconnect to grant the existing requested scopes.
- The inline Carousel scheduler now offers Instagram and TikTok to all
  verified users. YouTube remains video-only. Carousel Library ownership,
  complete-slide previews, media validation, and explicit TikTok visibility
  and publishing consent remain enforced.
- The same modal offers YouTube for Trending Text and Reaction Reels, with
  channel visibility, audience, notification, and AI disclosure settings.
  Video add/reconnect actions use the accounts OAuth popup context because
  those posts have no Carousel Library item. TikTok Music Usage Confirmation
  is validated before submission using the shared platform settings policy.
- Code-level verification confirms ready Reaction Reels create publishing
  tasks before success; Text Reels save the account/settings/time first,
  then the server queues rendering and the worker finalizes publishing.
  Hook videos save a pending composition and start rendering through the
  existing follow-up render request; failed starts remain retryable in
  Scheduling. These are local code/test findings, not production acceptance.
- The owner confirmed TikTok Direct Post audit approval. Both web and worker
  default to audited publishing, and deployment templates set
  `TIKTOK_DIRECT_POST_AUDITED=true`. An explicit false setting restores private
  testing restrictions. Existing deployed false overrides must be changed to
  true in both runtimes when releasing this change.

### 2026-09-26 Shared extraction condition preservation

Business Context extraction now explicitly repeats applicable source limits
in each standalone claim, including ordering deadlines, pickup windows, plan
limits, and required approval. No Carousel API, planner, renderer, review,
schema, or frontend behavior is changed by this Wall-focused update.

## 2026-09-25 Shared Business Context language (local implementation)

- Website, typed-description, and mobile-app AI context extraction share plain-
  English factual writing instructions. Descriptions preserve source meaning
  and qualifications; labels/search queries remain short. Unsupported or
  ambiguous meaning is omitted using existing schema fields. Creative guidance
  is confined to its existing fields rather than influencing factual wording.
- This changes newly analyzed Business Context used by all formats. Carousel
  planning, rendering, schema, profile-version ownership, and historical assets
  are unchanged. There is no new review gate, model call, or migration.

This document is the source of truth for Carousel product rules, architecture,
image safety, matching, readiness, rollout, and current implementation status.
Read it before changing Carousel API routes, workers, image sourcing, matching,
rendering, database schema, review scripts, or frontend behavior.

## Product Goal

### Explore reference catalogue additions (2026-09-30, local only)

The owner's new source folders add 11 complete slideshows / 70 slides to
Recreate: Habit (2), Interior Design (3), Relationship (3), Screen Blocker (3).
Habit, Interior Design and Screen Blocker are new compact-filter categories.
The local gallery now has 49 slideshows across 12 categories. Each source
subfolder remains one ordered slideshow; original images are never altered.
Seven supplied Hook clips are added to Recreate, retaining their original audio
and bytes while gallery previews play muted. Workflow 1 Library and covers are
not populated by these additions.

Catalogue preparation is additive and repeatable: preserve saved IDs, titles,
slide order and missing old references; reject conflicting replacements; never
downgrade a published batch. The original 66 imported items are unchanged.
New content stays staged and development-preview-only until a separate approved
cloud import verifies assets. This does not change Trending Carousel sourcing,
matching, writing, rendering, ownership, readiness or scheduling, and does not
assert deployment. Details: `docs/explore-catalog-update-2026-09-30.md`.

### Explore Recreate reference presentation (2026-09-30, local only)

Explore's Recreate gallery is a reference-browsing surface, separate from the
automatic Trending Carousel generation pipeline. Each imported slideshow stays
one complete ordered reference. Its gallery and preview keep the full source
image with `object-contain`; the main preview follows the natural image ratio
to avoid artificial dark side bars, rather than cropping the source. Category
names remain inside the compact filter, without numeric filter counts. Numbered
internal titles and duplicate category/slide-count captions are not exposed;
the media badge and preview's current-slide position remain useful navigation.

The gallery responds to its own available width, and selected-reference
thumbnails identify the chosen slide without reconstructing its typography.
Short fades/slides respect reduced motion and do not remount generator panels.
No Carousel source, matcher, writer, renderer, ownership, readiness, Library,
scheduling, schema or immutable rendered asset is changed by this local UI pass.
Nothing in this entry asserts deployment or authenticated production acceptance.

### Monotonic laptop Trending composition (2026-09-16)

Trending reserves one clear vertical unit for the format label, review card,
decision buttons, and remaining-content text. At 1366×768, the complete unit
must be visible without scrolling and without a format pill colliding with the
page subtitle or card stack.

Browsers cannot reliably read a laptop's physical diagonal, so the layout uses
CSS viewport profiles rather than claiming to detect 14- or 15.6-inch hardware.
The width curve grows monotonically from a 1366×768 profile (300px Slideshow,
270px Hook/Reaction, 280px Wall-of-Text) to a 1440×900 or 1536×864 profile
(340px, 305px, 315px), then caps at 1920×1080 (380px, 340px, 350px). Each card
uses the smaller of a positive viewport-width and viewport-height bound, so a
wide-but-short window cannot push controls below the fold. Labels retain a 24px
gap above their active card; a Slideshow with a taller next-card layer keeps
its extra clearance. Decisions remain a below-card pair with progress below.

Wall-of-Text feed overlays scale proportionally with their media, preserving
saved line breaks, text outline, and spacing. The editor's capped B treatment
and rendered assets remain unchanged. This supersedes the earlier
compact-laptop and 300px Slideshow review-size decisions below.

Slideshow review images use `object-contain` at every viewport width. Normal
4:5 renders fill the frame; different source ratios retain their entire image
with neutral space around it. `object-cover` cropped the top and bottom of
9:16 sources, removing the intended headline safe margin. Enlarging a frame
does not reposition text baked into a rendered slide.

This full-image policy also applies to Library Carousel covers and the shared
scheduling modal's Carousel preview. Library cover hover must not zoom and
clip rendered text. Full-slide Library previews and the editor's immutable
render preview already contain the complete image. This policy applies to all
saved slides and edited renders, independent of image URL or laptop size; it
does not modify source assets or repair text already baked outside safe margins.

### Active trial pack delivery

The seven-day pack quota is charged when a daily pack is reserved. While the
trial is active, feed reads, generation continuation, and completion callbacks
may finish an existing owner-scoped trial pack after its remaining content-day
quota reaches zero. They retain that pack's saved daily limit. Creating another
pack still requires unused quota; an expired trial still blocks preparation.
The database admission limit remains authoritative. This applies to all four
Trending formats, including Wall plan-publication callbacks.

Generate complete, visually coherent social carousels from website/business
analysis. Each candidate is one complete carousel with its own angle and slides.
The system should prefer highly relevant images, but it must degrade gracefully
to safe profile-specific backgrounds instead of failing on weak tag relevance.

The priority order is:

1. Human safety and manual approval.
2. Complete carousel output.
3. Image relevance.
4. Image uniqueness.
5. Library scale and readiness quality.

Relevance and uniqueness may degrade. Safety may not.

## Library-to-Social Scheduling Boundary

Scheduling entry points operate only on complete carousels saved in the server
Library with a real `library_items.id`. Browser-only fallback items cannot open
the scheduling flow.

Both Trending and Library use the same inline Carousel scheduling modal.
Trending first saves the complete carousel to the server Library, then keeps
the user on Trending while the modal collects the exact connected account,
optional caption, provider settings, and publish time. Library opens the same
modal directly for server-backed items. Normal Carousel scheduling must not
navigate to the Scheduling page.

### Unified Trending post scheduling UI

Ready-to-post Trending formats use one shared Instagram scheduling shell:
`Post`, `Account`, `Details`, then `Publish`. Carousel and Slideshow content
enter with the complete post already selected and retain their optional caption;
Wall-of-Text enters the same shell as a Text Reel, retains the same optional
caption, and shows only a compact preview, caption controls, and publication
settings. It does not add a redundant ready-to-prepare information card or
repeat the full on-screen copy inside the scheduling UI. Its durable schedule
is still saved before the background render begins. Hook videos remain separate
because they must collect and combine a demo video before scheduling.

The shared picker can add or reconnect an Instagram account from a Wall-of-Text
schedule without requiring a Carousel Library item. Carousel scheduling keeps
its existing Library ownership verification for OAuth and publishing.

The scheduling backend stores server-backed `scheduled_posts` and
`scheduled_post_targets` rows and creates delayed GCP Cloud Tasks for connected
social accounts. Scheduler payloads contain only `{ version, targetId }`;
captions, media URLs, OAuth tokens, cookies, and other secrets do not pass
through Cloud Tasks.

Saved carousels are scheduled as `library_item` sources; they must never be
silently replaced with a video media asset. The Scheduling editor preserves the
Library item, collects an exact connected account plus wall-clock date/time,
and only then creates Cloud Tasks. Undated drafts remain visible in the
Drafts list and do not appear as timed calendar entries.

The Scheduling Calendar shows every eligible dated post status; status filters
belong to List view. Calendar labels this scope and provides a direct View drafts
action. Its month badge counts only that month. Undated drafts have a separate
list with existing edit/cancel/recovery actions, without a selected-day filter.
Cancelled parent status takes precedence over retained render metadata. The
workspace wakes at a future target's publish window, polls active work, and
refreshes on focus or visibility restoration. Failed reads expose Retry; an
initial read failure does not masquerade as an empty account, and a refresh
failure retains the last successful data with a visible stale-data notice.

Social scheduling uses one server-owned five-minute minimum lead for ready
media, including ready Library carousels. Date/time controls use one-minute
steps and must not round choices or defaults to quarter-hour boundaries. The
server adds the full lead before rounding up to the next whole minute: a user
who confirms at 15:00:45 with a five-minute lead gets 15:06, never 15:05. The
API exposes the configured minimum to all scheduling clients, while the server
remains authoritative. A combined-video render may reuse the
originally validated publish time only when enough time remains to create its
exact-time Cloud Task; otherwise finalization fails clearly and requires a new
future time. The delayed GCP Cloud Task architecture and atomic publish claim
remain unchanged.

The visible Scheduling workspace and inline Carousel scheduling modal are
Instagram-only for new posts and Carousel recovery edits. Their account pickers
offer Instagram connections only. The portaled inline modal applies the
Instagram theme directly, and each account presents selection, connection
status, and reconnect in one publishing-account row instead of duplicated
connection and selection sections. Existing TikTok and YouTube provider
definitions, validation, and publishing logic remain preserved as dormant
multi-platform support, and legacy non-Instagram planned targets must not be
silently removed when an older draft is edited. This does not change the inline
Carousel scheduling boundary described above.

Instagram OAuth distinguishes adding an account from reconnecting one. Adding
must never revoke or replace another connection. Reconnect sessions persist the
selected `social_connections.id`, and the callback must verify that the returned
Instagram account ID matches that connection before updating credentials. Both
Settings and the inline account picker expose Add another account. Active
entitlements cap connected Instagram accounts at one for Free, three for
Starter, and five for Growth; the picker may select up to five exact connected
accounts, with each selected account remaining a separate publish target.

The modal flow is Step 1 action choice, Step 2 exact account selection, Step 3
optional caption and provider settings, and Step 4 ASAP or later scheduling.
`Next` changes only the modal step. It must not create a visible Drafts-page
outcome or navigate away. Cancel before final submission creates no schedule.
On final submission, the app creates or reuses an internal server draft with
the exact planned targets and wall-clock time, then calls the schedule publish
endpoint. Only a successful durable platform schedule closes the modal and
shows success. If final scheduling fails after draft persistence, the modal
stays on the origin page and may offer `/scheduling?draft=<id>` solely as a
recovery path. Direct visits to that deep link must still open the exact draft
editor, and the same recovery path remains reusable for Hook videos.

Carousel captions are optional. A blank caption must remain blank through
scheduling and publishing; do not synthesize provider text from the Carousel
title and do not require an LLM caption call. The visible Instagram editor may
offer an editable optional caption, but caption presence must never block
account/date/time scheduling. Dormant legacy TikTok targets keep their existing
caption support.

The shared Instagram scheduler shows a live caption preview in Details and
keeps the same caption visible on both Publish time choices, with an Edit caption
action. The Scheduling editor also previews its current caption. Caption copy
is separate from on-screen video/slide text and internal post titles. Previews
preserve line breaks and show an explicit empty state when no caption is added;
they never substitute the creative's title or overlay text for a blank caption.

The social publish worker loads the ordered `library_carousel_slides` rows at
publish time. Instagram publishes a 2-10 image carousel through child media
containers plus one persisted parent container. Before container creation, the
worker converts the rendered WebP slides to deterministic GCS-backed
JPEG publish copies; the Library carousel and frontend renders remain
unchanged. Dormant legacy TikTok targets publish the verified WebP URLs as a
2-35 image photo post through the Content Posting API and persist the publish
ID. YouTube remains unavailable for carousel scheduling because its upload API
is video-only. New inline Carousel scheduling does not render TikTok or YouTube
connections; their provider definitions and legacy target handling remain in
code so old schedules are not damaged. Existing Reel, TikTok video, and YouTube
video paths remain separate. Do not describe a scheduled post as actually
published until the worker updates its target row to `published`.

Carousel generation uses the shared durable job contract. Supabase
`background_jobs` and `background_job_events` are authoritative for ownership,
idempotency, claims, checkpoints, cancellation, retries, recovery, and terminal
state. The app dispatches a versioned `{ jobId, jobType, attempt }` payload to a
deterministically named GCP Cloud Task. An authenticated Cloud Run HTTP worker
reloads the full input from Supabase; the queue payload is never the source of
truth. Carousel has no selectable alternate queue provider.

For the Vercel app runtime, GCP queue publishing cannot rely on
`GOOGLE_APPLICATION_CREDENTIALS` unless it points to a real file. The app
supports `GOOGLE_CLOUD_CREDENTIALS_JSON` or the split
`GOOGLE_CLOUD_CLIENT_EMAIL` / `GOOGLE_CLOUD_PRIVATE_KEY` env pair for the
`ugc-app-sa` service account. Carousel API runtime validation checks Supabase
and the configured app queue provider; worker-side storage is validated through
the deployed worker profile and GCP smoke test.

Trending feed readiness is GCP-storage-aware:
completed Carousel rows are display-ready only when every ready slide URL is
trusted by GCS storage. Historical rows with URLs from retired providers are
not display-ready. Do not rewrite old rendered URLs in place; reset affected
feed items and let the app generate fresh GCP Carousel inventory instead.

## Non-Negotiable Image Safety

Carousel background images must not contain any human presence:

- faces
- hands or arms
- bodies or cropped bodies
- silhouettes
- reflections containing people
- people in the background
- people shown on screens
- people shown on packaging or printed material

The project is not using a Vision API for this decision. Manual review is the
authority. An asset is selectable only when all current safety fields agree:

```text
status = ready
subject_review_status = approved
image_subject_class = object-only
has_human = false
face_count = 0
person_count = 0
```

Because the schema does not currently have `hand_count`, manual approval as
`object-only` also means the reviewer confirmed there are no hands, arms, or
other human traces. Unreviewed or rejected assets are never selectable.

## Image Taxonomy

### Legacy narrow buckets

`visual_bucket` records where an older asset originally came from, for example
`laptop-desk`, `calendar-overload`, or `gym-phone`.

Keep it temporarily for:

- migration history
- contact-sheet review
- mapping and tag debugging
- old-versus-new matcher comparison
- rollback diagnostics

It is not the future runtime routing field. New broad-v1 assets may have
`visual_bucket = null`.

### Broad runtime buckets

`broad_visual_bucket` is the new runtime pool. Taxonomy version is `broad-v1`.
The current broad buckets are:

- `workspace-objects`
- `phone-and-devices`
- `data-and-screens`
- `notes-and-planning`
- `home-lifestyle`
- `food-and-table`
- `fitness-wellness-objects`
- `product-still-life`
- `abstract-backgrounds`
- `clean-texture-backgrounds`

Detailed meaning comes from `content_tags`, `object_tags`, and `mood_tags`.
Example:

```json
{
  "visual_bucket": "gym-phone",
  "broad_visual_bucket": "phone-and-devices",
  "bucket_taxonomy_version": "broad-v1",
  "content_tags": ["phone", "fitness", "tracking"],
  "object_tags": ["phone", "dumbbells"],
  "mood_tags": ["focused"]
}
```

Before an approved asset becomes selectable by the broad matcher, it must have
a valid `broad_visual_bucket`. Unreviewed assets may be incomplete temporarily.

## Broad Bucket Requirements

The canonical definitions live in
`lib/carousel/broad-visual-bucket-taxonomy.ts`.

Marketing SaaS currently requires:

- `workspace-objects`
- `phone-and-devices`
- `data-and-screens`
- `notes-and-planning`
- `abstract-backgrounds`
- `clean-texture-backgrounds`

Fitness Health currently requires:

- `food-and-table`
- `phone-and-devices`
- `fitness-wellness-objects`
- `home-lifestyle`
- `abstract-backgrounds`
- `product-still-life`

Other profiles are defined in the same taxonomy file. Each profile must also
declare an explicit logical fallback list made from broad buckets already
allowed for that profile. A fallback pool is configuration, not a new physical
bucket, S3 folder, or duplicated asset collection.

Example:

```json
{
  "profile": "marketing-saas",
  "fallbackBroadBuckets": [
    "clean-texture-backgrounds",
    "abstract-backgrounds",
    "workspace-objects"
  ]
}
```

The images stay in their normal broad buckets. The profile's fallback list only
controls which existing safe pools the matcher may search after stronger
matches are exhausted. Do not dynamically borrow an unrelated category.

## Runtime Matching Contract

Tags are scoring signals, not hard blockers. Missing an exact tag match lowers
relevance; it does not make a safe asset unusable.

Selection order:

1. Same broad bucket with a strong tag match.
2. Same broad bucket with a partial tag match.
3. Same broad bucket with weak or no tag match.
4. Approved safe asset from an explicit fallback broad bucket for the profile.
5. Approved shared asset whose `usable_profiles` includes the profile.
6. Reuse an already-used approved safe asset if no unique asset remains.
7. Fail only when no approved safe asset exists anywhere in the permitted pool.

Duplicate avoidance is a preference, never a hard rule. Prefer different images
inside one carousel first. Also prefer avoiding duplicates across a generated
candidate batch when the approved pool is large enough. Apply a scoring penalty
before reuse, but reuse an approved safe asset whenever uniqueness would
otherwise prevent a complete carousel.

Unrelated cross-category fallback is prohibited. The intended meaning of
`CAROUSEL_DISABLE_CATEGORY_FALLBACK=true` is:

- block unrelated category fallback
- allow declared same-profile broad fallback
- allow shared assets only when the current profile is explicitly permitted

Every selection should produce diagnostics such as:

```json
{
  "selectedAssetId": "asset_123",
  "broadVisualBucket": "data-and-screens",
  "score": 92,
  "fallbackReason": "partial_tag_match",
  "duplicatePenaltyApplied": false,
  "matchReason": [
    "matched broad bucket data-and-screens",
    "matched tags analytics and dashboard",
    "approved object-only with zero human signals"
  ]
}
```

Supported reason names should include:

- `exact_match`
- `partial_tag_match`
- `broad_bucket_fallback`
- `profile_fallback`
- `shared_profile_fallback`
- `generic_background_fallback`
- `duplicate_safe_reuse`
- `no_safe_asset_available`

## Shared Assets

Preferred model: one physical and database asset row that may serve multiple
profiles. Do not duplicate the same asset into multiple category rows.

Target shape (`usable_profiles` is a JSONB array of strings):

```json
{
  "category_slug": "shared",
  "asset_scope": "shared",
  "broad_visual_bucket": "workspace-objects",
  "usable_profiles": [
    "marketing-saas",
    "productivity-saas",
    "generic-business"
  ],
  "subject_review_status": "approved"
}
```

If compatibility temporarily requires duplicate metadata rows, they must point
to one canonical asset or share a stable source/image hash. Runtime deduplication
must use canonical asset identity, S3 key, Pexels ID, or image hash, not only row
ID.

The first shared-pool compatibility path is implemented for `home-lifestyle`.
It uses one physical row per image with `category_slug = shared`; it does not
duplicate rows into each profile category. Productivity SaaS, Fitness Health,
Wellness, Beauty Skincare, and Generic Business may load this source category,
but the broad matcher still requires the bucket to support the active profile
and all strict safety fields to pass. Marketing SaaS does not load this pool.
Per-row `asset_scope` and `usable_profiles` fields are still planned and are not
implemented yet, so only deliberately universal shared pools may use this
compatibility path. Cross-category reuse is also constrained by an explicit
profile + source-category + broad-bucket policy. A profile does not receive
every asset from an allowed source category. For example, Wellness may reuse
Fitness Health food/wellness/product pools and Marketing SaaS clean textures,
but it may not reuse Marketing SaaS analytics/data screens as Wellness abstract
backgrounds.

## Local Curated Image Packs

As of 2026-07-12, local curated carousel image packs are being audited before
any upload or production selection change. The known source folders are:

- `C:\Users\chund\Downloads\calory tracking` -> `calorie_tracking`
- `C:\Users\chund\Downloads\gym_carousel_images_pack\...` -> `gym`
- `C:\Users\chund\Downloads\personal_finance_carousel_images_pack\...` ->
  `personal_finance`
- `C:\Users\chund\Downloads\productivity` -> `productivity`

The audit command is:

```text
npm run carousel:local-images:audit
```

This command is intentionally read-only. It creates a local report under
`.tmp/local-carousel-image-pack-audit`, does not upload files, does not write to
Supabase, does not rename source folders, and does not approve any asset.

The local pack import model must extend the existing `category_image_assets`
pipeline. Do not create a disconnected runtime table such as
`carousel_image_assets` unless the app, worker, matcher, review tooling, and
slide foreign keys are deliberately migrated together.

Local source folder categories are not always runtime categories. The current
runtime mapping is:

- `beauty_skincare` -> `beauty-skincare`
- `calorie_tracking` -> `fitness-health`
- `gym` -> `fitness-health`
- `marketing` -> `marketing-saas`
- `outdoor_lifestyle` -> `shared`
- `personal_finance` -> `personal-finance`
- `productivity` -> `productivity-saas`

Keep the original local category in source metadata for provenance and review
debugging.

For a multi-folder pack, first create compact review sheets directly from the
audit report. `--category` can limit a sheet run to one source category:

```text
npm run carousel:local-images:review-sheets -- --audit-report <report.json> --category <source-category>
```

After full-resolution safety decisions are recorded, build a fail-closed
per-file review map:

```text
npm run carousel:local-images:review-map -- --audit-report <report.json> --tag-manifest <unreviewed-tag-manifest.json> --safety-review <review.json> --out-file <review-map.json>
```

The preferred reviewed tag-manifest command is:

```text
npm run carousel:local-images:tag -- --audit-report <report.json> --review-map <review-map.json>
```

It reads the latest audit report and writes a structured manifest under
`.tmp/local-carousel-image-tags`. The manifest includes one asset entry per
visual family, inferred category tags, object tags, broad runtime bucket,
caption, quality score, duplicate-family ID, text-safe areas, and source-file
links. It does not upload files and does not write to Supabase.

`local-curated-image-tags-v2` uses whole normalized terms rather than unsafe
substring matches, keeps category defaults narrow, and adds literal
content/object tags that the current runtime matcher can actually score.
Per-file overrides are required when an opaque generated filename contains no
semantic information. Review-map tags augment inferred tags; they do not erase
specific object terms inferred from the file path. Broad category mapping,
semantic tagging, duplicate decisions, and strict object-only safety decisions
remain separate concerns.

The local prepare command is:

```text
npm run carousel:local-images:prepare
```

It reads the latest tag manifest and writes an upload-ready local package under
`.tmp/local-carousel-image-import`. It normalizes every runtime image to
`base-1080x1350.webp`, creates a `thumb-320x400.webp`, keeps the original file
for provenance, and writes the exact `category_image_assets` row payload that
the importer will use. This command does not upload files and does not write to
Supabase.

The local import command is:

```text
npm run carousel:local-images:import
```

Before importing, run the checkpoint validator:

```text
npm run carousel:local-images:check
```

It verifies runtime category mapping, allowed broad buckets, strict safety
fields, duplicate object-key/hash identities, and prepared base/thumb
dimensions.

Then run the live structure preflight:

```text
npm run carousel:local-images:remote-structure
```

It checks the remote `category_image_assets` schema, samples existing row
shape, counts current strict-approved assets, and confirms the prepared
`base_s3_key` and `source_file_sha256` values do not already exist.

It is dry-run by default. The execute form is:

```text
npm run carousel:local-images:import -- --execute --yes
```

The importer uploads original, base, and thumbnail files to GCS under
`category-library/<runtime-category>/<broad-bucket>/<asset-id>/`, then inserts
the corresponding rows into `category_image_assets`. It checks for existing
local rows by `base_s3_key` and `source_file_sha256` before inserting, and it
preflights the remote schema before the first GCS upload. The `*_s3_key`
column names are legacy schema names only.

After importing, run:

```text
npm run carousel:local-images:verify-import
```

It reads the import manifest and import result, verifies all production rows
match the manifest, and can optionally sample uploaded GCS URLs.

Original files are the canonical source when an `originals` folder is present.
`carousel_4x5` or `carousel_1080x1350` files are derived renditions of the same
visual family, not separate fresh images. A crop and its original must share
canonical identity or duplicate-family metadata so the matcher cannot select
both inside one carousel or count both as unique inventory. Cropped-only packs
may be imported as lower-resolution canonical candidates only when originals
cannot be recovered.

For carousel runtime, prefer the manually prepared 4:5 rendition
(`carousel_4x5` or `carousel_1080x1350`) whenever it exists. Keep the original
as the provenance/canonical source and store it separately. A 9:16 vertical
image is not the preferred carousel runtime source; use it only when no 4:5
rendition exists and crop it to 4:5 during import.

All local imported assets must start as unreviewed and non-selectable. They
become selectable only after the same strict manual object-only review used for
Pexels assets. The importer must preserve source/provenance metadata when
available and store SHA-256 plus perceptual/near-duplicate metadata for
cross-crop and cross-pack duplicate control.

When the user explicitly confirms a local pack has already been manually
reviewed as strict object-only, the tag manifest may mark those entries as
manual-approved for the import pipeline. That still does not publish them by
itself; upload, database import, and runtime selectability remain separate
steps.

Current local checkpoint from the reviewed folders:

- Tagged assets: 184
- Skipped source files represented by canonical/crop pairs or rejected
  recommendations: 100
- Prepared import assets: 184
- Preparation errors: 0
- Runtime category split:
  - `fitness-health`: 84 assets (`food-and-table`: 26,
    `fitness-wellness-objects`: 58)
  - `personal-finance`: 80 assets (`home-lifestyle`: 11,
    `notes-and-planning`: 66, `phone-and-devices`: 2,
    `workspace-objects`: 1)
  - `productivity-saas`: 20 assets (`phone-and-devices`: 1,
    `workspace-objects`: 19)
- Runtime crop split:
  - 98 assets used an existing carousel-ready 4:5 rendition.
  - 86 assets were normalized/cropped to 4:5 during preparation.
- Latest tag manifest:
  `.tmp/local-carousel-image-tags/2026-07-12T19-35-03-831Z/tag-manifest.json`
- Latest import manifest:
  `.tmp/local-carousel-image-import/2026-07-12T19-35-09-675Z/import-manifest.json`

Production upload checkpoint:

- The local-image metadata migration `20260712170500` was applied to the
  linked Supabase project and marked applied in migration history.
- Remote structure preflight passed before upload. It confirmed the live schema,
  existing row shape, and duplicate checks against the prepared S3 keys and
  source hashes.
- Import completed with 184 inserted rows and 0 skipped existing rows.
- Production row verification found 184/184 manifest rows.
- Imported category split:
  - `fitness-health`: 84 rows (`food-and-table`: 26,
    `fitness-wellness-objects`: 58)
  - `personal-finance`: 80 rows (`home-lifestyle`: 11,
    `notes-and-planning`: 66, `phone-and-devices`: 2,
    `workspace-objects`: 1)
  - `productivity-saas`: 20 rows (`phone-and-devices`: 1,
    `workspace-objects`: 19)
- Six uploaded CloudFront base URL samples were checked successfully.
- Import result:
  `.tmp/local-carousel-image-import/2026-07-12T19-35-09-675Z/import-result.json`
- Post-import verification:
  `.tmp/local-carousel-image-import/2026-07-12T19-35-09-675Z/post-import-verification.json`

The schema foundation for this is migration
`20260712170500_add_local_carousel_image_asset_metadata.sql`. It extends
`category_image_assets` with local source, original, hash, canonical identity,
asset-scope, and usable-profile metadata, and creates `carousel_image_usage`
for future per-user image freshness tracking. This does not by itself import
or approve any local image. Runtime duplicate identity now prefers
`canonical_asset_id`, then `source_file_sha256`, then `source_perceptual_hash`,
then existing Pexels/object-key identity.

## Daily Trending Feed

### 2026-08-23 complete daily-pack delivery and Free allowance

Free receives exactly 10 combined posts per user-local day and defaults to
3 Slideshows, 4 Wall-of-text posts, and 3 Hooks until the user saves another
valid mix. Free, Starter, and Growth may all adjust the percentage balance;
each format may range from 0% to 100%, and all three percentages must total
100%. Starter remains 20 posts and Growth remains 50 posts.

Migration `20260823130857_raise_free_trending_allowance.sql` raises the
persisted Free entitlement to 10. If a smaller feed was already created for
the current day, the planning RPC appends the newly entitled slots, updates the
feed snapshot, and resumes preparation instead of leaving that user at the old
allowance until tomorrow. Existing ready or decided positions are preserved.

Carousel, Wall-of-text, and Hook preparation are dispatched as independent
background work. `GET /api/trending/feed` uses a read-only request fast path:
it reads the existing plan and ready provider rows, returns the current public
state without creating rows or enqueueing work in the request, and schedules
the idempotent/coalesced preparation boundary with Next.js `after`. The first
two preparation polls use a two-second interval, then back off through 3.5 and
6 seconds to a ten-second maximum; a hidden tab does not poll. This avoids both
the former request-time orchestration delay and a fixed tight polling loop.

The unified feed exposes preview-ready assignments while unresolved format
slots continue in background work, so Carousel, Wall-of-text, and Hook results
may enter the review queue at different times even though their preparation is
dispatched concurrently. The client distinguishes the number of cards ready
now from the complete number of daily content pieces still remaining. One
Carousel card occupies exactly one daily feed slot regardless of whether that
Carousel contains five or another supported number of internal slides; slides
must never be counted as separate daily posts. The blank dark 9:16 skeleton is
used only when no preview-ready assignment is available yet.

After a response includes preview-ready items, left and right swipes only
dismiss the current in-memory item and select the next in-memory item. Swipe
completion no longer waits for the decision API or refreshes the feed. Decisions enter an
account-scoped browser outbox first, are retried in the background with bounded
backoff, and are filtered from a reload while still pending. The server remains
the durable source of truth and its idempotent decision route still retires the
daily slot without replenishment.

The browser no longer calls the format-specific Hook or Wall preparation
routes from the Trending workspace. `readUnifiedTrendingDailyFeed` is the
request-time reader; `ensureUnifiedTrendingDailyFeed` is the single deferred
orchestration boundary for recovery, attachment, preparation, and readiness.
A terminal enqueue/provider failure is persisted as feed state `failed` so the
next read offers a retry instead of polling a skeleton forever.

The next two mounted deck cards prewarm their presentation assets. Protected
Hook preview cookies are keyed by video ID, allowing multiple upcoming Hook
sessions to coexist; inactive Hook videos preload without playing and become
active without requesting a new generation or feed response. Carousel images
and Wall video metadata retain their existing look-ahead preload behavior.

Hooks are part of the daily entitlement and are enabled when
`TRENDING_HOOK_VIDEOS_ENABLED` is true or absent. An explicit false value is an
emergency kill switch; it is not the normal production configuration.

The Trending-wide Adjust button opens the authenticated content-mix API for
Free, Starter, and Growth. The header control on an active card remains Edit.
Inside the accepted Hook composer, “Adjust opening clip” changes only the
opening video's start and end times; it does not change the daily content mix.
Saving any content-mix preference never mutates an already-created daily pack,
including its unbound positions. If today's pack exists, the preference
starts with the next local-day pack; if no pack exists yet, it is used to create
today's pack. This immutable boundary avoids discarding or duplicating work
while an atomic pack is still preparing.

Free's runtime allowance is fixed at 10 even if the entitlement row is briefly
stale during a migration-first rollout. The database migration remains required
to expand an already-created three-slot feed and keep persisted plan metadata
consistent.

The complete-pack reliability path has these format-specific safeguards:

- a preview-ready active Wall assignment is returned before old Wall creative
  inventory is checked for a stale generator version; historical v6 rows must
  not hide a current v7 assignment;
- the internal Wall preparation route accepts the immediately previous worker
  payload by defaulting a missing requested count to six and deriving the same
  stable legacy request key as the worker, so app/worker rolling deployments do
  not turn valid jobs into HTTP 400 failures;
- Hook generation requests at least six source candidates and may persist the
  validated subset when one candidate exhausts review and repair. A later
  idempotent refill fills any remaining Hook slot instead of failing the whole
  batch because one source was rejected; composition generation still requires
  its complete candidate contract;
- Structure 1 remains fail-closed and atomically transfers an untouched batch
  to Structure 2 after two planning failures. Structure 2 uses its dedicated
  LLM batch plus one isolated LLM repair for a structurally invalid item. If
  that repair still fails the publishing contract, the batch fails; it never
  substitutes authored runtime story copy.

Hook and Wall preparation share the AI-generation Cloud Tasks queue but are
independent jobs. The queue permits four concurrent deliveries, and the Cloud
Run AI-generation service may scale to four one-request instances so those
formats are not serialized behind one another or behind an unrelated AI job.
Carousel keeps its separate controlled-batch queue and worker boundary. Every
Cloud Run worker profile sets an explicit worker ID containing service name,
release version, and Git commit so a failed `background_jobs` row identifies
the deployed revision instead of an ambiguous container hostname.

### 2026-08-20 unified combined-feed architecture

The source implementation now treats Carousel as one format inside a single
persisted daily Trending allowance alongside Wall-of-text and Hook Video. This
is a source decision and must not be described as deployed until migration
`20260820084842_create_unified_daily_trending_feed.sql`, the Next.js release,
and the background workers are verified in production.

The stable billing keys are intentionally retained while their visible plan
names and combined daily limits change:

- no active paid-plan row -> **Free** -> 10 combined posts per user-local day,
  fixed at 3 Slideshow / 4 Wall-of-text / 3 Hook;
- `pro` -> **Starter** -> 20 combined posts per user-local day;
- `creator` -> **Growth** -> 50 combined posts per user-local day;
- `ultra_pro` remains an inactive legacy entitlement and is not assigned to
  new users.

Do not migrate existing user plan keys merely to make the labels appear more
intuitive. Runtime entitlement resolution and pricing display must use the
exact mapping above.

The paid-plan default daily mix is 25% Carousel, 50% Wall-of-text, and 25% Hook Video.
Each format may range from 0% to 100%; all three integer percentages must total
exactly 100%. Largest
remainder allocation produces whole posts. Starter therefore receives
5 Carousel / 10 Wall / 5 Hook by default. Growth receives
13 Carousel / 25 Wall / 12 Hook. Keeping the half-post remainder on Carousel
allows the default Hook allocation to fit one validated twelve-candidate worker
batch instead of serializing a second AI job for one slot; the total remains 50.

Migration `20260820084842_create_unified_daily_trending_feed.sql` adds:

- `subscription_entitlements.daily_trending_limit`;
- server-only `trending_content_mix_preferences`;
- one `daily_trending_feeds` snapshot per `user_id + local_date`;
- exactly 10, 20, or 50 ordered `daily_trending_feed_slots` rows; and
- service-role-only planning, assignment, mix-save, unbound-replan, and slot
  completion RPCs protected by advisory locks.

The slot list is the cross-format source of truth. Slots are allocated and
interleaved before content is attached, so the frontend must order by the
persisted slot position rather than grouping formats into blocks. Only a ready
assignment may attach to its matching reserved format. Assigned or decided
slots are immutable for that day.

A successful left or right decision retires exactly one reserved slot. It must
never create a replacement on the same local day. After all 10, 20, or 50 slots are
decided, the correct state is caught up until the next local day. Background
preparation fills only still-unbound slots; it is started during onboarding,
the daily sweep, an Adjust save, or safe GET recovery, and it must never clear
already visible items.

The content-mix API stores owner-scoped preferences for every plan separately.
Once a daily pack exists, saving a new mix does not replan any of its positions, including
`planned` or `failed` unbound slots. The preference applies on the next local
day. A saved 0% for a format does not hide that format's posts that are already
reserved today.

The older `daily_carousel_feeds` and `daily_carousel_feed_items` tables remain
an internal Carousel inventory source during this migration. They are not the
user's combined daily limit and must not control visible cross-format ordering.
Their internal ceiling may be raised when a Growth allocation needs 12 or 13
Carousel assets, but surplus inventory is not exposed outside the unified
slots.

The remainder of this section documents the older Carousel-only feed layer and
its still-relevant inventory, completion-evidence, worker, and rollout rules.

As of 2026-07-16, Trending has a server-backed daily feed layer. The
frontend should not treat the generic carousel history endpoint as the product
feed. It now requests:

```text
GET /api/trending/feed?timezone=<iana-timezone>
```

The route uses Firebase bearer authentication, keeps Firebase UID as the user
ID, resolves the user's local date from the browser-supplied IANA timezone, and
creates or returns one persisted feed for:

```text
user_id + local_date
```

The schema foundation is migration
`20260712173000_create_daily_carousel_feeds.sql`. It creates:

- `subscription_entitlements`
- `user_subscription_plans`
- `user_carousel_assignments`
- `daily_carousel_feeds`
- `daily_carousel_feed_items`

Migration `20260717100000_add_daily_carousel_replenishment.sql` adds
`daily_carousel_refill_batches`, the persisted profile timezone, daily-origin
and availability metadata on `carousel_generations`, batch-local candidate
uniqueness, idempotency keys for background jobs, and a delivery timestamp used
to lease Carousel Cloud Tasks redelivery attempts. It also adds the singleton daily
replenishment sweep checkpoint and service-role-only claim/advance RPCs.

Default entitlement rows are `pro` with 10 daily carousels and `ultra_pro` with
20 daily carousels. The frontend must read `dailyCarouselLimit` from the feed
response and must not hardcode plan limits.

The daily limit is an inventory target, not a one-time lifetime batch. On each
new user-local date, the feed must:

1. recover only an assignment already created for that same date but not yet
   attached because an earlier request stopped between durable writes;
2. assign already-ready, unassigned eligible inventory;
3. count viable unassigned processing inventory; and
4. reserve and enqueue only the remaining shortfall to the persisted daily
   limit.

Examples for a daily limit of ten:

- ten completed yesterday -> generate ten for the new day;
- five current-day assignments already attached -> generate five;
- no current-day assignments -> generate ten.

Completing an item does not refill its occupied position during the same local
day. The shortfall is calculated only against a new day's feed. Daily refill
reservations are idempotent per persisted feed and business-profile version,
and failed reserved candidates may extend that refill batch only after the
15-minute repair cooldown. Daily generation indexes are batch-local so worker
selection cost does not increase indefinitely as a profile accumulates daily
history.

Visible feed-item insertion and daily refill reservation both validate the
current `business_profiles.profile_version` inside service-role RPCs before
committing user-visible rows or reserving new generation work. A stale request
from an older business profile version must stop before enqueuing refill work
for that obsolete version.

Ready inventory is paged by a stable `created_at + id` cursor until the
required viable count is found or history is exhausted; assigned or failed
newer rows must never hide older valid unassigned inventory. Duplicate
rejection fingerprints ordered user-visible headline, supporting text, and CTA
copy only. Internal category and angle labels are not part of that identity.
New fingerprints are version-prefixed, and the feed recomputes visible-copy
fingerprints in memory for pre-release assignment rows so existing production
history remains compatible with the corrected duplicate rule.

An existing daily feed is read without rewriting its persisted feed row. Its
plan and daily limit are a snapshot for that local day. If the feed has fewer
items than that persisted limit, later GET requests append newly ready items to
the remaining positions. A partial feed therefore fills as existing generation
work completes instead of freezing after its first non-empty response.

If one or more unassigned slots reach a terminal failure while other cards are
ready, the response keeps `feed.state: "ready"` and preserves those ready cards,
but also exposes its public failure state and a visible **Retry missing** action.
That action is the only browser path that adds `retryFailed=1`; it reopens only
the failed, unassigned slots through `restart_failed_daily_trending_feed_slots`.
It must never clear, replace, or automatically retry ready content.

The response exposes `feed.state` with these values:

- `ready`: at least one runtime-safe active carousel is available and no
  unfinished slot is waiting on a processing generation.
- `preparing`: the feed has an unfinished slot and at least one generation for
  the current profile version is genuinely processing.
- `caught_up`: the user completed the available assignments and there is no
  generation work to poll for.
- `exhausted`: no runtime-safe active carousel or processing inventory remains.

The frontend polls every six seconds while `feed.state` is `preparing`. If a
feed still has unfilled positions but no active processing job, it uses a
one-minute repair poll so an open tab discovers scheduler recovery without a
tight permanent loop. Empty exhausted and caught-up feeds must not be inferred
as genuinely processing. Before an unfinished assignment is carried into a new
local day, its generation is revalidated as complete and strict runtime-safe;
invalid carries are marked failed and their slots are offered to valid carries
or newly ready unassigned carousels.
If concurrent population requests create an active current-day assignment
before one feed-item insert loses a uniqueness race, the next top-up recovers
that unpersisted assignment before claiming another fresh carousel.

Completion is recorded through:

```text
POST /api/trending/feed/actions
```

Allowed completion actions are:

- left swipe succeeds -> `completed_skipped`
- right swipe + Library save succeeds -> `completed_saved`
- right swipe + a timed platform schedule succeeds -> `completed_scheduled`

Changing between slides, opening a card, closing the page, cancelling the
right-swipe modal, or failing a save/schedule request must not complete an
assignment.

The actions API enforces this completion evidence server-side. `saved`
requires an owner-scoped, non-deleted `generated_carousel` Library item for the
assignment's carousel. `scheduled` additionally requires an owner-scoped
`scheduled_posts` row linked to that Library item in a usable non-draft state.
Same-action retries are idempotent; conflicting completed actions return 409.
Trending creates or reuses the schedule record as an idempotent internal draft
only when the user submits the inline scheduling modal. Account selection or
draft creation alone is not completion. The assignment is recorded as
`completed_scheduled` only after the user chooses an exact account and time and
provider scheduling succeeds; this is still not a claim that the provider has
published the post yet.

The first feed layer only reused completed carousel generations that already
existed for the current business profile. The 2026-07-17 source slice adds the
missing daily refill ledger, batch-local generation identity, lazy feed
reconciliation, persisted user timezone, open-tab local-date refresh, and a
signed internal replenishment route. The active cycle ID and last successful
UUID cursor are persisted in Supabase. A retry, timeout, or later scheduled run
claims that active cycle and resumes from its saved cursor; only after
completion may a new scheduled cycle start. Cursor advances use a locked
compare-and-set RPC, so a response is never allowed to silently overwrite a
newer checkpoint. Completed cycle timestamps are monotonic: an older or equal
delayed retry is an idempotent no-op and cannot replace a newer completed
sweep. A failed profile is logged and counted without preventing later profiles
in that sweep. Each page calls a HMAC-authenticated Next.js route. It only
reserves generation rows and sends the normal background worker jobs; the
Carousel worker remains the only live LLM, matcher, Sharp render, storage, and
completion path. Queued or stale-processing Carousel jobs are redelivered after
the worker's 30-minute reclaim boundary using the same background-job ID. An
atomic database delivery lease prevents six-second frontend polling or
concurrent scheduler requests from flooding the queue, and the worker's atomic
claim prevents duplicate delivery from causing duplicate LLM/render execution.

A business-profile update does not remove Carousel assignments already placed
in that day's feed. Existing positions remain the day's delivered snapshot;
any still-empty positions use a refill reservation for the new profile version.
Feed-item insertion locks and rechecks the selected business-profile version in
the database transaction. If the profile changed after selection, no stale
assignment may enter an empty position; only assignments created by that losing
attempt are invalidated, and the caller retries against the latest profile.
This source behavior must not be described as deployed until the migration,
Vercel release, replacement scheduler, and running Carousel worker are all
verified.

Daily-refill production rollout order is database migration first, then verify
the Carousel worker has desired and running count one, configure the dedicated
`UGC_INTERNAL_CAROUSEL_SECRET` wherever the scheduler replacement runs with
`APP_BASE_URL=https://www.getugcpilot.com`, deploy Next.js, run a one-user
production canary, and enable the replacement schedule last. The GCP scheduler
replacement lives in `infra/gcp/carousel-scheduler`: Cloud Scheduler starts a
Cloud Run Job that runs `dist/scheduler/replenish-daily-carousels.js`, signs the
internal replenishment route, and pages until the sweep cycle completes. Keep
that scheduler paused until the Cloud Run Job has been manually executed and
verified. Do not copy `.env.local` or expose the Supabase service-role key
merely to use the signing fallback.

As of 2026-07-18, the first GCP worker image for this path is in Artifact
Registry:
`us-central1-docker.pkg.dev/ugcsaas/ugc-worker/ugc-worker:worker-gcp-20260718111431`.
Terraform has applied Cloud Run Job `ugc-carousel-replenishment` and Cloud
Scheduler job `ugc-carousel-replenishment-quarter-hour`, and the scheduler is
paused. The automatic GCP replacement schedule is not live until that scheduler
is explicitly unpaused.

Later on 2026-07-18, the first two manual Cloud Run executions failed with
HTTP 401 because the deployed Vercel production route had an old invalid
`UGC_INTERNAL_CAROUSEL_SECRET` value. The Vercel production environment value
was updated to match GCP Secret Manager and the current production deployment
was redeployed. Manual execution `ugc-carousel-replenishment-ckb6c` then
completed successfully with one page, 3 processed profiles, and 0 failures.
The Cloud Scheduler job remained paused after the canary.

Historical note: the following 2026-07-18 Pub/Sub canary and AWS comparison
record is retained only as migration evidence. Both transports are retired;
the current implementation uses Cloud Tasks, Cloud Run, Supabase, and GCS.

The generic GCP Pub/Sub worker canary was validated. Terraform applied
Cloud Run Job `ugc-worker-canary-test` from `infra/gcp/worker-canary`, running
`test_worker_job` against `ugc-media-processing-sub` with
`WORKER_QUEUE_PROVIDER=gcp`. Early executions with `WORKER_POLL_WAIT_SECONDS=0`
exited before Pub/Sub returned messages, so the canary now uses a 10-second
pull wait. Final execution `ugc-worker-canary-test-bbd2b` completed Supabase
background job `24391910-4824-42a3-b432-2ff31f6bf775` with output worker
`gcp-cloud-run-job`.

The dedicated GCP Carousel worker profile is now deployed and verified.
Because a real queue consumer must keep running, the profile uses Cloud Run
Service `ugc-carousel-worker` from `infra/gcp/carousel-worker`, not a one-off
Cloud Run Job. The worker image
`us-central1-docker.pkg.dev/ugcsaas/ugc-worker/ugc-worker:worker-gcp-20260718142523`
includes a `/healthz` listener for Cloud Run startup checks while the same
process keeps polling Pub/Sub. The service runs with one internal always-on
instance, `WORKER_QUEUE_PROVIDER=gcp`, `WORKER_JOB_TYPES=generate_carousel`,
`WORKER_PUBSUB_SUBSCRIPTION=ugc-carousel-sub`,
`CAROUSEL_BROAD_MATCHER_MODE=dry-run`,
`CAROUSEL_DISABLE_CATEGORY_FALLBACK=true`, and `STORAGE_PROVIDER=gcp`.
Generated Carousel slides now use
`https://storage.googleapis.com/ugcsaas-media`, and `gs://ugcsaas-media` has
public object read enabled for the testing-phase GCP media cutover.

The real GCP Carousel generation smoke test on 2026-07-18 completed Carousel
`433cf650-3a79-4f00-a6d4-b1107f38b785` from Supabase background job
`ad451643-fdee-4e1f-93ce-ef925762584d` and Pub/Sub message
`19919982775905874`. Cloud Run logs showed message receipt, content planning,
image matching, text-containment validation, and job completion. The smoke
script verified 5 rendered slides and downloaded the GCS public URLs. This
validated the GCP Carousel worker path at that time. The current application
is GCP-only and ignores alternate queue-provider values.

The scheduler only includes profiles with a persisted Trending timezone. The
first authenticated browser feed request records the user's IANA timezone and
also performs lazy reconciliation immediately. Treating an unknown timezone as
UTC in the background sweep is forbidden because it can pre-create a feed for
the wrong user-local date; after the first visit, the scheduled sweep keeps that
profile replenished without requiring the tab to remain open.

Semantic near-duplicate concept rejection and deliberate visual-preset rotation
remain follow-up work.

## Readiness and Sourcing

Readiness is diagnostic in the current product phase. It must not block normal
generation while an approved safe profile fallback exists.

Readiness levels per required broad bucket:

- 20 approved object-only assets: internal canary minimum
- 40 approved object-only assets: beta minimum
- 60-100 approved object-only assets: production target

Forty is a minimum, not a cap. Keep every approved safe surplus asset.

Sourcing model:

1. Fetch 80-120 Pexels candidates per batch when a pool needs a top-up.
2. Store new candidates as unreviewed and non-selectable.
3. Generate a contact sheet and review manifest.
4. Manually approve only strict object-only assets.
5. Preserve exact reject reasons such as human, face, hand, duplicate, or low
   quality.
6. Keep all approved safe assets; never trim a pool back to 40.
7. Repeat controlled top-ups until the desired readiness level is reached or the
   configured attempt limit is reached.

Contact sheets should show:

- broad bucket as the primary label
- legacy narrow bucket as secondary history
- content, object, and mood tags
- source query
- review status and reject reason

Readiness reports should include candidate, approval, rejection, duplicate,
minimum target, surplus, and status counts. Readiness warnings should be logged
and returned diagnostically, not converted into a user-facing 409 solely because
the ideal image count was missed.

## Feature Flags and Rollout

Use:

```text
CAROUSEL_BROAD_MATCHER_MODE=off|dry-run|enabled
CAROUSEL_DISABLE_CATEGORY_FALLBACK=true
```

- `off`: legacy matcher selects images.
- `dry-run`: legacy matcher still selects; broad matcher runs in shadow and logs
  comparisons.
- `enabled`: broad matcher selects; legacy output may remain as shadow telemetry
  during rollout.

Safe rollout:

1. Local dry-run using Marketing SaaS.
2. AWS dry-run/shadow logs.
3. Compare safety, relevance, fallback, and duplicate behavior.
4. Enable for a small Marketing SaaS canary.
5. Run visual render canaries.
6. Expand to Productivity SaaS, Fitness Health, Wellness, Beauty Skincare, and
   Generic Business after each profile passes its own validation.

Do not deploy a worker merely because local code changed. Build, publish, update
the ECS task/service, and verify worker version, git commit, safety policy, and
matcher version in logs.

## Content and Rendering

Website analysis provides business context. The Carousel planner uses an LLM
(`gpt-4o-mini`, pinned in source for both Structure 1 and Structure 2) to create
structured slide content and visual intent. A stale deployment model variable
cannot silently split the two Carousel writers across models.
Worker startup metadata records the planner mode/version and whether the OpenAI
secret is configured. This proves runtime capability, not a successful model
call; acceptance of a generated carousel must also verify its persisted
planner source/model provenance.

The planner supports varied text modes rather than forcing a headline and body
on every slide. Rendering is performed with Sharp in the worker. Text must be
rendered into the final image with measured typography, safe wrapping, fixed
44px type, proper padding, and no heading-pill overflow. Adaptive font sizing is
reserved for Wall-of-Text and must not be introduced into either Carousel
structure.

Balanced carousel copy rules:

- A heading or hook is optional. When present, it must be 3-16 words, at most 100
  characters, use no more than four visual lines, and must not be forced into a
  single line by over-shrinking.
- Slide 1 supporting content must be one complete sentence of 8-40 words, at
  most 240 characters, and fit within eight visual lines. Supporting content
  on Slides 2-5 may use 8-50 words, at most 300 characters, and must fit within
  ten visual lines. Each body explains one specific idea and avoids repeating
  the heading. List items may use up to two visual lines each, with an
  eight-line total group cap.
- Previously generated legacy rows without a reserved content format retain
  their stored five-slide Hook, Problem, Consequence, Solution, and Result/CTA
  story for read/edit compatibility. The planner no longer creates that legacy
  story. New automatic Trending rows use the exact five roles defined by their
  reserved V1 content format, while retaining the existing coarse slide types
  for renderer and matcher compatibility.
- The renderer is the final source of truth for line limits. It must wrap using
  the production font stack, actual font size, available width, padding, and
  card dimensions, then keep headings to at most four rendered lines, Slide 1
  body text to at most eight rendered lines, and body text on Slides 2-5 to at
  most ten rendered lines.
- A headline and its supporting copy remain two distinct text groups. Structure
  1 renders every actual headline group over one measured white SVG background
  with dark text. Its supporting body, list, and CTA groups remain ordinary
  white SVG text directly on the image. Structure 2 has no separate headline
  field, so its story and CTA groups remain direct white text with no white SVG
  background.
- Both structures retain measured wrapping and safe-area containment. Direct
  white text uses a restrained dark outline for legibility; headline text never
  shrinks, truncates, adds an ellipsis, or substitutes fallback copy.
- JSON/schema validity, the backend-selected format, exact slide order and
  roles, required fields, renderer character limits, product timing, prohibited
  visual subjects, and unsupported/prohibited claims are publishing gates.
  A failing item may receive one isolated LLM repair; a second failure remains
  failed instead of receiving hardcoded replacement copy.
- Word-count minimums, perspective quality, CTA phrasing, generic wording,
  grammar style, headline/body overlap, and recent repetition remain prompt
  guidance and persisted advisory diagnostics. Structure 1's absolute body
  maximum is a publishing gate: 40 words on Slide 1 and 50 words on each of
  Slides 2-5. These rules do not rewrite accepted AI copy.
- The application does not run a hardcoded post-LLM copy normalizer. Accepted
  headline, body, list, story, and CTA strings are preserved apart from the
  whitespace normalization required to parse and render their JSON fields.
- Object-only safety validation treats clock and watch hands as object parts,
  while continuing to reject human hands and other prohibited human subjects.
- Unsupported-claim validation rejects unsubstantiated quantified social proof
  and money/revenue/profit/sales/conversion outcomes, plus CamelCase product or brand
  names that do not appear in the stored website analysis.
- CTA commands that introduce a capitalized product name must use a name found
  in the analysis. `businessName` remains authoritative for named products and
  quantified social proof remains an unsupported-claim blocker when the saved
  analysis does not support it.
- Every generation stores raw initial/repair LLM responses, the normalized
  plan, planner version/model/source/fallback reason, validation result, and
  renderer version on `carousel_generations`.

### 2026-08-10 Automatic Content Grammar V1

- This architecture reuses the one onboarding `business_profiles` row. The
  authoritative automatic-generation input is that row's current
  `context_json`, loaded by exact profile ID, Firebase owner, and
  `profile_version`; the linked `website_analyses` row remains provenance and
  a legacy/manual fallback. It does not create a second business profile, a
  parallel analysis table, a copied profile snapshot, or another onboarding
  flow. A stale profile-version job stops before completion instead of silently
  generating from old context.
- The current profile analysis is converted deterministically into controlled
  audience, customer-problem, customer-goal, and topic options. Stable option
  IDs let the model choose among supplied facts without inventing a new profile
  or starting another analysis request.
- Versioned JSON is the source of truth for 15 five-slide content formats and
  10 hook families in `worker/src/lib/carousel-config/formats.json` and
  `worker/src/lib/carousel-config/hook-families.json`. The configuration is
  validated at worker startup and fails closed on unknown IDs, invalid modes,
  incompatible hooks, or a format that is not exactly five slides.
- Before an automatic generation job is dispatched, the backend reserves one
  content-format ID and one compatible hook-family ID on the existing
  `carousel_generations` row. Selection is deterministic for a profile batch,
  preserves an existing reservation on retry, and scores recent usage to avoid
  immediate repetition across the ten candidates.
- `carousel_generations.format` continues to mean the canvas ratio such as
  `4:5`. Content structure is stored separately in `content_format_id`; do not
  overload or rename the ratio field.
- A compact snapshot of at most ten prior content summaries is stored with the
  reservation. It contains only format, hook family, hook, topic label/stable
  topic ID, and angle summary fields needed for retry-stable repetition checks;
  it never copies complete prior slide plans.
- Immediately before planning, the worker combines that reserved history with
  already-planned siblings from the same generation batch and persists the
  resulting compact ten-item snapshot. The current dedicated GCP Carousel
  worker remains limited to one instance with request concurrency one, so
  sibling planning is serialized and each later candidate can see earlier
  planned ideas. Do not increase either limit until same-batch idea reservation
  is made atomic in Postgres.
- The planner receives exactly one reserved format, one compatible hook family,
  the controlled profile options, and the compact recent-history snapshot. One
  normal LLM request creates one complete carousel. A single LLM repair request
  is allowed only when the first result fails a publishing gate. The writer
  never falls through to authored runtime copy.
- Automatic V1 output is always exactly five slides. Each slide stores its
  format-specific role while retaining the existing coarse `slideType` and
  `textMode`, so current image matching and rendering remain compatible.
- The final slide is a practical takeaway. A soft CTA is optional and must not
  be forced when it would weaken the content.
- Precise nutrition, calorie, protein, percentage, currency, time, audience,
  or performance numbers must be present in the saved analysis evidence. The
  planner rejects invented exact numbers; a calorie-tracking business may use
  formats such as Checklist, How-To, Swap, Comparison, or Myth vs Fact without
  fabricating nutritional values.
- Recent-topic validation uses the stable controlled topic ID as well as the
  compact topic label. Repetition remains a selection and writing signal, and
  is persisted as an advisory diagnostic rather than replacing usable AI copy.
- Object-only image safety, manual-review authority, matching policy, rendering,
  and scheduling boundaries are unchanged by the content-grammar slice.
- The V1 schema, selector, planner, app, worker, tests, and this architecture
  record are local worktree changes as of 2026-08-10. They are not deployed or
  production-verified until the additive migration is applied, app and worker
  revisions are released, and the authenticated production Trending flow is
  checked on `https://www.getugcpilot.com`.

The renderer must avoid fake app UI:

- no role chips
- no CTA buttons drawn as controls
- no unnecessary white boxes
- no dashboard-like components

The frontend displays already-rendered slide URLs and should not reconstruct the
slide typography.

## Current Live Architecture

```text
Frontend
  -> Next.js API route (thin controller)
  -> Supabase generation/job metadata
  -> GCP Cloud Tasks
  -> private Cloud Run worker
  -> LLM slide plan + safe image matcher + Sharp renderer
  -> GCS rendered slides
  -> Supabase slide/generation status
  -> Frontend polling and candidate/slide navigation
```

Supabase stores analysis, assets, durable job state, generation metadata, and
slide metadata. GCS stores source assets and rendered slides. Pexels is used
for controlled library sourcing, not for ad hoc unsafe selection during a live
render. Cloud Tasks is the only Carousel delivery queue; the worker runs on
Cloud Run.

Core tables:

- `website_analyses`
- `category_image_assets`
- `carousel_generations`
- `carousel_slides`
- `library_items`
- `library_carousel_slides`

## 2026-07-27 Frontend Presentation Rollback

- At the user's direction, the production-facing pages, components, and UI
  assets were restored to the last known old production presentation at Git
  commit `b874cc9`.
- This is a frontend-only rollback. The newer API routes, server libraries,
  tests, database migrations, worker logic, and GCP infrastructure remain in
  place.
- The old production light palette remains authoritative:
  `--background: #fcfbfa`, `--foreground: #17171b`, and
  `--primary: #c94716`.
- Later Trending, Analytics, AI Studio, Settings, and navigation presentation
  changes must not be treated as live after this rollback unless they are
  deliberately reintroduced and verified in production.

## Trending Carousel Outputs

As of 2026-07-25, the approved product target is one owner-scoped Trending
feed containing preview-ready completed Carousels, Hook videos, and
Wall-of-text videos in one Tinder-style deck. Users must not choose a format
before browsing. The side-by-side "Remixed from" reference preview is a future
feature and is not part of the current implementation.

The first implementation slice adds a format-independent `TrendingFeedItem`
contract and provider orchestration in `lib/trending/feed-items.ts`.
`GET /api/trending/feed` now returns unified `items` and provider availability
alongside the legacy `carousels` field for compatibility. Only completed
Carousel assignments whose full slide set has usable rendered URLs are adapted
into `format = carousel`, `readiness = preview_ready` items. Processing and
failed assignments remain in the legacy lifecycle data used by the existing
preparation and error states; they do not enter the unified deck. The Carousel
matcher, renderer, storage, save, scheduling, and completion paths remain
unchanged.

Hook feed items use a separate Hook text payload and become preview-ready when
the protected short source video, business-profile-generated Hook text, source
duration, and trim values are all available. A product demo is intentionally not
part of the Trending Hook card. A right swipe carries that exact Hook text and
source video into product-demo selection. The unified deck contains ready
Carousel, Hook, and Wall-of-text items and the former Carousel/Hook mode
selector is removed. Items are grouped by format in this fixed display order:

1. All Wall-of-text videos.
2. All Hook videos.
3. All Carousels.

Persisted feed position orders items only within its own format group. The
backend and frontend use the same shared comparator so the page cannot
accidentally restore interleaving.

Text data must not be flattened into one generic `text` field across formats:

- Carousel content remains slide-specific: ordered headline, subtext, slide
  type, and CTA semantics.
- Hook content is one short business-profile-generated overlay with
  duration-aware readability limits and Hook-specific placement/style metadata.
- Wall-of-text content is one continuous text value with its own validation and
  full-overlay layout rules. It has no separate headline, body, or closing
  fields.

The shared feed owns only common assignment, position, readiness, and format
metadata. Each format keeps separate generation, validation, persistence, and
rendering rules.

Wall-of-text preparation is implemented behind
`POST /api/trending/wall-text/feed/prepare`. Preview-ready Wall creatives are
included in the unified feed. The preparation path:

- selects only active, analyzed, 9:16 video rows from the shared
  `overlay_media_assets` catalog;
- prefers low-usage videos and avoids the caller's recently prepared
  backgrounds when fresh inventory exists, while allowing safe reuse rather
  than failing when the catalog is small;
- generates one continuous Wall-specific text value from the caller's current
  business profile;
- applies deterministic full-overlay layout metadata rather than asking the
  text model to invent placement;
- stores generated, owner-scoped `wall_text_creatives` and
  `user_wall_text_assignments` without duplicating the shared source video; and
- validates current business-profile ownership/version and source readiness in
  the database before a candidate can be persisted.

Migration `20260726100000_create_trending_wall_text_creatives.sql` adds those
generated creative and assignment layers. Assignment insertion increments the
shared source asset's global usage counter atomically. Browser clients have no
direct table privileges; the authenticated server route owns preparation.

The source catalog remains storage-provider neutral at runtime. Wall
preparation reads the source key/URL metadata produced by the configured media
upload path and contains no fixed GCS bucket, GCP hostname, S3 bucket, or
CloudFront hostname. Source upload tooling and final MP4 export remain separate
from feed preview.

- The feed receives the real ordered slide records for every returned candidate,
  including `renderedUrl`, slide number, type, text metadata, and status.
- Processing and failed generations keep their real lifecycle state; they are
  not represented as template artwork.
- Pending generations use one dark 9:16 post skeleton in the exact first-card
  position. The skeleton has no readable placeholder content, no slide dots,
  and no Carousel stack. It uses a restrained pulse and is replaced in place
  by the first preview-ready item. Never render one lifecycle card for every
  pending candidate. Failed candidates use one aggregate retry state rather
  than a wall of repeated failure cards.
- Generated candidates appear in a focused Tinder-style deck. One complete
  carousel candidate, including all five slides, is one outer deck card. Never
  flatten slides into the outer deck.
- The deck renders the active candidate plus at most the next two candidates.
  Background candidates are vertically offset, slightly smaller, less opaque,
  and non-interactive. The deck stops at the first and last candidates rather
  than looping or deleting an item after a swipe.
- Dragging the active card left selects the next complete carousel. Dragging it
  right opens the action choice dialog for the active carousel with Save to
  Library and Schedule Post options. Keyboard left/right navigation remains for
  accessible browsing between complete ideas. These interactions are local
  frontend state and must not refetch history.
- The active card may rotate by at most five degrees while dragged and exits in
  the swipe direction before the next candidate becomes active. Reduced-motion
  users get an immediate state change. Inner controls must be excluded from the
  outer pointer gesture at pointer-down time.
- The active Carousel card is approximately 270px wide and capped for narrow
  mobile viewports. This keeps it visually closer to the 230px Hook and
  Wall-of-text cards while retaining readable 4:5 slides. All slides for the
  active candidate and the selected slide of the next candidate are preloaded
  when the active candidate changes.
- Every candidate owns its own active-slide state. The centre card renders only
  that candidate's active slide; its left/right controls and five dots are
  positioned inside the image card and move only through that candidate's five
  slides. The dots, controls, and image must not create a wide three-slide
  strip or show neighboring slides from the same carousel. Background deck
  cards never expose slide controls, and a candidate's selected slide is
  preserved when the user leaves and returns.
- Completed carousel decks do not render a title, lifecycle badge, Generate
  action, idea counter, or Previous/Next idea controls below the card. Keep the
  deck visually focused and navigate complete ideas through swipe or keyboard.
- The right-swipe action dialog is the only post-swipe action surface on
  completed carousel cards. Save to Library calls the authenticated
  `POST /api/library/carousels` route with only the `carouselId`. The server
  verifies Firebase ownership, confirms the generation is completed, loads the
  ordered ready slides, and saves one Library parent item with ordered child
  slide rows. Duplicate saves return the existing Library item. After a
  successful save, Trending stays on the page, shows a View Library action, and
  advances to the next complete carousel. Schedule Post must use a
  server-backed Library item and the server scheduling API, then complete the
  account, optional-caption, provider-setting, and time flow inside the modal
  on Trending. Only the final successful scheduling call advances the deck.
  Browser-local scheduling drafts are no longer the intended persistence path.
- The Carousel Library lists only owner-scoped server Library items. The legacy
  global browser key `ugc-studio.carousel-library.v1` is not read, merged,
  scheduled, deleted, or automatically imported. Those old records have no
  trustworthy owner identity, so attaching them to whichever account is
  currently signed in would risk cross-account data exposure.
- Trending is the only visible Carousel product surface in the app. Clicking an
  image, slide, dots, or slide arrows must never open a separate Carousel Ads
  workspace.
- Trending must show a clear profile-needed, preparing, ready, caught-up,
  exhausted, or failed/retry state. It must never fall back to static template
  artwork or label a terminal empty feed as preparing.
- Trending must not expose `All`, `Video`, `Avatar`, or `Image` format tabs,
  and it must not render template/inspiration cards.
- The standalone `/carousel` Carousel Ads workspace is removed from the visible
  product. Do not reintroduce that route, link to it, or use it as a fallback
  destination unless a new product decision explicitly restores it.
- New website analyses, initial Carousel generation, and additional candidate
  generation require Firebase authentication so their stored `user_id` matches
  the owner used by the Trending feed.
- Carousel status reads require Firebase authentication and are limited to the
  owner of the requested candidate or generation batch.
- Existing legacy rows owned by the former test user are intentionally not
  re-assigned by this frontend slice. Migrate them explicitly only after the
  intended owner is confirmed.

## Hook Video Source Status

As of 2026-07-25, Hook Video source and scheduling/library building blocks exist
in the repository. A raw catalog or owner-uploaded influencer clip remains a
source asset. A unified Trending Hook item is the protected short video plus
Hook-specific text generated from the caller's current business profile,
variable source/trim duration, and a stable owner-scoped assignment. It does not
contain a product demo.

Migration `20260728183858_add_trending_hook_ideas.sql` adds a `trending`
suggestion context to the Hook-specific suggestion table and a separate
`user_hook_video_assignments` exposure layer. Existing `composition`
suggestions remain demo-specific. The two text-generation contexts are not
interchangeable.

The Hook videos product flow, when enabled from an approved surface, is:

1. Browse real catalog or owner-uploaded influencer videos. Influencer and video
   list APIs return display metadata only; they never expose source storage keys
   or source video URLs.
2. Trending Hook text is generated before browsing from the saved business
   profile only. It is constrained by the selected source video's real trimmed
   duration; there is no hard-coded five-second assumption.
3. A left swipe records a Hook-specific skip and moves to the next mixed feed
   item. A right swipe opens composition with the same source video and Hook
   text already selected, but opening or closing that reversible composer does
   not complete the Hook assignment. The Hook is recorded as selected only
   after Save to Content succeeds or after a real schedule and render request
   succeeds. These interactions do not mutate a Carousel assignment.
4. Product demos come only after a right swipe, from the caller's Content
   Library or a new owner upload saved into that Content Library. The durable
   Content record is `demo_videos`; its ready `media_assets` row with
   `source_type = demo_upload` is an internal composition projection, not
   Creative Assets membership. The first screen shows only `Upload demo video`
   and `Choose existing`; Content demos are fetched and displayed only after
   the user opens the existing-demo picker. Selecting or uploading a demo moves
   a prefilled Trending Hook directly to Review. Save and Schedule remain final
   composition actions.
5. The product must not fabricate demo, influencer, or Hook records when real
   inventory is empty.
6. The legacy `POST /api/trending/hook-videos/suggestions` composition path
   authenticates the Firebase user,
   verifies ownership of the selected sources, requires the user's persisted
   business profile, calls OpenAI server-side with structured output, and stores
   the returned suggestions. Static or random suggestion text is forbidden.
7. Review previews the opening and demo separately, overlays the selected hook,
   and allows trim changes only for the opening clip. Save persists an
   owner-scoped Hook video draft for Content. Schedule persists or reuses the
   same reviewed selection, creates a real `scheduled_posts` draft, and opens the
   Scheduling workspace with that exact draft ID.
8. Hook ideas are part of the daily Trending allowance. The server-only
   `TRENDING_HOOK_VIDEOS_ENABLED` variable may be set to `false` as an emergency
   kill switch; `true` or a missing value keeps Hook preparation enabled.

Protected influencer playback uses a five-minute, HTTP-only, same-origin preview
session. The preview route revalidates the signed video, influencer, source, and
user claims before streaming the S3 object and does not return the underlying
source URL to the browser. Production should set a dedicated
`HOOK_VIDEO_PREVIEW_SECRET`.

Migration `20260717143000_create_hook_video_drafts.sql` adds the service-role-only
`hook_video_suggestions` and `hook_video_drafts` tables. Migration
`20260717150000_index_hook_video_foreign_keys.sql` adds the supporting foreign-key
indexes. Both tables use RLS with no browser-role policies; Hook APIs perform
Firebase ownership checks and use server credentials.

The combination renderer receives the verified opening and demo assets, opening
trim values, selected hook text, and a composition fingerprint. It trims only the
opening segment, burns hook text only into that opening, normalizes both segments,
and concatenates opening then demo. The fingerprint includes both asset versions,
trim values, hook text, and ratio so a changed composition cannot reuse a stale
combined render.

This Hook videos behavior is implemented and locally validated in the current
source. Do not describe the app or video-render worker behavior as deployed until
the corresponding Next.js and worker releases are pushed and verified.

## Business Profile Automation

As of 2026-07-10, Carousel generation is business-profile-driven, not
Generate-button-driven.

1. One Firebase account has one business profile for the current product phase.
   `project_id` remains an internal default reference; no project selector is
   part of Trending.
2. Business context enters through one of three paths: website scrape with
   Firecrawl plus structured LLM analysis, an AI-IDE context paste parsed into
   the same structured analysis, or direct manual fields.
3. Saving a completed profile automatically prepares ten Carousel candidates,
   each with five slides, in the background. This targets fifty rendered slides
   per business-profile version. The profile's normalized analysis remains the
   worker input so the existing AWS planner, safe matcher, and Sharp renderer
   do not need to change.
4. Automatic generation rows carry the real Firebase `user_id`,
   `business_profile_id`, profile version, and `generation_source =
   auto_generated`. This makes repeat submissions idempotent per profile
   version and keeps future profile refreshes distinct.
5. There is no standalone Carousel Studio Generate screen in this phase. Manual
   Generate controls must not enqueue, open, or otherwise initiate Carousel
   generation unless a new product decision explicitly restores that workflow.
6. When Trending reads an older current-profile batch with fewer than ten
   candidates, it invokes an authenticated, idempotent preparation endpoint to
   complete that same batch. This is automatic profile preparation, not the
   manual Generate-button workflow.
7. Legacy `test-user-001` rows are development data until audited. Do not
   migrate or delete them blindly. Any cleanup must first confirm they are not
   demo or seed content and must remove dependent rows/assets deliberately.

### 2026-08-03 Required Onboarding Context v1

- A saved business-profile row is no longer sufficient proof that onboarding is
  complete. Generation access requires persisted `onboarding_status =
  completed`, onboarding version 1 or newer, and a runtime completeness check
  against the stored context.
- Onboarding v1 collects only generation-critical context: B2B/B2C model,
  category or product type, primary audience, current problem, desired outcome,
  differentiator or mechanism, brand tone, and one or more campaign purposes.
  Team size, revenue, and user role are not part of this gate.
- Website, AI-IDE, and manual intake remain supported. Their normalized facts
  are merged with the owner's required onboarding answers before a new profile
  version starts automatic preparation. Existing `claimsToAvoid` are retained;
  onboarding does not create an approved numeric-claims system.
- Legacy profiles default to incomplete. Their existing category, audience,
  problem, promise, differentiator, and tone may prefill the form, but they are
  never marked complete unless every v1 area, including business model and
  campaign purpose, is present. Daily replenishment excludes incomplete
  profiles and also rechecks context completeness in application code.
- The primary Trending feed and format-preparation routes enforce the same
  server-side check and return HTTP 409 with `code = onboarding_required`.
  Client redirects improve navigation but are not the authorization boundary.

## Current Implementation Status

Implemented:

- Pexels category asset library stored in S3 and referenced by Supabase.
- Manual review and strict object-only safety fields.
- Legacy narrow bucket taxonomy, matcher, readiness, seeding, and QA scripts.
- Broad-v1 taxonomy and profile requirements.
- Supabase columns `broad_visual_bucket`, `bucket_taxonomy_version`, and
  `object_tags`, with constraints and indexes.
- Broad metadata backfill for the Marketing SaaS and Fitness Health rows that
  were present during the 2026-07-06 backfill.
- Explicit logical fallback broad-bucket lists for every business profile.
- Broad runtime matcher v1 in both app and AWS-worker source, with strict safety
  filtering, soft tag scoring, runtime relevance exclusions, near-duplicate
  group avoidance, uniqueness preference, and safe duplicate reuse.
- `off|dry-run|enabled` broad matcher orchestration, defaulting to `off`.
- Structured legacy-versus-broad comparison diagnostics and deterministic app
  and worker checks.
- A live no-render Marketing SaaS audit that writes
  `.tmp/carousel-broad-matcher/marketing-saas-dry-run.json`.
- Expanded Marketing SaaS AWS shadow sampler
  `scripts/run-carousel-marketing-saas-shadow-sampling.mjs`, exposed as
  `npm run carousel:shadow-sample:marketing`. It queues controlled Marketing
  SaaS jobs, collects broad matcher dry-run logs from CloudWatch, writes a JSON
  report, review manifest, and visual contact sheet, and fails on missing logs,
  missing broad selections, failed jobs, or strict safety violations.
- Broad runtime matcher v2 in app and worker source. It adds deterministic
  candidate-spread scoring so similarly relevant assets rotate across sibling
  candidates while strict safety remains hard and approved duplicate reuse
  remains allowed when needed.
- Live Marketing SaaS broad matcher audit supports multi-candidate local
  diversity simulation with `--candidates`.
- Carousel worker deployment verifier
  `scripts/check-carousel-worker-deployment.mjs`, exposed as
  `npm run worker:carousel-deployment:check`. It verifies the ECS task
  definition env and the latest CloudWatch startup log for matcher mode,
  broad matcher version, image safety policy, planner version, renderer
  version, and Geist font availability.
- LLM slide planner with one structurally scoped LLM repair pass and no
  published hardcoded copy fallback. Generated rows store the raw initial/repair
  responses, normalized plan, planner version, actual model, source, fallback
  reason, validation result, and renderer version.
- Professional Sharp text renderer and AWS Carousel worker path.
- AWS Carousel worker revision 32 runs image
  `831963379461.dkr.ecr.us-east-2.amazonaws.com/ugc-worker:worker-20260713184011`
  from task definition
  `arn:aws:ecs:us-east-2:831963379461:task-definition/ugc-carousel-worker-task:32`.
  Startup metadata reports git commit
  `5d604b9805ea6c875af6f44cf247c2ada1212f67`, planner
  `llm-carousel-planner-v16-solution-story-guard`, renderer
  `social-bubble-renderer-v11-hybrid-soft-union`, broad matcher
  `broad-runtime-matcher-v2` in `dry-run`, safety policy
  `object-only-no-human-v1`, and Geist Regular available at
  `/usr/local/share/fonts/geist/Geist-Regular.ttf`.
- Renderer `social-bubble-renderer-v11-hybrid-soft-union` preserves each
  measured line's safe `requiredWidth`. Imperceptible adjacent differences
  below 3px per side snap to the larger width. Small visible side changes use a
  vertically extended cubic transition with vertical tangents, while larger
  changes retain rounded shoulders. The visible bubble and containment mask
  use the same single connected SVG path. This does not change copy, wrapping,
  typography, padding, image processing, safe margins, or text placement.
- Fresh production canary `61b0edb4-0af2-44b0-9211-d1db40f9b1f3` completed on
  worker revision 32 with five new renderer-v11 CloudFront URLs. All five WebPs
  were visually inspected at 1080x1350. The exact reference sentence retained
  widths `542, 628, 636` and used transitions
  `rounded-shoulder, soft-curve, none`. CloudWatch diagnostics reported
  `escapedTextPixels = 0`, `textPixelContainmentPassed = true`, and no repair on
  slides 1 through 5.
- Supabase relevance metadata `runtime_exclusion_reason` and
  `near_duplicate_group`, including database constraints and a ready-pool index.
- Marketing SaaS asset cleanup for wrong-bucket, human-form, people-on-screen,
  and manually confirmed duplicate assets.
- AWS Carousel worker revision 7 deployed in shadow mode with
  `CAROUSEL_BROAD_MATCHER_MODE=dry-run` and
  `CAROUSEL_DISABLE_CATEGORY_FALLBACK=true`.
- Non-blocking readiness diagnostics in `POST /api/carousel/generate` and
  `POST /api/carousel/generate-more`: low image count and missing bucket target
  coverage now return warnings on successful responses instead of user-blocking
  `409` errors.
- The carousel frontend shows the first readiness warning as a compact
  non-blocking diagnostic banner.
- AWS Carousel worker revision 8 deployed after the readiness slice. It keeps
  broad matching in `dry-run`, keeps unrelated category fallback disabled, and
  only pre-blocks rendering when zero approved object-only assets are available.

Not implemented or not live yet:

- Broad matching is not authoritative. AWS runs it only in `dry-run`; the
  legacy matcher still selects rendered images.
- Per-row shared asset fields (`asset_scope` and `usable_profiles`) are not
  implemented. The explicit shared source-category compatibility policy is
  deployed to AWS only in broad-matcher `dry-run` mode; it is not authoritative
  live behavior yet.
- App and worker contain duplicated Carousel planner, matcher, and renderer code;
  changes must remain synchronized until that duplication is deliberately
  removed.

Latest Marketing SaaS validation (2026-07-07):

- Pexels `14331365` was archived for `wrong_broad_bucket`; its object-only
  safety classification was preserved.
- Pexels `6177636` was archived as the manually rejected duplicate. Pexels
  `6177637` remains ready, and both rows use near-duplicate group
  `marketing-workspace-6177636-6177637`.
- Pexels `8386558` was rejected after AWS shadow visual review because the
  skeleton is a human-form/anatomy subject.
- Pexels `5473313` was archived as irrelevant for Marketing SaaS because it is
  a coding/terminal workstation incorrectly tagged as spreadsheet analytics.
- False `human` content tags were removed from 51 manually approved, strictly
  object-only Marketing SaaS rows. Strict safety fields remain authoritative.
- Local broad routing passes 6/6 selections with zero missing selections, zero
  profile fallback, and zero duplicate reuse.
- AWS worker revision 7 reports broad matcher v1 in `dry-run`, safety policy
  `object-only-no-human-v1`, legacy matcher v2, and renderer v3.
- Final five-slide Marketing SaaS AWS canary
  `dd6cf9e6-cb68-4625-ae3e-4f771efd385b` completed successfully. Shadow
  selections were manually inspected and contained no humans, faces, hands,
  bodies, silhouettes, skeletons, or obvious wrong-category images.
- Readiness slice deployed AWS worker revision 8
  (`worker-20260706194410`). Startup logs verified broad matcher mode `dry-run`,
  safety policy `object-only-no-human-v1`, legacy matcher v2, broad matcher v1,
  and renderer v3.
- Post-deploy AWS canary `3ca6a8d1-75c3-4f19-889a-83c48460fc01` completed 5/5
  rendered slides.
- Expanded Marketing SaaS AWS shadow sample
  `marketing-shadow-20260707-1` completed 20/20 jobs and 100/100 slide
  comparisons. Report:
  `.tmp/carousel-shadow-sampling/marketing-saas/marketing-shadow-20260707-1/report.json`.
  Contact sheet:
  `.tmp/carousel-shadow-sampling/marketing-saas/marketing-shadow-20260707-1/broad-shadow-contact-sheet.png`.
  Results: 0 failed jobs, 0 missing log jobs, 0 missing broad selections,
  0 strict safety violations, 0 same-carousel duplicate selections, 55 exact
  matches, 34 partial tag matches, and 11 broad-bucket fallback selections.
  The sample selected 30 unique broad assets across 100 slide selections. This
  is safe but too concentrated for production quality; the top repeated asset
  appeared 12 times across the batch.
- Local broad matcher v2 audit for Marketing SaaS with `--candidates 20`
  completed against the current Supabase image library. It selected 39 unique
  assets across 120 slide selections, with the top repeated asset appearing
  9 times. This improves diversity versus the earlier shadow sample, but the
  image library remains below beta readiness.
- Pre-refill strict approved object-only Marketing SaaS broad-v1 baseline:
  `workspace-objects` 14, `phone-and-devices` 17, `data-and-screens` 10,
  `notes-and-planning` 10, `abstract-backgrounds` 9,
  `clean-texture-backgrounds` 7. Marketing SaaS also has 12 safe
  `home-lifestyle` assets, but that bucket is not a required Marketing SaaS
  broad bucket. Required Marketing SaaS broad buckets total 67 safe assets.
  Canary target is 120 total across the six required buckets, beta target is
  240, and production target starts around 360. At that time, deficits were 53
  for canary, 173 for beta, and about 293 for 60-per-bucket production.
- AWS Carousel worker revision 9 deployed with image
  `831963379461.dkr.ecr.us-east-2.amazonaws.com/ugc-worker:worker-20260707044426`
  and task definition
  `arn:aws:ecs:us-east-2:831963379461:task-definition/ugc-carousel-worker-task:9`.
  `npm run worker:carousel-deployment:check` verified ECS env
  `CAROUSEL_BROAD_MATCHER_MODE=dry-run`,
  `CAROUSEL_DISABLE_CATEGORY_FALLBACK=true`, and CloudWatch startup values:
  broad matcher `broad-runtime-matcher-v2`, safety policy
  `object-only-no-human-v1`, runtime matcher `runtime-bucket-matcher-v2`, and
  renderer `social-bubble-renderer-v3`.
- Expanded Marketing SaaS AWS shadow sample
  `marketing-shadow-v2-20260707-1` completed 20/20 jobs and 100/100 slide
  comparisons after worker revision 9 deployment. Report:
  `.tmp/carousel-shadow-sampling/marketing-saas/marketing-shadow-v2-20260707-1/report.json`.
  Contact sheet:
  `.tmp/carousel-shadow-sampling/marketing-saas/marketing-shadow-v2-20260707-1/broad-shadow-contact-sheet.png`.
  Results: 0 failed jobs, 0 missing log jobs, 0 missing broad selections,
  0 strict safety violations, 0 same-carousel duplicate selections, 53 exact
  matches, 36 partial tag matches, and 11 broad-bucket fallback selections.
  The sample selected 35 unique broad assets across 100 slide selections, and
  the top repeated asset appeared 7 times. This improves the previous AWS
  sample from 30 unique assets and 12 top repeats.
- Marketing SaaS over-sourced broad-bucket refill tooling is implemented.
  `scripts/seed-marketing-saas-broad-refill.mjs` is exposed as
  `npm run carousel:marketing-broad-refill`. It computes broad bucket gaps,
  plans candidate fetches with `max(50, approved_gap * 5)` capped at 120 by
  default, skips buckets with pending unreviewed candidates, and never makes
  new rows selectable without manual approval. The low-level Pexels seeder can
  now write `broad_visual_bucket`, `bucket_taxonomy_version = broad-v1`, and
  object/mood tags at insert time. Explicit candidate limits below the old
  default of 80 are allowed so small gaps can still use controlled 40-60 style
  batches. The broad contact-sheet script now supports `--review-status
  unreviewed`, and the review applier supports broad-bucket review manifests.
  It also supports a narrow per-bucket
  `allowSubjectMetadataResetIndexes` override for explicitly reviewed,
  approved assets whose old non-face subject metadata is stale; clear-face or
  face-count positives remain blocked.
- Marketing SaaS refill dry-run on 2026-07-07 originally found all six required
  broad buckets had pending unreviewed candidate pools, so no additional Pexels
  sourcing was run. Dry-run report:
  `.tmp/marketing-saas-broad-refill/refill-dry-run-2026-07-07T05-14-08-040Z.json`.
- Unreviewed Marketing SaaS broad-bucket contact sheets were generated for
  manual review:
  `.tmp/carousel-broad-matcher/broad-bucket-contact-sheets/marketing-saas/workspace-objects`,
  `.tmp/carousel-broad-matcher/broad-bucket-contact-sheets/marketing-saas/phone-and-devices`,
  `.tmp/carousel-broad-matcher/broad-bucket-contact-sheets/marketing-saas/data-and-screens`,
  `.tmp/carousel-broad-matcher/broad-bucket-contact-sheets/marketing-saas/notes-and-planning`,
  `.tmp/carousel-broad-matcher/broad-bucket-contact-sheets/marketing-saas/abstract-backgrounds`,
  and
  `.tmp/carousel-broad-matcher/broad-bucket-contact-sheets/marketing-saas/clean-texture-backgrounds`.
- Manual review decisions in
  `scripts/data/marketing-saas-broad-image-review-2026-07-07.json` were applied
  to Supabase on 2026-07-07. The applier reviewed 448 rows, approved 409,
  archived 39 rejects, and reset stale non-face subject metadata for one
  visually approved object-only asset. Additional notes-and-planning rejects
  were added after visual inspection found hands, arms, bodies, and heads in
  the contact sheet. Applied review report:
  `.tmp/carousel-image-review/applied-review.json`.
- Post-apply Marketing SaaS refill/readiness dry-run shows zero pending review
  rows and all six required broad buckets above canary target. Strict approved
  object-only counts are: `workspace-objects` 106, `phone-and-devices` 100,
  `data-and-screens` 85, `notes-and-planning` 21,
  `abstract-backgrounds` 77, and `clean-texture-backgrounds` 87. Required
  bucket total is 476 against the 120 canary target. `notes-and-planning` is
  canary-ready but remains the beta weak spot because it is still below the
  40-asset beta target. Readiness report:
  `.tmp/marketing-saas-broad-refill/refill-dry-run-2026-07-07T05-37-03-096Z.json`.
- Local Marketing SaaS broad matcher audit after review apply selected from 488
  safe approved broad-v1 assets, including the 12 safe `home-lifestyle` assets
  outside the required Marketing SaaS buckets. With `--candidates 20`, it
  produced 94 unique assets across 120 simulated slide selections, zero missing
  broad selections, zero profile fallback, and zero duplicate safe reuse. Local
  audit report:
  `.tmp/carousel-broad-matcher/marketing-saas-dry-run.json`.
- Productivity SaaS can now reuse compatible Marketing SaaS broad assets without
  duplicating database rows. This is a compatibility source-category read, not
  the final shared-asset schema. `productivity-saas` reads its own approved
  object-only assets plus `marketing-saas` assets when the broad bucket is valid
  for the Productivity profile and all strict safety fields pass. Live local
  audit on 2026-07-07 selected 6/6 broad assets for Productivity SaaS with zero
  missing broad selections, zero profile fallback, and zero duplicate safe
  reuse. The selected sample sourced all six assets from Marketing SaaS, proving
  that the reuse path works. Report:
  `.tmp/carousel-broad-matcher/productivity-saas-dry-run.json`.
- A single shared `home-lifestyle` candidate pool was sourced and reviewed on
  2026-07-07. It contains exactly 80 Pexels candidates under
  `category_slug = shared` and `broad_visual_bucket = home-lifestyle`. Manual
  review approved 72 strict object-only assets, archived 8 human-positive
  assets, and left zero pending rows. Four user-reported rejects were joined by
  four additional strict-policy rejects found during high-resolution review:
  a printed human face, people visible through windows, a face/hands/body scene,
  and prominent human figures in wall art. The source batch uses one physical
  pool for Productivity SaaS, Fitness Health, Wellness, Beauty Skincare, and
  Generic Business. Contact sheets and the review manifest are under
  `.tmp/carousel-broad-matcher/broad-bucket-contact-sheets/shared/home-lifestyle`.
- App and worker source now recognize the explicit `shared` source category for
  those five profiles. Generic Business treats `home-lifestyle` as an optional
  profile fallback, not a readiness requirement. Strict approval and broad
  profile suitability checks remain unchanged. These source changes are present
  in AWS worker revision 11, but only as dry-run broad matcher shadow behavior.
- Post-review local Productivity SaaS audit loads 488 Marketing SaaS rows, 78
  Productivity SaaS rows, and 72 shared rows. Its combined `home-lifestyle`
  count is 84, it selected 6/6 slides with zero missing selections, and it used
  no duplicate-safe reuse. Report:
  `.tmp/carousel-broad-matcher/productivity-saas-dry-run.json`.
- Generic Business now reuses Marketing SaaS and shared rows without sourcing a
  separate category library. Its local audit selected 6/6 slides with zero
  missing selections and 93 unique assets across 120 simulated selections.
  Report: `.tmp/carousel-broad-matcher/generic-business-dry-run.json`.
- Wellness reuse is implemented locally with source-bucket restrictions. It may
  use Fitness Health `food-and-table`, `fitness-wellness-objects`, and
  `product-still-life`; Marketing SaaS `clean-texture-backgrounds`; and shared
  `home-lifestyle`. The corrected local audit excludes irrelevant Marketing
  analytics/dashboard assets. Current usable Wellness counts are:
  `food-and-table` 155, `fitness-wellness-objects` 10,
  `clean-texture-backgrounds` 87, and `home-lifestyle` 72. It can produce 6/6
  safe fallback selections, but `product-still-life` and Wellness-safe
  `abstract-backgrounds` remain at zero. Report:
  `.tmp/carousel-broad-matcher/wellness-dry-run.json`. This pre-refill state is
  superseded by the post-review shared-pool Wellness state below.
- Wellness gap sourcing is implemented as a shared-pool slice. The script
  `scripts/seed-shared-wellness-pools.mjs`, exposed as
  `npm run carousel:shared-wellness-pools:seed`, sources one controlled batch
  per missing/weak pool, skips any pool with pending review, and keeps every new
  candidate non-selectable. On 2026-07-07 it sourced exactly 80 unreviewed
  candidates for each of `product-still-life`, Wellness-safe
  `abstract-backgrounds`, and `fitness-wellness-objects` under
  `category_slug = shared`. All three batches completed with zero sourcing
  errors. These shared pools are permitted only for Fitness Health, Wellness,
  and Beauty Skincare. Productivity SaaS, Marketing SaaS, and Generic Business
  cannot use them. Each bucket has four contact-sheet pages and a manifest under
  `.tmp/carousel-broad-matcher/broad-bucket-contact-sheets/shared/<bucket>`.
  Manual review decisions in
  `scripts/data/shared-wellness-pools-review-2026-07-07.json` were applied to
  Supabase on 2026-07-07. The applier reviewed 240 rows, approved 204, archived
  36 rejects, and left zero pending review rows. Shared pool counts after review
  are: `product-still-life` 79 approved / 1 rejected, `abstract-backgrounds` 80
  approved / 0 rejected, and `fitness-wellness-objects` 45 approved / 35
  rejected.
- Post-review local Wellness broad matcher audit loads 528 safe approved
  broad-v1 assets across permitted source categories: Fitness Health 165,
  Marketing SaaS 87, and Shared 276. Required Wellness bucket coverage is:
  `abstract-backgrounds` 80, `clean-texture-backgrounds` 87,
  `fitness-wellness-objects` 55, `food-and-table` 155, `home-lifestyle` 72,
  and `product-still-life` 79. The audit selected 6/6 slides with zero missing
  broad selections, zero profile fallback, zero duplicate safe reuse, and 82
  unique assets across 120 simulated selections. Report:
  `.tmp/carousel-broad-matcher/wellness-dry-run.json`.
- Beauty Skincare reuse is implemented with source-bucket restrictions.
  It may use shared `home-lifestyle`, `fitness-wellness-objects`,
  `product-still-life`, and `abstract-backgrounds`, plus Marketing SaaS
  `clean-texture-backgrounds`. A pre-change Beauty audit could produce 6/6
  selections but had zero `clean-texture-backgrounds` and used profile fallback
  for clean texture slides. The source policy was updated in app and worker code
  to allow only Marketing SaaS `clean-texture-backgrounds` for Beauty Skincare.
  Post-change local Beauty audit loads 363 safe approved broad-v1 assets:
  `abstract-backgrounds` 80, `clean-texture-backgrounds` 87,
  `fitness-wellness-objects` 45, `home-lifestyle` 72, and
  `product-still-life` 79. It selected 6/6 slides with zero missing broad
  selections, zero profile fallback, zero duplicate safe reuse, and 83 unique
  assets across 120 simulated selections. Report:
  `.tmp/carousel-broad-matcher/beauty-skincare-dry-run.json`. No fresh Beauty
  Skincare sourcing is needed for canary or beta readiness.
- The profile-aware AWS shadow sampler is implemented in
  `scripts/run-carousel-marketing-saas-shadow-sampling.mjs` and exposed as
  `npm run carousel:shadow-sample:profile`. It keeps the Marketing SaaS command
  as the default, but can now run controlled dry-run samples for
  `productivity-saas`, `generic-business`, `wellness`, and `beauty-skincare`.
- AWS Carousel worker revision 10 initially deployed the shared source-policy
  updates in `dry-run`, but the first Beauty Skincare shadow sample exposed a
  resolver bug: Beauty analysis could resolve as `wellness` because the profile
  resolver checked Wellness keywords such as `habit` before Beauty keywords.
  The resolver now first honors explicit category/slug/label matches and then
  uses scored keyword matching. The fix is present in both app and worker code,
  and the regression is covered by app and worker broad-matcher checks.
- AWS Carousel worker revision 11 deployed the resolver fix with image
  `831963379461.dkr.ecr.us-east-2.amazonaws.com/ugc-worker:worker-20260707095551`
  and task definition
  `arn:aws:ecs:us-east-2:831963379461:task-definition/ugc-carousel-worker-task:11`.
  `npm run worker:carousel-deployment:check -- --minutes 30` verified ECS env
  `CAROUSEL_BROAD_MATCHER_MODE=dry-run`,
  `CAROUSEL_DISABLE_CATEGORY_FALLBACK=true`, and CloudWatch startup values:
  broad matcher `broad-runtime-matcher-v2`, safety policy
  `object-only-no-human-v1`, runtime matcher `runtime-bucket-matcher-v2`,
  content planner `llm-carousel-planner-v1`, and renderer
  `social-bubble-renderer-v3`.
- Beauty Skincare AWS visual QA after worker revision 11 archived seven
  previously approved but visually unsafe selected assets: Pexels `26733176`
  and `9475406` from shared `product-still-life` for hands; Pexels `30499766`
  and `10567234` from Marketing SaaS `clean-texture-backgrounds` for hands or
  arms; and Pexels `5797939`, `9908658`, and `5594349` from Marketing SaaS
  `clean-texture-backgrounds` for printed-human or human-like figure content.
  The log-level strict safety report had not caught these because their
  database safety metadata was stale, so visual contact-sheet inspection remains
  required before live enablement.
- Current AWS Beauty Skincare shadow sample
  `beauty-skincare-source-policy-v5-cleaned-20260707-1` completed 10/10 jobs
  and 50/50 slide comparisons against worker revision 11 after the cleanup.
  Raw broad matcher logs show `profileId = beauty-skincare` and
  `categorySlug = beauty-skincare`. Report:
  `.tmp/carousel-shadow-sampling/beauty-skincare/beauty-skincare-source-policy-v5-cleaned-20260707-1/report.json`.
  Contact sheet:
  `.tmp/carousel-shadow-sampling/beauty-skincare/beauty-skincare-source-policy-v5-cleaned-20260707-1/broad-shadow-contact-sheet.png`.
  Results: 0 failed jobs, 0 missing log jobs, 0 missing broad selections,
  0 strict safety violations, 0 same-carousel duplicate selections, 26 exact
  matches, 15 partial tag matches, 9 broad-bucket fallback selections, and 35
  unique selected assets across 50 selections. The v5 contact sheet was visually
  inspected, then the user manually rejected index 23. That mapped to shared
  `product-still-life` Pexels `36650046`, and it was archived on 2026-07-07.
  A fresh Beauty shadow sample should be run before treating Beauty as visually
  cleared again.
- AWS Wellness shadow sample `wellness-source-policy-20260707-1` completed
  10/10 jobs and 50/50 slide comparisons under the deployed source-policy dry
  run. Report:
  `.tmp/carousel-shadow-sampling/wellness/wellness-source-policy-20260707-1/report.json`.
  Contact sheet:
  `.tmp/carousel-shadow-sampling/wellness/wellness-source-policy-20260707-1/broad-shadow-contact-sheet.png`.
  Results: 0 failed jobs, 0 missing log jobs, 0 missing broad selections,
  0 strict safety violations, 0 same-carousel duplicate selections, 7 exact
  matches, 35 partial tag matches, 8 broad-bucket fallback selections, and 44
  unique selected assets across 50 selections. The user manually rejected index
  15, which maps to shared `fitness-wellness-objects` Pexels `4853707`. The
  asset is now archived in production and cannot be selected. Its older
  `subject_review_status = approved` metadata still needs normalization to
  `rejected`, but the runtime exposure is closed because archived assets are
  ineligible.

## 2026-07-16 Production Feed and Renderer Audit

- The ten carousels surfaced in the first production feed contain 50/50 stored
  1080x1350 WebP render URLs. Five older source assets were visually found to
  violate the no-human rule even though their metadata said object-only. The
  exact five decisions are recorded in
  `scripts/data/fitness-health-production-feed-safety-review-2026-07-16.json`;
  all five assets are now archived, manually rejected, and marked as containing
  a faceless human so they cannot be selected again.
- One opened July 10 render showed body text escaping its white bubble. That
  generation predates renderer provenance and remains immutable evidence; do
  not overwrite its URL. The current/deployed
  `social-bubble-renderer-v11-hybrid-soft-union` validates the same bubble mask
  geometry against rendered text pixels, rejects any escaped pixel after one
  repair attempt, passes the connected-bubble and renderer regression suites,
  and rendered the latest five-slide canary with correct white bubbles.
- The white bubble fill is production behavior, not a test-only fallback.
  `highlight` is the automatic path. Although `plain` and `soft-gradient` are
  accepted API values, they are not yet visually distinct style systems;
  `soft-gradient` currently matches `highlight`, while `plain` only adjusts
  image brightness slightly. Do not advertise those values as materially
  different presets until they are deliberately designed.

Do not describe planned behavior as deployed behavior.

## 2026-07-27 GCP Media Delivery Cost Control

- The optional GCP media CDN/global external load balancer is disabled in the
  applied foundation state while the product is in testing. Terraform variable
  `enable_media_cdn = false` removed the two forwarding rules, HTTP and HTTPS
  target proxies, URL map, CDN backend bucket, managed certificate, and reserved
  global IP. This does not disable or remove any Cloud Run worker.
- `gs://ugcsaas-media` remains the storage source of truth and is still guarded
  by `prevent_destroy = true` and `force_destroy = false`. Testing-phase media
  remains publicly readable through
  `https://storage.googleapis.com/ugcsaas-media`; a post-removal byte-range read
  of a rendered Carousel returned HTTP 206 with `image/webp`.
- The production app and all four GCP workers already use the direct GCS public
  base URL, so removing the optional delivery layer does not change generated
  media keys or worker execution.
- `media.getugcpilot.com` still resolves to the released former load-balancer IP
  `8.233.40.78`. Treat that hostname as inactive and remove its stale DNS record.
  Do not use it in app or worker configuration.
- Re-enabling the custom media domain requires a separate reviewed change: set
  `enable_media_cdn = true`, apply Terraform, point DNS to the newly allocated
  output IP, wait for the managed certificate to become active, verify HTTPS,
  and only then consider changing the public media base URL.

## 2026-07-27 Carousel Image Migration Completion

- The production Carousel image migration acceptance boundary is the canonical
  Carousel source and output tables: `category_image_assets`,
  `carousel_slides`, `library_items`, and `library_carousel_slides`. Avatar and
  overlay catalogs, historical `background_jobs` payloads, test/E2E records,
  and unreferenced render objects are not part of Carousel migration
  completeness.
- A production database and GCS inventory audit verified 4,649 canonical rows,
  7,124 GCP URL references, and 6,998 unique referenced object keys. There are
  zero AWS URLs, zero missing GCS objects, and zero zero-byte objects in this
  scope. Public byte-range reads returned HTTP 206 with `image/webp` for a
  representative object from each canonical table.
- The AWS `category-library/` prefix contains 4,730 image objects and every one
  has the same key in `gs://ugcsaas-media`. The AWS `carousels/rendered/`
  prefix contains 2,093 image objects; 2,043 have the same key in GCP and the
  remaining 50 are not referenced by any canonical Carousel or Library row.
  Those 50 orphaned old renders are intentionally not being copied.
- No important canonical Carousel image exists only in AWS. A global
  all-media audit may still report AWS URLs from out-of-scope historical jobs,
  test data, or media systems scheduled for replacement; that is not evidence
  of a Carousel migration gap.

## 2026-07-28 Reviewed Slideshows Asset Import

- The flat source folder
  `C:/Users/chund/OneDrive/Desktop/slideshows` contained 72 readable images,
  zero corrupt files, zero exact duplicates, and zero perceptual near-duplicate
  groups. It had no provenance sidecar and included 17 already-cropped
  1080x1350 files without corresponding originals, so those files remain
  marked as cropped-only canonical sources.
- The durable per-file decision map is
  `scripts/data/slideshows-carousel-review-2026-07-28.json`. Final uncropped
  contact-sheet inspection approved 61 files and rejected 11. The second,
  larger visual pass caught `07-online-yoga-and-remote-wellness.jpg`, which
  contains a visible person on a laptop screen; it is rejected along with the
  ten previously identified person/hand images. Rejected files were not
  uploaded and have no `category_image_assets` rows.
- The 61 approved assets are mapped as follows:
  - Productivity SaaS: 15 `notes-and-planning`, 9 `workspace-objects`, and
    1 `phone-and-devices`.
  - Fitness Health: 14 `food-and-table` and 20
    `fitness-wellness-objects`.
  - Shared: 2 `home-lifestyle`, usable by Productivity SaaS, Fitness Health,
    Wellness, Beauty Skincare, and Generic Business.
- Each approved file now has a SHA-256 source hash and a perceptual hash.
  The local review-map pipeline fails closed if the map is not marked
  `final_full_resolution_review`, if any audited file is missing a decision, if
  a decision names an unknown file, or if a runtime category/broad-bucket/scope
  combination is invalid. The old whole-folder approval flag remains only for
  backward compatibility and cannot be combined with a review map.
- The import path now uses the configured storage abstraction and is explicitly
  guarded to GCP for this reviewed batch. It no longer hard-codes AWS SDK or
  CloudFront configuration. The existing `base_s3_key`, `thumb_s3_key`, and
  `source_original_s3_key` database column names remain unchanged for schema
  compatibility even though the objects live in GCS.
- On 2026-07-28, all 61 approved assets were uploaded to
  `gs://ugcsaas-media` and inserted into production
  `category_image_assets`: 25 Productivity SaaS, 34 Fitness Health, and
  2 Shared. All rows are `ready`, manually `approved`, `object-only`,
  `has_human = false`, `face_count = 0`, `person_count = 0`, and have no
  runtime exclusion reason. The import preflight found no matching storage
  keys, SHA-256 hashes, or perceptual hashes in production.
- Post-import verification found 61/61 matching production rows and successfully
  read all 183 public GCP objects: 61 originals, 61 normalized 1080x1350 WebP
  bases, and 61 320x400 WebP thumbnails. Metadata-only corrections can be
  safely re-applied with
  `scripts/sync-local-carousel-image-asset-metadata.mjs`; the command requires
  exact base-key and source-hash matches before updating a row.
- Relevance tags were validated against the production broad matcher rather
  than merely stored. Across 50 simulated candidate Carousels, all 25 new
  Productivity assets were selected at least once. In a Fitness-specific
  50-candidate audit, 33 of 34 new Fitness assets were selected, with selections
  from both `food-and-table` and `fitness-wellness-objects`. Both audits
  produced complete 6/6 selections with zero missing selection.
- An isolated GCP render canary read six newly imported production URLs—one
  from every imported category/bucket group—and rendered six valid 1080x1350
  Carousel slides. The output and report are under
  `.tmp/local-carousel-render-canary/2026-07-28T08-29-59-344Z`.
- Production `CAROUSEL_BROAD_MATCHER_MODE` remains `dry-run`. These assets are
  present, safe, and selectable by the broad matcher, but the legacy matcher is
  still authoritative for the user-facing feed. Do not describe the new local
  assets as live feed selections until a separately deployed, profile-scoped
  broad-matcher canary is verified.

## 2026-08-10 Power Folder Tagging Checkpoint

- The seven source folders under
  `C:/Users/chund/OneDrive/Desktop/slideshows/power` contain 594 readable
  images: finance 26, food 356, gym 33, marketing 9, outdoor/lifestyle 40,
  productivity 71, and beauty/skincare 59. The audit found 14 exact-duplicate
  groups, 19 perceptual near-duplicate groups, and an estimated 553 visual
  families.
- Folder names map to source slugs and runtime categories as follows:
  `finance` -> `personal_finance` -> Personal Finance; `food` ->
  `calorie_tracking` -> Fitness Health; `gym` -> Fitness Health; `marketing`
  -> Marketing SaaS; `outdoor_freedom_nature_walking` -> `outdoor_lifestyle`
  -> Shared; the misspelled `producitivity` folder -> `productivity` ->
  Productivity SaaS; and `skin` -> `beauty_skincare` -> Beauty Skincare.
- Compact contact sheets plus targeted full-resolution checks produced the
  durable rejection source
  `scripts/data/power-carousel-safety-review-2026-08-10.json`. The review
  rejected 87 supported candidates for visible or ambiguous human presence,
  including hands, arms, cropped bodies, background people, and people on
  printed material/screens. The audit rejected another 17 exact-duplicate
  files. All 594 audited files therefore have an explicit decision: 490
  approved and 104 rejected/skipped.
- Approved runtime inventory is local-only at this checkpoint: Beauty Skincare
  50 (8 clean texture, 16 home lifestyle, 26 product still life); Fitness
  Health 350 (321 food/table and 29 fitness objects); Marketing SaaS 7 (3
  data/screens and 4 phone/devices); Shared 18 (13 abstract/nature and 5 home
  lifestyle/cafe); Personal Finance 19 (11 notes/planning, 1 phone/device, 7
  workspace/shipping); and Productivity SaaS 46 (7 notes/planning and 39
  workspace objects).
- The approved manifest uses `local-curated-image-tags-v2`. Category defaults
  are intentionally narrow so, for example, shipping boxes do not inherit a
  generic `budgeting` match and outdoor cafes do not inherit `nature`.
  Whole-term rules attach literal objects and concepts such as `receipt`,
  `credit-card`, `grocery-budget`, `whiteboard`, `bench-press`, `serum`,
  `popcorn`, and specific social platforms. Per-file overrides cover opaque
  generated finance filenames and visually verified device types. A tag audit
  found no approved asset with fewer than four content tags or fewer than two
  object tags; repeated signatures inside homogeneous dish/vegetable packs are
  expected because the filenames contain only the dish/object family plus a
  sequence number.
- The final approved tag manifest is
  `.tmp/power-carousel-image-tags-approved-v2-final/2026-08-10T16-34-40-116Z/tag-manifest.json`.
  Its 490 approved assets were prepared locally in
  `.tmp/power-carousel-image-import-upscaled/2026-08-10T17-11-03-503Z` as one
  canonical asset each: preserved original, 1080x1350 WebP runtime rendition,
  and 320x400 WebP thumbnail. The package stores the source hash and a
  `source_metadata.rendition` record; its 99 lower-resolution sources retain
  their 0.64 quality score, original dimensions, and an
  `approved_with_low_resolution_source` rendition-review status. Upscaling does
  not reclassify these sources as natively high resolution.
- The local checkpoint passed for all 490 records: strict object-only safety,
  tags, runtime categories, hashes, object keys, and prepared image dimensions
  are valid. Remote structure preflight found four exact source hashes already
  present in `fitness-health` (two treadmills, spin bikes, and a plyo box), with
  no prepared base-key or perceptual-hash conflict. The importer treats those
  exact sources as idempotent skips, leaving 486 new canonical asset records to
  upload. Originals must never be deleted for this reason.
- The first explicit production import attempt reached the desktop command's
  ten-minute limit before returning and did not create `import-result.json`.
  A later recovery preflight confirmed that it inserted no new database rows.
  The resumed checkpointed import then inserted 486 new canonical asset rows
  and skipped the four exact existing source hashes, completing all 490
  manifest assets without duplicate rows.
- The importer now checkpoints every ten assets: it uploads the original,
  1080x1350 base, and thumbnail concurrently for each asset, inserts that
  checkpoint's rows, and writes resumable progress. A retry first skips any
  source hashes already inserted, while deterministic object keys safely reuse
  any files uploaded by the interrupted attempt.
- Production verification found 490/490 matching `category_image_assets` rows:
  Beauty Skincare 50, Fitness Health 350, Marketing SaaS 7, Shared 18,
  Personal Finance 19, and Productivity SaaS 46. It successfully checked all
  1,470 trusted GCP URLs (original, 1080x1350 base, and thumbnail) with zero
  missing or mismatched rows, safety fields, tags, storage keys, or objects.
  Reports are `import-result.json` and `post-import-verification.json` in the
  prepared package directory above. This Power-folder batch is now verified
  backend Carousel library inventory.

## 2026-07-28 Unified Trending Wall-of-text Decision

- Trending is one mixed Tinder-style feed containing preview-ready Carousel,
  Hook-video, and Wall-of-text ideas. Each format keeps its own Business
  Profile prompt and text schema; Carousel slide copy, Hook opener text, and
  Wall-of-text copy must never be reused interchangeably.
- A Wall-of-text preview is a reviewed platform background video plus
  Business-Profile-specific Wall copy and a fixed full-overlay layout. It does
  not include a product demo.
- One continuous Wall copy value is visible for the full native video duration.
  It has no separate headline, body, or closing fields. The background plays
  once and does not loop. Copy length is limited by visual fit, not by a
  reading-time calculation based on video duration.
- Wall source selection does not use motion level, readability score, text
  capacity, or recommended text position. A video must be an active reviewed
  9:16 Wall asset with one `visual_group`, one `source_batch`, and one unique
  SHA-256 hash. Selection spreads a candidate set across visual groups before
  reusing a group.
- The reviewed `videos_real` batch contains 51 unique approved videos and 15
  exact duplicate files that were rejected. The production catalog contains
  all 51 approved videos and thumbnails in GCP, with zero incomplete rows.
  The durable map is
  `scripts/data/wall-text-videos-real-2026-07-28.json`.
- The application worktree now includes the Wall provider, preparation route,
  full-overlay video card, and left-skip/right-select persistence. These
  user-facing code changes must not be described as live on the production
  domain until the application is deployed and the authenticated production
  flow is verified.

## 2026-08-02 Unified Trending Creative Decisions

- Trending uses the same review actions for every preview-ready Carousel, Hook
  video, and Wall-of-text card. The current reference layout places one labeled
  Edit pill at the top-right of the page header and centers two compact,
  circular, icon-only Reject and Accept buttons below the content card. Each
  icon-only decision has an accessible label and tooltip, while restrained
  error, neutral, and success treatments preserve meaning. This supersedes the
  earlier three-equal-labeled-buttons row. Left/right swipe, keyboard
  decisions, and the Reject/Accept buttons call the same client decision
  handler.
- Decisions are durable server records with the authenticated user ID,
  assignment ID, creative ID, format, `accepted` or `rejected`, and
  `decided_at`. The database function records the decision and retires the
  format-specific active assignment in one transaction. Identical retries are
  idempotent; a conflicting second decision fails closed.
- A decision animates first, then the card is optimistically advanced while
  persistence runs. One synchronous client lock prevents duplicate submission.
  If persistence fails, the prior card index is restored.
- Accept is a review decision, not publication. Carousel acceptance preserves
  the generated creative in an intermediate `accepted` assignment state and
  opens the existing save-or-schedule review flow. Only a successful later
  save or schedule moves it to `completed_saved` or `completed_scheduled`;
  Hook acceptance opens product-demo composition; Wall acceptance opens its
  focused final-review/render flow. The existing render, schedule, and publish
  workers remain separate downstream stages.
- Edit opens the format-specific Trending creative editor for the assigned
  creative. Saving persists an owner-scoped revision; Carousel saves wait for
  the revision-specific worker render before downstream Library use.
- Trending never renders non-ready cards. When no preview-ready item exists and
  generation is active, the customer sees one dark 9:16 post skeleton in the
  first real-card slot with no preparation copy or Carousel-style placeholder
  details. The sidebar background-job indicator and the Trending
  render-progress/failure panels are removed from customer UI; job tables,
  polling, queues, workers, and backend logs remain unchanged.
- This implementation and its Supabase migration are local worktree changes.
  Do not describe the unified decisions as deployed or production-verified
  until the migration and application are deployed and the authenticated
  production flow is checked.

## 2026-08-02 Trending Creative Edit Persistence

- Trending edits are stored in the owner-scoped
  `trending_creative_edits` table. One row represents the latest revision for
  one assigned creative, and every content save clears prior render output.
  The editor submits its loaded revision, so a stale tab receives a conflict
  instead of overwriting a newer save.
  Source assets are resolved server-side and database validation requires a
  ready owner video (and current group membership for group selections).
- Carousel edits use the durable `render_trending_carousel_edit` background-job
  contract. The edit row is attached to the job before Cloud Tasks dispatch,
  and worker transitions are fenced by edit ID, owner, revision, and job ID so
  an older render cannot overwrite a newer edit.
- The Carousel worker reuses the production Sharp slide pipeline, preserves the
  normalized dragged X/Y anchor inside publishing-safe bounds, and uploads each
  revision under immutable content-hashed GCP keys. It reloads the original
  generation job's persisted text style so editing copy or position does not
  change the Carousel design. Render output preserves
  both the public URL and storage key for every slide.
- The Carousel editor previews the clean source background with a live inline
  SVG white-bubble treatment instead of showing the already-flattened rendered
  slide or a plain-text substitute. The worker remains the authority for final
  wrapping, containment, safe-bound clamping, and exported pixels. Supporting
  text takes precedence over CTA text, matching the production renderer.
- Saving a Carousel to Library uses the latest edit when one exists. A queued,
  rendering, draft, failed, incomplete, or non-GCP edit is rejected rather
  than silently saving the original. A ready edit refreshes the existing
  generated-Carousel Library item and its ordered slides, including edited
  copy and normalized placement metadata.
- Hook and Wall downstream save paths resolve saved edit content and selected
  source on the server. Hook combination renders carry the normalized text
  anchor. Wall render claims include edit ID/revision so a previously ready
  render cannot mask a newer Wall edit.
- These schema, app, and worker changes are local worktree changes. Do not call
  them deployed or production-verified until the migration and worker/app
  revisions are deployed and the authenticated production flow is checked.

## 2026-08-12 Staged Carousel Architecture Rollout

- The Carousel content planner and renderer continue to run inside the existing
  authenticated `ugc-carousel-worker` Cloud Run service. This rollout does not
  create a second background worker or a parallel text-generation pipeline.
- Production canary validation exposed and corrected a sparse-profile
  deterministic-fallback defect in the Resource Collection format. Planner
  `llm-carousel-planner-v23-semantic-resource-copy` now builds a
  de-duplicated evidence-backed resource pool and fills any remaining slots
  with generic reference types, so the three middle slides always contain six
  distinct resources even when onboarding provides only a few unique options.
  Its repetition validator also retains meaningful compact terms such as
  `AI`, `UI`, and `UX`; this prevents a short resource list from being falsely
  classified as a duplicate after its distinguishing acronym is discarded.
  Evidence labels are converted into explicit topic guides and goal checklists
  instead of rendering raw tags or clipped problem sentences as though they
  were resources. Near-duplicate fallback labels are removed. Planner parsing
  and strict JSON schemas cap list items at 44 characters to match the
  renderer's one-line checklist contract.
- Broad matcher `broad-runtime-matcher-v3` normalizes hyphens and underscores
  before whole-term tag comparison, supports simple singular/plural matches,
  and considers the best reviewed asset-tag match while selecting the target
  broad bucket. This is required for literal tags such as `social-media`,
  `video-marketing`, `youtube`, `tiktok`, and `instagram` to influence runtime
  selection instead of merely being stored as metadata.
- `CAROUSEL_BROAD_MATCHER_MODE=dry-run` remains the global production default.
  Exact comma-separated IDs in
  `CAROUSEL_BROAD_MATCHER_CANARY_BUSINESS_PROFILE_IDS` or
  `CAROUSEL_BROAD_MATCHER_CANARY_USER_IDS` may promote only matching dry-run
  generations to effective `enabled` behavior. An explicit global `off` mode
  cannot be overridden by either allowlist.
- The worker logs configured mode, effective mode, canary match source, matcher
  version, and the broad-versus-legacy comparison. This makes a profile-scoped
  canary auditable without changing every Carousel generation.
- Production-catalog simulations passed for Marketing SaaS, Productivity SaaS,
  and Fitness Health. The Marketing social-platform sample selected four
  reviewed Power-folder assets, Productivity selected four, and Fitness
  selected five, with zero missing selections or unsafe duplicate reuse.
- The staged production canary completed successfully as background job
  `6a38b5a2-82e4-4169-9ce2-cacb2b153933` and generation
  `873f4005-5813-4774-a036-1cba6805e11d`. The existing worker generated and
  persisted five 1080x1350 slides. Visual containment checks reported zero
  escaped text pixels, all rendered URLs returned HTTP 200, no human imagery
  was selected, and no image was reused. Three slides used reviewed local
  assets, including `power/food/toast_03.jpg`; the remaining two used eligible
  Pexels object imagery.
- The production LLM planner attempted its normal generation and repair path.
  Because that response failed strict content validation, the same worker used
  the v23 deterministic fallback. The rendered fallback remained semantic,
  de-duplicated, and within the renderer's one-line resource limits. This is
  the intended fail-safe behavior, not a separate text-generation flow.
- Final production revision
  `ugc-carousel-worker-carousel-v23-final-653843d` receives 100% of Carousel
  worker traffic. It uses image digest
  `sha256:7af8dec75bac452a9617a96a4d7c49591d35e14e55477e8806ed3d8f93f95ca2`
  from commit `653843d0c75556df7264142e456df1b55974b8bd`. Startup logs verify planner
  `llm-carousel-planner-v23-semantic-resource-copy`, broad matcher
  `broad-runtime-matcher-v3`, renderer
  `social-bubble-renderer-v11-hybrid-soft-union`, object-only/no-human safety,
  OpenAI configuration, Cloud Tasks transport, and the exact commit.
- The temporary canary business-profile and user allowlists were removed after
  acceptance. Global `CAROUSEL_BROAD_MATCHER_MODE=dry-run` and
  `CAROUSEL_DISABLE_CATEGORY_FALLBACK=true` remain in production. Enabling the
  broad matcher globally remains a separate product rollout decision.
- The production web environment points `GCP_CAROUSEL_TASK_URL` at the internal
  `ugc-carousel-worker` Cloud Run service and uses the `ugc-carousel` queue in
  `us-central1` with `QUEUE_PROVIDER=gcp`. The public production root and
  `/status` route both returned HTTP 200 after their canonical-domain redirect.

## 2026-08-13 Repetition Repair and Broad-Matcher Release

- A production assignment created after the v23 rollout proved that the new
  selector and renderer were live, but its visible result still resembled the
  old architecture. The LLM repair repeated a recent angle and the repair
  prompt did not include the recent-history evidence. Strict validation then
  rejected the repair and restored the older generic deterministic copy. At
  the same time, the broad matcher ran only in `dry-run`, so the renderer used
  the legacy image selection even though v3 proposed reviewed local assets.
- Planner `llm-carousel-planner-v25-format-aware-fallback` supplies normalized
  recent history to the repair request, permits a repair to select a different
  saved audience/problem/goal/topic combination when repetition caused the
  failure, and requires all five slides to be rebuilt rather than paraphrasing
  the rejected story.
- The grammar-aware deterministic safety path now rotates through saved,
  evidence-backed strategy combinations, rejects recent topic/hook/angle
  repetition, and writes distinct five-slide copy for the reserved content
  format. The July generic copy remains only for legacy/manual inputs that do
  not carry a reserved V1 format and compatible hook family.
- Global `CAROUSEL_BROAD_MATCHER_MODE=enabled` is now the release decision.
  Object-only/no-human review, approved-asset status, per-generation duplicate
  prevention, and disabled category fallback remain mandatory. The canary
  allowlists stay empty because global enabled mode does not need them.
- The first v24 production canary exposed two release blockers and traffic was
  returned to the verified v23 revision before changing any customer
  assignment. An action-led topic was shortened into the awkward phrase
  `Speed up meal`, and generic fallback image directions such as `clean
  premium` and `product-forward` outweighed the nutrition copy and routed
  three slides to shared skincare/product-still-life assets.
- v25 converts action-led topics into complete headline noun phrases (for
  example, `Speed up meal logging` becomes `meal logging`). Broad matcher
  `broad-runtime-matcher-v4` excludes the six exact generic slide-plan image
  directions from semantic routing while retaining specific LLM image
  directions. Visible headline/body/list/CTA copy remains authoritative, so a
  nutrition Resource Collection routes to food-and-table assets instead of
  unrelated skincare packaging. Matching app and worker regression checks
  enforce that boundary.
- This change continues to use the existing authenticated
  `ugc-carousel-worker` Cloud Run service. It does not create a new Carousel AI
  worker or a parallel text-generation pipeline.
- Replacement visual QA then exposed a separate compatibility defect before
  the customer feed was changed. V1 body-only and takeaway slides intentionally
  have no headline, but `carousel_slides.headline` is a legacy non-null column.
  The worker promoted the body into that column and also persisted the same
  body as `subtext`, so downstream edit/read flows could receive duplicate
  visible copy even though the flattened renderer drew the sentence once.
- Planner `llm-carousel-planner-v26-specific-fallback-copy` and the matching
  persistence adapter are the corrective architecture. The adapter promotes
  body-only copy into the legacy headline column but clears a normalized-equal
  subtext. The deterministic Examples and Resources safety paths now describe
  the saved topic and customer goal directly instead of repeating abstract
  phrases such as `current routine` and `supporting context`. Resource evidence
  prioritizes specific multi-word profile facts, rejects weak standalone labels
  such as `AI` or `support`, and uses semantic similarity that permits a
  distinct guide and checklist without admitting near-duplicate resources.
  Regression tests cover all 15 V1 grammars, compact resource evidence,
  repetition avoidance, and persistence-level copy deduplication.
- Do not mutate or overwrite the rendered URLs of the affected assignment.
  Once v26 is deployed and a replacement has completed production validation,
  retire the stale assignment and expose the new generation through the
  existing assignment/feed records.
- v26 production validation completed from Cloud Build
  `7a5b6a13-a895-40a8-a4ab-a4220022f834`. Image
  `carousel-v26-65ab455` has digest
  `sha256:62da0d886a051f5bde8713e628b237a006537cfd6eebfe427cf83a0579c05215`
  and source commit `65ab455ad75848d370718c0a382b04018467da86`.
  The isolated deterministic canary generated customer replacement
  `5505987f-735f-4b95-a562-8e6272baa00a` through background job
  `cc233321-76a1-4a19-ae58-ebd426979a2a`.
- That replacement contains five distinct approved object-only assets, all
  five immutable WebP URLs returned HTTP 200 at 1080x1350, the v4 broad
  matcher selected `food-and-table` on every slide, and the renderer reported
  zero escaped text pixels on all five slides. Manual contact-sheet review
  confirmed coherent nutrition imagery, specific six-resource copy, and no
  duplicated persisted headline/subtext on its body-only takeaway.
- Final production revision `ugc-carousel-worker-carousel-v26-65ab455` now
  receives 100% of Carousel worker traffic. Temporary v25 replacement and v26
  canary tags were removed. Startup logs verify normal `llm` planner mode,
  planner `llm-carousel-planner-v26-specific-fallback-copy`, global broad
  matcher `enabled` with `broad-runtime-matcher-v4`, and the exact source
  commit above.
- The final feed-assignment redirect was not performed in this release step:
  the managed approval service timed out on the guarded Supabase mutation and
  its permitted retry. The customer feed therefore remains on assignment
  `9d8d9d58-9317-49d0-85d3-1f6e889dec3b`; no original generation or rendered
  asset was deleted or overwritten. Re-audit edits, Library saves, and
  Trending decisions before retrying the idempotent redirect.

## 2026-08-13 Carousel V1-Only Generation Guard

- At that release, the supplied Carousel architecture used one current
  Business Profile, backend selection of one of 15 five-slide formats and one
  compatible hook family, one compact history snapshot of at most ten prior
  Carousels, strict validation, and a validated deterministic safety fallback.
  The per-Carousel request boundary described in this original guard was
  superseded by the controlled five-Carousel batch decision below, and the
  deterministic publishing fallback was later retired by the 2026-08-23 copy
  preservation decision.
- Every Carousel still begins with one hook. Diversity means rotating the
  backend-selected hook family and writing fresh wording; it does not mean
  producing a Carousel without a hook.
- New Carousel rows may now be created through the automatic Business Profile
  and daily-inventory preparation path only. The old authenticated
  `POST /api/carousel/generate` and `POST /api/carousel/generate-more` routes
  return HTTP 410 with `carousel_manual_generation_retired`; they no longer
  create rows or enqueue jobs. This enforces the earlier product decision that
  Trending is automatic and has no manual Generate workflow.
- The application database creation boundary now requires a Business Profile
  ID, exact profile version, V1 content assignment, and
  `generation_source = auto_generated`. A TypeScript caller cannot create an
  unassigned legacy generation through that function.
- Planner `llm-carousel-planner-v28-controlled-five-carousel-batch` fails before any LLM
  or deterministic writing when a request is not exactly five slides or lacks
  a valid compatible format/hook-family assignment. The legacy generic planner
  prompt and the generic fitness/business fallback are no longer part of the
  active writer. Existing stored legacy Carousels remain readable and are not
  deleted, rewritten, or re-rendered.
- Compact recent history is present in the initial prompt and is now also
  present in every repair prompt when history exists, even when the first
  validation failure was not itself classified as repetition. The later
  2026-08-23 decision keeps repetition advisory and does not use fallback copy.
- The deterministic V1 behavior described by this historical release remains
  only as legacy compatibility/test code; active publishing calls fail closed.
- Validation telemetry now distinguishes `fallbackUsed` from `repaired`. A
  deterministic fallback records `fallbackUsed = true` and `repaired = false`;
  a successful LLM repair records the inverse. This prevents quality reports
  from presenting fallback output as a successful AI repair.
- These V1-only route, application, planner, test, and documentation changes
  are local source changes. They require the database migration, normal
  application and Carousel worker release, plus an authenticated production
  canary before being called live.

## 2026-08-13 Controlled Five-Carousel Format Testing

- The existing stable format IDs remain canonical. They are not renamed to
  numbered IDs. Every format definition now stores an integer `rotationOrder`
  from 1 through 15 and an integer `version` (currently 1).
- A controlled experiment batch always contains exactly five Carousel slots.
  Batch sequence 0 attempts rotation positions 1-5, sequence 1 attempts 6-10,
  and sequence 2 attempts 11-15. Later cycles rotate both the first group and
  the positions inside each group to reduce timing and position bias.
- Rotation state is durable per Business Profile. The application reserves
  `carousel_experiment_batches` through one advisory-lock-protected database
  transaction before creating generation rows or asking AI for text. Failed,
  deleted, or skipped output never rewinds the monotonically increasing batch
  sequence.
- Each reserved batch persists five normalized
  `carousel_experiment_assignments`. It records the originally assigned
  format, format version, selected compatible hook family, actual generated
  format, replacement origin, linked generation, and lifecycle status.
- New generation rows link to their experiment batch and assignment and store
  both `content_assigned_format_id` and the actual `content_format_id`, plus
  `content_format_version`. The actual ID is authoritative for rendering,
  history, and later performance evaluation.
- Hook families rotate deterministically within each format's compatible
  family list. The selector uses persisted/recent attempts for that format; it
  does not choose families or formats using a pseudo-random seed score.
- One `generate_carousel` background job now owns one experiment batch and one
  initial structured AI request returns all five Carousel plans. The request
  receives only the five required format definitions, their assigned hook
  families, saved business context, compact recent history, and normalized
  saved analysis for evidence validation.
- Every returned Carousel is parsed and validated independently. A broken item
  receives one small isolated repair request; the other four accepted items
  are never regenerated by that repair.
- The AI may return `not_applicable` for a slot only when the saved context
  cannot honestly support that format. The worker deterministically reuses an
  already applicable format and hook family from the same batch, asks only for
  that one replacement Carousel, still returns five outputs, and persists the
  repeated format as the normal actual `content_format_id`. It never mutates
  the saved Business Profile to make a format fit.
- Recent history remains compact and capped at ten. It now includes the stable
  audience ID alongside hook, topic, angle, format, and hook-family fields;
  full prior slide copy is not sent.
- Daily inventory deficits are rounded up to a whole five-item experiment
  batch, capped at 50, so an initial text request is never split into fewer
  than five Carousel outputs.
- Experiment tables enable RLS, expose no `anon` or `authenticated` access,
  and explicitly grant only the server `service_role` the required Data API
  privileges. This accounts for Supabase's 2026 explicit-grant behavior for
  new public tables.
- Performance weighting now extends this controlled rotation through the
  bounded learning decision below. Generated, accepted, saved, scheduled,
  published, and evaluated remain separate concepts; only a comparable
  evaluated publisher snapshot may change a later selection multiplier.
- This architecture is implemented and production-build validated locally.
  Migration `20260813110309_add_controlled_carousel_experiment_batches.sql`,
  the application, and the worker must all deploy together before the feature
  can be called live. Existing completed legacy Carousels remain readable and
  are not deleted or rewritten.

## 2026-08-13 Bounded Carousel Performance Learning

- Performance learning extends the controlled five-Carousel selector; it does
  not replace the V1 architecture, delete the rotation, or create another
  background worker. The existing Instagram content-analytics sync performs
  best-effort Carousel attribution after it loads real platform results.
- Evidence must trace through an owner-scoped `published`
  `scheduled_post_target`, its server Library item, and the original completed
  `carousel_generations` row. The platform post ID, social connection, owner,
  actual `content_format_id`, hook family, and Business Profile must all agree.
  Generated, accepted, saved, or merely scheduled Carousels never count.
- A Library Carousel with a `trendingCreativeEdit` is excluded. Its visible
  text may no longer faithfully represent the originally assigned hook family,
  so attributing its outcome to that assignment would contaminate learning.
- Evaluation policy `carousel-performance-seven-day-v1` freezes one publisher
  view snapshot around seven days after publication. A snapshot is comparable
  only within 24 hours before or after the seven-day due time. Once frozen,
  later lifetime views never replace it. Missing or late analytics remain
  unevaluated rather than being treated as zero or compared unfairly.
- Views are the only Carousel learning metric. The Carousel observation and
  ranking path does not collect, store, or score reach, likes, comments,
  shares, saves, or total interactions. Those values may remain available to
  the separate general Analytics and Hook-video systems, but they cannot
  influence Carousel format or hook-family selection.
- Format ranking starts only after at least two formats each have four
  evaluated posts. Median views are the primary result, variation relative to
  average views penalizes inconsistency, and confidence grows gradually after
  the fourth result. Only the latest 20 evaluated posts per format from the
  last 180 days participate, preventing old history from locking selection.
- Learning is multi-winner, not winner-takes-all. Every consistently successful
  format may receive a higher multiplier at the same time. One viral spike is
  limited by the median, consistency penalty, minimum sample size, and a hard
  format multiplier range of `0.85` to `1.25`.
- When comparable format evidence exists, four of five batch slots use
  retry-stable weighted selection without same-batch format duplication. One
  of five slots always remains controlled exploration, and the exploration
  sequence still covers all 15 stable formats. Without enough evidence, all
  five slots keep the existing deterministic rotation.
- Hook-family learning is separate and is compared only inside the same
  content format. It also requires at least two compatible hook families with
  four evaluated posts each, uses the same robust consistency rule, caps its
  multiplier from `0.90` to `1.20`, and preserves 25% controlled hook-family
  exploration. Performance selects a family; the writer must still create
  fresh hook wording and pass recent-history validation.
- Every experiment assignment persists its controlled-rotation candidate,
  actual assigned format, format and hook selection modes, and the capped
  multiplier snapshots used at reservation time. Retried or concurrent
  preparation therefore reuses the original persisted assignment even if
  analytics changes later.
- Migration `20260813122724_add_carousel_performance_learning.sql`, the
  analytics attribution module, bounded selector, preparation integration,
  and regression tests are implemented and production-build validated
  locally. The database migration must deploy before the application code;
  this behavior is not live or production-verified yet.

## 2026-08-13 Trending Onboarding Prebuild

- Final onboarding completion now supplies the browser's validated IANA
  timezone to the server. The completed Business Profile starts today's
  Carousel feed preparation with `markItemsShown = false` before the client
  redirects to Trending.
- Carousel prebuild failures do not roll back a successfully completed
  onboarding profile. The existing authenticated Trending feed endpoint
  remains the idempotent recovery path.
- Wall-of-text preparation is scheduled in the same prebuild orchestration.
  Hook preparation is included only where the existing Hook feature gate is
  already enabled; production Hook behavior is not widened by this change.
- These changes are locally build- and contract-tested. They require the normal
  application and worker release, working Cloud Tasks configuration, and an
  authenticated production canary before being called live.

## 2026-08-20 Trending Preparing Skeleton

- The customer-facing preparation sentence and Carousel-shaped loading stack
  are retired. Initial loading and a genuinely preparing empty feed render one
  dark charcoal 9:16 skeleton at the exact width and position of a Hook or
  Wall-of-text Trending card.
- The skeleton contains no fake text, thumbnails, slide dots, or metadata. A
  separate, faint 32%-wide gradient highlight travels left to right over the
  stable `#18191c` base in a two-second linear loop. The card background,
  opacity, scale, border, and shadow do not animate, and reduced-motion users
  receive the stationary base without the travelling highlight.
- The preview-ready post and skeleton share the same reserved card dimensions
  and crossfade in place over 200ms. Both transition layers remain mounted
  through the handoff, so the change does not require a timer, per-frame React
  updates, or a layout-moving replacement.
- Caught-up and terminal exhausted states remain explicit text states; they do
  not pretend that generation is active.

## 2026-08-17 Carousel Source-Library Reset

- The testing-phase legacy Carousel source library is intentionally being
  retired before a replacement library and tagging model are introduced. This
  is an explicit exception to the normal rule to retain approved surplus
  assets.
- Reset scope is limited to `category_image_assets`, its
  `category-library/` GCS source objects, `carousel_image_usage`, and the
  source-asset foreign keys on `carousel_slides`. It does not delete immutable
  rendered Carousel output, Library child-slide records, scheduled posts, or
  any avatar, overlay, Hook, Wall-of-text, or unrelated media catalog.
- Before deleting source assets, the reset retires active Carousel assignments
  and requires both `generate_carousel` and
  `render_trending_carousel_edit` jobs to be terminal. Stored legacy
  Carousels consequently remain historical rendered artifacts only; they are
  not editable or eligible for a new Trending assignment after the reset.
- The reset deletes the physical source objects and the old asset rows rather
  than retaining archived metadata. The next library must be imported under
  the existing `category_image_assets` contract with its new, reviewed tagging
  structure before Carousel generation resumes.

## Next Implementation Slice

Name: **Verify v26 and replace the stale production assignment**

1. Obtain explicit approval for the guarded Supabase assignment mutation.
2. Re-audit the stale assignment for intervening edits, saves, or Trending
   decisions. If still untouched, point only feed item
   `5b63f84e-a33a-48a3-9b70-6dfef658be38` at a new pending assignment for
   generation `5505987f-735f-4b95-a562-8e6272baa00a` and mark the old
   assignment `completed_skipped`.
3. Verify the authenticated production Trending card after refresh while
   retaining all original generations and rendered assets.

## Working Rules

- Make one behavior change per slice and validate it before deployment.
- Keep API routes thin; heavy generation belongs in authenticated GCP Cloud Run
  workers.
- Never use Supabase Edge Functions for Sharp rendering.
- Never make unreviewed assets selectable.
- Never silently fall back to an unrelated category.
- Never trim approved surplus assets.
- Never claim GCP worker behavior changed until the deployed revision is
  verified.
- Never overwrite a rendered Carousel asset behind an immutable URL. Rendered
  keys must change when either the renderer version or output bytes change.
- Keep the production Carousel worker font files in sync with the font family
  used for text measurement and SVG rendering.
- Update this file whenever a product rule or architecture decision changes.

## 2026-08-08 Shared-Browser Account Isolation

- Owner-created Carousel, schedule, and editable-video records must never use a
  global browser-storage collection as a source of truth or fallback.
- Carousel Library reads only the authenticated owner's server Library.
  Scheduling reads only owner-scoped `scheduled_posts`, and video editing reads
  and writes only through the authenticated edit APIs.
- Legacy global browser records are never read, imported, or automatically
  migrated. Their records do not contain a trustworthy owner ID, so automatic
  migration could copy User A's data into User B's account on a shared browser.
  On app load, an exact cleanup removes only the retired Carousel Library,
  schedule-draft, and editable-video keys. Owner-scoped server records and
  unrelated browser preferences are untouched.
- The application query provider is keyed by the current Firebase UID. A user
  change remounts the authenticated application subtree and creates a fresh
  query cache, preventing one account's in-memory page state from carrying into
  the next account.
- Onboarding goal selections autosave to the incomplete owner-scoped business
  profile without marking onboarding complete or changing the profile version.
  Final completion still validates at least one goal and applies the selected
  goals to generation context in one explicit action.

## 2026-08-02 Creative Assets Saved Collection and Scheduling UI

- Creative Assets now exposes a `Saved` tab beside Videos and Images. It is a
  unified customer surface over the existing owner-scoped Carousel, Hook, and
  Wall-of-Text stores; it does not duplicate rendered media or introduce a
  second source of truth.
- Trending save confirmations for all three formats link to
  `/avatars?tab=saved`. Existing saved creatives appear automatically because
  the tab reads the established Library and saved-draft APIs. Repeated saves
  keep the existing idempotent behavior of each format.
- A saved Hook is identified as a composition until the downstream scheduling
  render combines it with the selected footage. Carousel and Wall-of-Text keep
  their existing rendered/preparing states.
- Scheduling account rows now display the backend-provided
  `profilePictureUrl`, with the platform icon as an image-load fallback. The
  same shared avatar is used by Carousel, Hook, and Wall-of-Text scheduling.
- The Carousel scheduling dialog uses fixed header, scrollable-content, and
  footer grid rows. The content no longer forces a minimum height, so the Back
  and Next controls remain visible on shorter screens.
- The Carousel scheduling header is text-only and does not repeat the
  Instagram logo. Publishing-account rows still show the selected account's
  real profile picture because that identity is actionable confirmation.
- These UI changes are production-build validated locally. They are not
  deployed or authenticated-production verified yet.

## 2026-08-03 Content Library Demo-Footage Boundary

- The visible `/library` Content Library is dedicated to reusable demo footage.
  Its duplicate Carousels tab is removed, and legacy `?tab=content` links now
  resolve to the demo-footage view.
- Saved Carousels remain available under Creative Assets > Saved through the
  existing `CarouselLibraryTab`. Carousel storage, save APIs, preview,
  scheduling, publishing, and deletion behavior are unchanged.
- This is a frontend navigation and presentation decision only. It does not
  remove Carousel records, routes, workers, or the Library-backed scheduling
  source of truth.

## 2026-08-20 Creative Assets Presentation Simplification

- Videos and Images no longer place the optional group switcher inside a
  dedicated explanatory card. `All assets`, every owner-created group, and the
  compact `Create group` button remain available in one bare control row; group
  storage, membership, upload, rename, and delete behavior are unchanged.
- Saved no longer renders the introductory `Saved content` card or enclosing
  format panels. Its format filters remain as a compact control row, and Hook,
  Wall-of-Text, and Carousel results render through a flat embedded
  presentation. The existing owner-scoped APIs, preview, refresh, removal, and
  scheduling behavior remain unchanged.

## 2026-08-22 Inline Carousel Scheduling Bundle Boundary

- Trending and Library now load the shared Carousel scheduling modal only after
  a real `SchedulePlatformContext` has been created. The closed modal is not
  part of either route's initial client bundle.
- While the modal chunk opens, a blocking status surface keeps the existing
  page in place and clearly reports that scheduling is opening.
- The modal's account loading, selection limits, optional caption, publishing
  settings, date/time validation, durable-draft recovery, submission callbacks,
  and close/reset behavior are unchanged. Closing still clears the parent
  scheduling context, so a later open starts with fresh modal state.

## 2026-08-22 Creative Assets Saved Bundle Boundary

- The default Videos view and the Images view keep the existing
  `UserMediaCollection` path and behavior. The Saved collection is now a named
  dynamic import from the client workspace and is requested only when Saved is
  the active tab.
- A direct `/avatars?tab=saved` visit still selects Saved on the server and
  shows a content-only loading status while its client chunk arrives. Normal
  Videos and Images navigation no longer downloads the inactive Saved
  collection's Hook, Wall-of-Text, and Carousel library code up front.
- Saved format filters, owner-scoped APIs, preview, refresh, removal,
  scheduling, and storage behavior are unchanged. This boundary does not add a
  cache or alter any data-fetching contract.

## 2026-08-22 Trending Hook Flow Bundle Boundaries

- The live Trending feed keeps Hook composition state in its existing parent
  wrapper and includes `HookVideoComposer` in the initial Trending client
  bundle. The composer still opens only after an accepted Hook enters
  composition, but a right swipe no longer depends on loading a fresh client
  chunk that may be stale after a deployment. Closing the composer clears the
  parent composition and returns to the already-loaded in-memory daily pack; it
  does not refresh or regenerate the feed.
- The shared Hook/Wall scheduling drawer is loaded only when its existing
  open or pending-schedule state is present in Trending, Hook composition, or
  the Saved Hook library. A blocking scheduling status covers the short chunk
  load without unmounting the parent creative or library state.
- Preview-session creation, demo and suggestion selection, drafts, connected
  account loading, publishing settings, schedule validation, submission,
  completion, and close/reset behavior are unchanged. These boundaries alter
  client-code delivery only; they do not change API or storage contracts.

## 2026-08-22 Shared Account Scheduling Queries

- The active Scheduling, Analytics, Settings, Carousel scheduling, and
  Hook/Wall scheduling surfaces now read social connections and schedules
  through shared React Query entries keyed by the current Firebase UID.
- Fresh account data is reused for at most 15 seconds and retained inactive for
  30 minutes. The account-keyed query provider is still remounted when the UID
  changes, so no cached connection or schedule can cross accounts.
- A full schedule read also seeds the smaller scheduling-configuration query,
  avoiding a second request when a scheduling drawer opens immediately after
  Scheduling or Analytics. A stale full schedule is never treated as fresh
  configuration.
- Existing correctness-sensitive refreshes remain explicit: OAuth completion,
  manual account refresh, user-initiated Scheduling catalog refresh, and the
  two-second active-schedule poll bypass the freshness window. Schedule
  mutations update the open Scheduling cache directly or invalidate the shared
  schedule query before another route can reuse it.
- API routes, durable schedule creation/publishing behavior, recovery errors,
  account selection, lead-time validation, and visible loading/error behavior
  are unchanged. Dormant legacy multi-platform workspaces remain untouched.

## 2026-08-22 Scheduling Editor Bundle Boundary

- The Scheduling calendar, list, tabs, schedule polling, and action dialogs stay
  in the initial `/scheduling` client module. The large create/edit drawer is a
  named dynamic import requested only when a new, edit, or deep-linked draft
  flow has set the existing parent-owned `drawerOpen` state.
- The workspace still owns the open/edit identity, selected server schedule,
  account-scoped catalogs, connections, mutations, refreshes, and error state.
  The deferred editor owns only the same temporary form state it owned before
  extraction, so opening, saving, closing, and reopening retain their previous
  reset and preservation behavior.
- Presenter preparation still uses the authenticated `/api/media/from-avatar`
  request through a parent callback. Manual media refresh remains a forced
  account-scoped catalog refresh, and saved account targets, hidden legacy
  platforms, carousel sources, captions, five-minute lead validation, and
  TikTok publishing settings are unchanged.
- A blocking loading surface is shown only while the editor chunk is arriving.
  This boundary changes client-code delivery, not scheduling API, database,
  publishing, recovery, or ownership contracts.

## 2026-08-23 Creative Assets Premium Pill Navigation & Unified Saved Presentation

- The primary Creative Assets collection switcher (`Videos`, `Images`, `Saved`)
  now uses a premium floating pill capsule track with elevated active tabs,
  matching the secondary format switcher in Saved.
- The `Saved` tab retains its dynamic bundle boundary and owner-scoped Hook,
  Wall-of-Text, and Carousel stores, but now unifies their presentation:
  - When filtering by `All`, empty sub-libraries do not render placeholder
    boxes that push down populated content.
  - If all formats are empty, a single unified onboarding empty state is
    displayed with shortcuts to explore Trending.
  - When specific format filters (`Hook videos`, `Wall-of-Text`, `Carousels`)
    are selected, only the targeted format is rendered.
- Existing preview dialogs, Instagram/TikTok scheduling drawers, deletion APIs,
  and recovery error handling remain unchanged.

## 2026-08-23 Production Color Palette Modernization

- Upgraded the central light design tokens in `app/globals.css` from the legacy warm/brownish palette to the modern production palette:
  - `--primary: #ff5a1f` (Electric Coral-Orange) replacing legacy `#c94716`
  - `--primary-hover: #e04810` replacing legacy `#ad3c12`
  - `--brand: #ff5a1f` and `--brand-soft: #fff7ed`
  - `--background: #f8fafc` (Ghost White / Slate 50) replacing `#f8f8f7`
  - `--foreground: #0f172a` (Deep Slate 900) replacing `#181817`
  - `--muted: #475569` (Slate 600) replacing `#666663`
  - `--muted-subtle: #94a3b8` (Slate 400) replacing `#73736f`
  - `--border: #e2e8f0` (Slate 200) and `--border-strong: #cbd5e1` replacing `#e5e5e2` / `#d4d4d0`
  - `--card-muted: #f1f5f9` and `--surface-subtle: #f1f5f9` (Slate 100)
  - `--success: #10b981` (Emerald 500) replacing `#168a4a`
- Updated pricing checklist checkmarks to use `text-success` (`#10b981`).
- All layout dimensions, responsive behaviors, component trees, API contracts, and business logic remain completely unchanged.

## 2026-08-24 Trending Centered Stacked Review Stage

- Trending presents one interactive active creative in a centered review stage,
  with the next two real feed items mounted as a quiet visual stack behind it.
  The next card peeks above the active creative at rest, and the deeper preload
  layer remains visible enough to communicate that more content is ready.
- Both background cards remain non-interactive, inert, and hidden from
  assistive technology. They retain protected Hook preview preparation,
  Carousel image preloading, and Wall video warm-up without creating duplicate
  controls or another accessible review target.
- Dragging the active card in either direction progressively promotes the same
  next card using the absolute horizontal drag distance. A small left or right
  movement therefore reveals real prepared media immediately; cancelling the
  gesture returns the stack to rest, while a completed decision promotes that
  already-mounted item without a blank intermediate frame.
- The active Carousel uses a compact responsive 4:5 width capped at 270px.
  Hook and Wall-of-Text previews use a compact responsive 9:16 width capped at
  230px. Both formats remain constrained by the available dynamic viewport
  height so decision controls stay visible on short screens.
- Slideshow media covers the complete fixed 4:5 review frame. A source whose
  aspect ratio does not match the frame may crop only its excess edges instead
  of exposing empty left or right gutters; the card dimensions remain unchanged.
- The format label is attached directly above the active card and uses a compact,
  flat treatment. Reject and Accept stay centered immediately below the active
  creative and do not use ambient elevation.
- The format label uses a neutral 22px surface with 10px medium-weight copy. Only
  its small icon carries the format identity color; the pill itself has no glow,
  ring, shadow, blur, or format-colored background.
- The active creative's own responsive frame is the geometric center of the
  review area. The format pill and decision controls are positioned outside that
  frame, so neither changes the card's horizontal or vertical center.
- The pill stays visible above the complete prepared stack in reserved space.
  It clears ordinary same-height stacks by 40px and clears a taller 9:16
  background item behind an active 4:5 Slideshow by 72px, preventing the label
  from covering any media or overlay copy.
- The deck reserves 94px above the active frame for the pill/stack clearance
  and 107px below it for Skip/Accept. These rails keep both control groups out
  of the Trending subtitle and neighboring layout even at constrained desktop
  heights.
- Responsive card sizing subtracts the 348px page/deck chrome budget before
  applying each format ratio. The normal desktop caps remain 270px for
  Slideshow and 230px for 9:16 video, while shorter viewports reduce the media
  instead of forcing the controls off-screen.
- Keyboard focus is drawn around the active card-sized frame rather than a
  full-width deck container. The Trending section retains horizontal clipping
  for swipe exits without exposing a large empty focus outline.
- Hook and Wall-of-Text share one authoritative responsive 9:16 frame class.
  Their outer articles therefore have identical width and height at every
  breakpoint; only their media and overlay content differ.
- Swipe, keyboard, Edit, decision outbox, Carousel slide navigation, and feed
  ordering behavior are unchanged.
- User-facing Trending language calls the generated outputs `content`, never
  `ideas`. This applies to preparation, empty and failure states, card labels,
  and accessibility text; internal candidate and idea naming remains an
  implementation detail.
- The shared `creative-reject`, `creative-accept`, and `creative-edit` button
  variants are shadowless by default. Their separation comes from a quiet border,
  semantic icon color, hover fill, and the existing keyboard focus ring.
- Hook and Wall-of-Text audio controls use a compact flat overlay without ambient
  shadow or backdrop blur. Hook cards, rendered Carousel/Wall cards, edited
  badges, and the Trending loading card also avoid ambient elevation.
- The Trending header's `Adjust` and item-level `Edit` actions share the same
  compact 36px pill size, padding, typography, icon scale, border weight, hover
  treatment, and focus behavior. Their labels and semantics remain distinct.
- The Adjust content-mix dialog keeps one identity color per format everywhere
  that format is represented: Slideshows use the existing primary orange,
  Wall-of-Text uses the existing product purple, and Hooks use the existing info
  blue. The composition segments, icon badges, percentages, slider progress,
  and slider thumbs use that same mapping. The composition ribbon and slider
  tracks use a slimmer six-pixel treatment for a quieter premium hierarchy.

## 2026-08-23 Carousel AI Copy Preservation and Model Pin

- Structure 1 and Structure 2 Carousel writing requests use the shared
  source-pinned `gpt-4o-mini` model. The worker logs that exact model plus both
  planner versions at startup, and stored generation provenance remains the
  authority for confirming the model that produced a particular Carousel.
- The publishing contract separates blockers from writing preferences. Invalid
  JSON, changed selected format, wrong slide order or role, missing required
  fields, renderer length/shape violations, product-timing violations,
  prohibited visual subjects, and unsupported or prohibited claims may block
  or trigger one isolated LLM repair. Word-count targets, perspective style,
  CTA semantics, generic phrasing, grammar style, and repetition are advisory
  diagnostics only.
- When an AI response passes the publishing contract, its copy is preserved.
  The worker no longer replaces or augments accepted text through a hardcoded
  post-processing copy rewriter.
- Structure 2's authored deterministic story fallback is removed from the
  planner and its active batch runtime. If the initial structured batch and one
  isolated LLM repair cannot produce a publishable item, generation fails and
  can be retried; no template sentence is published in its place. Structure 1
  is also LLM-only: its deterministic writer, enable/disable switch, fallback
  result type, and authored persistence placeholder have been removed rather
  than merely disabled at publishing call sites.
- Historical rows whose provenance says `deterministic-fallback` remain
  immutable records of the earlier implementation. They are not rewritten or
  presented as LLM output.
- This source change is locally build- and regression-tested. It is not live
  until the Carousel worker is deployed and an authenticated production canary
  verifies `content_planner_model = gpt-4o-mini`, `content_plan_source = llm`,
  and preserved visible copy on both structures.

## 2026-08-24 Structure Contract and Live-Output Validation

- Structure 1 planner `llm-carousel-planner-v30-llm-only-structure-contract`
  has no deterministic writing mode or authored-copy fallback. Missing OpenAI
  configuration, an invalid initial response, and a failed isolated repair all
  fail closed. The historical `content_plan_fallback_reason` and
  `fallbackUsed` persistence fields remain readable for old rows but new
  Structure 1 planner results always use source `llm`, a null fallback reason,
  and `fallbackUsed = false`.
- The Structure 1 JSON contract binds every returned slide to the assigned
  slide number, role, slide type, allowed text modes, CTA position, and exact
  list-item count. A role without `listItemCount` must return an empty list;
  extra list copy is a structural failure eligible for the one LLM repair, not
  ignored data and not replacement prose.
- Slide persistence no longer invents `Slide N` when an impossible empty-copy
  record reaches it. It throws before persistence because every published
  visible string must originate in the accepted AI plan.
- Structure 2 remains LLM-only. The historical `productMechanism` selection and
  forced Slide 4 product sentence have been removed. The writer now receives the
  minimal saved `businessDescription`, one open creative seed plus emotion, the
  selected format as a flexible reference, and recent accepted copy. Unsupported
  precise features, proof, metrics, customers, guarantees, and outcome claims
  remain blockers; valid original AI wording is not replaced.
- The shared runtime slide-plan module now contains types only; its old authored
  deterministic builder was removed. The scale-readiness audit owns a local
  synthetic fixture instead, so offline matcher testing cannot become published
  copy by being imported into a runtime path.
- Local contract validation covers all 15 Structure 1 formats and all eight
  Structure 2 formats. A live `gpt-4o-mini` planner audit returned one valid
  Structure 1 plan and five valid Structure 2 plans with LLM provenance and no
  fallback copy. Structure 2 still produced advisory word-count and writing
  quality findings; these are retained as diagnostics, consistent with the
  decision not to replace structurally valid AI wording.
- Structure 1's two-attempt recovery to Structure 2 is allowed only for an
  automatic rotation batch whose five items already have durable content-plan
  provenance. An explicit Structure 1 request fails as Structure 1. Recovery
  preserves the same reserved creative seeds and emotions and only changes the
  LLM presentation structure; neither writer may publish deterministic prose.
- These changes are local source changes and must not be described as live
  until the Carousel worker is deployed and the authenticated production flow
  is verified on `https://www.getugcpilot.com`.

## 2026-08-24 Carousel 30-Day Creative Plan Architecture

- A business profile keeps its complete analysis for existing product and
  operational uses. Carousel creative planning does not replace or truncate
  that stored analysis. It deliberately projects only the saved
  `businessDescription` into the creative-plan and slideshow-writing prompts so
  the writer receives factual grounding without a fixed problem, audience,
  workflow, outcome, or product-mechanism storyline.
- Each 30-day plan contains 150 durable items: five organizational slots for
  each of 30 days. The day grouping is inventory organization, not a daily usage
  limit. Every item contains exactly an open-ended `creativeSeed` and a required
  `emotion`; it must not contain finished slide copy, a hook, CTA, full story,
  format, structure, or product mechanism.
- Structure 1 and Structure 2 consume the same neutral item inventory. A request
  reserves the required number of items atomically, attaches them to the job,
  and consumes each item only after successful Carousel persistence. Failed
  requests release their reservations, and expired reservations can be reused.
  The next 30-day plan is generated when the current planning period needs a new
  inventory.
- Both writers receive the reserved `creativeSeed`, its `emotion`, the minimal
  `businessDescription`, their selected format reference, and the exact visible
  copy from the last ten accepted Carousels (hook/headline, every slide's visible
  text, CTA, structure, format, generation ID, and content-plan item ID). The
  history is not reduced to an LLM-generated summary.
- Structure 1's format contract is unchanged. Structure 2 remains exactly five
  slides, but its eight formats are creative references rather than a compulsory
  sentence-by-sentence story backbone. Examples and role guidance may inspire
  the LLM, while the five-slide count, selected format ID, required fields, and
  renderability remain structural. CTA presence and slide position are creative
  choices and never publishing gates.
- Content-plan generation and both slideshow writers are source-pinned to
  `gpt-4o-mini`. Structural invalidity can trigger one isolated LLM repair or a
  failure. Structurally valid AI copy is preserved even when advisory diagnostics
  identify generic phrasing, repetition, CTA quality, perspective, or word-count
  drift.
- The database foundation, lifecycle, asynchronous plan-generation job, and
  Carousel provenance link are introduced by migrations `20260824150000`
  through `20260824153000`. They must be applied before deploying the app and
  worker revisions that use the plan-first contract.

## 2026-08-25 Private Carousel Creative-Brief Layer

- Carousel remains a 150-item, 30-day inventory: five usable ideas per
  organizational day. Wall-of-Text is explicitly outside this plan and must
  receive its own future planning architecture.
- New Carousel plans create 30 private creative briefs, each producing exactly
  five durable `creativeSeed + emotion` items. The six brief fields are
  `creativeSeed`, `audienceContext`, `humanMoment`, `emotionalTension`,
  `supportedAngle`, and `preferredFormatFamily`. They are internal AI context,
  never frontend labels, slide fields, or user-visible output JSON.
- The planner receives an explicit definition for every private brief field:
  `creativeSeed` is a human observation rather than final copy;
  `audienceContext` is a supported, non-universal audience segment;
  `humanMoment` is a concrete everyday event; `emotionalTension` is the
  resulting inner conflict; `supportedAngle` is an approved-fact-only business
  connection rather than a sales claim or promise; and
  `preferredFormatFamily` is a soft storytelling direction. All six fields are
  used together for each set of five child ideas. The selected Carousel format
  remains authoritative.
- Brief generation receives an approved business-profile context snapshot
  (audience, pain points, differentiators, value, tone, purpose, category, and
  stated problem/promise) alongside the minimal business description. It must
  not invent factual support, audience segments, capabilities, evidence, or
  guarantees.
- A final Carousel writer receives its one durable idea plus its parent brief.
  The brief supplies human specificity but does not impose a story. The
  backend-selected Structure 1 format and hook family, or the selected
  Structure 2 format reference, remain authoritative.
- `preferredFormatFamily` is only a soft variety direction; it is not a
  renderer ID, cannot override a selected Carousel format, and cannot create a
  CTA requirement. Existing optional-CTA behavior remains unchanged.
- Each parent brief and its five child items persist atomically. The existing
  item reservation, release, provenance, and one-time consumption contract is
  unchanged. Legacy items have no parent brief and continue with their original
  seed-plus-emotion behavior.
- The additive rollout is migration
  `20260825110000_add_carousel_creative_briefs.sql`. It must be applied before
  the app and worker revisions. Existing active plans are not rewritten or
  invalidated; a new plan uses the richer brief layer once it is created.

## 2026-08-24 Carousel Human-Hook Library Reconciliation

- Source paths under `gym_part2/human_hook` classify as Gym hook assets, and
  source paths under `productivity_humanhookpart-2/human` classify as
  Productivity hook assets. They are available to the first-slide human-hook
  rotation without changing unrelated categories.
- `scripts/reconcile-carousel-role-library.mjs` is the targeted, auditable sync
  path for these three local source trees. It uploads new sources, refreshes
  changed sources, removes stale database rows and objects only within the
  selected source scopes, and verifies the resulting backend inventory.
- The live targeted reconciliation inserted 30 hook assets, refreshed 240
  retained Productivity human assets, removed 33 stale selected-scope rows, and
  verified 810 selected-scope GCS objects with no stale selected-scope rows.
  Unrelated missing Travel sources were intentionally outside this operation.

## 2026-08-23 Carousel Editor Render Fidelity

- The persisted rendered slide is the initial Carousel editor preview source of
  truth. Opening Edit must show the same crop, compositing, line breaks, font
  scale, text treatment, and text position as Trending; the editor must not
  immediately replace that asset with a browser reconstruction over the raw
  category image.
- After the user changes a field, the live preview reads the slide's real
  `structureId`, Structure 2 layout variant, text treatment, render format, and
  visual role. Structure 2 stays horizontally centered and exposes only the
  renderer-supported upper/center/lower vertical placement. Product screenshots
  preview the contained foreground over the softened cover backdrop used by the
  renderer.
- Structure 2 renderer version `story-native-renderer-v2-line-bubbles` replaces
  the oversized full-block pill with quiet line-sized white shapes and reduces
  the story and CTA font ranges. `pill` treatment uses black text on white;
  `overlay` and `outlined_overlay` use white text directly over the image.
- Structure 1 continues to use its connected line-bubble renderer and therefore
  uses black text on white. A no-bubble Structure 1 mode is not inferred in the
  editor because it is not part of the Structure 1 persistence contract.
- The editor-only SVG drop shadow is removed. Any treatment visible when Edit
  opens now comes from the actual rendered asset, and live preview geometry does
  not add a separate shadow that the worker did not render.
- The user-facing first-slide image selector is named `Hook library` and is
  presented as a simple folder. The existing `hyper-hooks` identifier and API
  remain internal compatibility details and are not user-facing product names.
- Existing immutable Carousel render files are not rewritten in place. New
  generations and saved edits use the v2 Structure 2 renderer; an already-stored
  v1 asset remains exact until it is explicitly edited and rendered again.

## 2026-08-23 Trending Adjust and Edit Action Boundary

- `Adjust` is the global Trending feed action. It opens the authenticated
  content-mix preference flow backed by `/api/trending/content-mix` and controls
  the daily percentage split between Slideshows, Wall-of-Text, and Hooks.
- `Edit` remains the active-creative action. It changes the current creative's
  copy, media, and supported placement; it does not change the daily feed mix.
- Both actions are visible together in the Trending header when an active
  creative exists. Adjust remains available while the feed is loading, empty,
  or caught up so the global preference is not coupled to a card being present.
- The mix editor keeps the three percentages at exactly 100 percent while
  respecting the existing backend caps. Changes to either video format trade
  against Slideshow; changing Slideshow proportionally redistributes the two
  capped video formats.
- Free, Starter/legacy Pro, and Growth users can all save a valid daily mix.
  Free retains 30/40/30 only as its no-preference default; a saved Free
  preference is authoritative for a newly created daily pack.
- Saving does not rewrite a completed daily pack. The existing backend contract
  applies the preference today only when no daily feed exists; otherwise it
  starts with the next local day.

## 2026-08-24 All-Plan Trending Mix Adjustment

- Every authenticated plan may adjust the daily percentage split between
  Slideshows, Wall-of-Text, and Hooks. This includes Free, Starter (the legacy
  `pro` key), and Growth.
- Free's ten-post allowance is unchanged. A Free user without a saved
  preference still receives the 30% / 40% / 30% default; after a valid save,
  that owner-scoped preference controls the next eligible daily pack.
- The existing integrity rules are unchanged: all percentages total 100%, each
  format may use the full daily allowance, and an already-created daily pack
  remains immutable. A save applies today only when no feed exists;
  otherwise it starts on the next local day.
- The Adjust dialog uses a restrained flat control-panel treatment with a 6px
  composition ribbon, 6px slider tracks, and 14px thumbs. Format identity
  colors and accessible keyboard/focus behavior remain intact.
- Migration `20260827180000_allow_full_format_content_mixes.sql` widens the
  persisted preference and daily-feed validation to 0-100 for every format.
  Hook and Wall-of-Text generation already support the 50-post maximum daily
  plan, so workers do not need to change.

## 2026-08-24 Sectioned Settings Navigation

- Customer Settings now presents one active section at a time in this fixed
  order: Account, Business Context, Plan & billing, App screenshots, Connected
  accounts, Preferences, Product updates, Raise Ticket, Request Feature, and
  Privacy & data.
- App screenshots remains the existing owner-scoped product-screen library;
  its upload, validation, storage, removal, and Structure 2 eligibility
  behavior are unchanged.
- The Carousel administration component and APIs remain in source, but the
  administration panel is no longer mounted in the customer Settings screen.
- Existing `#subscription-billing`, `#app-screenshots`, and
  `#instagram-publishing` deep links select the matching section instead of
  scrolling through one long settings page.

## 2026-08-24 Database-first Instagram Analytics Refresh

- Instagram Analytics reads owner-scoped durable database snapshots before it
  considers a provider refresh. The account-keyed browser query cache keeps
  those results fresh for 30 minutes, so revisiting Analytics inside that
  window neither clears visible data nor starts another synchronization job.
- Account-insight snapshots are specific to the selected 7-, 30-, or 90-day
  range. Content feed coverage is also tracked per range. Opening Analytics
  enqueues work only when that relevant saved snapshot is missing or stale;
  saved data remains visible while an eligible refresh runs in the background.
- Post metrics use the bounded age policy: posts under 24 hours refresh hourly,
  posts from one through seven days refresh every six hours, and older posts
  refresh daily. After the first range snapshot, provider feed scans use a
  one-day overlap from the last successful scan instead of re-reading the
  complete range. Manual
  Refresh bypasses freshness gates but remains an incremental range refresh.
- A successful UGC Pilot Instagram publication immediately inserts its
  non-sensitive media identity into the analytics content store. The normal
  provider synchronization later fills metrics and richer media metadata.
  Registration is best-effort after the durable publish projection and cannot
  turn a successful Instagram publication into a failed publish retry.
- Media-insight failures are isolated per post. A failed post retains its last
  saved values and error marker while other posts in the same account continue
  to refresh; a transient account/feed failure likewise keeps an existing saved
  account visible.
- Hook, Carousel, and Wall attribution no longer runs before content analytics
  is returned. Content synchronization persists the general Analytics
  snapshot, queues a separate durable `instagram_attribution` job, and returns
  without waiting for that attribution work. The existing seven-day Carousel
  performance policy, views-only learning input, evidence chain, and bounded
  selector are unchanged.
- The former three-second browser polling loop is not on the saved-data render
  path. A first-ever load may still observe its durable job, while background
  refresh observation uses a ten-second interval and the same 15-minute upper
  bound as the worker-to-application analytics request.
- These migration, application, and worker changes are local source changes.
  Deploy the additive snapshot migration before the application and worker,
  then verify the authenticated Analytics and post-publication flows on
  `https://www.getugcpilot.com` before describing the behavior as live.

## 2026-08-24 Wall Source Minimum-Duration Cleanup

- Wall-of-Text source videos must be at least 6.000 seconds and at most 60
  seconds. The six-second floor is source eligibility only; it must not be used
  as a duration-derived copy budget.
- The 16 active reviewed Wall sources below six seconds were exported locally,
  SHA-256 and duration verified, human validated, and then removed from the
  production database and GCP storage. Their 16 MP4s, manifest, dependency
  backup, and deletion result remain in
  `artifacts/wall-text-under-6s-review-2026-08-24` for recovery.
- Cleanup removed only the exact reviewed targets: four unused Wall previews,
  three rejected decisions, one historical decided daily-feed slot, one
  isolated one-item generation batch, 16 catalog rows, 16 video objects, and
  16 thumbnails. There were no accepted, selected, edited, published, or
  performance-observed dependents. Post-cleanup verification found zero
  under-six-second active Wall sources, zero orphaned Wall creatives or feed
  slots, and 128 eligible Wall source videos.
- The production database now rejects any active `wall_text_overlay` video
  below six seconds. Local application selection, user-source preparation, and
  both Wall importers apply the same floor; those application/import guards are
  not live until their source changes are deployed.
- Hook video duration eligibility and all Slideshow/Carousel behavior are
  unchanged by this decision.

## 2026-08-24 Wall V7 Spatial-Fit Copy Contract

- New Wall-of-Text writing reservations use prompt version
  `wall-text-writer-prompt-v8-spatial-fit`. Clip duration no longer creates a
  word maximum, reading-time score, or rewrite trigger for the current V7
  `wall-text-overlay-v6` content path.
- Video duration remains source and render metadata only. A current Wall source
  must still be between 6.000 and 60 seconds, but every eligible source uses the
  same copy acceptance contract.
- Each format's word range is a soft target. The layout engine also estimates a
  soft spatial target from the safe text box, but neither target is a required
  minimum or a hard rejection boundary.
- Current V7 copy has an 8-word structural minimum and a 50-word absolute safety
  ceiling. Final acceptance is authoritative measured layout: one continuous
  message must form 4-7 balanced lines inside the safe box using Inter at one of
  the supported 52, 50, 48, 46, or 44px sizes. Copy that cannot fit at 44px
  fails instead of shrinking further.
- The writer may receive one isolated repair for a real publishing failure such
  as measured overflow. The runtime does not truncate, replace, or publish
  canned fallback copy when repair is exhausted.
- A batch already reserved under the prior prompt keeps its persisted assignment
  budgets when resumed so idempotent in-flight work is not silently mutated.
  New reservations use the spatial-fit contract and store its prompt version.
- Hook copy, Hook duration handling, Wall font weight, semantic line ownership,
  and all Slideshow/Carousel behavior are unchanged in this implementation.
- These application changes are locally validated but are not live until the
  application source is deployed and the authenticated production Wall flow is
  verified on `https://www.getugcpilot.com`.

## 2026-08-24 Wall SemiBold Typography and Authoritative Lines

- Current Wall-of-Text preview, editing, validation, and final rendering use
  the bundled Inter SemiBold 600 face. The supported responsive range remains
  52, 50, 48, 46, or 44px, and 44px remains the readability floor.
- The layout engine owns the final measured 4-7 lines. The writer supplies one
  continuous message without authored line breaks; the browser and worker
  consume the saved `finalLayout.blocks[].lines` and do not independently
  reflow accepted copy.
- Current V7 validation requires normalized `sourceContent.text`, `fullText`,
  and the joined authoritative final lines to represent the same message. A
  mismatch fails closed instead of truncating, replacing, or silently
  reformatting the content.
- Legacy database rows and already-queued render payloads with weight 700 stay
  readable during rollout. They are accepted at the boundary and normalized to
  600 in active preview/render specifications without changing their saved
  line text. The production constraint accepts both 600 and 700 and was
  validated without rewriting existing rows.
- Existing rendered MP4 files are immutable and are not retroactively changed.
  Newly generated or re-rendered Wall videos receive the 600 face after the
  worker and application source are deployed.
- The rolling production database migration is live. The application and
  worker source changes are locally validated but are not live until they are
  deployed and the authenticated Wall flow is verified on
  `https://www.getugcpilot.com`.
- Hook typography and text flow, Hook duration behavior, and all
  Slideshow/Carousel behavior are unchanged by this implementation.

## 2026-08-24 Hook Authoritative-Line and Fallback Contract

- The approved Hook writing structure remains one continuous opening thought
  expressed in 1-3 intentional semantic lines, with at most 12 words total,
  7 words per line, and 78 characters. The existing Global Hook text formats,
  evidence requirements, duration-aware human review, and 34-60px readable
  font range are unchanged.
- `hook-overlay-layout-v1` identifies the current authoritative render layout.
  Validated `opening_lines` and the measured `visual_fit.fontSize` now travel
  together through feed preview, editing, draft saving, scheduling, saved-video
  rendering, and the worker. The joined lines must represent the same text.
- Current layouts fail closed when their saved lines, font size, or text do not
  match. The preview does not silently reflow them, the editor does not slice
  extra in-progress lines, and the renderer does not truncate or substitute a
  different line arrangement.
- Hook feed and editor previews now share the export typography contract: the
  exact Geist SemiBold browser face, weight 600, a 5px black outline at the
  1080px render width, and the same emoji/CJK fallback families. Preview-only
  bold and shadow treatments were removed, so review no longer shows heavier
  or softer text than the finished video.
- Old queued jobs and old stored edits without the layout version retain one
  isolated compatibility path that derives a layout once and upgrades it in
  memory. Versioned current content never enters that legacy path.
- A generated Hook receives at most one targeted repair for a real validation
  or review failure. If the repaired result still fails, that candidate is
  excluded; the system does not run a repeated rewrite loop or publish canned
  fallback copy.
- The Wall editor's client-side save gate was also aligned with the already
  approved 8-50-word, measured 4-7-line contract; it no longer repeats the old
  12-word or clip-duration message.
- A final source scan confirmed that clip-time word formulas remain only in
  validation for pre-V7 Wall layout versions. New V7 Wall copy uses the
  duration-independent 8-50 absolute bounds plus measured 4-7-line fit, while
  one targeted content repair remains the only quality rewrite attempt for
  both current Wall and Hook generation.
- These application and worker changes are locally validated but are not live
  until deployed and verified in the authenticated Hook flow on
  `https://www.getugcpilot.com`. Wall rendering behavior and all
  Slideshow/Carousel behavior are otherwise unchanged.

## 2026-08-24 Trending Hook Demo Content Boundary

- A demo uploaded during Trending Hook composition is Content. Trending uses
  the same `/api/demo/create-upload-url` and `/api/demo/complete-upload`
  persistence path as the Content screen, creating an owner-scoped
  `demo_videos` row before using its ready media projection in composition.
- `Choose existing` lists only ready `media_assets` projections whose
  `source_type = demo_upload`. General Creative Assets uploads, generated
  videos, and Edit exports are not eligible as product demos.
- The `demo_upload` projection exists so Hook validation and rendering can use
  the unified media contract. It must remain excluded from Creative Assets and
  visible in the Content Library at `/library`.
- Failed Trending demo uploads are cleaned up through the demo delete API, so
  the Content record, media projection, and raw storage object retain their
  existing synchronized-deletion behavior.
- This application change is locally validated but is not live until deployed
  and verified in the authenticated Trending and Content flows on
  `https://www.getugcpilot.com`.

## 2026-08-24 Carousel Content Plans and Flexible Structure 2 Flow

- Automatic Carousel preparation is now backed by an owner- and
  business-profile-version-scoped 30-day content plan. Each plan item owns one
  creative seed and one emotion; plans activate only after all required items
  are complete.
- Content-plan writing runs as the durable
  `carousel_content_plan_generation` background job. Writer work is partitioned
  into five-item batches, is idempotently attached to its plan, and uses the
  normal retry/recovery lifecycle instead of making a page request wait for AI.
- Plan items are reserved atomically for Carousel generation and consumed only
  by a completed generation with matching owner, profile, plan, and item
  provenance. Failed or abandoned work can release an unconsumed reservation;
  another user or profile version cannot reuse it.
- The planning tables, reservation functions, job completion function, and
  generation link are additive, service-role-only database changes. Deploy the
  five ordered `2026082415*` migrations before application and worker code.
- Structure 2 format metadata is versioned as
  `carousel-structure-2-formats-v4-expanded-copy-centered` with story reference
  version `carousel-structure-2-story-reference-v4`. Each format still uses the same
  five known roles exactly once, but their order is no longer a fixed runtime
  backbone. Format-specific example flows guide the writer, while only the
  format ID and five-slide output shape remain structural requirements. CTA
  presence and placement remain AI-owned and optional.
- Structure 2 remains LLM-only and source-pinned to `gpt-4o-mini`. It receives
  the minimal saved business description, the reserved creative seed and
  emotion, its format reference, and the last ten exact accepted copies. One
  isolated LLM repair is allowed; the runtime does not publish deterministic
  substitute prose.
- These changes are locally validated but are not live until the ordered
  migrations, application, and worker are deployed and the authenticated
  Carousel flow is verified on `https://www.getugcpilot.com`.

## 2026-08-24 Wall-of-Text Accepted Action Surface

- Accepting or right-swiping a Wall-of-Text idea opens one compact action card
  with the smaller 9:16 video preview on the left and only two actions on the
  right: `Create a Schedule` and `Save to Creative Assets`.
- The accepted action surface does not repeat the format label, title,
  explanatory copy, overlay-copy label, or full overlay text outside the video.
  The rendered overlay remains visible inside the video preview itself.
- `Create a Schedule` is the primary action and opens the existing inline
  scheduling dialog on Trending. Its first step collects an exact Instagram
  account plus date and time; its review step confirms the destination and
  publish time before durable scheduling.
- `Save to Creative Assets` keeps the existing owner-scoped Wall draft save and
  render-preparation behavior. Loading and failure feedback remain visible
  because they communicate the state of the two requested actions.
- This is a presentation-only decision. Wall copy generation, authoritative
  line layout, video/audio preview, edit persistence, rendering, scheduling,
  ownership, and completion contracts are unchanged.

## 2026-08-24 Fixed Hook and Slideshow Typography Contract

- Adaptive typography belongs only to Wall-of-Text. Its existing measured
  52/50/48/46/44px range and 44px readability floor remain unchanged.
- Current Hook layouts use fixed 52px Geist SemiBold type under
  `hook-overlay-layout-v2-fixed`. Hook writing still owns one to three semantic
  lines and the existing word/character limits. If those authoritative lines
  do not fit at 52px, the candidate receives the existing single targeted LLM
  repair and then fails; the renderer never shrinks, truncates, adds an
  ellipsis, or publishes fallback wording.
- Stored and already-queued `hook-overlay-layout-v1` layouts remain readable at
  their saved 34-60px size through an explicit legacy path. Current v2 payloads
  are rejected unless their saved font is exactly 52px and their lines match
  their text.
- Structure 1 and Structure 2 Carousel renders use fixed 44px typography.
  Pre-render validation checks Structure 1 headline/body/list groups and
  Structure 2 story/CTA groups against their fixed-size line capacities. A
  failing AI plan gets the existing one isolated repair and then fails closed.
- Structure 1 renderer `social-plain-text-renderer-v15-structure-parity`
  renders headline, body, list, and CTA groups as direct white text with the
  same fixed 44px type, dark outline, and no-background SVG treatment as
  Structure 2. Its former headline-bubble containment retry is retired because
  there is no longer a white background shape to contain.
- Structure 2 renderer
  `story-native-renderer-v5-plain-white-story-text` renders story and CTA copy
  as direct white text with a restrained dark outline. Stored legacy treatment
  labels remain readable, but new Structure 2 specs normalize the effective
  treatment to the plain overlay.
- Existing rendered Carousel WebPs and Hook videos are immutable. The new
  renderer/layout versions apply only to new generations and explicit
  re-renders after the application and worker are deployed.
- These are local source changes. Do not describe them as live until the
  application and GCP workers are deployed and authenticated production
  canaries verify both Carousel structures and Hook rendering on
  `https://www.getugcpilot.com`.

## 2026-08-24 Structure 2 Server-Owned Ordering and Hook V4 Contract Repair

- Structure 2 AI responses no longer own `slideNumber`, `slotIndex`,
  `candidateIndex`, or `storyFormatId`. The structured-output contract uses
  five required named positions for the batch and for each plan. The worker
  maps those positions to the already-reserved assignments, injects slide
  numbers 1 through 5 from position, and injects the backend-selected format
  before publishing validation and persistence.
- This removes the former `items.anyOf` ambiguity that allowed duplicate or
  reordered numeric identities to satisfy the model-facing JSON schema before
  failing the stricter application parser. Persisted Carousel plans and slides
  still retain their normal numeric slot/slide metadata; only AI ownership of
  that metadata is removed.
- The exact-key parser remains a second fail-closed boundary. Extra structural
  fields, missing named positions, invalid roles, or render-fit failures still
  receive at most the existing isolated LLM repair; no deterministic story copy
  is introduced. A missing CTA or a CTA on any slide is valid and does not enter
  the repair path.
- Migration `20260824180000_align_hook_fixed_type_validation.sql` makes the Hook
  persistence boundary rolling-safe for the matched V3 and fixed-type V4
  validator/overlay pairs. It does not allow a V4 validator with a V3 overlay,
  or vice versa.
- A Hook job whose database error is a deterministic generation/persistence
  contract failure is no longer replaced three more times. Transient worker or
  provider failures retain the existing recovery path, while a later normal
  refill may choose new candidates after a terminal content failure.
- These source and migration changes are locally validated but are not live.
  Apply the Hook migration before releasing the application and workers, then
  verify Hook persistence plus a new Structure 2 batch through the authenticated
  production Trending flow on `https://www.getugcpilot.com`.

## 2026-08-25 Structure 2 Optional CTA Contract

- Structure 2 no longer requires exactly one CTA and no longer owns a fixed CTA
  slide. The model-facing schema permits `ctaText` to be either a non-empty
  string or `null` on every slide.
- The planner prompt treats CTA presence and placement as creative choices. The
  parser does not count CTA fields or compare them with format metadata, so a
  missing CTA, a CTA on any slide, or more than one natural CTA cannot reject an
  otherwise publishable Carousel.
- When `ctaText` is null, the renderer omits the separate CTA bubble and gives
  the story copy the available space. When CTA copy exists, its existing fixed
  44px render-fit and safety checks still apply; unrenderable text is not
  published merely because CTA placement is flexible.
- Exact five-slide shape, server-owned slide order, required story fields,
  renderer fit, human-image safety, unsupported-claim checks, and ownership
  boundaries remain unchanged. This removes a copy-format rigidity, not the
  publishing and safety boundaries that protect usable output.
- Planner version
  `llm-carousel-structure-2-flexible-seed-writer-v9-plain-white-story-text`, story schema
  `carousel-structure-2-flexible-story-v5-plain-white-story-text`, and format metadata
  `carousel-structure-2-formats-v4-expanded-copy-centered` identify this contract. These
  source changes are not live until the updated Carousel worker is deployed and
  a production Structure 2 batch is verified.

## 2026-08-25 Progressive Trending Delivery and Carousel Assignment Binding

- Daily Trending slots remain the ordered, durable source of truth. A resolved
  slot is public immediately; another slot being planned, preparing, failed, or
  unavailable must not hide a ready Carousel, Hook, or Wall-of-Text idea.
- The feed returns only resolved items, in the existing durable order. It uses a
  whole-screen failure only when there are no usable ideas at all. A partial
  failure is isolated to that slot, while planned/preparing slots may continue
  through their normal background path.
- A new local day does not reuse a Carousel assignment from an earlier date.
  The legacy Carousel feed may recover only a same-day assignment that was
  created but not attached during an interrupted request. The unified feed's
  per-`feed_id` Carousel binding index remains compatible with historic rows;
  new work does not use it to carry an idea into another day. Hook and Wall
  assignments remain globally unique.
- Feed status is derived from durable slots under the same per-user/day
  advisory lock used for assignment attachment. A delayed failure update cannot
  overwrite a feed that already has ready slots, and the migration normalizes
  legacy stale `failed` statuses without changing user content assignments.
- This is a Trending availability and recovery decision only. It does not
  change Carousel structures, CTA flexibility, source selection, rendering,
  swipe decisions, plan allowance, or worker generation contracts.

## 2026-08-25 Trending Video Deck Presentation Boundary

- In Trending review, Hook and Wall-of-Text use an in-media format pill and
  may show one inert, subtle right-side preview of the next video card. This
  is a visual cue only; the existing horizontal swipe decisions, preloading,
  and accessibility boundaries remain unchanged.
- A next Carousel is never shown in that video-side preview. When Carousel is
  active, it retains the existing centered multi-layer review treatment and
  its external format pill. Carousel generation, source data, slide controls,
  editing, scheduling, and readiness behavior are unchanged.

## 2026-08-25 Bound Hook Assignment Integrity

- A current-day Hook assignment that is bound to a `ready` daily Trending slot
  is part of that user's durable pack. A later Hook refill may supersede only
  unbound active Hook assignments; it cannot retire an assignment that the
  daily-feed reader still needs to display.
- The database enforces this boundary for every Hook writer through the
  assignment-state transition itself, rather than relying on one refill caller
  to remember the rule. The rule applies equally to Free, Starter, and Growth
  plans.
- The rolling repair reopens only today's `ready` Hook slots whose linked
  assignment was already superseded. It leaves the old assignment as history,
  preserves every decided slot, and lets the normal prepared-feed attachment
  path bind an eligible active Hook. It neither deletes user content nor adds
  posts beyond the plan's existing durable slot count.

## 2026-08-25 App Screenshot Signed Upload CORS Contract

- Settings and the Trending Carousel editor upload app screenshots directly to
  the configured GCS media bucket through a V4 signed `PUT` URL.
- Browser uploads send only the signed `Content-Type` header. They do not send
  `Cache-Control`; production bucket CORS did not authorize that request header,
  so its preflight omitted CORS response headers and the browser surfaced only
  `TypeError: Failed to fetch` after the API had already created a pending row.
- The GCP foundation CORS contract includes `Cache-Control` as an allowed shared
  header for forward compatibility, while the current screenshot upload keeps
  the smallest required request-header surface. Failed uploads continue to
  archive their pending owner-scoped database row.

## 2026-08-25 Durable Trending Delivery Reconciliation

- The `daily_trending_feed_slots` table is the immutable delivery ledger. A
  feed is complete only when it has exactly `daily_limit` physical positions
  and every one is decided. Re-entering the daily-plan reservation is therefore
  an idempotent repair for a missing position; it preserves formats already
  promised at existing positions and never deletes or recreates decided work.
- A `ready` Hook or Wall assignment is pinned to its daily slot across safe
  mutable-source changes (prompt/version or Creative Assets selection). A
  genuinely retired assignment, deleted/ineligible source asset, or missing
  provider item reopens only that undecided slot for normal replacement. A
  provider outage cannot reopen a slot because reconciliation requires a
  successful provider read.
- Every successful Hook, Wall, Carousel-plan, and Carousel worker completion
  atomically writes a durable Trending-reconciliation outbox record in the
  same database transaction that marks the source job complete. The worker
  attempts the signed internal application call immediately; a failed call is
  rescheduled from that durable record with capped exponential backoff and is
  drained by the authenticated background-job recovery scheduler. Browser
  polling is only a read mechanism, never the trigger that advances completed
  backend work.
- The recovery scheduler also finds current feeds whose physical slot count is
  not exactly `daily_limit`. This repairs a historical interrupted 9/10 (or
  analogous 19/20 and 49/50) feed even after its last existing card is swiped,
  without marking it complete or waiting for another browser refresh.
- A content-plan record is marked failed only after its owning background job
  reaches a terminal failed state. Retriable worker errors leave the plan
  generating. The Wall-of-Text content planner also uses the supported model
  defaults rather than sending an unsupported temperature override.
- Carousel and Wall-of-Text planner chunks use one 120-second OpenAI request
  window with SDK retries disabled. A timeout, rate limit, service error, or
  network interruption becomes the durable background-job retry state, so the
  next worker resumes from already persisted five-item chunks rather than
  terminally failing a plan after hidden in-process SDK retries.
- Deploy this as one compatibility slice: apply migrations
  `20260825140000_harden_trending_daily_delivery.sql` and
  `20260825153000_make_trending_delivery_reconciliation_durable.sql`, deploy
  the app route, then deploy both AI-generation and Carousel workers (the
  latter requires the internal URL and secret environment variables). Enable
  the authenticated background-job recovery scheduler only after its deployed
  route passes a production check; it is required for durable retry when all
  immediate callback attempts fail. Verify a Free canary plus Starter and
  Growth canaries on the authenticated production Trending flow. Existing
  content remains untouched; only unresolved current slots can be repaired.

## 2026-08-26 Carousel Expanded Copy Capacity and Centered Placement

- The automatic Carousel writers now treat more complete copy as permissible,
  rather than forcing the short one-to-two-line output that had become the
  common result. This doubles the maximum capacity only; it does not double a
  minimum or force every slide to be longer.
- Structure 1 accepts up to 100 headline characters / 16 words on every slide.
  Slide 1 body copy accepts up to 240 characters / 40 words, while each body on
  Slides 2-5 accepts up to 300 characters / 50 words. The body word ceilings
  are publishing gates; lower word targets remain guidance. CTA copy remains
  capped at 68 characters and each list item at 88 characters. At the fixed
  44px type size, the rendering caps are four headline lines, eight Slide 1
  body lines, ten body lines on Slides 2-5, two lines per list item, and eight
  lines for a complete list group.
- Structure 2 accepts up to 720 story characters and 360 CTA characters. Its
  fixed 44px caps are twelve story lines and six CTA lines. When both groups
  are present, the stricter square-canvas combined-safe-area calculation is
  also a publishing gate, so the doubled independent caps cannot create an
  unsafe or clipped slide.
- Structure 2 format word maxima now provide the doubled advisory reference:
  28 words on the opening slide, 60 words on slides two through four, and 64
  words on slide five. The existing lower word targets remain unchanged and
  word ranges remain writing guidance rather than a copy-replacement rule.
- New automatic Structure 1 and Structure 2 slides place text in the vertical
  center. Structure 1 no longer selects top/bottom placement from text mode or
  slide type, and Structure 2 no longer selects upper/lower placement from
  story role, asset role, or slide number. In Structure 2, an optional CTA
  travels with its story as one centered text block instead of remaining
  bottom-anchored. Existing immutable renders are not rewritten, and an
  explicit editor placement remains user-controlled.
- Fixed typography, measured wrapping, direct white headline/body/list/story/CTA
  text, no-shrink, no-truncation, human-image safety, and all five-slide format contracts remain
  unchanged. New versions are
  `llm-carousel-planner-v36-followup-copy-50`,
  `social-plain-text-renderer-v16-followup-copy-50`,
  `llm-carousel-structure-2-flexible-seed-writer-v9-plain-white-story-text`,
  `carousel-structure-2-flexible-story-v5-plain-white-story-text`,
  `carousel-structure-2-formats-v4-expanded-copy-centered`, and
  `story-native-renderer-v5-plain-white-story-text`.
- Structure 1's balanced line selection uses bounded dynamic programming with
  the same rag and short-final-line scoring. This prevents a valid 50-word
  follow-up body from causing exponential render time while preserving the
  renderer's measured-fit decision.
- This is a local source decision. It is not live until the worker is deployed
  and new Structure 1 and Structure 2 output is verified through the
  authenticated production Trending flow on `https://www.getugcpilot.com`.

## 2026-08-26 Unified Plain SVG Text Treatment

- Structure 1 and Structure 2 now use the same direct-white-text SVG
  treatment: fixed 44px Geist SemiBold type, a restrained black outline, and no
  white text background. Structure 1 retains separate headline/body/list/CTA
  groups and Structure 2 retains its story/CTA groups; this changes only their
  visual treatment.
- The shared Carousel text outline is 3px black at 72% opacity with rounded
  joins. It is deliberately stronger than the former 2px treatment while
  remaining lighter than the 4px Wall-of-Text outline.
- Structure 1's connected white headline bubble, black headline text, bubble
  shadow, and text-pixel containment retry are retired for new renders. Both
  structures preserve their existing measured wrapping, line caps, safe areas,
  centered automatic placement, no-shrink/no-truncation policy, and explicit
  editor positioning.
- Existing rendered images are immutable. The new renderer applies only to new
  Structure 1 generations and explicit Structure 1 edit re-renders after the
  worker deployment and production verification.

## 2026-08-26 GCP Worker Demand Scaling Boundary

- All HTTP Cloud Run workers use request-based CPU allocation. Their instances
  start only when Cloud Tasks delivers an HTTP job and may scale to zero when
  the queue is idle; a minimum instance count of zero is intentional for the
  current testing/early-production cost boundary.
- AI generation has an initial ceiling of ten single-concurrency instances and
  its Cloud Tasks queue may dispatch up to ten jobs concurrently. This is a
  controlled burst limit, not a guarantee that every provider generation will
  finish within two minutes. Any increase requires provider-quota and
  production latency verification.
- Carousel remains request-based but fixed at one concurrent worker and one
  Cloud Tasks dispatch. Its idea/assignment reservation is not yet safe for
  parallel Carousel writers; scaling it above one would risk duplicate or
  conflicting Carousel assignments.
- Every task-serving Cloud Run service explicitly sends 100% of traffic to its
  latest healthy revision. This prevents a historical revision pin from
  leaving a successful Carousel, social-publish, or video compatibility-worker
  deployment ready but unable to receive new Cloud Tasks jobs.
- Long video rendering is authoritative only through `ugc-video-render-job`.
  Each Cloud Run Job execution starts for one durable render and exits when it
  finishes. The legacy video HTTP service remains a request-based,
  zero-minimum compatibility receiver until the deployed task URL is verified
  to use the internal Job launcher. It must not be configured with idle,
  always-allocated CPU.
- Cloud Tasks' video-render limits throttle app launcher requests, not active
  Cloud Run Job executions. Before increasing parallel video launch capacity,
  introduce a durable database render-slot gate so a burst cannot create an
  unbounded number of paid Job executions.

## 2026-08-26 Atomic Carousel Batch Ownership

- A `generate_carousel` background job remains one five-Carousel experiment
  batch; no second Carousel job type or duplicate job table is introduced.
- Before Cloud Tasks can deliver that job, one service-role database transaction
  creates or reuses its deterministic job record, binds the exact five existing
  generation rows, their experiment assignments, and their five already-reserved
  content-plan items. The job ID is recorded on every one of those records in
  the same commit.
- The transaction locks only its own experiment batch. Different users and
  different batches remain free to prepare concurrently. A second request for
  the same batch returns the original job instead of taking ideas a second time.
- If the app stops before Cloud Tasks delivery, the database still shows the
  complete owner/job relationship. Recovery can redeliver that same job; it
  cannot create duplicate Carousel ideas or attach a different batch's ideas.
- A queued job with no recorded delivery is immediately eligible for a safe
  send on the next preparation attempt. The delivery claim is compare-and-set,
  so two observers may race to recover it but only one can send the task.
- The preparation path also repairs the narrow interrupted-write case where a
  generation row exists but its experiment-assignment link was not yet written.
  A conflicting existing link fails closed.
- This removes the database-ownership blocker for later controlled parallel
  Carousel workers. The deployed/local Terraform concurrency remains one until
  this migration, app code, worker compatibility, and a concurrency load test
  are deployed and verified together. Scaling is a separate rollout, not part
  of this database change.

## 2026-08-28 Controlled Demand-Scaling Safeguards (local, not deployed)

- The future scaling target is up to ten concurrent demand-driven workers for
  Carousel, long video rendering, and social publishing. This is a capacity
  ceiling, not ten permanently running servers: Cloud Run remains at zero when
  there is no work.
- Before any queue or Cloud Run limit is increased, long video rendering uses a
  database-backed pool of ten render slots. A launcher must hold one durable
  slot before it starts a Cloud Run Job; a duplicate task sees the existing
  lease instead of starting a second render. Slots are released only when a
  launch fails or the durable background job leaves active processing.
- Social publishing remains parallel across different connected accounts, but
  each platform/connection pair has one durable account lane. A second post for
  the same account waits and retries without consuming a provider-failure
  attempt. This supplements—not replaces—the existing per-target publish
  idempotency operation.
- Carousel batch ownership remains the existing transaction keyed by experiment
  batch. A ten-way database concurrency canary must prove that one batch gets
  one job and its exact five ideas, while ten distinct batches get ten separate
  jobs. The local contract tests validate the transaction shape only; the
  database canary is a deployment gate, not proof from a unit test.
- Planned rollout after deployment and canaries: retain capacity 1 initially,
  then raise queue and service limits together to 2, then 5, then 10 while
  monitoring duplicate ownership claims, provider errors, queue age, and cost.

## 2026-08-28 Immediate Terminal Carousel Replacement

- A terminal `generate_carousel` failure for daily Trending inventory writes a
  durable reconciliation-outbox record immediately. Manual and non-daily
  Carousel failures do not start Trending preparation.
- A partially completed five-Carousel experiment job is never replayed as a
  whole. Completed generations remain immutable and failed generations remain
  diagnostic history; reconciliation calculates the true remaining daily-feed
  shortfall and reserves fresh candidate indexes for that shortfall.
- A confirmed terminal background-job state bypasses the older 15-minute refill
  repair cooldown. The cooldown remains for ambiguous queued or processing work
  so a slow healthy worker is not mistaken for a failure.
- Repeated failure notifications remain idempotent through one outbox row per
  source job, the locked daily-refill reservation, batch-local candidate-index
  uniqueness, atomic experiment-job ownership, deterministic Cloud Tasks, and
  the worker claim token. This changes recovery latency only; it does not change
  daily allowances, content formats, Carousel structures, rendering, or visible
  completed work.

## 2026-08-26 Same-day Upgrade Reconciliation

- A same-day paid upgrade appends the complete paid pack to the feed already
  promised for that day. Free-to-Starter therefore reserves 30 total slots and
  Free-to-Growth reserves 60 total slots under the current product rule.
- After that append, the stored daily feed size is authoritative for every
  later ensure and worker reconciliation. The current plan's base allowance
  must not shrink a 30-slot feed back to 20 or a 60-slot feed back to 50.
- Reconciliation preserves the stored formats and physical positions, repairs
  only unresolved work, and does not grant the paid pack a second time.

## 2026-08-26 Paid Activation Prebuild

- A successful Starter or Growth subscription activation now writes one
  idempotent `paid_trending_prebuild` background job in the same database
  transaction as the billing subscription. Cloud Tasks delivery happens only
  after that transaction commits, so a Dodo retry cannot create a second paid
  pack.
- The prebuild worker re-reads the current subscription and profile before
  calling the existing unified daily-feed preparation. A cancelled or replaced
  plan is skipped; a valid same-day Free-to-Starter or Free-to-Growth upgrade
  still uses the existing 30- or 60-slot reconciliation rule.
- This does not enable the daily replenishment scheduler. It prepares the
  current paid pack immediately after payment activation; future-day prebuild
  remains a separate, explicitly controlled rollout.

## 2026-09-25 First-Visit Trending Swipe Guide

- Trending no longer mounts an onboarding video or animated walkthrough in the
  authenticated workspace. The application-video screen remains available only
  to the developer preview route.
- A newly created account whose owner-scoped
  `trending_walkthrough_completed_at` is null sees the Try UGC Pilot-style
  guide only after its first ready Trending card is available. The historical
  walkthrough backfill leaves existing accounts complete, so this rollout does
  not reintroduce onboarding for them.
- The guide is rendered directly over the active review card for every
  Trending format. It blurs and darkens that card, shows left Skip and right
  Accept directions with the shared hand asset, and stays visually scoped to
  the card rather than covering the page, feed loading state, or controls.
- The first card pointer, swipe, keyboard decision, Edit action, or decision
  button dismisses the guide without editing, skipping, accepting, saving, or
  scheduling the card. Dismissal then records the existing owner-scoped
  completion timestamp through the authenticated walkthrough endpoint. The
  write is idempotent; a failed write leaves the guide hidden for the current
  visit and lets a later visit retry.
- The guide respects reduced-motion preferences and announces the directions
  to assistive technology. It is presentation-only: daily-feed preparation,
  content selection, and all decision and scheduling behavior remain
  unchanged.

## 2026-08-27 Free Trial Entitlements

- Free access is a one-time three-day trial that begins when a user completes
  the current business onboarding. It reserves at most ten Trending content
  slots on each of at most three daily packs. Paid Starter and Growth access
  bypasses this trial ledger and retains the existing same-day upgrade rules.
- Existing product profiles are backfilled with an expired trial, including
  incomplete profiles so they cannot receive a fresh trial by resuming old
  onboarding. Their existing feed items and scheduled posts are not deleted or
  cancelled, but new free preparation is blocked until they upgrade.
- A free trial may create no more than five Instagram schedule targets in total
  during its active window. The schedule target is counted when it is created,
  including when its publication date is in the future; cancelling it does not
  restore the trial slot. The database locks the user's trial record while
  counting, so concurrent schedule requests cannot exceed five.
- Entitlement checks occur before normal app preparation and again in database
  triggers for daily feed creation and Instagram schedule target insertion.
  Existing ready content remains readable, but an expired trial may not trigger
  more background preparation.

## 2026-08-30 Carousel Edit Preview Parity and Immutable Slide Reuse

- The Carousel editor keeps the immutable rendered image until a user changes
  that slide. Once a drag or copy edit requires a live preview, both Carousel
  structures use the renderer's direct white, 44px Geist SemiBold text with a
  3px black 72%-opacity outline. The retired white SVG text rectangles and
  white line pills must not return in the editor, because a position-only edit
  must preserve the same visual language as the saved creative.
- A Carousel edit render reuses the original immutable `rendered_url` and
  `rendered_s3_key` for a slide whose source asset, copy, normalized position,
  and visual role are unchanged. It renders and uploads only changed slides,
  while still saving one complete ordered output containing every slide. This
  reduces a Slide 1 Hook-library update from a serial five-slide render to the
  one changed slide without changing the final asset contract.
- Carousel next/previous controls advance from the latest stored slide index,
  not an index captured by an earlier render. Their full pointer interaction is
  isolated from the deck swipe gesture, so an edited Carousel can navigate
  immediately while its immutable edited slide URLs are displayed only after
  the render state is ready.

## 2026-08-31 Carousel Fresh-First Source Rotation

- A Carousel first selects an approved, safe image that has never previously
  been assigned to that business profile for the requested category and role.
  It only resumes the existing shuffled reuse cycle after that fresh pool is
  empty. An image uploaded later is new to the profile and therefore wins over
  an old image that would otherwise be recycled.
- This rule does not weaken the image-library safety, readiness, ownership,
  role, or per-Carousel no-duplicate checks. It changes only the ordering
  between fresh and previously used eligible images.

## 2026-08-30 Daily Feed Recovery and Planner Shortfall Handling

- A unified daily feed remains `preparing` while any reserved slot is pending,
  even when earlier positions are already visible. The client continues
  polling until the pending count reaches zero, then backs off to a one-minute
  cadence aligned with the server recovery scanner. A partial pack is useful
  content, but it is not a terminally ready pack.
- The recovery scanner claims feeds with stale unassigned `planned`,
  `preparing`, or `failed` slots even when the physical slot count equals the
  daily allowance. It re-enters the existing idempotent Carousel, Hook, and
  Wall preparation paths; it never replaces `ready` or `decided` assignments.
  Claims are bounded and, after repeated stale passes, only still-unassigned
  stale slots become `failed` with a durable diagnostic instead of spinning
  forever.
- Carousel and Wall content-plan duplicate validation is shortfall-aware. Only
  literal copies after normalizing case, punctuation, and spaces are rejected;
  related themes, wording variations, and repeated private situations remain
  valid. When a literal copy appears, the planner regenerates only that item.
  Every other item in the five-item group and chunk remains intact. Structural
  or safety validation errors still reject the chunk for normal retry handling.
- A completely unconsumed Carousel reservation may reopen only when its five
  original generation rows never received a writer job. It re-leases those
  exact five plan items and returns the jobless failed rows to `processing`;
  it never substitutes different ideas or restarts a durable writer job.
  A partially consumed daily refill is never reopened. Its completed items
  remain immutable and a terminal shortfall creates a fresh successor refill
  batch for the missing feed positions only.

## 2026-08-31 Hook Inline Symbol Rendering

- Hook copy keeps its original text for semantic validation and legacy
  compatibility, but the approved `❌` and `✅` characters are normalized into
  named `cross` and `check` inline-symbol tokens before any visual rendering.
  The Preview and the GCP render worker both draw the matching bundled Lucide
  CircleX/CircleCheck assets; neither surface depends on an operating-system
  emoji font.
- Only the assigned `GF_009_A` visual contrast format may use that exact
  cross-then-check pair. New Hook generation rejects every other emoji, and
  older unsupported emoji are omitted at visual-render boundaries instead of
  producing a missing-glyph code such as `274C` in a video.
- The text layout reserves the icon advance before rendering. This preserves
  Hook line fitting, placement, and the existing fixed 52px type contract.
  Existing source copy remains intact; no historic Hook record is rewritten
  solely for this presentation change.

## 2026-08-31 Trending Accepted-Action Persistence

- A right swipe remains one durable `accepted` decision. It removes the decided
  card from the current feed without waiting for a later optional save or
  scheduling choice.
- A right swipe is also a keep decision. Before a Carousel card is retired,
  Trending creates or reuses its owner-scoped Creative Assets Library item.
  If that hand-off cannot be created, the card remains in Trending and the
  user can retry; connecting Instagram, cancelling a dialog, or leaving the
  page can never discard an accepted Carousel.
- A selected Wall-of-Text or Hook is not a Saved Creative Asset. Only the
  explicit `Save to Creative Assets` action makes it visible in that library;
  scheduling uses its required internal record but does not create a second
  Saved asset.
- A Hook that is accepted but not explicitly saved or scheduled is discarded
  when the user leaves the composer. It has no `Continue creating` library
  entry and no resume link back to Trending.
- Instagram connection is a scheduling concern only. It never controls
  whether a right-swiped Trending item is retained or recoverable.
- Once a user/day Trending review shell has shown content, it stays mounted
  when the final ready card is removed. This keeps the accepted Carousel or
  Wall-of-Text `Save to Creative Assets` / `Schedule Post` chooser alive until
  the user completes or closes it; the state is reset for a different user or
  local day.
- The retained shell uses the existing caught-up, preparation, retry, or
  failure state behind the chooser. It does not re-add the decided card, change
  the durable decision outbox, or alter Hook composition, saving, scheduling,
  rendering, or worker behavior.

## 2026-08-31 30-Day Plan Continuity and Diversity

- A profile-version has one Carousel plan for its full 30-day date window. A
  failed planning run is repaired on that same plan ID, retaining every valid
  parent brief and child seed as an exclusion; it never creates another plan
  version in the same window. The plan is a reusable pool: unused ideas are
  reserved first, then the least-recently-used idea from a terminal batch is
  rotated back in. A high-volume day therefore never marks the plan finished,
  fails because its 150 ideas were used once, or starts a new cycle early.
- The next 30-day Carousel plan is generated from current approved business
  context and receives the immediately preceding plan's ideas as private
  guidance. Each individual child item gets its own private audience, human
  situation, tension, supported angle, soft format direction, and assigned
  concept lane. The item-level context is stored on the plan item, while old
  items continue using their parent brief. Each five-item group is prompted to
  use different situations, but only exact normalized copies are rejected;
  related themes and wording variations remain valid.
- Wall-of-Text follows the same continuity rule and is plan-first. Normally a Wall
  writer may reserve only active 30-day plan items. Its 200 ideas also rotate
  unused-first then least-recently-used after a terminal batch. If planning is
  not ready, the durable planning job is returned and the writer waits; the
  legacy direct-writer fallback must not produce unplanned Wall content.
- The account-scoped Wall early-delivery rollout adds a separate published
  prefix to a plan. An opted-in daily delivery intent can reserve unused items
  from complete, committed five-item briefs while the same 200-item planner
  continues. The plan becomes active only when all 200 items and 40 briefs exist.
  Incomplete plans never recycle consumed items. Saved items and finished posts
  remain available if the remaining planner fails.
- Chunk publication checks the planner job and worker claim, saves the items,
  and records a durable publication event in one database transaction. Events
  have independent identities and token-fenced acknowledgements. A short worker
  callback starts Wall-only reconciliation; the existing recovery scheduler
  retries missed events and resumes incomplete plans independently of feed gaps.
  Automatic plan reopening is capped at three planner jobs for opted-in plans.
- Daily Wall delivery uses an immutable intent per feed, explicit retry key and
  reserved Wall slot count, with generator and layout versions in its identity.
  Repeated polls and publications reuse its writer,
  including after partial output. A request for 20 posts waits for 20 available
  published ideas. Opt-in is off by default, and only new opted-in plans use the
  fast path. Turning the account flag off stops new early admissions while
  already admitted writers retain their reservation permission. Keep the new
  worker deployed until these admitted jobs and plans finish. Carousel and
  Reaction preparation are not invoked by per-chunk Wall callbacks.
- Wall planning requests produce ten ideas (two complete five-idea briefs) at
  a time and send the model only a bounded recent history. The database still
  validates every historical idea. A blank provider response is classified as
  a durable retry, retaining all saved plan items, rather than becoming a
  terminal validation failure. This Wall-specific reliability change does not
  alter Carousel planning or its output contract.
- Wall items use the same individual private context and broad concept lanes as
  Carousel. The Wall writer receives the item's exact stored situation rather
  than relying only on the five-item parent brief. Its final duplicate gate is
  exact-normalized text only, and it keeps accepted videos while retrying only
  a failed candidate twice more.

## 2026-09-23 Wall-of-Text plan-matched fact selection

- Every new Wall-of-Text plan stores the immutable approved-business-fact
  snapshot that was available when its 200 ideas were planned. Each child idea
  must choose one `selectedFactId` from that snapshot based on whether the fact
  truly supports its human moment and content idea; a positional or round-robin
  fact choice is not a valid planning decision.
- The item-level `selectedFactId` is private. Before the Writer is called, the
  server replaces the reservation's initial canonical fact with that selected
  fact and saves it on the reservation. Thus a retry and later reuse of the
  same plan item use the same fact, while a new 30-day plan selects again from
  its own current profile-version snapshot. Fact IDs are only meaningful inside
  that saved snapshot and are not carried into the next plan.
- The Writer receives only the one plan-matched fact, not an open menu of
  facts. It may express the fact in clear ordinary language and must not pad
  text with copied words or end with a vague bridge such as “is relevant to
  this pressure.” The 24–48-word range, measured five-to-eight-line fit,
  factual-claim guardrails, exact duplicate gate, and no separate readability
  reviewer remain unchanged.
- Existing plan items with no `selectedFactId` retain their historical
  reservation behavior, so this additive rollout does not break active plans
  or retries. An additive service-role-only database function saves the chosen
  fact only on an already claimed assignment; the saved plan context, private
  item context, and assignment grounding JSON remain the durable fields.
- In prompt version `v15`, every new item is fact-first: the planner chooses
  its `selectedFactId` before it creates the human moment and idea. Those two
  fields may make an ordinary illustration of that fact, but cannot introduce
  an unrelated event, cause, workflow, problem, or outcome and then attach a
  fact afterward. The structured response lists `selectedFactId` before the
  other item fields to reinforce that order. This is part of the existing planning request, not a
  readability-review pass, so the later Writer remains free to write natural
  24–48-word copy from the matched fact and context.

## 2026-09-01 Carousel 4px Text Outline

- New Carousel renders use a 4px black outline at 72% opacity with rounded
  joins across both structures. The live Carousel editor preview uses the
  matching 4px responsive stroke, so edited previews and saved WebPs share the
  same text treatment.
- The renderer versions are now `social-plain-text-renderer-v17-outline-4` for
  Structure 1 and `story-native-renderer-v6-outline-4` for Structure 2. This
  keeps new rendered storage objects and edit output provenance distinct from
  the earlier 3px treatment.
- Existing rendered Carousel images remain immutable; the 4px outline applies
  to new generations and slides that are explicitly re-rendered.

## 2026-09-02 Structure 1 Heading-Only White SVG Background

- A Structure 1 slide whose visible `headline` is rendered as a headline gets
  exactly one measured white SVG background behind that heading. The heading
  uses dark Geist SemiBold text so it is visually distinct from the image and
  remains readable across all approved backgrounds.
- This treatment is semantic, not image-role-based: a Slide 1 Hook-library
  asset does not receive a background merely for being a hook image. It does
  receive the white SVG background when that slide also has a visible heading.
  A body-only or single-statement slide remains direct white text, as do every
  Structure 1 body, list, and CTA group.
- A heading remains optional content, not a writing requirement. The planner
  must not add one merely to activate this treatment; when body copy works on
  its own, it uses `body_only` with a null headline and receives no white SVG
  background.
- Structure 2 has story and CTA fields rather than a separate heading field.
  Its direct-white story/CTA treatment is unchanged; no white background is
  inferred for it.
- New Structure 1 renders and explicit Structure 1 edit re-renders use the
  current line-fitted heading renderer. Existing rendered images remain
  immutable.

## 2026-09-06 Structure 1 Line-Fitted Heading SVG

- The heading-only white SVG is one connected path that follows the measured
  width of every rendered headline line. A two-, three-, or four-line heading
  therefore has rounded outer ends plus overlapping rounded shoulders wherever
  the next line is narrower or wider. It must not taper through an S-shaped
  pinch or use one full-width rectangle with empty white space beside shorter
  lines.
- The path uses the same measured Geist line widths, fixed 44px heading type,
  horizontal/vertical padding, safe-area calculation, and line limit as the
  prior treatment. This is a visual-contour change only: it does not alter
  planner copy, wrapping, text positions, body/list/CTA treatment, image
  safety, Structure 2, or whether a heading is optional.
- The renderer version is
  `social-heading-rounded-shoulder-svg-renderer-v20-outline-4`. New render
  keys use that version; existing v19 and earlier rendered images remain
  immutable.

## 2026-09-01 Compact-Laptop Trending 9:16 Review Frames

- Hook and Wall-of-Text Trending cards use the same shared 9:16 sizing rule.
  The maximum review-frame width is 280px (about 498px tall) at the common
  1366px-wide compact-laptop view, then tapers smoothly to 260px by 1536px
  wide. The available-height calculation still protects the format label,
  stacked preview clearance, decision controls, and progress text on short
  laptop screens.
- This has no 1440px cutoff: compact-laptop and higher-resolution viewports
  transition smoothly between their comfortable sizes. Carousel (4:5) frames,
  swipe behavior, keyboard interaction, deck layering, and the loading
  skeleton's shared 9:16 frame remain structurally unchanged.
- The paired Reject and Accept controls use that same 1024px-and-up,
  available-height calculation. They stay at least 56px for safe interaction
  and scale from the prior 64px base to a maximum of 80px with proportionate
  icons on compact laptops, tapering to the prior 76px maximum at 1536px wide
  so they retain their visual relationship to the card.
- The deck's external controls use the full visible card stack as their visual
  boundary. When an active 4:5 Slideshow has a taller next card behind it, its
  format pill moves above the stack and its decision row receives an
  available-height-based lower offset. Hook and Wall-of-Text pills keep a
  small, explicit gap above their own next-card layer. This preserves card
  size while preventing labels and decisions from overlapping preview media.
- The reduced vertical frame retains that external-control contract. When a
  Slideshow reveals a Hook or Wall card as its next stacked card, its decision
  row reserves the card's full promoted 9:16 height—not only its smaller
  resting-preview height—so the media cannot overlap Reject or Accept while
  the swipe transition is in progress.

## 2026-09-09 Compact Slideshow Review Label

- The external Slideshow pill uses the same compact label rhythm as Hook and
  Wall-of-Text: it reads `Slideshow` and sits 24px above a normal active 4:5
  frame. Slide dots remain the visible slide-count affordance.
- When the immediate next card is a taller 9:16 Hook, Wall-of-Text, or
  Reaction Reel, the Slideshow pill retains only the extra clearance required
  to stay above that media layer (72px on smaller viewports and 96px at 1024px
  and above). All deck layering, swipe behavior, controls, and media sizing
  remain unchanged.

## 2026-09-05 Six-Slide Carousel Core Flow

- This decision supersedes earlier five-slide Carousel statements in this
  document. New automatic Carousel generations require exactly six ordered
  slides; existing rendered five-slide carousels remain immutable and usable.
- Structure 1 remains the educational/list family: reader-first cover, four
  useful value slides, then a useful takeaway or CTA. Its source JSON retains
  five reusable base definitions, but the runtime expands them to the required
  six-slide contract before planning, image reservation, rendering, and
  persistence.
- Structure 2 is the strict product-story family: reader-first cover, reader
  problem, realization, grounded product mechanism, modest proof or result,
  then takeaway or CTA. Slides 1-5 cannot carry CTA text; the final slide may
  use a natural CTA or a useful stand-alone takeaway.
- The writing prompt directs the first slide toward a reader-first reason to
  swipe (specific benefit, tension, mistake, contrast, or curiosity gap), but
  this is creative guidance rather than a hard validator rule. The validator
  must not reject a valid cover merely because it begins as a personal story or
  cannot mechanically prove audience attention. It continues to enforce the
  objective contract: present copy, six ordered slides, exact roles, CTA
  placement, claim safety, and fixed text fit. The cover uses a larger fixed
  text treatment and a tighter line limit so the hook—not the background
  photo—leads the slide.
- Slide 6 always reserves a static visual slot. When a ready, approved user
  app screenshot exists, the reservation function places that product asset in
  the final slot; otherwise the normal approved static-image pool supplies the
  visual. It must never fall back to an unrelated lifestyle/human slot.
- The white SVG remains heading-only for Structure 1. It is not activated by a
  hook image and the planner must not manufacture headings just to obtain the
  treatment. Structure 2 has no heading field, so its story and CTA text remain
  direct-white text on the image.
- The agreed reader-problem/product-capability/proof questions are deliberately
  not a separate semantic gate in this release. The core flow is enforced and
  tested first; a later decision can add that stricter quality gate without
  changing the slide contract.
- In the Trending review deck, only the 4:5 Carousel/Slideshow review frame
  grows to a 300px maximum width (375px high at its fixed 4:5 ratio). Its
  existing viewport-height safeguard remains in place. Hook and Wall-of-Text
  cards keep their separate 9:16 responsive frame and are not resized.

## 2026-09-06 Slide 1 Hook Reliability and Structure 2 Batch Keys

- Structure 2 has two intentionally separate position-key sets: five batch
  keys (`first` through `fifth`) name the independently planned Carousels in a
  worker request; six slide keys (`first` through `sixth`) name the slides
  inside one Carousel. Batch messages, schema, and parsing use only the
  five-key set, while individual story-plan parsing and rendering use the
  six-key set. This prevents a six-slide Carousel from incorrectly requiring a
  sixth batch assignment.
- Structure 2 Slide 1 uses the explicit `reader_first` perspective. It may
  address the reader directly (including `you` / `your`) and must create a
  reason to swipe. Slides 2-5 retain their existing first-person story rules,
  so the reader-first cover does not weaken the product-story sequence.
- Structure 1 records an advisory-only `hook_quality` diagnostic when Slide 1
  lacks a recognizable tension, outcome, contrast, mistake, useful promise,
  or curiosity signal. It never blocks publication or triggers a repair by
  itself: creative resonance cannot be proven mechanically. Structural safety,
  claim safety, repetition checks, and fixed-layout fit remain blocking.
- When a real Slide 1 render-fit failure does require repair, both structures'
  repair prompts now state the three-line display constraint and its actual
  type size (Structure 1: 60px for `single_statement`, otherwise 44px;
  Structure 2: 60px). The repair must replace the overflowing cover with
  shorter copy rather than add a repeating headline.
- The live Carousel planner audit script passes the required
  `businessDescription` string to the Structure 2 planner, allowing the normal
  live audit to exercise its production-shaped input.

## 2026-09-06 Six-Slide Reservation Initialization Repair

- The six-slide reservation migration must initialize its ten request and
  actual metadata arrays only after `v_slide_count` is read from the validated
  plan. PostgreSQL evaluates `DECLARE` initializers before `BEGIN`, so an
  `array_fill(... array[v_slide_count])` initializer is invalid while that
  count is still null.
- The follow-up migration corrects only that function initialization order. It
  preserves the already-agreed compatible five-or-six-slide database contract,
  role patterns, image rotation rules, and existing rendered Carousel records.
- A production release is complete only when the GCP Carousel worker is built
  from the same Git revision as the deployed Vercel app. A six-slide request
  must never be handled by an older five-slide worker.

## 2026-09-06 Six-Slide Image-Usage Constraint Repair

- The reservation function can now reserve six slide images, but the legacy
  `carousel_image_usage_role_assignment_chk` also has to allow an assigned
  `slide_number` of 6. Otherwise the sixth assignment fails at insert time
  even after the reservation function has passed validation.
- The constraint remains `NOT VALID` to preserve the original migration's
  treatment of historic rows; it is nevertheless enforced for every new
  assignment.


## 2026-09-06 Terminal Recovery and Candidate Isolation

- Nullable composite RPC results are normalized before ownership checks.
  PostgREST's object of null fields means no replacement; real or malformed
  populated rows still pass through the full ownership validation.
- A released/expired, unconsumed reservation that was attached to a durable
  writer cannot be reopened. Daily recovery now creates a fresh successor
  for this case as well as released partial reservations, under the existing
  feed lock and expected-batch guard. Active writer jobs block replacement
  even when a generation row incorrectly says failed.
- Structure 2 reference word ranges are advisory again, as specified in the
  format contract. Measured overflow, slide roles, CTA position, claim safety,
  and the other existing blocking checks still require a valid plan.
- An individual Structure 2 planning failure gets one isolated repair. If
  that repair fails, persist its response and validation issues, then continue
  validating and rendering the other candidates. Complete candidates retain
  their output and consumed plan provenance when the batch is partial.
- Structure 2 model calls now have a 120-second timeout and no hidden SDK
  retries. An absent initial response does not fan out into five repair calls.
- Production acceptance still requires the application and Carousel worker
  at the same release revision and ready feed slots on the production domain.
- Automatic replacement is limited to three successor batches per daily
  feed/profile version. Both replacement and cumulative extension enforce this
  budget in the database, including for older application revisions. Exhausted
  failures stay visible instead of producing an unlimited chain of model calls;
  a new daily feed or profile version receives a new budget.

## 2026-09-07 Format Isolation and Explicit Recovery

- Starter remains 20 daily pieces, Free 10, Growth 50. There is no ten-piece
  batch barrier: all daily slots are reserved together and valid items appear
  progressively. A same-day paid upgrade preserves its previously promised
  additional pack.
- Carousel provider exceptions cannot abort the shared feed read or prevent
  Hook, Wall, and Reaction preparation. Every terminal format returns a public
  failure object, including while the retained review shell is open.
- Carousel inventory counts every active worker stage, including waiting for
  the provider, rendering, uploading, and cancellation pending. An exhausted
  recovery with no active inventory marks missing Carousel slots failed
  immediately, without waiting for repeated stale recovery scans.
- Automatic recovery remains limited to three successor batches. An explicit
  authenticated retry of failed, unassigned slots opens one new three-successor
  window. It records a budget starting sequence; it never rewrites generation
  history or old replacement sequence numbers. Repeated clicks without a newly
  failed slot are no-ops. Ready/decided items are preserved and active writers
  prevent resetting their budget.
- The daily feed's existing retry token now scopes Reaction retries too, so
  the retry button does not simply retrieve the same failed Reaction job.
- Structure 1 and Hook copy use explicit 60-second requests without SDK
  retries. Hook transient provider errors enter the durable job retry path;
  independently valid copies still survive a failed best-effort repair.
- Expired or exhausted free-trial reconciliation returns skipped so the
  outbox settles. It does not manufacture generation work or keep polling.
  Paid activation still schedules its own prebuild.
- Database migration: 20260906183128_allow_explicit_bounded_format_recovery.
  Application/worker changes require the coordinated release before production
  acceptance; local model canaries alone are not end-to-end acceptance.

## 2026-09-09 Background business onboarding (local, rollout pending)

- Release verification found direct anonymous/authenticated grants on five
  internal Reaction-render RPCs introduced by the earlier split-worker migration.
  `20260909175456_restrict_reaction_render_rpc_access.sql` revokes those grants
  explicitly while preserving worker service-role execution. Revoking PUBLIC
  alone does not remove Supabase's direct default grants.

- New enrolled accounts save source input and a durable analysis job in one
  transaction, then continue through identity and goals while a top status strip
  tracks analysis. Website, manual, and mobile-app intake retain their existing
  analysis engines. Existing profiles and legacy setup sessions keep their flow.
- `business_onboarding_drafts` stores answers separately from analyzed facts.
  Owner, source revision, and answer revision checks fence old tabs and late
  jobs; legacy profile writers cannot reset a draft-managed profile.
- Analysis attachment and final form submission both schedule the same durable
  finalizer once ready. It validates the stored analysis and atomically writes
  one completed v3 profile, preserving owner name, logo, goals, and timezone.
  The existing completion trigger starts the trial at that point, never on
  source acceptance. Repeated delivery returns the same profile and timestamp.
- Content preparation still uses `prebuildTrendingAfterOnboarding` and the
  existing unified daily feed. A failure after profile completion retries
  preparation without repeating analysis or trial activation. The dashboard's
  existing feed recovery remains available.
- Queue publication happens after the accepted response; persisted queued rows
  remain discoverable by the existing recovery scheduler if publication fails.
  Required analysis/finalization run in the durable worker, not in `after`.
- Migration: `20260909165333_add_background_business_onboarding.sql`. Enrollment
  defaults off except for `BUSINESS_ONBOARDING_BACKGROUND_USER_IDS`; the server
  flag `BUSINESS_ONBOARDING_BACKGROUND_ENABLED=true` expands fresh enrollment.
  Explicit `false` stops enrollment, including the allowlist. Existing drafts
  always resume and finish, so rollback must retain the new handlers/schema.
- Local database and independent-session concurrency tests pass. Deployment and
  authenticated production canary acceptance remain pending; see
  `docs/onboarding-background-analysis-plan.md` for release gates.

## 2026-09-10 Free trial and complimentary access

Free trials receive 20 daily content pieces for three days. Instagram scheduling
is uncapped while the trial is active; expiry and usage tracking remain enforced.
A NULL free_trial_entitlements.instagram_schedule_limit means uncapped. Positive
per-user limits remain enforced. Active complimentary Starter/Growth grants supply
product access separately from Dodo subscriptions and bypass free-trial gates.

## 2026-09-10 Production read recovery and Wall copy repairs

Trial and avatar catalog database clients retry read-only gateway failures twice;
write requests are never replayed by this policy and access checks still fail closed.
Wall layout retries carry the rejected draft and measured error, reducing the word
budget by four per repair down to the existing 24-word minimum. The two-repair
limit, fixed 52px font, safe area, and incremental acceptance remain unchanged.
Runtime/font errors propagate as dependency failures instead of copy-fit errors.

## 2026-09-11 Structure 1 combined format and optional hook overlay

- The supplied twenty hook structures are a versioned, backend-owned template
  catalog for Structure 1 Slide 1 only. Compatibility is explicit per content
  format: preferred mappings are selected before adaptable mappings, and an
  unmapped format/hook-family pair is valid with no template.
- Durable rows continue to store normalized IDs rather than a duplicated JSON
  format: content format, hook family, optional hook-template ID, and template
  version. At worker runtime those identifiers resolve into one combined
  six-slide format object. The optional pattern is added only to Slide 1's
  instruction; Slides 2-6 are copied unchanged from the base format.
- A hook template is adaptable structural guidance rather than literal final
  copy. The planner replaces `{topic}` and removes or softens unsupported time,
  metric, personal-result, or performance claims. An unresolved placeholder or
  unsupported precise claim is repairable and blocking. A possible semantic
  disconnect between the cover and Slides 2-6 is recorded as an advisory so it
  can be monitored without turning subjective wording into a generation stop.
- Optional overlay data must never make Structure 1 unavailable. Missing,
  incomplete, unknown, stale-version, format-mismatched, or hook-family-
  mismatched template data resolves to the selected base format's native Slide
  1 hook. Required format and hook-family corruption remains an error.
- `CAROUSEL_HOOK_TEMPLATES_MODE` supports `enabled`, `shadow`, and `off`.
  Missing or unknown values resolve to `off`, so rollout is explicit. Shadow
  mode performs and logs selection only, then persists null template fields and
  sends the native combined format to the worker. Retries reuse the durable
  assignment and do not reselect it.
- Structure 2 remains isolated, uses its existing complete story format, and
  always clears/stores null hook-template fields during takeover and normal
  generation.
- An optional overlay cannot be the reason an otherwise usable Structure 1
  Carousel is lost to repeated Slide 1 overflow. The normal isolated repair
  first gets one chance to shorten the cover. If the repaired plan's only
  remaining publishing blockers are measured Slide 1 `render_fit` issues, the
  worker removes the overlay and makes one narrowly scoped LLM request for a
  native-format Slide 1. Slides 2-6 and the plan-level communication are frozen
  and merged back by the worker; the model does not regenerate those chapters.
  The merged plan must still pass the complete publishing validator. Claim,
  structure, placeholder, Slides 2-6, and other unrelated failures remain
  blocking and cannot enter this fallback. No deterministic truncation or
  authored cover copy is introduced.
- A successful native overflow fallback records its third raw response and a
  `hookTemplateFallbackUsed` validation diagnostic, and clears the actual hook
  template ID/version before persistence so performance is not attributed to a
  pattern that was abandoned. Planner version
  `llm-carousel-planner-v40-native-hook-overflow-fallback` identifies this
  behavior.
- Database migration: `20260910150000_add_carousel_hook_template_assignments`.
  The application migration and worker must be released together before
  explicitly enabling this behavior in production.

## 2026-09-11 Carousel dispatch safety and grounded Structure 1 planning

- Carousel preparation validates the durable job store and `generate_carousel`
  Cloud Tasks configuration before it reserves an experiment batch, a
  content-plan item, or a customer quota slot. A missing dispatch URL or other
  required queue setting is a deployment configuration error, never a failed
  Carousel generation.
- Once a durable Carousel job has been created and its delivery lease claimed,
  an ambiguous Cloud Tasks send failure leaves the job `queued` and records a
  `queue_delivery_deferred` event. It is not marked failed and its Carousel
  rows are not terminalized. The existing leased-delivery recovery and
  idempotent worker claim are the only redelivery route; this avoids both lost
  work and duplicate paid work when Cloud Tasks accepted a request before the
  app lost the response.
- The GCP cutover canary has a `carousel-generation` kind. It uses an invalid
  payload that the Carousel worker rejects before it loads a Carousel row,
  calls the LLM, selects an image, or writes output. Production acceptance must
  verify the signed app-to-Cloud-Tasks-to-Carousel-worker path at the same app
  and worker release identity before enabling hook overlays or recovering old
  failures.
- Structure 1 planner version
  `llm-carousel-planner-v42-grounded-batch-cover-poster-contract` requires a
  server-derived grounding anchor from the saved creative brief. The model may
  select only an anchor ID; the worker restores its verified fact and requires
  the concept and Slides 3-5 to use it. Old persisted plans remain readable,
  while newly generated plans cannot invent a fact or use generic disconnected
  middle slides.
- Both initial and batch Structure 1 planner instructions now state the same
  measured Slide 1 poster-cover contract: 4-12 words, targeting at most 90 characters,
  three actual visual lines at 92px for the dominant hook and, when present,
  two lines at 34px for distinct supporting copy. No text is shrunk or
  truncated. The treatment is Slide-1-only and does not alter Slides 2-6. The
  publishing validator remains strict.
- The historical six-slide role-asset error `dimension values cannot be null`
  is the PostgreSQL array-initialization defect fixed by committed migration
  `20260906091416_fix_carousel_six_slide_reservation_initialization.sql`; it
  is not a null image-metadata issue. Release verification must confirm that
  migration is present in production rather than adding a weaker asset
  fallback.
- Historical content-plan duplicate-seed failures are already isolated to the
  literal normalized duplicate and regenerated one item at a time. Near
  overlap remains allowed; no broad duplicate rejection should be restored.

## 2026-09-14 Business Context Settings and immutable versioning

- Settings exposes an owner-editable **Business Context** section. Its `Save
  draft` and `Re-analyze draft` actions write only a staged context; neither
  action changes `business_profiles.context_json`, profile version, active
  Carousel plans, rendered output, or a current user's assigned Trending
  content.
- Re-analysis uses the separately pinned Business Context model
  `gpt-5.6-luna` with `medium` reasoning by default. It must use only the
  supplied factual source and return empty/null fields for unsupported details.
  Creative-writer model configuration never controls this analysis.
- `Apply to future content` promotes only an exact, fact-ready reviewed draft
  in one optimistic profile-version update. The exact draft timestamp and
  profile version must both still match, so another tab cannot silently apply
  an older draft. A draft with zero usable facts remains reviewable but cannot
  be activated; one fact is sufficient because grounded formats rotate an
  approved fact rather than requiring an arbitrary count.
- A context activation never prebuilds, reconciles, or reassigns the already
  reserved local-day Trending pack. That pack is read with its saved profile
  version and remains a historical snapshot; only a new local-day pack uses
  the newly active context. This prevents a v13 context from detaching ready
  v12 Carousel, Hook, Wall-of-Text, or Reaction assignments.
- Each profile-version is the immutable fact boundary for all generation
  formats. Carousel continues its existing server-derived anchoring; no
  Carousel plan, render, or approved assignment is bulk-rewritten when the
  owner changes Business Context. This preserves the current durable plan and
  assignment recovery contracts.

## 2026-09-17 Slide 1 cover poster treatment

- Slide 1 is a distinct, bottom-anchored cover treatment for both Carousel
  structures. It uses one dominant heavy display hook (92px, weight 800, up to
  three visual lines) and may include a distinct, smaller supporting line
  (34px, up to two lines). It does not use Structure 1's white headline bubble.
  Slides 2-6 keep their established type hierarchy and layouts.
- The existing image blend, crop, brightness, saturation, and background
  readability treatment remain unchanged for every slide. Moving a Slide 1
  text block lower must not introduce a new full-slide gradient, blur, crop, or
  brightness change. Structure 1 continues to use its prior center-region
  brightness sampling for Slide 1 so its blend remains stable after the text
  moves.
- Approved Hook-category assets selected with `asset_role = hook` for Slide 1
  may contain people or faces when that category calls for them. This is a
  category-scoped exception, not permission to use unreviewed human imagery or
  to change Slides 2-6's existing asset policy. The existing Hook-library role
  selection remains authoritative; no new image-selection step, user flow, or
  image transformation is introduced.
- Existing completed Carousel renders remain immutable. The treatment applies
  to new renders and intentional edits only; historical images are not bulk
  rewritten.

## 2026-09-20 True Black cover typography and short-hook prompt contract

- Both Carousel structures render newly created Slide 1 covers with Geist Black
  at weight 900. The worker image explicitly packages `Geist-Black.ttf`, so an
  exported slide does not rely on an 800 request resolving to a lighter Bold
  face. Slides 2-6 retain their established SemiBold hierarchy.
- Structure 1 initial, batch, repair, and native-overflow prompts, plus
  Structure 2 initial and repair prompts, now ask for one self-contained,
  reader-first hook. The target is 5-9 words (never more than 11), natural or
  sentence case, and never all caps. Structure 1 prefers `body_only` when its
  selected format allows it; its existing format roles and optional
  headline/body support contract remain intact.
- This change does not alter the six-slide formats, slide roles, cover text
  placement, image blend, crop, brightness, saturation, asset selection, or
  historical renders.

## 2026-09-20 Centered Inter Tight carousel typography

- This decision supersedes the 2026-09-17 bottom-anchored cover placement and
  the earlier 2026-09-20 Geist Black treatment for newly rendered slides.
  Existing completed Carousel renders remain immutable.
- Both structures now render Slide 1 as a centered (52% vertical centre),
  three-line maximum hook in Inter Tight Bold 700 at 96px. The type has no
  added outline, drop shadow, or black gradient. Supporting copy remains an
  exceptional, distinct secondary line at 32px rather than a repeated hook.
- Slides 2-6 use centered Inter Tight SemiBold 600 at 60px. Slide 6 uses the
  same treatment as the preceding content slides; no Carousel
  slide has a standalone CTA type treatment. This changes typography and text
  placement only; six-slide roles, formats, copy modes, and the original image
  blend remain intact.
- Neither renderer adds a readability gradient or tint to any Carousel slide.
  Structure 2 retains its existing crop and product-screenshot layout variants;
  Structure 1 continues its existing brightness sampling without adding a
  gradient.
- Structure 1 and Structure 2 initial and repair prompts ask for one 5-9 word
  (11 maximum), sentence-case Slide 1 hook and a clear central text-safe zone
  in the supplied visual direction. Follow-up copy is guided toward 18-30
  words so the larger centered type does not rely on shrink-to-fit behaviour.

## 2026-09-20 Richer centered body copy without gradient overlays

- Slides 2-6 now target 18-30 words, with a 30-word ceiling and a ten-visual-
  line maximum at 60px in both structures. The larger content budget is paired
  with real render-fit validation; text is never shrunk or cut to fit.
- No Carousel slide receives a renderer-added black gradient or tint. Structure
  1 continues its existing image brightness sampling without a gradient;
  Structure 2 now renders its text directly over its established background
  image and retains its existing crop/layout variants without the former SVG
  readability gradient. Text outline remains a non-cover readability treatment.

## 2026-09-20 Single-hook-only Slide 1 contract

- This decision supersedes every earlier optional Slide 1 supporting-copy rule.
  New Carousel plans in both structures use exactly one hook only: target
  5-9 words, hard limit 5-11 words, rendered in the centered 96px Inter Tight
  Bold cover treatment. There is no cover subtitle, body support line, or
  secondary text layer.
- Structure 1 generates the hook in `headline` with `body: null`; its renderer,
  re-edit worker, and editor preview render only that headline. Structure 2
  keeps its single `storyText` field and applies the same 5-11 word hook limit.
  A legacy saved Structure 1 plan may still contain body/subtext, but a new
  intentional re-render ignores it on Slide 1 instead of drawing it as support.
- This changes only visible Slide 1 copy structure and its validation. The
  image blend, crop, brightness sampling, background asset policy, and Slides
  2-6 treatment remain unchanged.

## 2026-09-20 Final takeaway, not a CTA

- All newly planned Carousel slides must set `ctaText` to null. Slide 6 remains
  part of the six-slide sequence, but it is a self-contained 18-30-word final
  takeaway at the same centered 60px SemiBold treatment as Slides 2-5. It must
  never become a separate action label or an instruction to save.
- This applies to both structures and to Carousel re-edits. A submitted edit
  cannot reintroduce CTA text into a new render. Existing completed renders
  remain immutable.
- The editor's temporary preview follows that same rule: it never draws an old
  CTA field or a readability gradient while an edit is being made.
- A user-supplied or approved application screenshot may still be selected for
  Slide 6. That is an image-selection decision, independent from the removed
  CTA-copy behavior.

## 2026-09-21 Validated centered copy contracts

- Both Structure 1 and Structure 2 prompt for a 5-11-word Slide 1 hook and
  18-30-word prose on Slides 2-6, then enforce those exact word ranges through
  their publishing validators and bounded repair path. No generated copy is
  truncated, expanded, or otherwise replaced after the model response.
- The OpenAI `gpt-4o-mini` production probe returned `finish_reason: "length"`
  with zero completion tokens when the whitespace word-count regex appeared in
  a strict Structured Outputs schema, while the otherwise identical schema
  without that regex completed normally. Therefore these schemas retain strict
  object shape, nullability, character limits, and role enums, but deliberately
  omit the word-count `pattern`. The prompt plus validator are the safe output
  boundary for this model.
- The maximum new-cover hook length is 42 characters in both structures. This
  gives the existing centered 96px, three-line treatment the measured margin it
  needs for natural reader-first hooks. The 5-11 word contract remains the
  governing rule; the character ceiling is a fit guard, not a request for a
  second support line.
- The Structure 2 strict-output schema uses the broader 720-character story
  transport ceiling for Slide 1 rather than imposing the 42-character publish
  ceiling inside the decoder. The publisher remains authoritative: it rejects
  any overlength hook and an unterminated hook exactly at the 42-character
  boundary, then uses the existing isolated repair to request a shorter,
  complete hook. This prevents decoder-boundary fragments such as a final lone
  letter from reaching a rendered slide; it does not alter the visible cover
  budget or rewrite historical renders.
- The change does not alter the image blend, crop, brightness, safe area,
  fonts, text placement, slide roles, CTA prohibition, or historical renders.

## 2026-09-21 Structure 2 bounded near-valid copy repair

- Structure 2 continues to make one isolated LLM repair for a rejected plan.
  It may make exactly one additional repair only when every remaining blocking
  issue is a word-count or copy-uniqueness issue (`word_count`,
  `recent_repetition`, or `story_repetition`). The final repair repeats the
  exact publishing contract and asks the model to count changed Slides 2-6.
- This is not a general retry loop: provider-empty, invalid-schema, claim,
  role, CTA, rendering, or other content failures remain terminal after their
  normal single repair. No renderer or worker ever pads, truncates, or rewrites
  model copy to make it pass.
- The decision raises the Structure 2 planner identifier to
  `llm-carousel-structure-2-writer-v14-bounded-copy-repair`; it changes only
  generation recovery reliability, not the approved cover/body design,
  existing image treatment, format sequence, or historical renders.

## 2026-09-21 Verified TikTok scheduling beta

- The visible new-post scheduling and inline Carousel scheduling surfaces stay
  Instagram-only for all accounts except the verified Firebase email
  `vtu19403@veltech.edu.in`. That account may select its connected TikTok
  account alongside Instagram for Direct Post video and 2-35 image photo
  Carousel targets. YouTube remains dormant.
- This is enforced in the OAuth, analytics, draft create/edit, final schedule,
  and retry server boundaries; a hidden frontend control is not the access
  control. The named verified Firebase email is the complete allowlist.
- TikTok authorization requests exactly `user.info.basic`, `video.publish`,
  and `video.list`. The account identity view uses basic info, Direct Post uses
  `video.publish`, and per-video analytics use `video.list`. Do not add
  `user.info.profile`, `user.info.stats`, or the draft-only `video.upload`
  scope for this beta without a new product decision.
- The beta analytics panel shows only returned public-video metrics (views,
  likes, comments, and shares). It does not claim account-level followers,
  following, total likes, or public-video-count analytics.

## 2026-09-23 TikTok Direct Post audit readiness

- The verified-email TikTok beta collects explicit per-target Music Usage
  Confirmation before it saves a schedule. It preserves TikTok's mandatory
  manual visibility choice; `SELF_ONLY` is never selected or substituted by
  the app.
- `TIKTOK_DIRECT_POST_AUDITED` defaults to false in the web app and worker.
  While false, the scheduler and publisher reject TikTok visibility other than
  `SELF_ONLY` with an actionable audit message. A private test still requires
  the creator to make the TikTok account private. TikTok approval is the only
  condition that changes the flag to true.
  Scheduling now verifies that account requirement from fresh creator-info
  privacy options; the worker checks it again before new video/photo publish
  initialization. Public or unconfirmed account privacy is blocked without
  changing the selected connection or visibility. Existing publish sessions
  retain their IDs on retry; the check does not reinitialize them.
  The full Scheduling editor keeps each enabled platform discoverable with a
  Connect action when no non-revoked account is present. It refreshes account
  data when opened and provides manual refresh after reconnecting in Settings.
  Disconnected accounts are never presented as active publishing destinations;
  the existing TikTok beta gate and Carousel platform restrictions remain intact.
- TikTok server-hosted videos and photo carousels use `PULL_FROM_URL`; every
  production media hostname must be verified in TikTok Developer Portal before
  scheduling. The worker rejects a media URL outside the configured verified
  host list before it asks TikTok to publish.
- This changes only the TikTok target controls within the shared inline
  scheduler. It does not change Carousel source ownership, slide rendering,
  caption behavior, or the Library-to-Social scheduling boundary.

## 2026-09-25 Hook schedule layout and confirmation boundary

- The Hook video schedule drawer shares the Wall-of-Text desktop dialog width:
  it is responsive within the viewport and may grow to 960px. Its fixed header
  and action footer remain visible while only the form body may scroll.
- On desktop, destination selection is placed beside caption and publish-time
  controls. Selected TikTok and YouTube accounts place only their compact,
  post-specific publishing details below that primary form. The previous
  expanded account-card checklist is retired: generated Hook media retains its
  safe default AI disclosure without a routine checkbox, commercial disclosure
  remains a collapsed optional control, and YouTube visibility remains a
  collapsed account detail.
- TikTok still requires an explicit manual audience choice from the current
  creator capability response; the application must not preselect visibility.
  The audit restriction and provider-specific commercial-content choices remain
  enforced. Music Usage Confirmation is no longer displayed in the main
  scheduling form. The final TikTok confirmation dialog records that explicit
  consent immediately before schedule submission, and server-side normalization
  continues to reject any target without it.
- This is a Hook-scheduling presentation and confirmation timing change only.
  It does not alter account gates, selected targets, captions, time validation,
  durable scheduling, media rendering, or provider publishing behavior.

## 2026-09-23 Verified YouTube scheduling beta

- Video scheduling is enabled only for the verified Firebase identity
  `vtu19403@veltech.edu.in`. The same server-owned check protects Google OAuth
  connection, schedule creation and editing, final schedule submission, and
  publish retries; a hidden client control alone never grants YouTube access.
- The approved account can connect a YouTube channel from Settings and select
  it in the video scheduling editor or Hook-video drawer. The OAuth flow asks
  only for channel read and `youtube.upload` scopes, and scheduled publishing
  requires both upload scope and a background-refresh token.
- YouTube remains unavailable for Carousel scheduling because the upload API
  accepts video media only. The inline Carousel scheduling modal remains
  Instagram plus the existing verified TikTok beta, and legacy targets remain
  lossless when an older schedule is edited.
- Google test-project behavior is an external rollout constraint: the approved
  email must be listed as a Google OAuth test user, and uploads from an
  unaudited project are restricted by Google to private visibility. General
  release requires the corresponding Google verification/audit; it is not
  implied by this beta gate.

## 2026-09-21 Structure 2 field-level repair and empty-response evidence

- A parsed Structure 2 plan with blocking copy failures on one or more
  individually repairable slides now receives a bounded field-level repair
  that returns only those slides' `storyText` values. The worker merges and
  revalidates them against the unchanged six-slide plan. Structural, CTA, and
  recent-history failures retain the complete-plan repair path. No valid
  sibling slide is rewritten merely to correct word-count, fit, grounding,
  perspective, repetition, or hanging-hook issues.
- The validator also rejects only clear hanging cover endings below the
  42-character cap (for example, a hook ending `to constantly`). It still does
  not require punctuation from naturally complete short hooks.
- An empty initial provider response is now identified separately and its
  completion ID, request ID when supplied by the SDK, finish reason, refusal,
  response size, and token usage are persisted with each failed generation.
  This distinguishes an absent model response from a copy-rule rejection.
- The decision initially raised the planner identifier to
  `llm-carousel-structure-2-writer-v16-field-repair-observable-empty-response`.
  It preserves the fixed font sizes, safe area, no-shrink/no-truncate policy,
  story sequence, history boundary, historical renders, and approved image
  behavior.

## 2026-09-21 Structure 2 flexible body-copy boundary

- Production evidence showed that the 18-word lower limit—not the fixed 60px
  rendering contract—was causing otherwise complete 14-17-word body sentences
  to enter repair and, at times, turn worse during repair. New Structure 2
  body copy on Slides 2-6 therefore accepts 14-30 words and aims for 16-22
  words. This is a narrow change to Structure 2, the generation path where
  the failures were observed; Structure 1 is unchanged.
- The 30-word ceiling, fixed 60px font, ten-line safe area, no-shrink and
  no-truncate renderer behavior, six-slide sequence, first-person voice,
  grounded-claim checks, duplicate/history checks, no-CTA policy, and
  complete cover-hook rule remain mandatory. A short sentence still fails when
  it is incomplete, generic, structurally wrong, unsupported, or does not fit.
- The source format library and runtime validator now share this exact
  14-30-word range. The planner identifier is
  `llm-carousel-structure-2-writer-v17-flexible-body-copy-field-repair`, so
  production rows make the relaxed boundary auditable.
- The targeted copy-repair schema also applies the existing 42-character cap
  to Slide 1 only. This is not a new copy-quality rule: it prevents the repair
  response from ignoring the measured three-line, 96px cover fit boundary and
  causing a valid body plan to fail for a second time.

## 2026-09-22 Structure 2 render-first cover and exact-freshness boundary

- A live production batch on the then-current v17 worker proved that the
  worker, queue, image path, renderer, and feed delivery were healthy, but
  fuzzy recent-copy validation rejected otherwise valid plans too often. The
  validation boundary now blocks only a literal visible-copy duplicate after
  normalizing case, punctuation, and whitespace. A close token overlap remains
  an advisory freshness signal and the writer still receives recent accepted
  copy to avoid it; it cannot by itself discard a natural, audience-relevant
  Carousel.
- The 42-character cover figure is now a writing preference, not a publishing
  ceiling. Slide 1 still must be one complete 5-11-word hook and must pass the
  measured centered 96px, three-line render-fit and safe-area checks. A hook
  that physically overflows remains blocked. A complete unpunctuated hook at
  the preferred length is valid; a lone final letter at that boundary and clear
  hanging endings remain rejected as actual truncation signals.
- Structure 2 targeted repair uses the existing broad 720-character structured
  transport ceiling for Slide 1. It asks the model to prefer the 42-character
  target, then the publisher decides with the real word-count, completeness,
  and render-fit checks. This avoids decoder-boundary fragments while preserving
  no-shrink and no-truncate rendering.
- The decision raises the planner identifier to
  `llm-carousel-structure-2-writer-v18-render-first-freshness-advisory`.
  It changes only new Structure 2 validation and repair behavior; slide roles,
  CTA prohibition, image selection, safe area, renderer, and historical
  renders are unchanged.

## 2026-09-23 Shared hook-template coverage for Structure 2 (local implementation)

- Supersedes the earlier Structure 1-only hook-template restriction. Structure 2
  reuses the twenty-pattern catalog through explicit compatibility pools for all
  eight story formats. List/formula patterns and context-specific copywriting
  patterns are excluded from these pools. Selection is deterministic, prefers
  unused eligible patterns within the batch and recent completed history, and
  changes Slide 1 guidance only.
- New batch preparation snapshots the existing global
  `CAROUSEL_HOOK_TEMPLATES_MODE` (`off`, `shadow`, `enabled`). There is no account
  allowlist. Missing legacy snapshots remain off; already-dispatched legacy
  batches cannot be enabled by replaying preparation. Shadow records proposed
  choices but sends no optional pattern to the model.
- Both direct Structure 2 batches and Structure 1 planning takeovers resolve
  hooks at their shared Structure 2 worker entry, after final story formats are
  known. Takeover still clears obsolete Structure 1 choices. A service-role-only
  transaction persists all five assignment/generation pairs and a resolution
  marker before the model call. Retries reload durable choices rather than
  rerolling. The new migration expands the old Structure 1-only pair constraints;
  apply the additive migration before deploying callers.
- Application readers now recognize compatible Structure 2 template attribution.
  Missing, stale or incompatible optional templates use native story guidance;
  required structure/format identity checks remain in place. Effective attribution
  and resolution reasons are saved separately from the batch selection diagnostics.
- Initial generation, full-plan repair and targeted cover repair use the same
  resolved pattern. The writer is
  `llm-carousel-structure-2-writer-v19-shared-hook-templates`. Unresolved hook
  placeholders and unsupported numeric multipliers remain publishing failures.
  After two normal repairs, only a remaining Slide 1 render-fit failure may get
  one native-cover repair. It freezes strategy and Slides 2-6, revalidates the
  complete story, and clears effective template attribution with
  `hook_template_cover_render_fit` if successful.
- No renderer, six-slide role, 14-30-word body, CTA, image, daily-feed eligibility,
  old inventory or historical-render change is included. Centered 96px cover
  type, the three-line limit, and no shrink/truncate behavior remain unchanged.
- Local checks: `npm run carousel:structure-2-hooks:test`,
  `npm run carousel:content-grammar:test`, and TypeScript checks. This entry does
  not assert production rollout: migration application, coordinated web/worker
  deployment, mode verification and bounded direct/fallback canaries on
  `https://www.getugcpilot.com` are separate release gates.

## 2026-09-25 Streamlined business onboarding presentation

- New background-onboarding sessions use a two-screen presentation: one source
  screen and one durable setup-progress screen. The prior identity and goal
  screens remain in source for legacy and already-started draft sessions; they
  are not deleted or repurposed.
- The source screen accepts either a public website or a short manual product
  brief. Manual briefs retain the existing `manual` intake type, add an explicit
  `experience: streamlined` marker for safe resume behavior, and use the
  existing background analysis worker to turn the description into grounded
  business context. This does not create another profile, analysis store,
  Carousel source, or generation worker.
- Once analysis is attached, streamlined sessions persist the supplied or
  analyzed business name and the default `brand_awareness` purpose before the
  existing durable finalizer runs. The established profile-version, trial,
  ownership, idempotency, and `prebuildTrendingAfterOnboarding` boundaries are
  unchanged. A legacy draft retains its previously chosen identity and goals.
- Progress copy may describe the upcoming Wall-of-Text, Hook, and Carousel
  preparation, but it must be driven by durable job states and must not claim a
  format is complete before the finalizer has committed. The unified feed
  remains the source of truth for its actual per-format readiness.
- The streamlined source and progress views intentionally use an unframed,
  centered canvas: one centered prompt or status list and only the
  current-status toast. The old decorative progress rails were removed because
  they did not represent the two-screen onboarding flow. This is
  presentation-only; it does not change Carousel generation or readiness behavior.

## 2026-09-25 Wall reference typography and range-only writing

- New Wall-of-Text output uses the packaged Arial Bold 700 face at fixed 50px
  with the existing 1.10 line-height, 4px outline, normal tracking, and no
  shadow. The fixed 52px V13 layout remains accepted only for saved legacy
  cards; no historical card is reflowed by this decision.
- Writer requests carry only the inclusive measured word range (normally
  24–48). There is no preferred or target count in the prompt. The durable
  `target_words` reservation field remains for RPC compatibility and stores
  the range maximum, never a copy-generation instruction.

## 2026-10-03 Seven-day trial and pricing alignment

New trials receive seven calendar days and seven daily packs from completed
onboarding, with 20 concepts per pack and unlimited Instagram scheduling while
active. The quota is charged when a pack is reserved; its final reserved pack
can still finish while active. Unexpired trials extend from their original
start without resetting usage. Expired trials stay closed and longer custom
trials are preserved. Paid and complimentary access stays unchanged.

The pricing page distinguishes daily content from shared AI generation credits
and advertises only deployed workflows. See
`docs/trending-seven-day-trial-2026-10-01.md` for the release migration and checks.

## 2026-10-04 Shared scheduling time-zone release integration

- Scheduling and the shared inline Carousel/Wall/Reaction scheduler use the
  owner-persisted account time-zone default, initialized once through the
  verified Firebase identity. Explicit manual date/time edits and saved schedule
  time zones remain authoritative. The account query is reset on UID changes.
- The Hook drawer uses the same default and full time-zone selector. Its compact
  account rows sort only their display copy; destination IDs, provider access,
  mandatory settings, consent, and the durable scheduling contract are unchanged.
- The worker checks the durable target's scheduled time before claiming a new
  provider operation. An early delivery is a durable wait, not a failed provider
  attempt. Already published outcomes and cancelled-post cleanup retain their
  idempotent paths. This complements the already-applied database claim/recovery
  guard; those migrations are not replayed.
- These source integrations are local, not deployed. No Carousel source,
  selection, plan, slide, rendered asset, daily slot, or Library ownership rule
  is changed. Production-domain acceptance and coordinated app/worker deployment
  remain required.

## 2026-10-04 Reviewed native Trending post-feed checkpoint

- The approved post interaction replaces horizontal swipe presentation with a
  vertical scrolling feed. Double-tap/Like enters the existing format-specific
  scheduling or Hook composition flow; scroll/Skip records the existing durable
  skip decision. Only the active post plays media or accepts actions.
- A Carousel must be saved to the owner's Library before dismissal and scheduling
  hand-off. A failed save leaves the post visible and releases its interaction
  lock. No new publishing operation or provider call is introduced by the gesture.
- Current-visit review history holds at most 120 posts in the parent feed state,
  including while the Hook composer is open. History is read-only: revisiting
  cannot repeat a save, decision, edit, scheduling hand-off, or autoplay.
- Shared Landing/Try demonstrations use the same gesture primitive without
  implying that a demo like has actually published a post. Drag/snap timers and
  listeners are cleaned up on resize, blur and unmount; reduced motion is honored.
- This checkpoint changes presentation and interaction only. Existing owner,
  daily assignment, immutable profile, render, recovery and publishing contracts
  remain authoritative. Offline checks are not production acceptance.

## 2026-10-08 Explore format workflows

- Explore exposes separate Hook video, Wall of text, and Slideshows workflows. The older talking-head/demo and creator-phone routes remain hidden; their component code is retained as the visual reference.
- Hook and Wall of text generate videos only, accept an optional owned image or short video input, and can import existing owned footage for trimming/text/narration. Their Create sidebar reuses the older square reference tiles, instruction field, settings rows and action footer, with no voice-reference tile or subtitle controls.
- Selecting a gallery video shows that actual clip in a playable style-example tile. It never silently attaches the clip's poster as an image. Gallery examples are visual guidance; uploaded optional media is the explicit provider input. Uploaded video requests include their owned media asset ID.
- Slideshows generate images only, edit an ordered 2–10 image sequence, and save it to the owner's Library through a restricted, idempotent API. Manually arranged sequences do not invent a Carousel generation/plan record; the existing Library slide foreign key becomes nullable for this path. Automatic Carousel sourcing, matching, plans and readiness remain unchanged.
- Generation immediately opens Your Video / Your Slides. Editing and saving remain gated until the schema and renderer release are verified.

### 2026-10-11 Explore image and video reference correction (local)

- Hook and Wall of text now retain the optional image and source video together.
  A selected gallery clip is a real generation input, resolved by its registered
  ID on the server. This supersedes the earlier style-example-only behavior.
- New video workflow requests use explicit Google Omni edit mode, with video
  bytes, appearance image and complete instructions. Source roles and token
  counting include both media. Existing jobs without this mode keep their
  original provider routes and request fingerprints.
- Sources are limited to 10 seconds and 32 MB; gallery MP4 duration is verified
  before billing, owned uploads retain their ownership checks, and clips are
  never silently shortened. Unsupported models cannot discard the video.
  Missing input fails before provider submission without image-only fallback.
- Generated edits require user review. Provider completion is not a check of
  face likeness, action matching or text removal. Website and worker release
  plus an authenticated production canary are still required. See
  `docs/workflow-image-video-reference-fix-2026-10-11.md` for the contract.

### 2026-10-11 Explore workflow grid presentation (local)

- Explore follows the user's two-row sketch. At desktop container widths of
  840 CSS pixels or more, Talking Head + Demo, Hook video, and Wall of text
  occupy the first row. Slideshows, Build AI influencer, and Quick start occupy
  the second row. Every workflow is in the page layout; horizontal scrolling
  and the two navigation dots are removed. The grid reflows to two columns
  from 560 CSS pixels and one column below that.
- Build AI influencer uses the same landscape preview and below-preview title
  placement as the workflow cards. Quick start contains only AI Studio, Video
  generation, Image generation, and Audio generation in a roomier 2-by-2
  layout. Library, Trending content, and Schedule a post shortcuts are removed.
  Its button area matches the neighboring 16:9 previews, with its heading and
  description placed below using the same spacing and typography. Full shortcut
  descriptions remain in each link's accessible name.
- Workflow destinations, development preview links, cover playback/reduced
  motion, and slideshow generation/editor contracts retain their behavior.
  This presentation change is local and has not been deployed.

### 2026-10-08 Manual slideshow editor follow-up

- Slideshows shares the older workflow sidebar and footer. Users choose slideshow examples from the right-hand gallery or upload 2–10 JPG/PNG/WebP reference images; image model, ratio and image-count controls stay in Create. Uploading references does not call a generation provider.
- Edit slides adds per-slide heading/body text, font, size, alignment, position, colors and allowlisted SVG background shapes. The same vector overlay drives preview and PNG export. Edited pixels are uploaded as owned ready image assets before Library saving; scheduling uses the confirmed saved images.
- Users may reorder or remove generated slides, retaining 2–10 images for saving. Reference slides guide generation and do not automatically enter the editor. Every generated or edited output resolves to an owned, ready, non-deleted image; no arbitrary client URL is trusted by the save API.
- Browser exports load catalogue slides or owned ready images through a size-bounded, same-origin endpoint. It accepts catalogue/asset IDs, never a client URL, rejects redirects and non-raster responses, and disables caching of account images. Guest access is limited to catalogue images in development preview; production exports require existing Pro access.
- Drafts are owner/reference scoped. Interrupted Library saves preserve their immutable request key and resolved asset IDs; completed saves are verified against the owner's Library before scheduling. Automatic Carousel generation, sourcing, plans, readiness and publishing workers are unchanged. This follow-up is included in the complete Explore release; production deployment is verified separately against the merged commit.

### 2026-10-08 Slideshow reference and model refinement

- Create removes the redundant Browse slideshows tile and the reference-only Edit these slides action. Its fields flow together within the scrolling sidebar instead of stretching the instruction field above Model. A selected reference uses a square preview tile; opening its full slideshow starts at the selected reference slide.
- Selecting or uploading a slideshow stays in Create. Only generated replacements enter Edit slides, receive text overlays and become Library outputs. Older drafts preserve their generated replacements and text while dropping unmodified reference pixels. Interrupted saves containing generated/edited asset IDs retain their immutable retry contract; obsolete reference-only saves are not resumed.
- The slideshow model selector defaults to GPT Image 2.5 and offers Nano Banana 2.1 as the alternative. Seedream is removed from this workflow; standalone AI Studio keeps its existing model options and default. The API enforces the workflow-specific allowlist before credit reservation.
- The image worker maps `gpt_image_2_5` explicitly to OpenAI `gpt-image-2.5-sunburst` for reference-based editing. It cannot silently inherit the older `OPENAI_IMAGE_MODEL` value. The provider fence, output ownership, credit reservation, ratio handling and disabled SDK retries remain in force. The updated worker must be released before advertising the new frontend default in production.

### 2026-10-08 Explicit slideshow generation context

- Beneath the selected preview, Create shows every source slide in a horizontally scrolling thumbnail strip. All slides selects the complete slideshow; Selected slides lets users include any subset, including one slide. Empty selections cannot generate. Choosing or uploading another slideshow resets to its first slide.
- The checked images become the explicit `referenceImageUrls` context for every requested output. The selected preview slide is first when included, with the remaining references in their original order. Output images controls the number of new images, independently of reference count; reference pixels still never enter Edit slides automatically.
- API validation canonicalizes every input with the current owner before billing or queueing. Worker input and provider fingerprints retain the exact reference list; every private image is resolved for that owner. GPT Image 2.5 receives a file array and Nano Banana 2.1 receives multiple image parts plus the instructions. Legacy single-image jobs retain their previous input and fingerprint contract.
- Context is limited to 14 distinct references (the catalogue has at most 12 and uploads at most 10), 25 MB per input and 50 MB combined downloads. Oversized context fails before provider submission. No database schema or automatic Carousel sourcing/matching/rendering behavior changes. Coordinated worker and website deployment remains required; offline checks do not call paid generation.

### 2026-10-08 Optional demo in Hook and Wall of text

- Video workflows add Create → Edit video → Demo → Schedule. Clicking Edit video opens the ready uploaded/Creative Assets clip through the same handoff as Edit this video. Slideshows keeps its three existing sections.
- Demo accepts an owned uploaded or Creative Assets video, with replace/remove, playable preview, trim, the older framing/pan controls, original volume and optional uploaded/saved audio. Users can continue with just the saved opening. No generation prompt, provider, subtitle or Carousel behavior changes.
- Save final video freezes the chosen inputs. Existing single-video finishing first trims the demo; an optional audio pass starts its soundtrack at the trimmed segment's beginning. The existing concatenation contract then joins the saved opening before the prepared demo. Opening overlays and sound remain in that segment; recorded framing is rebased to demo trim timestamps.
- Every pass uses the existing owner-bound, idempotent receipt and renderer. Only the confirmed combined asset enters Schedule. Changing either opening edits or demo inputs invalidates the scheduling output. Local selection never dispatches a render. Prompt defaults and slideshow business-context changes are explicitly deferred from this release.
- Demo upload and Creative Assets are available before choosing or saving an opening. The owner/workflow-scoped draft preserves demo trim, framing and soundtrack across opening changes; untouched legacy opening drafts migrate without replacing newer selections. Only combining requires a saved opening. A selected, uploading or restoring demo prevents scheduling the opening alone until the user explicitly skips it. Opening revisions invalidate stale combined outputs even when an asset ID is reused; incompatible framing must be reset or recorded again.

### 2026-10-09 Explore laptop layout (local)

- Narrow windows now show a persistent Controls / Preview switch. Both panels stay mounted, so changing views preserves source selections, generation state and slide edits. In compact video editing, reopening Workflow controls uses a temporary full-width controls view with Back to editor instead of compressing the media/tools pane. This replaces the earlier side-by-side expanded-controls mode.
- Slideshow Create labels the reference-image selection separately from the active slide and versions requested for that slide. Reference selection and output quantity contracts are unchanged. The development-only preview can seed two sample outputs for populated editor layout checks; it cannot save or generate, and production never accepts these fixture pixels as owned outputs.

- Hook and Wall of text use Create, Demo and Schedule; each clip is edited from its preview rather than a separate Edit video tab. Desktop editor headers and actions reserve their own rows, with only the media/tools body scrolling. Stacked and very short windows use normal document flow, and navigation reveals the chosen panel at the same 1024px breakpoint as the layout.
- Compact video editing uses the available workflow width and exposes an accessible Workflow controls toggle to reveal the still-mounted source panel. Back to previews restores the normal workspace. The compact width boundary includes fractional CSS pixels from display scaling. Portrait media reserves room for its playback controls and Edit actions; an absent optional Demo is a short Add demo row rather than a second full-height card.
- All three format workflows retain readable 14px generation instructions with at least 160px writing height. Reference tiles stay capped in compact and stacked layouts. Text styling/timing is disclosed on demand; existing clip drafts, portal targets and save/merge handlers remain intact.
- Scrollbars remain visible with muted narrow thumbs across the workflow, its dialogs and app navigation. The development-only format fixture now also renders Slideshows for free layout checks. Generation, slideshow ownership/export, automatic Carousel sourcing and publishing contracts are unchanged; paid operations and authenticated production acceptance are outside these local checks.

### 2026-10-10 Explore scheduling review and publishing preferences (local)

- Explore video workflows pass the confirmed final owned video to scheduling as one playable, fixed video with its duration. The generic scheduler retains Hook/Secondary selection for independently composed posts; Explore does not offer a second composition of its already finished video. Slideshows retain their saved, ordered image sequence.
- Hook and Wall of text can schedule an opening alone, a demo alone, or opening followed by demo. A selected but unprepared opening is never silently skipped. Neither clip selected blocks preparation. An unchanged, ready owned MP4 can be scheduled directly; standalone demo trim, text, sound and crop/pan still apply before scheduling. Source framing is an optional single-clip extension behind the existing framing gate, with a distinct renderer fingerprint; omitted legacy fields and receipts keep their identities.
- Optional publishing controls are collapsed. TikTok's required visibility selection and supported interaction choices remain available; privacy is not silently preset. Photo posts omit video-only Duet/Stitch controls. An owner-persisted AI content disclosure default in Settings initializes new TikTok/YouTube posts, while explicit per-post choices and saved schedule settings remain authoritative. This preference does not alter Carousel sourcing, plans, rendering, readiness or publishing ownership.
- The shared Trending publishing modal and Trending video drawer also load this account disclosure preference. Account selection and creator-capability refresh store only per-post overrides, so they cannot replace a saved AI default with a hard-coded value. New TikTok/YouTube submissions wait for the preference read; a failed read is disclosed for review with the existing AI disclosure fallback. Closing/reopening the modal or changing accounts invalidates its prior preference response. TikTok visibility and interactions remain explicit per-post choices.
- The video drawer exposes the AI disclosure choice for each selected TikTok/YouTube account, including when optional audience settings are collapsed. Supported TikTok video interactions can be enabled per post; creator-disabled interactions stay unavailable. The shared photo-post modal continues to expose only comments.
- These changes have local component/browser, database permission and renderer checks. The publishing-preference migration and the website/worker contract must be released together before production acceptance. Local fixtures cannot publish real posts or replace authenticated verification.


## 2026-10-12 Explore reference duration contract

- Hook and Wall of Text send the selected gallery or owned source video, optional appearance image, and complete prompt to Google Omni in edit mode. A ten-second source retains its ten-second timeline; output duration is derived from the source.
- Source support follows Omni uploaded-video editing (up to ten seconds), with a 32 MB download bound. Sources are never silently truncated or omitted. Unsupported models must disclose incompatibility while retaining the attachments.
- Edit results must pass an actual MP4 duration check before storage, allowing 0.25 seconds for frame/container rounding. Mismatched or unreadable results fail without a new paid retry. Verified duration is retained for recovery.
- This scoped release preserves old jobs without edit mode. Worker rollout precedes the website, followed by authenticated production verification. See `docs/wall-text-reference-release-2026-10-12.md` for validation and release state.


## 2026-10-13 Compact Explore restoration and pending Wall scheduling (local)

- The user's final marked screenshots select narrow left controls, in-panel stage tabs and a dense right gallery/preview. Hook uses Create/Demo/Schedule; Wall uses Create/Edit/Schedule; Slideshows uses Create/Edit slides/Schedule; Talking Head uses Create/Edit demo/Schedule. Quality and alternative-output counts are immediately visible.
- Talking Head's preview is always present. Its redundant creation headline/description, Hide/Show preview control, Library shortcut and empty Library section are removed at the user's explicit request. Image, video and audio reference pickers remain wired; audio guidance is Seedance 2.5, up to 30 seconds. This supersedes the earlier optional-hide presentation for this route.
- A local Wall single-clip pending-schedule producer now captures the selected owned source, trim, timed text and original/background audio settings through the existing top-level editing contract. Source/account changes, loading/errors and stale confirmation invalidate that snapshot. Background scheduling stays capability-gated and falls back to export-first when unavailable. Its right pane uses the existing sequence preview before export; platform targets still require verified final media.
- These UI and pending-schedule changes do not alter automatic Carousel sourcing, matching, plans, reservations or readiness. Saved Slideshow image sequences retain their Library ownership and explicit confirmation.
- Latest read-only production check resolves website SHA fb7728fc8ac4f1e66ad55fb45b6830d267ad1b38; its pending-schedule API and the four local Explore migrations are not deployed. Local validation is not production acceptance. See docs/explore-functional-fixes-review-2026-10-13.md.
- Final Hook/Wall Create restoration uses direct square optional-reference buttons, Your instructions, visible source heading and 200px prompt. Selected references shrink to a compact row; source-duration text retains the classic settings grid. Existing upload/selection/model constraints are unchanged. Slideshow image scheduling and automatic Carousel operations remain unchanged by these presentation corrections.
- Schedule review actions use bounded columns and stack in narrow form containers after the user identified an overlap. Stable platform tiles keep Instagram, TikTok and YouTube names separate from selection checks; the obsolete Talking Head inline-platform override is removed. Confirmation, ownership, selected target and image-only platform constraints are unchanged.

- Talking Head + Demo keeps one workflow header and the same rounded controls card across Create, Edit demo and Schedule. The stage tabs remain inside that card; Schedule inherits its width, alignment, padding and scrolling instead of replacing it with a separate form card. This is a presentation change only.

- Hook video and Wall of text retain the Talking Head + Demo controls-width rule on compact desktop screens: `clamp(360px, 25cqw, 440px)`. The former 336px override is removed so those cards no longer become narrower on laptop or short-height screens. Mobile keeps the existing single-column layout.

- The same persistent header and tabbed controls card applies to Hook video, Wall of text and Slideshows when entering Schedule. The phone workflow places Create/Edit demo/Schedule inside its controls card and uses the same desktop controls width, including when its empty preview is hidden. Scheduling actions, drafts and explicit confirmation boundaries remain intact.

## 2026-10-13 Explore Recreate actions and reference tiles (local)

- Recreate on Hook/Wall gallery cards explicitly returns to Create/Generate and
  selects that card's registered video. Earlier uploaded video guidance cannot
  override it, including repeated selection of the same card. Appearance images
  and previously selected owned outputs remain available. Previewing a card
  only opens its preview. Active uploads/generation block conflicting actions.
- Image, video and audio reference tiles retain their original dimensions after
  selection. Selected images fill the tile; its overlay plus adds more images
  into the same container. Talking Head and video-generation image collections
  preserve order and individual removal, and every displayed image becomes an
  explicit generation input. Model limits are enforced without discarding
  attachments: Kling uses two references; other models use six total. Hook/Wall
  Omni edits accept up to five appearance images plus the actual source video,
  superseding the earlier one-image restriction. The existing provider already
  forwards multiple image parts and token-counts all media.
- Recreate selects a compatible model and normalizes only unsupported settings.
  Reference upload failures retain the prior preview but block generation until
  an explicit replacement/removal/cancellation. Saved-audio downloads expose
  parent pending/error state from the click, preserve specialized upload
  callbacks, and cannot silently submit earlier audio to generation or finishing.
- Valid slideshow output-image uploads immediately invalidate the scheduling
  output. Editor actions, direct Schedule navigation and scheduling review all
  respect pending slideshow changes. Failed uploads retain editable images but
  require explicit re-save before scheduling the sequence.
- Native browser fetch is invoked without dependency objects as receivers in
  generation admission/recovery/discovery and connected-account helpers, so
  Generate and account loading no longer throw Illegal invocation before a
  request. Durable request identities and owner checks remain intact.
- These corrections are local; no paid models or publishing were invoked during
  fixtures. Production authentication is unavailable in the checking browser,
  so deployment plus authenticated production acceptance remain pending. See
  docs/explore-action-audit-2026-10-13.md for validation evidence.

## 2026-10-14 Reference video duration display (local)

- Hook and Wall Create show the selected source length as a compact seconds
  value in the Duration field, aligned with the other settings. For gallery
  entries without saved duration, the existing video thumbnail reports loaded
  media metadata before Generate; the field briefly shows Reading… meanwhile.
- Duration metadata is scoped to the current video URL. Late events from a
  replaced or removed video cannot change the selected reference's duration.
  Owned uploads retain their saved duration. Gallery generation still sends
  the registered ID and the backend independently verifies the actual MP4.
- This presentation follow-up is local and not deployed. No paid generation
  or publication was submitted. Focused request/state tests cover metadata,
  duration-based estimates and stale selections alongside existing delivery.

## 2026-10-14 Direct reference removal controls (local)

- Selected Explore image and video references expose a small × in the top
  corner. The separate + stays at the bottom corner to add or replace guidance.
  Each image in a collection removes only itself and preserves the remaining
  order. Gallery videos clear their Recreate selection; uploaded videos clear
  their attachment. Neither action deletes saved library assets.
- An explicit cleared selection also suppresses the initial URL/preview
  reference. Removing guidance cannot reveal the initial gallery clip again;
  choosing another Recreate card establishes a new selection normally.
- Talking Head + Demo, Hook, Wall of Text, shared audio reference tiles and
  standalone video generation use this placement. Reading/uploading references
  and disabled generation controls cannot remove accepted guidance mid-request.
- This follow-up is local and not deployed. No paid generation or publishing
  was submitted for the UI checks.
- Validation: 168 focused reference/form/workspace tests, TypeScript and scoped
  lint pass. Desktop browser checks cover all three Explore video workflows;
  mobile Talking Head + Demo and Hook checks pass with Webpack. The final Wall
  mobile run could not finish while its client modules were still compiling
  in the shared development worktree. Concurrent caption imports also prevent
  the Turbopack preview from resolving worker `.js` references to `.ts` source.

## Preserved production-branch history

The records below are retained from the deployed branch during release reconciliation. Later dated release receipts above remain authoritative for current status.

### 2026-10-13 MCP Library adapter candidate (not deployed)

- IDE Library identities are separate from generic media IDs and Creative Asset groups. Owner-bound pages and item reads expose ordered saved Carousel/slideshow outputs, exact snapshot revisions and explicit archive tombstones.
- Carousel saves share the website's owner/completion/latest-ready-edit resolver and canonical payload builder. The MCP request binds actual generation/slide/edit source state and destination state, including removed saves. Stale inputs reject; recreating a removed save requires an explicit new request with the inspected tombstone revision.
- The additive service-only transaction records immutable accepted request inputs/results atomically with canonical saves or metadata-only removal. Recovery returns historical receipts before current write gates, plan status or source readiness and never reapplies an older replacement over newer website edits. Existing website RPCs, Carousel generation/matching/renderers and publishing behavior are preserved.
- Explore v2 MCP saves share existing owned-ready-image validation, exact ordering and fingerprints. Catalogue guidance does not enter outputs implicitly. This adapter saves already rendered images; browser-only text-bearing slideshow export still needs a separate backend workflow.
- MCP_LIBRARY_WRITES_ENABLED defaults off. The migration, hosted rollout and intended authenticated user workflow require separate verification. Offline fixture/SDK tests are not production acceptance and no customer media is generated for connectivity checks.

## 2026-10-13 Hook library hidden in Slideshow Edit (local, explicitly not deployed)

- The customer editor no longer mounts the Hook library folder or requests its
  catalogue. The description refers only to slide uploads and app screenshots.
- Existing Hook catalogue assets, category sourcing, stored edits, authenticated
  compatibility API and renderer contracts are retained. No image, category row
  or customer edit is deleted or rewritten.
- The current endpoint merges the fixed 15 Hyper Hooks with active hooks for the
  Carousel's category. That merge can increase the visible folder as category
  assets are added; specific newly uploaded image identities have not been
  reconciled during this check.
- The user explicitly asked that this UI change not be deployed. It was prepared
  after deployment source 07a4e516 was frozen and is outside that release.

## 2026-10-14 Demo and Creative Assets separation

- Dedicated `demo_upload` footage is excluded from the general Creative Assets
  inventory and Explore's opening picker. Demo reads its dedicated records and
  owned ready media projection. Scheduling explicitly retains ready demos as
  secondary footage; existing compositions, media IDs and stored files remain
  valid. This does not change Carousel image sourcing, matching or rendering.
- The user specifically identified the existing WhatsApp upload as demo footage.
  Its classification is corrected by linking that same asset to a Demo record,
  retaining its original storage key and bytes. No filename heuristic applies
  to other uploads. Generic-namespace registered demo removal retains bytes for
  completed compositions after exact owner/project/source/key validation.
- The prior complete UI/subtitle release c6a2e13f is active on the website, MCP
  and warm video receiver. An authenticated 19.2-second caption run completed
  in 11.34 seconds (0.95-second startup), compared with 130.63 seconds before
  activation. Production Serif preview is one line and caption review is centered.
  Ongoing SEO and subsequent inline Demo action work remain outside the frozen
  follow-up release. See docs/demo-creative-assets-separation-2026-10-14.md.

## 2026-10-14 Explore schedule time rejection recovery (local)

- Explore Talking Head + Demo, Hook, Wall of Text and Slideshow distinguish an
  explicit HTTP 409 `schedule_time_too_soon` rejection from an uncertain request.
  After a rejection, Review schedule opens the current form and explicit
  confirmation submits its current time. Ordinary finished-media scheduling
  retains the original idempotency key; accepted server schedules recover
  before the time-dependent minimum lead check. New requests still require
  the full five-minute lead and valid timezone/date/account selection.
- Background preparation permits a new immutable request only after an
  explicit time rejection and a read confirming the old request is unconfirmed.
  Confirmation and replay share the browser lock. Lost responses, missing GET
  results alone, accepted requests and existing publishing targets do not
  authorize replacement or automatic posting.
- Real production records confirm one Explore-format Instagram Reel reached
  publication on 2026-10-12. The caption in the reported 2026-10-14 screenshot
  has no matching server schedule in the connected account. This is evidence
  for the existing publishing pipeline, not a new production test of every
  workflow or deployment of this fix. Details and validation are recorded in
  `docs/explore-schedule-time-recovery-2026-10-14.md`.

## 2026-10-14 Approved workflow sidebar width

- The owner selected the 5% wider controls after reviewing local 5% and 10%
  schedule comparisons. Talking Head + Demo, Phone Video, Hook video, Wall of
  text and Slideshows use `clamp(378px, 26.25cqw, 462px)` for desktop controls
  across Create, overview Edit/Demo and Schedule, including the empty Create
  state. The format shell fallback grows from 360px to 378px.
- Recreate's default editor grows by the same 5% to
  `clamp(336px, 33.6%, 441px)`. Its resize state, keyboard increments and gallery
  space limits remain authoritative; its TypeScript default matches the CSS.
- Inline schedule review gives the description its own full-width header row.
  Refresh accounts keeps a single line and a stable 148px width while loading.
  Mobile stacking, expanded clip-edit tools and publishing contracts retain
  their existing behavior. This supersedes earlier 360–440px controls guidance.

### Trending touch rollout acceptance — 19 October 2026

- Source 426b37fd is deployed to the real production dashboard; PR #73 merged as d2f698a7 with an identical source tree. All 86 interaction tests, application TypeScript/lint, the combined actual-gallery browser gate, contract CI and Vercel production build passed.
- Real signed-in production mouse advance/reversal restored the exact prior post; reload preserved that selection. One initial skip was recorded, with no save/schedule/publish/generation. Phone/tablet native touch is covered by local Chromium tests; physical device acceptance remains separate. Receipt: outputs/trending-touch-release-verification-2026-10-19.json.

## Trending library backgrounds retain body copy — 19 October 2026 release preparation

- Include the completed worker correction in render-trending-carousel-edit.ts: body-only/single-statement copy resolves submitted subtext then headline, so replacing backgrounds cannot interpret the legacy headline column as deletion. Advance the renderer cache signature to normalized-edit-v4-body-copy. Six-slide render and editor browser regressions passed in the originating task. Production rollout is tracked in the combined Hook/Seedance release receipt.

## Combined Explore/slideshow deployment resumed — 23 October 2026

- The user authorized deployment of all intentional current changes. The private slideshow execution-plan migration `20261022092140` is already present with RLS and service-only access verified. Do not bulk-apply historical migration drift or unrelated deferred migrations.
- Ship the matching generation worker before website/MCP so named slideshow inputs and versioned per-output contracts are supported before new requests can be accepted. Runtime release identity and production acceptance are recorded separately from the passing local suites in `docs/combined-release-deployment-2026-10-23.md`.
