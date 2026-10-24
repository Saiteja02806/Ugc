# Private creator accounts — 24 October 2026

Follow-up: `creator-slideshow-and-parity-2026-10-24.md` records the later TikTok
collection, reviewed source-frame selection and legacy recovery fixes. Its
frame-selection and validation results supersede the initial ones below.

The Hook video References gallery now has **Recreate the account** for the
verified account `vtu19403@veltech.edu.in`. The dropdown lists **Creator Account
1**, **Creator Account 2**, their video counts, and **All references**.

| Account | Original source folder | Videos |
| --- | --- | --- |
| Creator Account 1 | `D:\reference1\New folder\New folder` | 6 |
| Creator Account 2 | `D:\reference\New folder\New folder` | 6 |

The selector replaces only the reference gallery. Existing Create / Demo /
Schedule, Generate / Upload / Creative Assets, normal reference filters, owned
videos, previews and Recreate actions retain their entry points. Filters return
with All references; Instagram/TikTok filters do not hide private imports whose
original post URLs were not supplied. Switching galleries preserves the exact
reference already used by a preparation, generation or editor.

## Access and generation

- The client visibility check is reinforced by Firebase verification and the
  exact email allowlist on metadata, video, poster, source-frame, starting-image,
  animation and caption/Remix admission. The private accounts are excluded from
  the ordinary public/MCP reference catalogue.
- Source MP4s and decoded first-frame PNGs are packaged under
  `lib/explore/creator-account-media/`, outside `public/`. Manifest identities,
  byte sizes and SHA-256 digests are checked before serving. Playback fetches
  authenticated bytes and uses browser-local object URLs, revoked on cleanup.
  Read failures are retryable; requests have deadlines and owner scoping.
- Recreate opens the existing source-frame / person-photo / generated-image
  preparation. It keeps the original scene and selected person-photo roles,
  supports the existing image models, then animates the owned approved image.
  The private original video cannot enter the public gallery-video generation
  path. Model availability, photo ownership and billing checks still apply.
- The user explicitly approved sending a selected reference frame/video to the
  existing AI provider when Generate is clicked, and separately approved caption
  text and movement directions for Recreate and Remix. Implementation sends a
  selected PNG for the starting-image step; animation uses the owned generated
  image. Private originals are never copied into public snapshot storage.
- A dedicated provider route serves only the exact hash-bound PNG for ten
  minutes. Tokens cannot expose a video or different reference. The worker
  signs immediately before provider submission, and saved jobs retain unsigned
  canonical provenance so queue delays and recovery do not freeze expired URLs.
  Website and worker share `CREATOR_REFERENCE_SIGNING_SECRET`, when configured;
  otherwise they derive a purpose-specific HMAC key from their existing shared
  `SUPABASE_SERVICE_ROLE_KEY`. Both deployment targets must agree on the key.
- Source-bound caption records and editable animation directions come from four
  sampled frames per clip. They are adaptation material, not evidence of full
  motion review or successful paid output fidelity. No source account URLs,
  follower counts or platform provenance were inferred.
- Starting-frame history resolves the same private source and directions.
  Generated-video Remix resolves the immutable creator reference ID even after
  browser playback URLs change. Browser object URLs are not frozen into jobs.

## Local validation

- 245 focused API, access, source-frame, preparation, generation, recovery,
  history, Remix and gallery integration tests pass.
- 44 worker image-generation/contract tests verify fresh signed delivery through both
  Gemini paths and unchanged ordered scene/person roles. Worker build passes.
- TypeScript and scoped lint pass. A production Next webpack build passes; the
  default sandboxed Turbopack build stalled and was stopped. Final source build
  confirmation is `.tmp/creator-account-build-final.log`. Test summaries are
  `.tmp/creator-account-final-tests.log` and `.tmp/creator-worker-final-tests.log`;
  scoped lint is `.tmp/creator-account-lint.log`, and packaging verification is
  `.tmp/creator-account-packaging.json`.
- Next tracing includes all 24 immutable private assets for the media route and
  required PNGs for source/provider delivery. None are in `public/`.
- Local browser evidence uses the actual dropdown, reference cards, private
  APIs, media hook and starting-frame preparation with fixture authentication,
  entitlements and photo picker. Checked 1280×720, 1366×768, 1536×864,
  1920×1080, 1280×600, 390×844 and 320×568, including no horizontal overflow,
  account replacement, matching source preparation and another email's hidden
  selector. Screenshots and the exact browser receipt are under
  `.tmp/creator-accounts-browser/`. Surrounding gallery layout is a fixture.
  Keyboard Escape, returning to All references then reopening playback, and
  retrying a failed authenticated media read also pass. Top/scrolled gallery
  screenshots are retained for all seven sizes.
- The older `scripts/explore-recreate-source-action.test.mjs` runner still has
  an incomplete React DOM mock against the pre-existing workspace and could not
  execute. The current workspace gallery handlers, including creator switching
  and preserved preparation identity, pass in
  `scripts/explore-format-source-workspace.test.mjs`.

No paid generation, deployment, production data/schema changes or authenticated
production acceptance were performed. Visual fidelity after real image/video
generation, browser zoom and coarse-pointer interaction remain unverified.
Website and worker must be deployed together before production acceptance on
`https://www.getugcpilot.com`.
