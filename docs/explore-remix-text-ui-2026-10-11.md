# Explore Remix Text section — 2026-10-11

The current editable input and hook-only reference behavior are documented in
[Editable Remix Text](design/remix-text-editable-input-2026-10-11.md).
That update supersedes the earlier source-thumbnail, read-only quote and Demo Remix behavior recorded below.

Implemented locally in the existing Hook, Wall of Text, Demo and Slideshow editors.
No production deployment, database migration or paid AI call was performed.
The existing generation rollout flag remains off by default.

## User flow

1. Open Edit for a video or demo, or select an owned output slide in Edit slides.
2. Remix Text is a collapsed 44px row. Existing manual text
   tools remain the default, without an enclosing large Remix card or mode tabs.
3. Open **Remix Text**. The caption from the post used for generation appears
   automatically, with its source thumbnail and name. There is no reference or
   source-slide dropdown. Slideshow copy follows the original source slide even
   after outputs are reordered. Unlinked/uploaded media uses manual text.
4. The section shows the account's saved Business Context name/readiness and a
   link to Settings. Missing context prevents generation. Additional instructions
   stay collapsed unless opened or restored from a saved request.
5. **Generate remix** asks the backend to adapt the reviewed source structure and
   approximate length to server-retrieved business facts. An editable draft replaces
   the form; the authored video or slide stays unchanged.
6. Edit the draft if desired. **Use this text** applies it, collapses the row and returns to the
   manual tools, where position, style and video timing can be adjusted.

Applying copy retains existing video trim, audio, styles and block timing. New
blocks inherit the chosen text style and scale source timing to the trimmed clip.
Slideshow copy retains the selected output's design and stable identity.
Demo copy applies only to its own clip, preserving trim, audio and crop/framing.
Its recovery key uses the owned demo ID, and its hook-format render contract
stays compatible in both video workflows. Generation waits for an owned demo;
local fixtures continue to block paid requests.
AI output retains its similarity/length limits. User-authored revisions use the
existing editor bounds: 600 characters per video block, or 180 heading and 600
body characters per slide, with the existing total/block limits and fit checks.

Only creator-added captions are eligible. Infographic/poster slides remain
excluded entirely, including titles and instructions; app screenshot/UI text
remains excluded. Empty and unreviewed source copy cannot generate.

## Snapchat Classic preset

Available within the shared video text style tools, including Hook and Wall of
Text. The preset uses regular Arial/Helvetica, white centered text and a square,
full-width black strip. Defaults at 1080px video width are 56px type, 58% background
opacity and 7.5% top placement. Text wraps within 94% width; the strip stays full
width. Opacity, color, size, text width, position and visibility interval remain
editable. Selecting a preset preserves authored copy and timing.

React preview and worker export share the layout. Sharp renders the escaped SVG
to a transparent PNG; FFmpeg composites it only during the block's selected
interval. Mixed bold/classic overlays keep their browser stacking order. Legacy
bold rendering and old draft shape remain compatible. The Docker image adds Noto
Color Emoji alongside existing Arial fonts. Local Windows rendering confirms an
emoji glyph is present, but the production container's font appearance still
requires a deployed export check.

## Request recovery and privacy

The backend resolves source copy and Business Context itself. The reference GET
exposes only the business name/readiness, not the stored private facts. Existing
account-scoped receipts, atomic claims, quota and UUID recovery remain unchanged.
A lost reply/reload checks the same request instead of making another provider
call. Instructions are locked while the outcome is uncertain; account, output
or source changes ignore stale replies. Receipts include the original source in
their browser key. Matching v1 receipts recover the existing UUID; a receipt
for another reference cannot retarget the current output. No schema change was
added in this update.

## Automatic source association and editor layout

The public generation-job response supplies only the source format, reference
ID and primary source URL. Owned media can opt in to an owner-scoped lookup of
its original job on GET; the response omits job prompts and business facts.
This read does not mutate media or create provider requests. Job-only slideshow
previews resolve their owned media ID before looking up source metadata.
An original job that is no longer available yields no invented source.

The editor follows the visible clip's aspect ratio. Portrait clips use a narrow
preview column beside the text tools within an 856px frame; landscape clips use
up to 480px of media width within a 1040px frame. Preview height scales with the
viewport, with no cropping or separate height limit that distorts the ratio.
Loaded demo dimensions take precedence over stored metadata. The large nested
preview card and repeated Demo labels are removed. Wide screens also keep the
workflow controls behind the existing toggle, retaining their mounted state.

