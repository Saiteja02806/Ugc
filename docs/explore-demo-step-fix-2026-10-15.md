# Demo step and replacement follow-up — 15 October 2026

These are local changes, not a deployed release. This report supersedes the
previous audio-control descriptions for Hook video.

## Corrected behavior

- Hook video and Talking Head + Demo use **Create → Demo → Schedule**. The
  focused Edit hook/Edit demo screens still contain only editing tools.
- Hook's demo upload and Creative Assets choices remain visible alongside the
  preview cards. Previously `editPreviewActive` hid the entire source section.
  Change also targeted a missing selector. Change now reveals Controls on
  mobile, scrolls to the actual upload control and focuses it.
- Talking Head's Demo upload section is restored, with a directly visible
  Replace demo action. Its selected-media Preview demo action is compact,
  rather than another large upload tile. Demo sound remains available here.
- Hook has **one shared background track** across its hook and demo. It has no
  separate demo-audio picker in either the overview or focused demo editor.
  Original footage volume is now controlled in Demo setup, not the focused
  editor (superseding the earlier version of this report). Older local and
  server clip drafts cannot reintroduce a hidden demo-only audio attachment.
- Wall of Text remains a single-video workflow. Opening Edit without a clip
  now keeps Create's upload/assets/generation controls and reference gallery
  available, rather than entering the isolated full-screen empty editor.
  A saved `editVideoId` still enters restoration/editing as before.

## Browser evidence

Actual local application routes were checked at 1280×720 and 390×844, with
generation, server uploads, saving and scheduling disabled by preview mode.

| Flow | Observed result |
| --- | --- |
| Hook Demo upload → Change → replace → Edit demo | Replacement selector was visible and focused; replacing the file changed the preview source and clip duration. Focused editing hid workflow tabs and kept Save edits in the viewport at 1280×720. |
| Hook mobile Preview → Change | Switched to Controls and focused Replace demo at y=335px; no horizontal overflow. |
| Hook shared audio | One Background audio section; no Upload demo audio control after uploading a demo. |
| Talking Head Demo upload → Replace | Direct sidebar replacement worked; Demo sound remained available. Final compact Preview demo measured 119×34px in the desktop-pointer browser, including at narrow viewport width; coarse-pointer CSS retains 44px minimum. |
| Wall `?step=edit` without a clip | Create selected, source controls present and reference gallery visible; no isolated empty editor. |

Final screenshots:

- `outputs/hook-demo-shared-audio-1280.png`
- `outputs/hook-demo-change-mobile.png`
- `outputs/talking-head-demo-compact-1280.png`
- `outputs/talking-head-demo-compact-mobile.png`
- `outputs/wall-source-recovery-1280.png`

One intermediate source edit introduced an invalid UTF-8 byte and temporarily
broke the local compiler. It was corrected. Final checked routes loaded with
zero console errors; development preload/Fast Refresh warnings remained.

## Verification and limits

**380 tests passed, 0 failed** in
`outputs/demo-step-final-tests-2026-10-15.log`. Tests cover replacement,
retained drafts, source restoration, Hook's excluded demo audio, shared music
composition, independent Talking Head tracks, focused editing, slideshows,
Remix and scheduling transitions. Targeted ESLint, TypeScript and whitespace
checks passed.

The production Explore URL redirected to sign-in. Authenticated production
acceptance and paid generation/rendering/publication were not verified. The
existing Talking Head reference-transcript persistence gap is unaffected by
this UI change. No source-media or Library assets were modified in the checks.
