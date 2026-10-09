# Explore workflow and shortcut design

Local design review, 2–3 October 2026. Nothing has been pushed or deployed.

## AI character Explore card — October 3, 2026

The owner expanded this pass to include the character workspace and generation
backend. Build AI character links to `/explore/build-character`. In the explicit
development preview the character section occupies one third of the lower row
and Quick start two thirds once the Explore container reaches 960px. Quick start
uses three columns and two rows there, two columns at intermediate widths, and
one column on phones. Narrower layouts stack the character section first. The
six shortcuts retain their labels and destinations, including Kling's ten-second
duration. The unfinished Workflow 1/3 shortcuts remain development-preview-only;
the new character card uses the normal authenticated workspace route in production.

The card shows three supplied portraits from
`C:/Users/chund/OneDrive/Desktop/workflow/ai character`: `Cozy Bedroom Vlog
Selfie.png`, `Selfie Vlog with Mini Microphone.png` and `Modern Vlogging Portrait
with Microphone.png`. These are examples, not generated results or selected
account characters. The card now offers Create yours. Its portraits have a
compact 150px display height. Business profiles, creative briefs and structured
prompts are never displayed in the character workspace. See
`docs/ai-character-builder.md` for the screen, contracts and release prerequisites.

`scripts/prepare-explore-character-previews.mjs` reads the supplied originals
and writes complete 640px-wide WebP portraits and a manifest to
`public/explore/characters`. The component crops only their display framing.
The three optimized portraits total 222,106 bytes (approximately 217 KiB).
Reproduce them with:

```powershell
node scripts/prepare-explore-character-previews.mjs 'C:\Users\chund\OneDrive\Desktop\workflow\ai character'
```

Validation includes TypeScript, scoped ESLint, real local Postgres execution of
the atomic batch migration, backend ownership/retry tests, and client request/
recovery tests. Browser review covers desktop and phone layouts and accessible
gender/model controls. Screenshots are local review artifacts under
`.tmp/explore-character-review`. Production acceptance requires migration and
application release, followed by verification on the production domain.

## Existing workflow and shortcut review

The explicit development preview retains Workflow 1 / Recreate / Workflow 3.
The top row now uses three equal fluid columns and 16:9 covers, replacing fixed
380px-wide 4:3 covers. Each workflow has a description of the content users can
create. All three workflows now use the owner's supplied media in the cover
sequences described below.

The owner selected the card headings "Create a talking hook video" and
"Recreate the viral formats" for the first and second workflows respectively.

Below the workflow row, Build AI character occupies the left third and the six
Quick start cards occupy the right two thirds on wide screens. Narrower screens
stack the character section above Quick start. The shortcuts use three columns
and two rows on desktop, and one column on phones. The compact cards have an 84px
minimum height, 12px vertical padding, and a horizontal icon/title/description
layout. Destinations remain in accessible link labels, without an extra visible
badge row. Workflow covers reflow
from three columns to two and then one on smaller screens. Existing theme
colors and fonts, visible focus states and reduced-motion-safe feedback remain.

| Card | Development-review destination |
| --- | --- |
| Seedance 2.5 — Talking-head videos | Workflow 1: `/explore/create-hook` |
| OmniFlash 1.1 — Emotion videos | Workflow 2: `/explore/recreate` |
| Trending content | `/dashboard` |
| Audio generation | `/audio-generation` |
| Kling — Create a 10-second video | Workflow 1, with its duration set to 10 seconds |
| Create app demo | Workflow 3: `/explore/creator-phone` |

Review links retain `preview=1`. Production availability gates remain in place;
the six-card section is currently shown only in the explicit development
preview. The owner confirmed Trending and Audio destinations and asked to leave
the existing model setup unchanged. This pass does not add models, rename
Google Omni, map OmniFlash to a provider, or change Recreate's default model.
The card names describe the requested design; selecting the specific Kling and
OmniFlash providers remains separate work. Workflow 1 still defaults to
Seedance 2.5.

The ten-second duration is validated before entering the local Hook composer.
Repeated, non-integer and out-of-range values retain the five-second default.
User instructions and attachments remain empty on entry. Generation, billing,
authentication, storage, workers, reference media and Carousel rendering are
unchanged. Local presentation checks do not assert authenticated production
acceptance; that requires verification after a release.