Remix has no sparkle icons. The automatically linked source text appears as a
readable quote with original line breaks, keyboard focus and scrolling for long
captions, rather than a small read-only textarea. Excluded sources show their
notice without an empty quote. Demo trim is a small disclosure. The shared footer
keeps one Back action and the primary Apply/Save action at the right, with a short
status at the left. Mobile stacks Back above Apply. It reserves space rather than
covering fields; mobile uses document scrolling to reach the complete editor.

## Verification

- The aspect-ratio refinement passed root TypeScript, scoped ESLint and the 60
  video/demo/slideshow editor regressions. CUA inspected real local 720x1280 and
  960x540 video files at 1280x720, plus portrait at 1920x1080 and 390x844. The
  rendered portrait and landscape ratios match 9:16 and 16:9; no horizontal
  overflow or Remix sparkle icons remain. Generate and the footer fit the laptop
  portrait view. Mobile text controls and both footer buttons are reachable.
  Revealing and returning from Workflow controls preserves the linked caption.
  Review screenshots: `.tmp/remix-text-browser/local-demo-portrait-remix.jpg`,
  `.tmp/remix-text-browser/local-demo-landscape-remix.jpg` and
  `.tmp/remix-text-browser/local-demo-portrait-mobile.jpg`.
- The automatic-source update passed source/ownership/privacy API tests, job and
  media-result contracts, generation recovery, and existing video/demo/slideshow
  editor regressions. Root TypeScript and scoped ESLint passed; existing unrelated
  slideshow lint warnings remain.
- CUA browser verification used the real local Demo editor and a separate mock
  AI fixture. The chosen caption appeared automatically without selectors.
  Generating left authored text unchanged; reloading recovered the draft;
  reviewing and applying returned to manual tools with timing preserved.
  The real editor had no horizontal overflow at 1280px or 390px. At 1280x720,
  Generate and the single Back/Apply footer were visible. Preview screenshot:
  `.tmp/remix-text-browser/local-demo-remix-updated.jpg`.
- Root TypeScript and worker TypeScript compilation passed.
- Scoped ESLint passed for the new/updated Remix, preset and rendering code.
  Existing unrelated warnings in the slideshow editor were left unchanged.
- 42 targeted backend, catalogue, in-memory migration, edit and slideshow checks
  passed, including account/source association, private context, excluded sources,
  idempotency, concurrent claims, draft validation and preserving slide design.
- Eight video format/render tests passed, including actual FFmpeg exports for
  caption bars, selected intervals, trim/audio, unchanged source bytes and both
  mixed-preset stacking orders.
- Browser fixture passed with the real Remix section and shared caption controls,
  mocked APIs and no provider call. It checks manual-first behavior, editable drafts,
  Use, preset switching, exact slide targeting, missing context, excluded/unreviewed
  references, reload recovery and stale account responses. Desktop and 390px mobile
  screenshots were visually inspected without horizontal overflow.
- The compact-layout update passed 60 editor regressions, including both Demo
  workflows retaining trim, style, audio, framing and draft recovery after Use.
  Browser checks assert a single compact row on desktop/mobile, no initial
  reference fetch, optional field disclosure, and the existing receipt recovery.

Local review images: `.tmp/remix-text-browser/remix-compact-desktop.png`,
`.tmp/remix-text-browser/remix-compact-mobile.png`, `.tmp/remix-text-browser/remix-desktop.png`,
`.tmp/remix-text-browser/remix-mobile.png` and
`.tmp/remix-text-browser/caption-mobile.png`. These fixtures use placeholder video
and mock business/source data; they are not production acceptance.

Commands:

```powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false
node ../node_modules/typescript/bin/tsc -p tsconfig.json # from worker/
node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/explore/remix-text.test.ts lib/explore/remix-text-api.test.mjs scripts/remix-text-catalog.test.mjs scripts/remix-text-db.test.mjs scripts/explore-slideshow-editor.test.mjs scripts/explore-format-common-editor.test.mjs
node --test scripts/explore-format-edit.test.mjs
node scripts/remix-text.browser.cjs
node --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/explore-format-demo-state.test.mjs scripts/explore-format-common-editor.test.mjs scripts/explore-slideshow-editor.test.mjs
```

## Production activation still pending

Apply the existing private receipt migration, enable
`EXPLORE_TEXT_REMIX_ENABLED=true`, and deploy the web and worker changes through
the established release process. Final acceptance must use a real authenticated
account on `https://www.getugcpilot.com` to check generation, Use, persistence,
receipt recovery and exported font appearance. No equal-reach promise is made.
