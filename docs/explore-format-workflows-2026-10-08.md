# Explore format workflows

Local implementation, 2026-10-08. No deployment, paid generation, cloud media
publication, social posting, staging or commit was performed for this change.

## User experience

Explore features Hook video, Wall of text and Slideshows as separate workflows.
Hook and Slideshows use covers from the supplied `workflow/format2` folder;
Wall of text uses the two replacement clips in `landing_page/WOT`.
AI influencer creation remains. The old talking-hook and creator-phone routes
and standalone audio page show the existing not-found screen; their underlying
components, data, APIs and media remain. Quick start links open AI Studio,
Trending content and Library. Legacy Recreate links redirect by reference type.
Legacy Recreate job links recover in the corresponding AI Studio mode, retaining
the original job identity even when it predates format tagging.

Compact Create, Edit video (Edit slides for Slideshows) and Schedule tabs sit
inside one left control card, following the existing talking-hook/creator-phone
workflow shell. A single shared footer holds the active step's primary action;
Create uses Generate or Edit this video, Edit uses Save edits / Save slideshow
and then Continue to Demo for Hook or Continue to Schedule for other formats
after a successful save, and Schedule uses the
existing Review / Resume / Check saved schedule action. The controls scroll
above that footer. Generation submits through its original form even though
its button is portaled into the shared footer. The right panel holds References
and Your Video / Your Slides. An accepted
Generate submission switches to results synchronously, displaying pending jobs
and completed results there. Manual view changes remain in place as jobs update.
Workflow histories and recoverable jobs are scoped by authenticated owner and
format. Original AI Studio generation behavior remains available outside these
workflow presentations.

On reopening a workflow, the generator independently discovers active jobs
through the authenticated account's existing jobs API and filters them by
generation type and Explore format before the server's result limit. Browser hints and original job URLs remain
fallbacks, but another browser can recover an ongoing generation without them.
Discovery refreshes on mount, reconnect and window focus. Discovered IDs remain
tracked after leaving the active list so completion and the saved output are
still retrieved. Account changes reset their scope. References remains the
default view for a fresh URL; recovering a task does not change the selected tab.

Saved browser job IDs restore independently of loading media history. A slow or
failed history request cannot block task polling or cover recovered progress
with loading skeletons. Results completed during a history request are retained
when that request finishes. These changes reconnect the screen to existing
server work and do not submit or cancel generation jobs.

Hook and Wall offer Generate / Upload / Creative Assets as video sources. Their
generation produces only videos. Upload accepts MP4, MOV or WebM, 1–120 seconds,
up to 250 MB. Creative Assets shows owned ready videos, including legacy creator
videos; size and duration limits still apply. Selected clips appear in Your Video
and open through Edit this video. No reference or generation request is required
for existing footage. Imported media is verified by the existing owned-media
API, and edited source IDs restore on refresh without requiring generation tags.
Custom dimensions are preserved; the player reads missing duration/dimensions.
The original uploaded or saved footage remains unchanged.

Hook video references are available to signed-in users on the Free plan as well
as paid plans. Browsing, previewing and selecting Hook references does not depend
on subscription status, and the reference gallery has no upgrade banner. The
gallery retains its 12-card pagination. Generation access, credits, saves and
scheduling continue through their existing controls.

Reference cards use top-right Recreate icons, with a check, outline and caption
on the selected reference. Media clicks open previews. Hook and Wall reuse the
talking-head/demo and creator-phone workflow shell and creation CSS directly:
the same colors, frames, square reference cards, spacious instructions, inline
settings and shared action footer. Optional references appear before
instructions and contain only Choose image and Video reference; no voice tile.
The image picker places Upload image directly below Choose image, with no
helper paragraph. Two tabs separate Your images from UGC Pilot images. It opens
Your images when the account has saved uploads, otherwise UGC Pilot images.
Users can switch tabs; a completed user upload reveals Your images immediately.
Your images lists
the signed-in owner's ready PNG/JPEG/WebP uploads from the existing media API;
new optional image uploads remain in that account's media storage and can be
reused after refresh without uploading again. The list loads only when Choose
image opens. Selecting a saved image rechecks its owned record before attaching
it. Catalogue copies use a separate project marker and remain in UGC Pilot
images, including the older AI Studio copies identified by catalogue filenames.
Preview uploads remain temporary and do not create saved records.
One attachment is active at a time; custom media overrides the selected gallery
poster, which otherwise appears in Choose image. Choosing None removes this
image and its gallery fallback, permitting
instructions-only generation. A failed replacement retains the previous media,
pending uploads block generation, and owner changes discard late selections.
Hook and Wall show their model, duration, quantity and ratio selectors below
instructions, using the older setting-field styling. Preview settings remain
interactive while generation is locked. Slideshows retain their compact settings
popover. Reference popovers close when leaving Generate/Create, while job
polling and drafts remain mounted. Galleries initially show 12 references and
offer Show more references;
changing filters resets the visible count. On mobile, the References view shows the gallery,
selection reveals controls and generation reveals results. Original AI Studio
layouts and other reference-card callers retain their existing presentation.

