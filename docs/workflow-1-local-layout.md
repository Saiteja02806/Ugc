# Workflow 1: local layout review

Latest layout: see `workflow-reference-layout-2026-10-02.md`. The older header-audio, collapsible demo sidebar and overflow settings-strip descriptions below are historical, not the current Workflow 1/3 layout.

Route: `/explore/create-hook?preview=1`, development only. Linked from local Explore preview; no production catalogue change.

## Confirmed product decisions

- User-owned instructions, optional Creator reference, optional user-provided video reference, and optional hook audio.
- The application must not prefill, rewrite, append to, or override the user's instructions. Library examples are informational only and never become generation input.
- Library stays empty until the product owner explicitly supplies or approves videos. Do not insert existing clips, sample videos, or substitutes.
- Hook audio has two explicit intents: voice reference or exact spoken recording. Provider support is not established by this UI.
- Demo is optional. Its original sound stays intact; optional demo audio plays during the demo only, layered alongside that original sound.
- The initial workspace fills at least the available viewport with the preview and composer. Library content follows the entire workspace and requires scrolling, including on 14-/15-inch laptop-sized viewports. A small rounded “Library ↓” shortcut beneath the composer scrolls to the Library heading and moves keyboard focus there, respecting reduced motion without changing the route or instructions.
- Library is no longer in the sidebar. Attached demo is a separate collapsible right sidebar on wide screens and a modal drawer on narrower screens; it starts closed. Attach audio is a compact header control that opens a popover.
- Preview is the main surface. Composer and actions use rounded corners/pills in the existing brand theme.
- The composer is prompt-first, without the old large Creator/video attachment row. Optional references live behind the plus button; Creator also has a compact picker using the existing static Creator gallery. Reference selection never alters instructions.
- Model, duration, output count, quality, aspect ratio and Creator are compact settings. Their row measures its actual width and shows navigation arrows when needed; resizing or opening the demo sidebar retains selections.
- Prompt growth is bounded, with internal scrolling for long instructions. Compact attachment chips do not expand into full previews inside the composer.
- Replacing or removing a demo clears its associated background audio. This is explained in the demo controls; invalid replacement files preserve the existing demo/audio pair.
- The Explore card has a reserved cover-video field and hover-play behavior. It remains empty until the user supplies the approved cover video.

## Implemented in this pass

- Editable user instructions, local Creator/video/audio attachments, a below-screen empty Library, conditional demo-audio controls and duration validation.
- No uploaded test hook is shown as a generated hook. The main preview remains an honest generation-result state until generation is connected.
- Files stay in browser memory while panels are closed/reopened or audio is opened. They are **not saved** across page reloads; leaving warns when instructions or attachments exist. Media players detach before blob URLs are released on replacement/unmount.
- Generation is disabled; no provider request, upload, persistent write, credit charge, scheduling or publishing occurs.
- Current model choices/durations mirror a subset of existing integration choices. The 720p/1080p quality and aspect-ratio controls are layout-only choices, not verified provider capability. This is not verification of voice cloning, lip-sync, or the requested 30-second support.

## Next stages, after layout review

The later local presentation-only pass is documented in `workflow-ui-polish.md`:
shared rounded workflow styling, quieter surfaces and reduced-motion-safe
popover/drawer transitions. It preserves all decisions and local-only limits
above; it does not connect generation or add example media.

1. Verify providers for both audio modes, exact dialogue behavior, duration and reference combinations. Put verified capabilities in one shared configuration.
2. Add durable workflow drafts and authenticated asset uploads, with input snapshots and consent/ownership checks for voice and creator references.
3. Connect hook generation, retained alternatives and explicit selection.
4. Connect clean-cut rendering with original demo sound plus demo background audio, preserving render history.
5. Reuse existing supported scheduling destinations and validate the authenticated end-to-end flow before release.

Recreate, Trending, existing generation APIs, billing and render workers are unchanged by this layout pass. Nothing was deployed.

## Local verification

- TypeScript and targeted ESLint passed; 21 layout/catalogue contract tests passed.
- Browser viewport checks: 320×568, 390×844, 1024×576, 1366×768, 1440×900, 1536×864 and 1920×1080 CSS pixels. Library was below the initial viewport at each size; scrolling revealed it. No page-level horizontal overflow occurred. Very short mobile screens may scroll the creation area as well, without clipping controls.
- Follow-up shortcut verification at 1366×768, 1440×900 and 390×844: “Library ↓” was visible near the composer while Library content remained below the viewport. Clicking it revealed the heading, moved focus there and preserved both the route and exact instruction text. Keyboard Enter and reduced-motion mode were also checked.
- Tested Creator/gallery selection, custom Creator and video-reference attachment, instruction retention, hook audio and exact-recording intent retention, empty Library, demo drawer/sidebar closing/reopening, media metadata playback readiness, and demo-audio controls.
- Tested settings overflow arrows and selection retention across viewport/sidebar resizing. The narrow demo drawer traps keyboard focus and Escape returns focus to its header button.
- A long prompt with all hook references and the wide demo sidebar open retained a 333px preview at 1440×768; prompt height remained bounded at 144px and Library remained below the viewport.
- Demo background audio longer than the demo produced an explicit error; replacing it with shorter audio cleared the error. Replacing/removing the demo cleared its background audio. The exact instruction text remained unchanged throughout attachment actions.
- Observed no non-GET network requests during attachment interaction tests. Generate remains disabled.
- No browser console errors were observed. Existing app-level font-preload/LCP warnings remain outside this scoped layout work.
- The composer is part of the first-screen flow, not globally fixed. Library scrolls with the following page content and cannot appear above that first-screen boundary.
- Local checks are layout verification, not production acceptance or proof of provider generation, audio mixing, export or scheduling support.
