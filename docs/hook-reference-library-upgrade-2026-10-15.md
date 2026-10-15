# Hook reference library upgrade — 15 October 2026

## Scope and release state

Replace the selectable Explore Hook library with the supplied sets from
`D:\hook\videos (10)\New folder\HOOKS`. Preserve the existing card layout and
generation/edit/scheduling flows. Add a small Instagram link beside each Hook
name. No new customer controls, database migrations or dependencies are needed.

The code and media are prepared locally. The website and worker have **not been
deployed** by this task; production acceptance remains a release step.

There are 46 complete source sets, each containing one MP4, one MP3 and one TXT
with an Instagram post URL. The user explicitly excluded `New folder (13)`
(17.3 seconds) from the gallery until full-length references are supported.
The new gallery therefore has **45 hooks**. The excluded source remains recorded
without shortening or replacing its original bytes.

## Data and behavior

- `worker/src/lib/explore-hook-reference-release.json` is the release manifest:
  immutable media fingerprints, original Instagram links without tracking
  parameters, source-folder provenance, dimensions and durations, poster and
  audible-preview mappings, and the explicit excluded ID.
- Original video, MP3, poster and audible preview are separate content-addressed
  objects. Original video bytes remain the generation and text-extraction source.
  The preview copies the video stream and adds only that hook's supplied MP3,
  using the existing reference-audio renderer and its current 0.2 volume/fades.
  Existing repeat/trim and demo-speech policies are unchanged.
- All 46 videos have local OCR transcripts. All 45 eligible hooks have visually
  reviewed caption blocks in `lib/explore/reference-text-catalog.json`, bound to
  the original video hash. Source changes at the last frame are retained when
  they contain creator captions. Incidental UI, scenery and watermarks are
  excluded. Caption timing is approximate, sampled at up to four frames/second.
  Hook 25's graphic logos remain visible in the source; no brand names are
  invented from those graphics. Its visible amount caption is stored as text.
- The gallery replaces the legacy hooks after explicit release activation.
  Old source records, text and audio mappings remain resolvable. The authenticated
  catalog response supplies retired hooks separately as `archivedHookItems`;
  the client can resolve saved selections/remix provenance but filters them out
  of browsing. Other Explore formats and the separate free landing preview keep
  their existing catalogs.
- Instagram source links are validated HTTPS post/reel URLs. The icon is an
  independent keyboard-accessible link with a tooltip and `noopener noreferrer`;
  it does not trigger card preview or Recreate. Opened previews use the audible
  preview URL; generation continues to use the original video URL.

## Verification completed

- Full decoding and folder/link validation: 46/46 sets.
- Reviewed text coverage: 45/45 eligible hooks. The excluded hook is unapproved.
- Existing data preserved exactly: 453 previous text entries and 434 previous
  transcript entries; zero modifications to either set.
- Local media audit: 46 previews have identical decoded video pictures and
  preserved timing. Their decoded audio matches the corresponding supplied MP3
  (minimum sampled correlation 0.9724, expected volume gain 0.2).
- Configured cloud storage: all 184 objects (76,432,741 bytes) uploaded or reused,
  then read back and verified by SHA-256, length and content type. 183 objects
  were newly uploaded; one was already present. Existing objects were not deleted.
- Public media URLs: 184/184 returned successful HEAD responses with the expected
  media content types; zero unavailable objects.
- 104 focused tests passed: active/staged gallery boundaries, old-reference
  recovery, text/remix services, original-link validation, catalog compatibility,
  paired-audio rendering and demo speech, and preview/export timing.
- Worker TypeScript build and application TypeScript checks passed.
- Full Next.js production build passed (compilation, TypeScript and static
  generation). Targeted ESLint checks passed. The sandboxed compiler stalled;
  the completed production build ran outside the sandbox.
- Real production card/dialog component browser fixture passed: source-link
  target and independent click, unchanged Recreate selection, playing unmuted
  soundtrack preview, keyboard focus, desktop and 390px mobile with no overflow.
  Screenshots: `.tmp/hook-card-browser/desktop.png` and `mobile.png`.

The browser fixture uses local media and an intercepted external-post navigation.
It does not establish Instagram availability, verify platform reach, spend AI
credits, or replace final acceptance on `https://www.getugcpilot.com`.

## Reproduction and release

Run commands from the project root. Scripts default to a dry run unless noted.