Image/text guidance uses the existing Google Omni provider. Video guidance
uses the existing Runway transformation: MP4/MOV/WebM, up to three seconds and
9:16 or 16:9. Its output follows the source duration, so the UI displays Runway
and the clip length, fixes duration controls, and the new-format API bounds its
credit reservation to three seconds. This differs from Upload / Creative Assets,
which import 1–120-second footage directly into the editor. Video generation
requests never send both the custom video and the gallery poster. Legacy
Recreate still enforces its original image-only requirement.

Spoken words in the instructions pass unchanged through the API and direct
worker prompt. Google documents native prompt-driven audio at
https://ai.google.dev/gemini-api/docs/omni#prompting-the-audio.
The Runway video-reference path has no explicit narration or voice selector;
users can add a recorded/uploaded voiceover in Edit video. This implementation
does not claim that a paid provider run's speech was verified. Wall instructions
have a smaller user limit so the full background-only suffix fits the worker's
1,000-character limit. Preview attachments use the same local metadata/ratio
validation as upload, but never upload or submit generation requests.

Wall requests a background without
lettering; its message is an editable manual text layer. Both video editors
provide trim start/end, timed text with position/width/size/color, original volume,
optional uploaded or saved background audio, music volume and playback mode.
There is no subtitle control or transcription request. Drafts persist by owner,
format and source, including selected owned background audio. A saved receipt
cannot replace a newer local draft. Saving produces a separate final video;
source footage is retained. Text already inside source footage remains part of
the original video; added overlays remain independently editable.

Slideshows expose only image generation, with a 4:5 default. Reference slides stay
in their original order, with independent generated replacements and restore
original actions. Recreating a slide returns to Create with that reference.
The selected slide survives refresh, and generation holds its reference in
place while pending. The editor previews the full sequence. Text inside an image is changed by
regenerating the image. Saves use an immutable request identity and transactional
Library creation; interrupted saves resume the same request. Restored outputs
are checked against the owner's current Library before scheduling.

Schedule uses the existing full scheduling editor, connected accounts, account
time zone and platform-specific settings. It requires the exact saved video or
Library slideshow. Slideshows offer Instagram and TikTok; video options retain
the existing platform availability. The final slideshow sequence is visible
beside Schedule. Switching sections preserves the schedule form. The durable
receipt and Web Lock prevent creating a second schedule through ordinary retry.

## Cover assets

`scripts/build-explore-format-covers-v2.mjs` reads source media and creates
silent, fast-start 960×540 covers. One example fills the card at a time, using
the older Recreate cover's top/bottom cropping and eight-frame zoom before the
next example. Hook runs 6.42 seconds, retaining the complete duration of both
supplied clips. Slideshows shows all six fitness
images and then all four goal images in numeric order, for 15.67 seconds.
Individual crop positions keep example text readable. This presentation only
affects Explore covers; full gallery media and editor framing are unchanged.

Each format has separate versioned MP4 and WebP files in `public/explore/covers`.
`format-covers-v2.json` records output dimensions, frames, durations, crop
positions, poster times and all fourteen original byte counts and SHA-256
hashes. The builder checks originals before and after rendering, then copies
validated outputs. Previous v1 files remain available. Gallery publication
remains the existing explicit import; locally staged references remain
development-only. Cover playback pauses when reduced motion is requested.

Wall of text now uses `wall-of-text-v3.mp4` and its matching poster, built by
`scripts/build-explore-wall-text-cover.mjs` from `landing_page/WOT`:
`WOT_1-Vmake - Copy.mp4` (6.5 seconds), followed by
`WOT_2-Vmake - Copy.mp4` (8.5 seconds). Both clips play completely, with the
same eight-frame ending zoom, for a 15.67-second loop. The landscape framing
centers their wall-of-text content. `wall-of-text-v3.json` records the source
hashes, crop positions, frame counts and verified output; rendering checks
full decoding, silent streams, fast-start metadata and unchanged originals.
Previous covers remain available. This replacement changes only the Explore
cover; reference galleries and generation behavior are unchanged.
The replacement passed the existing `--covers-only` browser check at desktop,
laptop and mobile sizes, including muted playback, responsive framing and
reduced-motion behavior. No browser errors or non-GET API calls occurred.

Quick start retains AI Studio, Trending content and Library, and adds Video
generation (`/ai-studio?mode=videos`), Image generation
(`/ai-studio?mode=images`) and Schedule a post (`/scheduling`). Local preview
links retain the mode query when adding `preview=1`. Scheduling opens the
existing calendar; it does not submit or schedule a post automatically.

The cover revision passed final TypeScript and scoped ESLint checks. The
existing browser runner's `--covers-only` check passed at 1440×1000,
1280×720 and 390×844: all three v2 covers loaded and played muted in their
16:9 cards, six shortcuts had the expected destination and mode queries,
layout had no horizontal overflow, and live reduced-motion changes paused
and resumed covers. No browser errors or non-GET API calls occurred. Screenshots
are in `.tmp/explore-format-split/explore-desktop.png` and
`explore-covers-{laptop,mobile}.png`. Original hashes, output frame counts,
silent streams and fast-start metadata passed the renderer's checks. This
revision does not deploy the site or verify authenticated production tasks.

