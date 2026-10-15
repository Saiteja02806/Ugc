# Hook background-music UI and implementation plan

## Decision

Proceed with one compact background-music row below the selected generation
references and above Your instructions. Keep the existing gallery and settings
layout. Show the row after a Hook reference is chosen; reference audio is the
default. The classic composer currently omits its contextBanner, so the earlier
reference-audio explanation is not actually visible in this layout.

The default row has a muted Background music label, Play/Pause, a friendly track
label such as Reference audio · Hook 61, and Change. No filename, extra switch,
waveform, slider or music buttons are added to gallery cards. Change opens three
choices: Reference audio, Choose another track, and No background music. Audio
Library, saved audio and upload belong inside the replacement picker. Volume
stays in Edit → Sound. A single workflow music choice covers the hook and demo;
demo speech/voiceover remains separate.

## Local design evidence

Development-only interactive preview:
`/e2e/explore-format-preview?format=hook&sources=1&music=1&refId=explore-paired-hook-cfa08753a0ca05384e797ad2`

The row was reviewed inside the actual Hook workflow at the normal 1280px-wide
desktop viewport and 390×844 mobile viewport. It measured approximately 70px
high and 313px wide on mobile. Document content width was 386px within the
390px viewport. The 300px Change panel was wholly visible (x=50, right=350).
It does not change the surrounding form's width. The existing settings and
Generate action keep their existing scrolling/footer behavior.

Verified default selection, Play/Pause with the fixed local MP3, opening the
menu, No background music changing the summary and disabling playback, restoring
Reference audio, and Escape returning focus to Change. The alternative-track
screen is a labeled design sample; it is not connected to uploads or rendering.

Screenshots:
- `.tmp/hook-music-ui-review/desktop.jpg`
- `.tmp/hook-music-ui-review/mobile.jpg`
- `.tmp/hook-music-ui-review/mobile-menu.jpg`

TypeScript, targeted ESLint and diff-whitespace checks passed. The fixture route
is unavailable outside development; the preview-only composer banner requires
both development mode and its explicit review marker. The functional audio
pipeline, storage media and production behavior were not changed in this review.

## Safe functional sequence

1. Preserve the provider output before adding reference music. New reference
   generations must have a verified, owned clean source for music replacement.
   Do not remove music from a mixed track by approximation or mute speech to hide
   it. Older outputs without a usable clean source retain current behavior and
   need an honest capability message where replacement cannot be supported.
2. Introduce one explicit, versioned music choice: reference, custom owned audio,
   or none, with volume and repeat/once policy. Reference identity remains
   provenance when a different track is selected; it must not force that track
   back on. Missing new fields on old requests retain legacy behavior and request
   fingerprints. Inspect the saved-draft/receipt validators before deciding
   whether their schemas need a backward-compatible migration.
3. Use that same choice for Create, Edit, combined preview, final rendering,
   scheduling, saved draft restoration, and re-edit metadata. Reference selection
   follows a newly chosen Hook only in reference mode. Explicit custom and none
   choices persist. Only one workflow background track is mixed. User speech and
   independent demo audio stay separate.
4. Replacement is transactional: cancelled or failed picking/upload retains the
   previous choice. Audio loading failure must not silently select another song.
   Changing music invalidates a previously prepared output. Preparing the new
   audio mix must not resubmit paid video generation.
5. Enable the actual compact row after the underlying contract and renderer pass
   tests. Reuse the existing audio library and upload paths rather than duplicate
   asset selection. Add clear loading/error feedback only while needed.
6. Verify reference/custom/none transitions, restore reference, volume zero,
   reload, failed selection, changing Hook references, clip trim, Hook + Demo,
   retained speech, and re-editing a saved final video. Use real FFmpeg output to
   detect doubled tracks and compare preview with export. Check small mobile
   widths, long track labels, keyboard focus, disabled states and no overflow.
   Fix Hook 76's HEVC preview compatibility before releasing the complete library.

This UI review approves the interaction direction. It does not establish that
the replacement/removal feature is already implemented or production-verified.

## Hook gallery controls refinement

The Hook workflow now places the Instagram/TikTok source link in the lower-left
corner of the video and a labeled Recreate action in the lower-right corner.
Visible Hook-number captions are removed; accessible preview/action names retain
the reference identity. References without a source URL have no source icon.
Selected references show a checked Selected action. Other format cards retain
their existing presentation. The background-music prototype stays in place.

Local checks cover desktop and 390px mobile geometry, independent source-link,
preview and Recreate behavior, keyboard access and audible reference preview.
TypeScript, targeted ESLint and workflow regression tests pass. Screenshots are
saved in `.tmp/hook-gallery-overlay-review/`. This refinement does not change
generation, soundtrack selection, media assets or the known Hook 76 decode issue.

The subsequent user-requested refinement removes the action label and both
visible control backgrounds. Both corners now show only 18px icons in transparent
32px rounded focus targets (44px for coarse pointers). The music row is unchanged.
See `hook-new-batch-2026-10-15.md` for the accompanying 22-set import and checks.