Validation: TypeScript, scoped ESLint and all 51 existing workflow/catalogue
checks passed. Browser review at 1440x900, 390x844 and 320x568 confirmed the
responsive layout and no page-level horizontal overflow. At 1440px, covers
measure approximately 420x236px. All six shortcut destinations were opened;
Workflow 1 showed the requested ten-second duration. Trending and Audio reached
their signed-out screens without generating content. No browser console errors
were recorded. The local Explore review remains open at `/explore?preview=1`.

The compact Quick start pass was checked again at 1440x900, 390x844 and
320x568. Desktop cards measure 325x84px in the 660px-wide block. Phone cards
remain 84px tall in a single column, with all six labels visible and no card
or page-level horizontal overflow. Scoped ESLint passed; no browser console
errors were recorded. The open space has no new panel or feature in this pass.

## Workflow 1 animated cover

The owner supplied `format1 (1).mp4`, `format1 (2).mp4` and `format1 (3).mp4`
from `C:/Users/chund/OneDrive/Desktop/workflow/format`. Filename order determines
the sequence. The confirmed loop is diagonal triptych → video 1 → video 2 →
video 3 → horizontal triptych → diagonal triptych. The return goes directly
back to the opening view.

Every section uses a sharp crop that fills its area. There is no blurred fill,
duplicate background or letterboxing. The diagonal crops cover the whole slanted
slice so rectangular inner edges never appear. Solo views focus on each face;
horizontal views show cropped facial details across three full-width strips.
The individual clips use three-second excerpts starting at one second, instead
of showing the entire source footage. Short dissolves join the stages. The
result is a silent 13.92-second, 960x540 H.264 loop, about 1.7 MiB, with an opening
poster and fast-start metadata. The encoded file contains no audio stream.

`scripts/prepare-explore-hook-cover.mjs` reproduces the MP4, poster and manifest
under `public/explore/covers`, with intermediate renders under `.tmp`. Source
files are only read. Rebuild with:

```powershell
node scripts/prepare-explore-hook-cover.mjs --input 'C:\Users\chund\OneDrive\Desktop\workflow\format'
```

The owner requested automatic, continuous playback. The local Workflow 1 card
uses native muted inline autoplay and looping, with no playback button or
application-triggered pauses for visibility or reduced motion. Loading the
page starts the cover without a click. A can-play handler explicitly starts
playback when media is ready, so it also continues during scrolling. There
are no freeze-frame holds between
stages. The closing diagonal plays source seconds 0..1 and the opening resumes
at source second 1, keeping the loop boundary in motion. The poster is only a
loading placeholder.

Validation: the renderer verified all 334 output frames, 960x540 dimensions,
absence of audio, and the MP4 index preceding media bytes. Decoded frames from
all five views were inspected. TypeScript and scoped ESLint passed, as did all
45 relevant existing workflow/catalogue checks. Browser review confirmed the
13.92-second media loads, starts automatically and keeps looping without a
click. Playback remained active after several complete cycles, with no Play
or Pause control present. Decoding every frame found zero adjacent repeated
frames. Scoped ESLint passed again after the continuous playback change.
Playback also remained active after scrolling the cover completely off-screen
on the phone layout.
Desktop (1440px) and phone (390px) layouts retained their cover aspect ratios
and had no horizontal overflow. This
cover remains part of the explicit local development preview; no release was
pushed or deployed.

## Workflow 2 animated cover

The owner supplied four videos and two image collections from
`C:/Users/chund/OneDrive/Desktop/workflow/format2`. Recreate presents one example
at a time in this order: `hook.mp4` → `hook1.mp4` → `WOT_1-Vmake.mp4` →
`WOT_2-Vmake.mp4` → slideshow folder `1` → slideshow folder `New folder` →
the first hook again. Each slideshow retains all of its numbered images in
numeric order: four slides in the first collection and six in the second.

The owner left the zoom direction to visual judgment. Each outgoing example
zooms from 100% to 122% over eight frames (one third of a second), then cuts to
the next example at normal size. This also joins the last slideshow back to the
first hook. The two slideshows change images normally and receive the zoom at
the end of their collection. Their images remain visible for 29 frames each.
There are no diagonal or horizontal montage views in this cover.

