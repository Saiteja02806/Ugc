# Landing follow-up review — 13 October 2026

**Status: implemented locally; do not deploy.** The user explicitly held the
release while other chats prepare more changes. No push, new deployment,
migration or production schedule was submitted for this follow-up.

## Result

- The circled left hero card now uses the supplied `landing_page/middle.mp4`.
  Its new public assets are `left_side-v3.mp4`, a matching first-frame WebP,
  and a verification JSON manifest. The badge says “Talking Head UGC” as
  requested. The center Hook+Demo video and right slideshow are preserved.
- The old interactive daily-feed marketing section is replaced by
  `LandingContentShowcase`: slideshow images only, with the heading
  “Create a repeatable content format.” It advances every 3,000ms while the
  document is visible, respects reduced motion, and cleans up its timer.
- Double-tap/scroll approval, heart/skip controls, review history and the
  Hook/Wall video previews are removed from this section. Its slide number
  and dots are passive indicators. Real Trending and publishing behavior is
  unchanged by this landing presentation change.
- Nearby comparison copy now describes daily Trending slideshows and video
  creation in Explore, rather than claiming all three formats arrive daily.

## Additional issue found during production acceptance

The production Wall of Text editor loaded an existing video and showed typed
text in its live preview, but loading its saved draft failed with
`Failed to execute 'fetch' on 'Window': Illegal invocation`. Save edits stayed
disabled. This is a confirmed production issue, not a clean acceptance result.

Three client transport helpers invoked browser-native fetch as an object
method (`deps.fetch`), giving it the transport object as its receiver.
`clip-draft-client`, `workflow-finishing-client` and
`workflow-default-music-client` now extract the function before invoking it.
Authentication, URLs, request methods, headers, timeouts, receipts and
idempotency are preserved. This fix remains local under the deployment hold.
No customer draft was saved or render requested during this check.

## Validation and review

- Browser-receiver regression tests failed 3/3 against the old transports and
  passed 3/3 after the fix. They cover draft GET/POST, finishing submission
  and recovery, and approved background audio reads.
- Focused draft, finishing and background-music suite: **54/54 passed**,
  including real Postgres ownership, revision and replay checks.
- Final TypeScript check: passed. An earlier check observed two transient
  `imageReferences` prop errors while other chats were editing; the final
  checkout check passed after those edits settled.
- Scoped ESLint, changed-file whitespace check and verification-script syntax
  check passed. The previous interactive preview script was updated for the
  passive slideshow contract; that standalone browser script was not run.
- Next's actual landing page rendered at `http://127.0.0.1:4331/` in the
  isolated local review server. Desktop and 390px mobile checks showed no
  horizontal overflow. The slideshow advanced, its section contained zero
  buttons and zero videos, and double-clicking did not create approval state.
- Both desktop hero videos loaded browser metadata (`readyState=4`) and
  played. The left video reported 716×1284 and the versioned v3 URL; the center
  retained its original 720×1280 source.
- Source-media preparation verified all 317 original encoded video frames
  unchanged, H.264/YUV420 compatibility, complete decode, no audio track,
  fast-start metadata, and an unchanged supplied source file. See the public
  JSON manifest for hashes and duration.
- A separate review agent confirmed the browser receiver root cause and the
  distinct supplied video. Its final review was interrupted by a usage limit.
  Final diff review was performed in this chat, including effect cleanup,
  passive semantics, aspect ratio, accessibility labels, request identity and
  preservation of the center/right assets. No completed independent final
  review is claimed.

The first local page compile was slow and produced temporary development
chunk/devtools errors. Reloading after compilation restored hydration and
playback. This is local evidence only. Fresh production draft-saving and
provider generation still require acceptance after the held release.

## Review artifacts

- `.tmp/landing-followup/screenshots/hero-desktop.jpg`
- `.tmp/landing-followup/screenshots/slideshow-desktop.jpg`
- `.tmp/landing-followup/screenshots/slideshow-mobile.jpg`
- `.tmp/release-2026-10-13/follow-up-transports.log`
- `.tmp/landing-followup/types-final.log`
- `.tmp/landing-followup/lint-final.log`

## Release boundary

This follow-up intentionally includes the landing entry point, hero/showcase
and comparison components; removal of `landing-swipe-deck`; versioned v3 media
and manifest; media-preparation and landing verification scripts; three
browser transport fixes and their regression tests; this review and the
landing decision in `CAROUSEL_CONTEXT.md`.

Other chats are concurrently changing Explore references, workflow actions
and AI character recovery/autosaving. Those changes were not reverted or
staged by this chat. They need their own completed reviews and a new combined
validation pass. Business Context work remains separately deferred. Local
environments, caches, logs, screenshots, helper servers and generated audit
outputs remain outside the release source.