## Release dependencies

1. Apply `supabase/migrations/20261008001500_explore_format_workflows.sql` after
   existing Library, media, background-job and Explore finishing migrations.
   It adds owned generation format tagging, nullable automatic generation IDs
   for Library image sequences, and the service-only `explore_save_slideshow` RPC.
2. Deploy the worker with the format renderer and optional volume mixing. Old
   finishing drafts omit the new field and keep their previous fingerprints.
3. Deploy the app. Enable `EXPLORE_FORMAT_EDITING_ENABLED` together with existing
   `EXPLORE_FINISHING_ENABLED` only after matching worker readiness. Enable
   `EXPLORE_SLIDESHOW_SAVING_ENABLED` after the migration. Examples default false;
   actual local environment files were not changed.
4. The preexisting production Explore route/sidebar visibility restriction is
   preserved. Releasing Explore publicly requires a separate visibility change.
   Enable gallery media only through the existing verified publication process.
5. After an authorized deployment, accept the authenticated owner flows on
   `https://www.getugcpilot.com`: generation and credit accounting, worker export,
   Library save/recovery, account selection, time zone and exact-source schedule.
   Local previews do not establish production integration acceptance.

## Validation

### Workflow panel revision

Hook now includes the optional Demo step shown in the product reference.
Empty Hook and Wall of text editors offer Create video, Upload video and
Creative Assets action cards, each opening the corresponding Create source.
The repeated source instructions beneath the Create selector are removed.
The Demo workspace shows the selected hook immediately, uses its saved edit
after saving, and shows uploaded or owned Creative Assets demo videos alongside
it. Players pause when leaving Demo. Demo selections survive tab navigation
and replacing the hook; the combined export is invalidated when either input
changes. Removing the demo restores the saved opening as the schedule source.

Combining requires a saved owned opening and a ready owned demo. The existing
finishing API/worker performs the composition with no format-edit payload,
transcription or automatic music. Owned demo asset IDs are reused without a
second upload, and retries keep the existing durable request identity. Recovery
rechecks owned demo media before showing it or enabling Continue to Schedule.
The optional source parameter in the finishing hook leaves legacy local-file
demo uploads unchanged. No new API, schema or worker deployment is required.

`scripts/explore-workflow-panels.browser.cjs` checks the actual empty Edit
actions, selected-hook preview before saving, demo upload and asset selection,
player pause, tab persistence, removal and responsive layout at 1440, 1280,
390 and 320 pixels. It uses the development fixture, blocks non-GET API
requests and writes screenshots into `.tmp/explore-workflow-panels`.
These checks establish local UI behavior; authenticated production save and
schedule acceptance remains a release check on the production domain.

Local TypeScript and worker compilation, scoped ESLint, existing composition/
finishing/receipt tests, format-specific renderer and database tests, generation
UI tests, and image API tests cover the changed boundaries. Actual FFmpeg output
checks trim duration, text timing, original audio mute and unchanged source bytes.
PGlite executes the new migration and checks ownership, ordered persistence,
same-request replay, changed-content conflicts and format tagging.

`node --test scripts/explore-format-generation-ui.test.mjs` executes the real
generator component submit handlers with mocked authentication held pending.
It verifies all three switch to results before authentication/network completion
and reject submission without a reference or generation access.

`node scripts/explore-format-ui.browser.cjs` checks the running development app
at localhost:3000 (override with `EXPLORE_PREVIEW_BASE_URL`). It uses installed
Playwright or the Codex bundled runtime. It checks three distinct Explore cards,
correct media controls, reference/results navigation, desktop/mobile layout,
schedule drafts, actual trim/text controls through navigation and reload,
no subtitles, and the three hidden routes. All non-GET API requests are blocked.
It also selects actual local video files and fixture Creative Assets videos in
both video workflows, opens each in the editor, switches/removes sources, checks
the pinned generation action at 1280×720 and checks the three source controls on
mobile. Fixture assets are passed only from the development-only test route;
real picker data still requires authenticated owner access.
Signed-out visits to hidden routes may show the existing sign-in redirect before
the not-found UI; the browser checks also verify server rejection of each route.
The development-only `/e2e/explore-format-preview` fixture uses local cover
footage with generation/saving disabled. Screenshots are in the ignored
`.tmp/explore-format-split` directory.
Its `legacy=hook` and `legacy=phone` options show the original hidden workflow
components for local Create/Edit/Schedule comparisons without exposing their
public routes or enabling generation/saving. Browser checks verify that every
primary action sits in the same shared footer, including the external Generate
button's native association with the generation form.

`node --test scripts/explore-format-video-source.test.mjs` checks that uploaded,
generated, edited and legacy creator video sources retain their exact identity,
native dimensions and duration, and rejects non-video/unready/oversized or
out-of-range clips. Existing source upload/UI tests verify authenticated upload
completion, errors, retry, stale completion and preview-only file handling.