Hooks and slides use sharp landscape crops with individual focal positions.
The Wall-of-Text examples have plain dark side margins so their complete text
blocks remain visible; no blurred or duplicated footage fills the margins.
The four videos retain their complete visual durations. The six-example loop
is 34.79 seconds, 835 frames at 24 fps, 960x540 H.264, approximately 3.23 MiB.
It has no audio stream and includes fast-start metadata and a WebP poster.

`scripts/prepare-explore-recreate-cover.mjs` reproduces the MP4, poster and
ordered manifest under `public/explore/covers`. Temporary renders stay under
`.tmp`, and the supplied folder is only read. Rebuild with:

```powershell
node scripts/prepare-explore-recreate-cover.mjs --input 'C:\Users\chund\OneDrive\Desktop\workflow\format2'
```

Recreate's cover is attached through an explicit development-preview override.
The live workflow catalogue retains its existing cover configuration. The shared
workflow card uses muted inline autoplay and continuous looping with no play,
pause or resume buttons. The supplied media is not a reference-selection or
generation input, and no provider/model mapping changes in this pass.

Validation: the renderer verified dimensions, all 835 frames, absence of audio,
and fast-start metadata. Final decoded frames from the four videos and all ten
slides were inspected for framing. TypeScript, scoped ESLint and all 45 relevant
existing workflow/catalogue checks passed. Browser review at 1440x900 and
390x844 confirmed silent automatic playback, continuous looping without a
click, no playback controls and no horizontal overflow. Playback continued
through loop boundaries while both covers were entirely off-screen on the
phone layout for over a minute. No browser console
errors were recorded. This remains a local design review; nothing was pushed
or deployed.

## Workflow 3 animated cover

The owner supplied two ten-second portrait clips from
`C:/Users/chund/OneDrive/Desktop/workflow/format3`. The confirmed sequence is
diagonal pair → video 1 alone → video 2 alone → diagonal pair again. Video 1
is `Influencer_presenting_productivi_20261002151259.mp4`; video 2 is
`final_opal.mp4`. The opening three-second diagonal view uses source seconds
4..7 and 7..10 respectively, showing the app screens in both examples. Each
solo view then plays its complete ten-second clip from the beginning.

The owner selected framing that keeps the creator's face and phone visible
together. Solo views use a 620x540 sharp crop centered in the 960x540 cover,
with plain dark side margins. The diagonal pair fills the cover with sharp,
overlapping canvases clipped along a slanted boundary. There are no blurred
fills, duplicated backgrounds or gaps around the seam. Clean cuts join the
three moving stages. The loop is 23 seconds, 552 frames at 24 fps, approximately
2.64 MiB, with a WebP opening poster and MP4 fast-start metadata. Audio from
the supplied clips is removed from the cover output.

`scripts/prepare-explore-phone-cover.mjs` reproduces the MP4, poster and
manifest in `public/explore/covers`; temporary renders stay under `.tmp`.
The supplied clips are only read. Rebuild with:

```powershell
node scripts/prepare-explore-phone-cover.mjs --input 'C:\Users\chund\OneDrive\Desktop\workflow\format3'
```

The third cover is attached through the development-preview override and
inherits the shared card's silent, automatic, continuous playback with no
play, pause or resume buttons. Workflow 3's availability gate and generation
behavior remain unchanged. This cover is for the local design review.

Validation: the renderer verified all 552 frames, 960x540 dimensions, no audio
stream and fast-start metadata. Decoding the full cover found zero adjacent
repeated frames. Both split views, both solo views and their phone demonstrations
were inspected. TypeScript, scoped ESLint and all 45 relevant existing workflow
checks passed. Browser review at 1440x900 and 390x844 confirmed automatic,
silent playback, several uninterrupted loops, no playback controls and no
horizontal overflow. The third cover continued playing through a complete
loop while below the phone viewport. No browser console errors were recorded.
All three covers remain in the local Explore preview; nothing was pushed or
deployed.

## Explore navigation icon — October 2, 2026

Explore uses the stacked gallery (`GalleryVerticalEnd`) symbol, selected by the
owner after reviewing the icon alternatives. The transparent SVG at
`public/icons/sidebar/explore.svg` uses a 24x24 viewBox and a 1.7px outline. It
renders through the shared sidebar mask at 20px, inheriting default, hover and
selected colors in both expanded and collapsed navigation.

## Workflow 1 Editorial Serif captions and real demo — October 2, 2026