```powershell
npm run worker:build
node --experimental-strip-types scripts/prepare-hook-reference-release.mjs --source 'D:\hook\videos (10)\New folder\HOOKS' --exclude-folder 'New folder (13)' --stage
node --experimental-strip-types scripts/extract-explore-reference-text-local-v2.mjs --hook-release --execute --concurrency 2
node scripts/create-hook-reference-review.mjs
# Apply a source-hash-bound visual review using review-explore-reference-text.mjs
# with its --hook-release option. OCR alone never marks text ready.
node scripts/audit-hook-reference-media.mjs
node --experimental-strip-types scripts/publish-hook-reference-release.mjs
# Only after readiness succeeds, upload/verify and activate the local manifest:
node --experimental-strip-types scripts/publish-hook-reference-release.mjs --execute --yes
node scripts/hook-reference-card.browser.cjs
```

Upload verification is resumable and does not deploy anything. It refuses to
activate if the manifest or text changes while uploading. Published media
mappings and exclusions cannot be silently replaced by a rescan.

Deploy the website and worker with the same manifest before allowing new jobs.
For the safest order, deploy the worker first so it knows the new audio identities,
then the website. Keep all legacy media and mappings. Verify authenticated Hook
browsing (45 references), original links, reviewed text, representative Recreate,
preview/export and Hook + Demo on the real production domain. Do not interpret
local fixtures as production acceptance.

To restore the previous gallery, change only `activation` to `pending` and release
the website; keep the published manifest/media and worker mappings available for
new and old saved creations. Reverting the entire manifest would remove mappings
needed by creations already made with these hooks.

The worktree already contained extensive independent editor/session changes and
continued changing during this task. No commit, push or deployment was performed.
Any later request to release all changes must audit and validate the complete
worktree under AGENTS.md, rather than staging only this upgrade.

## Follow-up implementation review — 15 October 2026

Reviewed the introduced catalog/runtime, client source link and audible preview,
source extraction/review scripts, readiness/upload checks, archived-reference
resolution, Remix Text binding/application, generation soundtrack postprocessing,
and finishing/re-edit soundtrack handling.

One recovery bug was found and corrected: when `activation` changed to `pending`,
`getArchivedHookReferences()` returned nothing. A gallery rollback could therefore
remove new-hook references from saved creations' client/text lookup, despite
retaining their published media. Archive lookup now depends on publication,
independently of gallery activation. A regression check exercises all 45 reviewed
new hooks with the old gallery active and confirms their saved text still resolves
while their cards remain hidden.

Additional checks cover every eligible hook through the real Remix input and
apply helpers at 3-, 5- and 10-second edit lengths. They preserve block order,
valid timing, trim range and both volume settings; the stored source copy fits
the default portrait text layout. Deterministic test copy replaces AI responses;
these checks do not spend provider credits or predict future generated wording.

Generation job checks now exercise all 45 new identities, verifying that each
completed provider result reaches its registered audio postprocessor and keeps
the correct soundtrack provenance. Finish-job checks exercise each new identity
both before and after an edit: the matching MP3 is downloaded/verified once,
saved music volume survives, generic final-composition music yields to the paired
track, and ordinary Demo speech is retained. Existing real FFmpeg tests verify
continuous music across the join and no doubled music on re-edit.

Fresh focused review suite: 75 tests passed, including the per-hook loops above.
Fresh TypeScript and targeted ESLint checks passed. Direct comparison of all 46
original folders confirms that the manifest still matches the original video
bytes, supplied MP3 bytes and canonical source links.
The production build was rerun after the rollback fix and passed compilation,
TypeScript and static generation. The fresh 46-preview media audit also passed
with unchanged decoded pictures and minimum sampled audio correlation 0.9724.

Audio intentionally uses the existing initial volume of 0.2, short fades, and
repeat/trim policy for the final video length; it is not a promise of the original
Instagram loudness or a custom beat-alignment edit. OCR boundaries remain
approximate. Neither this review nor the earlier local browser fixture is final
production acceptance; website and worker deployment remain outstanding.

## Second supplied-folder batch — 15 October 2026

The supplied `D:\hookswithlinks` folders were imported as a second immutable Hook
release. It adds 31 complete one-video/one-MP3 pairs, numbered Hook 46 through
Hook 76. Each has a source-hash-bound, visually reviewed creator-caption record
for Remix Text; every supplied MP3 is saved as the selected reference's soundtrack
and is mixed into its audible preview using the same 0.2-volume policy.

Source icons remain deliberately small beside the Hook title. Seventeen records
include a validated original post link and show the matching platform icon: one
Instagram Reel and sixteen TikTok posts. The other fourteen complete pairs have no
source URL and therefore show no icon, while retaining their video, reviewed Remix
Text and paired background audio. This preserves the existing gallery layout and
does not invent a link where none was supplied.

