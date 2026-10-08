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
and then Continue to Schedule after a successful save, and Schedule uses the
existing Review / Resume / Check saved schedule action. The controls scroll
above that footer. Generation submits through its original form even though
its button is portaled into the shared footer. The right panel holds References
and Your Video / Your Slides. An accepted
Generate submission switches to results synchronously, displaying pending jobs
and completed results there. Manual view changes remain in place as jobs update.
Workflow histories and recoverable jobs are scoped by authenticated owner and
format. Original AI Studio generation behavior remains available outside these
workflow presentations.

Hook and Wall offer Generate / Upload / Creative Assets as video sources. Their
generation produces only videos. Upload accepts MP4, MOV or WebM, 1–120 seconds,
up to 250 MB. Creative Assets shows owned ready videos, including legacy creator
videos; size and duration limits still apply. Selected clips appear in Your Video
and open through Edit this video. No reference or generation request is required
for existing footage. Imported media is verified by the existing owned-media
API, and edited source IDs restore on refresh without requiring generation tags.
Custom dimensions are preserved; the player reads missing duration/dimensions.
The original uploaded or saved footage remains unchanged.

Reference cards use top-right Recreate icons, with a check, outline and caption
on the selected reference. Media clicks open previews. Hook and Wall reuse the
talking-head/demo and creator-phone workflow shell and creation CSS directly:
the same colors, frames, square reference cards, spacious instructions, inline
settings and shared action footer. Optional references appear before
instructions and contain only Choose image and Video reference; no voice tile.
The image picker includes the existing creator examples and custom uploads.
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