The owner preferred the left-aligned serif direction and requested a stronger
match to the existing Editorial Serif subtitle reference. This pass uses the
project's Playfair-derived `UGCPilot Editorial Study` fonts: medium italic
supporting text, a heavy italic keyword, and smaller upright `video` beside
`hook`. Warm ivory support and pale teal emphasis form a compact lower-left
group. The complete phrase enters together, with a small rise and a 94% to
100% keyword scale over 180 ms. This is explanatory cover text, independent
of speech transcription and subtitle generation settings.

The supplied demo resolves to `C:/Users/chund/OneDrive/Desktop/workflow/DEMO.mp4`.
The owner clarified that “23 seconds” meant **2–3 seconds**. Source seconds
2..4.5 are shown for exactly 60 frames at 24 fps. The useful portrait screen
area is displayed on the right, with a plain dark area reserved for `Add your
own demo` on the left. The caption occupies the same output interval as the
real demo: frames 258..317, or 10.75..13.25 seconds. Both caption lines fade
out inside that interval. No footage or caption from this beat extends into
the next stage.

The updated loop is diagonal triptych → video 1 → video 2 → video 3 → real
demo → horizontal triptych → diagonal return. The demo uses clean cuts on
both sides so it retains its complete 2.5-second interval. Other transitions
retain the prior short dissolves. `Create a talking hook video` appears from
0.25..4.5 seconds; the remaining creator examples are free of cover text.
The text and motion are precomposed into the silent MP4, keeping caption and
footage timing together through every native browser loop.

The development preview points to `create-hook-v2.mp4` and its captioned poster.
The earlier `v1` remains available. The new loop has 404 frames, runs for 16.83
seconds, and is approximately 1.90 MiB at 960x540. The same renderer verifies
frame count, silence, fast-start metadata and selection of the intended fonts.
The font files and their OFL notice are reused from the existing project assets.
No generation, model mapping, production catalogue or subtitle preset changes
are included. Rebuild with:

```powershell
node scripts/prepare-explore-hook-cover.mjs --input 'C:\Users\chund\OneDrive\Desktop\workflow\format' --demo 'C:\Users\chund\OneDrive\Desktop\workflow\DEMO.mp4'
```

Validation: all 404 frames decoded successfully with zero adjacent duplicates.
The manifest confirms that the demo and its caption share the exact 2.5-second
interval. Scoped ESLint, the renderer syntax check and all 45 existing workflow
and catalogue checks passed. Browser review at the default 1280x720 viewport
and at 390x844 confirmed readable captions and no horizontal overflow. The
actual demo and caption were observed together at 11.35 seconds; playback
continued across a complete 16.83-second loop, muted and without controls.
No media errors or browser console errors were recorded. This revision remains
in the local Explore preview; nothing was pushed or deployed.

## Edge-to-edge cover framing — October 2, 2026

The owner marked the dark side bands in all three covers and explicitly chose
edge-to-edge footage, accepting the tighter crop required by the portrait
sources. This supersedes the earlier choice of solid side margins to preserve
the creator and entire phone together. Card dimensions and the surrounding
Explore layout stay unchanged.

Workflow 1 now uses `create-hook-v3`: the real demo fills the 960x540 frame,
with the existing Editorial Serif caption overlaid at the lower left. The
reserved dark caption column is removed. The real demo and `Add your own demo`
still share frames 258..317, exactly 2.5 seconds. Workflow 2 uses `recreate-v2`:
both Wall of Text examples now use the same full-width crop as the hooks and
slideshows. Its example order and short outgoing zooms are unchanged. Workflow
3 uses `creator-phone-v2`: both solo views fill the cover at 960 pixels wide,
with the vertical crop centered on the creator and phone. It retains the
diagonal opening, both complete ten-second clips and clean cuts. All images
remain sharp; no blurred fills, duplicated backgrounds or stretching are added.

The three preparation scripts reproduce these versions by default. The phone
renderer can still reproduce its earlier inset version with `--solo-width 620`.
Earlier media versions remain available in `public/explore/covers`. The new
files are attached only through the existing explicit local-preview overrides.