`New folder (44)` was not imported because it contains four videos and no paired
MP3. `New folder (45)` was not imported because it contains a video and TikTok URL
but no paired MP3. The files remain untouched so either folder can be imported
later if an unambiguous audio mapping becomes available.

The second manifest is published and active locally. Its 124 content-addressed
objects (31 videos, 31 MP3s, 31 posters and 31 audible previews; 80,935,285 bytes)
were uploaded or reused, read back and verified by SHA-256, byte length and content
type. 117 objects were newly uploaded; seven already existed. Its media audit
confirmed unchanged decoded video pictures and a minimum sampled soundtrack
correlation of 0.9851 against the registered MP3.

The active local catalog now contains 76 eligible Hook cards: the original 45 plus
these 31. The browser fixture verifies the independent Instagram and TikTok icon
links, Recreate selection, audible preview and responsive layout. Worker and app
TypeScript checks passed, as did focused catalog, Remix Text and soundtrack tests.
The live website and worker have not been deployed by this task. After deployment,
verify the authenticated gallery on `https://www.getugcpilot.com` before treating
the addition as production-accepted.

To reproduce the second batch from the project root:

```powershell
node --experimental-strip-types scripts/prepare-hook-reference-addition-release.mjs --source 'D:\hookswithlinks' --stage
node --experimental-strip-types scripts/extract-explore-reference-text-local-v2.mjs --hook-addition-release --execute --concurrency 2
node scripts/create-hook-reference-addition-review.mjs
# Apply source-hash-bound visual review with review-explore-reference-text.mjs
# and its --hook-addition-release option.
node --experimental-strip-types scripts/hook-reference-addition-release-readiness.mjs
node --experimental-strip-types scripts/audit-hook-reference-media.mjs --addition
node --experimental-strip-types scripts/publish-hook-reference-addition-release.mjs
node --experimental-strip-types scripts/publish-hook-reference-addition-release.mjs --execute --yes
```

## Full local playback recheck — 15 October 2026

**The complete 76-hook set is not yet ready for a browser-compatible release.**
The earlier three-card fixture and FFmpeg decode checks did not establish that
every preview actually displays moving video in a browser.

The expanded local fixture selected every reference, checked link visibility and
targets, and played all 76 audible previews to their end. Seventy-five previews
decoded visible video. Hook 76 (`New folder (48)`, reference
`explore-paired-hook-def19968a4a8c55c52679591`) reached its end with audio but had
`videoWidth = 0` and `videoHeight = 0` in Edge. It failed again at normal playback
speed. Its stored source and preview both use HEVC/H.265 (`hvc1`), which is not
universally supported across browsers/devices. It needs an H.264 browser preview
before this entire batch can be considered ready. No preview/media mapping was
changed during this audit; its original bytes and current storage mapping remain
intact. The browser audit intentionally exits with failure until this is fixed.
Evidence: `.tmp/hook-card-browser/all-playback.json` and
`.tmp/hook-card-browser/failed-Hook-76.png`.

Both local media audits passed for all 77 registered sets (including the excluded
long clip). They hash-verified every staged asset, fully decoded each original
video, MP3 and preview audio, compared the preview's decoded video frames with its
source, verified soundtrack pairing, and checked source durations using the same
MP4 parser as generation. All 76 selectable references fit the generation limit.

Direct folder comparison found that `New folder (20)` now contains an original
TikTok link that was absent from the manifest. It was added to Hook 61; the second
batch now has 17 linked and 14 unlinked references. Fresh comparison of both source
directories confirms matching video/MP3 hashes and source links for every record.
The TikTok source icon also now inherits the card link's color, correcting the
shared icon's nearly black fill on dark Hook cards. The browser checks this
computed color in addition to its target and independent click behavior.

Updated previously 45-hook-only test assumptions and the generation lookup mock.
The local regression suite passes 72 tests, covering all 76 reviewed Remix Text
sources, generation soundtrack routing, all 76 Hook + Demo/re-edit soundtrack
identities, saved-volume preservation, rollback recovery, and real FFmpeg render
behavior. A further nine catalog/remix/generation tests pass after the added link.
Worker compilation, application TypeScript and targeted ESLint checks pass. Paid
AI calls and hosted integrations were mocked; these tests do not establish live
provider availability or guarantee AI output quality. No cloud upload, push or
deployment was performed during this local recheck.