Validation: the renderers verified dimensions, frame counts, silence and
fast-start metadata. All three final videos passed a complete decode. Durations
remain 16.83, 34.79 and 23 seconds respectively. Scoped ESLint and all 45 existing
workflow/catalogue checks passed. Desktop review at 1280x720 showed the demo,
Wall of Text and phone footage reaching the cover edges. Mobile review at
390x844 found no horizontal overflow. All three videos started automatically,
muted and looping without controls; no media or browser console errors were
recorded. Nothing was pushed or deployed.

## Workflow 1 native editorial motion — October 2, 2026

The owner supplied the local Higgsfield screen recording from 18:45:38 and
requested more expressive first-cover subtitles, with After Effects available.
The reference was reviewed as a full sequence and at its actual frame timestamps.
Its staged entrances, strong keyword emphasis and readable hold informed this
pass. The cover retains the owner's editorial serif direction and existing
montage rather than reproducing the reference's artwork.

The editable source is
`design/explore-hook-motion/Explore Hook Cover — Editorial Motion v4.aep`, with
the independent footage plate in `Media` and the final MP4/poster in `Preview`.
It has two semantic title precompositions and three layers in its main
composition. Bodoni MT Black Italic supplies the large teal keywords; Georgia
Italic supplies the ivory lead phrases, with upright Georgia for `video`.
After Effects did not have the project's Playfair-derived family installed;
the native source deliberately uses these available editorial serif fonts.
No missing or substituted fonts were found. The web render embeds the type.

The lead phrase reveals character by character with a 14-pixel rise. The large
keyword changes from outline to solid fill from left to right over half a second,
settling from 94% to 100% scale. Supporting `video` arrives just after the
keyword. Each complete message holds, then fades within its own cue. The two
titles use 35 numeric keys and one expression that keeps the suffix next to an
edited keyword. Source text remains native and editable; a temporary duplicate
was changed from `hook` to `demo` and rendered to verify both motion and spacing.
The duplicate was removed after inspection. No third-party effects are required.

Inspecting the decoded media found that the prior manifest's rounded demo
start was one frame early. The v4 demo cue now follows the actual plate cuts:
frames 259–318 inclusive, or 10.7917–13.2917 seconds, exactly 2.5 seconds.
The opening cue remains 0.25–4.5 seconds. All montage stages, edge-to-edge
crops, continuous playback and the second and third covers retain their
existing behavior. The real demo stays visible under its title.

The explicit local preview now points to `create-hook-v4.mp4` and its poster.
`scripts/prepare-explore-hook-motion.mjs` takes the completed native render,
verifies its geometry and timing, optimizes it and updates the cover manifest.
The output is 960×540, 404 frames at 24 fps (16.83 seconds), approximately
2.52 MiB, with no audio stream and MP4 fast-start metadata. After Effects
completed the full native render; entering, settled and exiting cue frames
were inspected in the final video, and the whole MP4 decoded successfully.
Scoped ESLint, the preparation-script syntax check and 76 existing workflow
and catalogue checks passed.

The local dev server was restarted after it stopped during the render.
The browser's failed-page screen used a blocked `data:` URL, and Browser Use
also rejected a return to the HTTP preview from that screen. No browser-policy
workaround was attempted. This revision has rendered-media verification and
code checks; its current browser review is incomplete. The previous layout's
desktop and phone verification remains recorded above. Nothing was pushed or
deployed.

## Workflow 1 immediate demo handoff — October 2, 2026

The owner liked v4's type direction but identified the 6.29-second gap between
the opening title and `Add your own demo`. V5 moves the real demonstration
and its title together to 4–6.5 seconds, directly after the opening. The
remaining creator examples follow the demonstration; the horizontal triptych
and diagonal return still finish the continuous 16.83-second loop.

The uncaptioned plate is reordered using decoded frame boundaries: old frames
0–95, then 259–318 (the complete 60-frame demo), then 96–258, then 319–403.
`scripts/prepare-explore-hook-motion-plate.mjs` reproduces this plate from the
packaged source and writes `design/explore-hook-motion/timeline-v5.json` with
the new timing. It retains all 404 frames and the original sharp crops. The
bottom contrast shade supports the opening and demo through 6.5 seconds.

`Explore Hook Cover — Editorial Motion v5.aep` keeps the native editorial
serif layers. The lead `Add your own` is readable from the demo's first frame;
its keyword fills over 0.4 seconds. Keyword strokes increase from 1.5px to
2px so the outline reads more clearly at card size. The two cues share a
baseline and have short coordinated exits. The project uses 30 numeric keys
and its existing suffix-spacing expression. The earlier project and assets
are preserved. No provider, generation or other workflow behavior changes.

After Effects completed the full v5 render. The optimized silent MP4 is 960×540,
24 fps, 404 frames, approximately 2.57 MiB, and has fast-start metadata. The
final file passes a complete decode with zero adjacent duplicated frames.
Its cue entrances, exits, footage cuts and loop return were inspected using
360px-wide frames. The explicit local preview registry now points to v5.
Scoped ESLint and all 81 current workflow and catalogue checks passed.
Browser acceptance is not claimed for this pass; the prior failed-page URL
policy block was not bypassed. Nothing was pushed or deployed.

## Workflow 1 native panel choreography — October 2, 2026

V6 implements the owner's approved reference-informed plan. The first workflow's
explicit local preview now uses `create-hook-v6.mp4`. V5 and the original clips
are preserved. The three creators and the real demo are independent native media
layers packaged in `design/explore-hook-motion/Media/v6`.

The serif outline title builds in phrases during 0–4 seconds. At frame 96,
the real demo and `Add your own demo` begin together: a sharp six-frame diagonal
wipe reveals the footage while its caption moves 28px. The demo interval stays
exactly 60 frames, ending at frame 156 (6.5 seconds). Native masks assemble the
final horizontal strips into the diagonal triptych. Shared dividing lines and
automatic source fitting keep intermediate poses filled. The closing source
frame follows directly into the next opening frame with matching framing.
`timeline-v6.json` and the packaged README document the 58 native numeric keys,
slider controls, media assumptions and render procedure.

Reference observations: Sherwood's staged typography/product reveal and
itsyashf's assembly sequence informed this pass. Their prompts and media were
not incorporated into the project:
https://skillry.dev/ai-videos/opus-5-5/imthatcarlos-133592
https://skillry.dev/ai-videos/opus-5-5/itsyashf-692347

After Effects completed the final native render. The prepared MP4 is 960×540,
24 fps, 404 frames, approximately 2.74 MiB, silent and fast start. It passes a
complete decode with zero adjacent duplicate frames. Card-size views checked
caption boundaries, wipe progress, the strip morph and the loop seam. At 160×90,
the seam mean grayscale difference is 2.49/255, comparable to 2.42/255 between
the preceding frames. A longer keyword was rendered in a temporary duplicate;
the suffix followed its new width. No missing AE fonts or media were reported.
Scoped ESLint and all 85 current workflow/catalogue checks passed. Cover markup
retains autoplay, muted, loop and no playback controls. Current browser acceptance
is not claimed. Nothing was pushed or deployed.

## Workflow 3 product motion — October 2, 2026

The owner requested a fresh third-workflow concept after reviewing two supplied
motion references. V3 uses a soft paper stage, bold sans-serif text reading
“Your app. On a creator’s phone.” and an upright video window. This intentional
layout keeps the complete portrait footage visible, including the phone and face.
It replaces the earlier edge-to-edge landscape crop for this local third cover.

Two real handset-presenting excerpts play continuously. Native mint focus corners
briefly draw around each phone, and six-frame horizontal card slides connect the
creators through a fixed rounded aperture. The closing return ends at creator 1
source frame 65 and the next opening begins at frame 66. The 150-frame, 24 fps loop
is silent and has no playback controls, still holds, dissolves or footage blur.

`design/explore-phone-motion/Explore Phone Cover — Product Motion v3.aep` is a
separate editable native project with packaged source media. The previous v2 cover
and the first workflow's v6 project remain intact. The local preview cover registry
evaluated `creator-phone-v3`; production availability gates remain unchanged. The
unrelated demo used in workflow 1 is not inserted into these app examples.

The 0.56 MiB MP4 passes full decode and fast-start checks, has no audio and no
adjacent duplicate frames. A 42-frame review at card size checks both transitions
and the loop. A longer headline and Accent colour edit were rendered in a temporary
duplicate. Current browser acceptance is not claimed. Nothing was pushed or deployed.

## Workflow 3 review and revised concept — October 3, 2026

The owner rejected v3: its light stage did not match the dark Explore UI, its two
creator examples repeated the same message, and its card slide lacked a meaningful
motion-graphics explanation. The explicit local cover registry is restored to v2;
the v3 render, source media and editable AE project remain available for comparison.

`design/explore-phone-motion/CONCEPT-v4.md` proposes a dark app-screen-to-handset
transformation, followed by the real creator result and a short alternative example.
This is a research and storyboard brief, not an approved or rendered replacement.
Matching clean app artwork and a framing/perspective test are needed before a full
build. Workflow 1's accepted v6 and the other catalogue behavior remain unchanged.

## Workflow 3 screen-to-creator implementation — October 3, 2026

The owner requested implementation with motion graphics and supplied the matching
task-list app screenshot. V4 uses Explore's charcoal stage and orange accents.
The app surface enters with perspective and a separate depth contour, moves across
the cover, and fits into the first creator's physical handset. A sharp handoff at
3.0417 seconds reveals the original moving phone footage without doubled text from
a crossfade. Native phrase-based typography reads “Your app.”, “On their phone.”,
then “Create your video.” The alternate creator arrives without replaying the headline.
The closing handset contour turns edge-on to conceal the change between the two
different apps and returns the task-list surface to its opening pose.

`Explore Phone Cover — Screen to Creator v4.aep` contains 14 project items, with
separate media, app surface, text, contours and palette controls. The source media
and screenshot are packaged under `design/explore-phone-motion/Media`. The screenshot
remains raster artwork; screen alignment uses sparse manual Corner Pin keys. Replacing
the portrait media requires reframing and realigning the fit and return contour.
The earlier v3 project and a v4 backup before cleanup remain available.

The native render and optimized MP4 are 960×540, 24 fps, 216 frames (nine seconds).
The approximately 1.19 MiB web file is silent, fast start, fully decodable and has
zero adjacent duplicate frames. All 54 frames of a short transfer test and 58 selected
frames of the complete loop were reviewed at card size. Mean loop RGB change at
360×202 is 0.67/255, below 1.64/255 between the preceding frames. A temporary longer
title and blue accent verified automatic text fitting and linked colour controls.
AE reports no missing fonts or footage. The explicit local preview now selects v4;
production availability gates and other workflow covers remain unchanged. Current
production/browser acceptance is not claimed. Nothing was pushed or deployed.

## Workflow 3 framed iPhone and proportion correction — October 3, 2026

The owner supplied `Dark_iPhone_Task_Agenda_Mockup-removebg-preview.png` to replace
the bare app panel, then requested that its natural width and height remain intact.
V5 packages that transparent 375×666 image unchanged, verified by SHA-256 against
the supplied file. The asset retains its bezel, Dynamic Island and original app UI.

The image layer has equal X/Y scale. Its main transfer layer now uses uniform scale,
position and native 3D rotation; a Scale expression keeps all axes equal between
keys. The old Corner Pin was removed from the image animation. The depth contour
also uses uniform transforms. The mockup approaches the physical handset and hands
off sharply at frame 73, preserving the supplied image rather than forcing its
shape to match the recorded phone. The opening, transfer and return all use this
framed image. The three native kinetic phrases and dark Explore palette remain.

`Explore Phone Cover — iPhone Motion v5.aep`, `native-project-v5.json` and
`timeline-v5.json` are saved under `design/explore-phone-motion`. The optimized
1.22 MiB render is 216 frames at 24 fps, nine seconds, silent, fast start and fully
decodable, with zero adjacent duplicate frames. A 58-frame card-size review checks
the opening, handoff and return. Native scale reads at eight timeline points confirm
equal axes, and AE reports no missing fonts or footage. Loop mean RGB change is
0.90/255, compared with 2.47/255 between the preceding frames at 360×202.

The explicit local cover registry now selects v5. V4, v3, the accepted first
workflow v6 and other covers are preserved. No production gates changed, and no
push or deployment occurred. This media review does not claim production browser
acceptance.

## Workflow 3 clean frame and closing text — October 3, 2026

The owner requested removal of the decorative lines around the iPhone and meaningful
text beside the phone at the nine-second mark. V6 disables the depth outline, return
outline and travelling edge light; the actual supplied iPhone bezel remains intact.
The three earlier phrases remain, and “Your app.” returns from 8.4 seconds. Both
words are fully visible by 8.8 seconds, throughout the final frames and at frame zero.
Identical caption positions and opacity across the loop avoid an empty ending or
a text flash. A small uniform phone drift prevents a frozen opening interval after
removing the animated lines. The phone's natural proportions remain preserved.

The separate `Explore Phone Cover — Clean Loop v6.aep`, native JSON export and
`timeline-v6.json` document this correction. The silent nine-second, 216-frame web
render passes full decode and fast-start checks and has no adjacent duplicate frames.
A 58-frame review covers the complete motion and the closing caption. Loop mean RGB
difference is 0.94/255 versus 2.44/255 in the preceding frame pair at 360×202.
Native reads confirm both caption opacities are 100% at the start, 8.8 seconds,
the final frame and the timeline boundary. A longer keyword was rendered in a
temporary duplicate to verify native editability and width fitting, then the QA
compositions were removed. AE reports no missing fonts or media.

The local cover registry now selects v6. Previous projects and cover files are
preserved. This correction changes only the local workflow 3 cover; nothing was
pushed or deployed, and production acceptance is not claimed.

## Workflow 3 Cal AI creator replacement — October 3, 2026

The owner supplied a Cal AI gym creator clip and framed Cal AI iPhone PNG to
replace the first productivity example. V7 packages both assets unchanged,
verified against the supplied files by SHA-256. The second Opal example remains.
The source review locates a clear phone pose at four seconds. The first scene
uses source time = composition time + one second, and the natural mockup aligns
at three seconds with position [639,314], equal 54% scale and 2.8° Z rotation.
At frame 73 the mockup hands off sharply to the recorded phone. This is a manual
alignment, not a tracked screen replacement; the mockup is not stretched or warped.

The new framed image appears in the opening, transfer and return. Its 375×666
source uses equal 135.2% X/Y scale in the phone precomp, with the main Scale
expression keeping all axes equal. The charcoal stage, native kinetic captions,
disabled decorative outlines and readable closing “Your app.” remain.

`Explore Phone Cover — Cal AI v7.aep`, `native-project-v7.json` and `timeline-v7.json`
are saved separately. The 1.06 MiB web render is 960×540, 24 fps, 216 frames and nine
seconds, with no audio, fast-start metadata and a successful full decode. It has
zero adjacent duplicate frames; 58 selected frames were reviewed across the loop.
Mean loop RGB difference at 360×202 is 1.54/255 versus 4.34/255 for the preceding
frame pair. Native reads confirm uniform image scaling and fully visible closing
captions. AE reports no missing media or fonts.

Only the explicit local cover registry now selects v7. V6 and the other covers
remain preserved. No production gates changed; nothing was pushed or deployed.
This is local media verification, not authenticated production acceptance.

## Workflow 2 replacement clips — October 7, 2026

The owner replaced `format2/WOT_1-Vmake.mp4` and
`format2/WOT_2-Vmake.mp4`. The Recreate cover now uses `recreate-v4.mp4`
and `recreate-v4.webp`, with a new URL to avoid reusing the previous media.
V3 remains a separate unreleased design candidate.

The two hook clips, both complete ordered slide decks, outgoing zooms and
edge-to-edge presentation are retained. The replacement clips run for 8.5 and
6.667 seconds. Their vertical crop focuses are 0.36 and 0.25, respectively,
to keep the creators' faces visible. The source files are read-only.

Reproduce from the project root:

```powershell
node scripts/prepare-explore-recreate-cover.mjs --input 'C:/Users/chund/OneDrive/Desktop/workflow/format2' --name recreate-v4 --wall-text-1-focus 0.36 --wall-text-2-focus 0.25
```

The optional name and focus arguments preserve the renderer's original defaults.
The final export is 960×540, H.264/yuv420p, 24 fps, 839 frames, 34.958 seconds
and 3,200,881 bytes, with no audio and fast-start metadata. Full decoding and
an isolated browser rendering of the existing card component passed, including
autoplay, looping, poster loading and desktop/mobile sizing without media errors.
SHA-256 checks confirmed all supplied source files were unchanged by rendering.

Replacement source SHA-256:
- `WOT_1-Vmake.mp4`: `215f79295120586c0f369c4515aa4e72a113dcba4b28dcf1b1ce1131a35cdc4e`
- `WOT_2-Vmake.mp4`: `6e5e455779739400d88d46484ba73ec5b88a8f7c95b60c79501c09d5af517f70`

This is a local cover refresh. It has not been pushed, deployed or accepted on
the production site.
