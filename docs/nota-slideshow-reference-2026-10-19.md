# Focus slideshow reference — 19 October 2026

Source: `C:/Users/chund/OneDrive/Desktop/slideshow explore/Focus/New folder`.
The user renamed NOTA to Focus and requested the **Focus** category (`focus`).
The existing internal reference ID and uploaded asset keys remain stable.
Reviewed all six JPEGs in numeric order, 1.jpg through 6.jpg. Each is 1320×1760;
combined size is 683,042 bytes. Original files and image bytes are unchanged.

Reference: `explore-slideshow-nota-f79553cb5f15c74e`.
Visible topic: **Focus**. The first image is the cover. Updated catalogue release:
`ec1d17715e95dba5519a`. The prior 93 entries remain byte-for-byte unchanged;
the new catalogue has 59 slideshow references with 332 slides.

The existing importer uploaded all six objects to `explore/recreate/v1/` with
SHA-256 filenames and immutable cache headers. Public HTTP GETs verified JPEG
content types and hashes matching the local sources. Media upload is complete.
Six visually reviewed captions are registered against exact slide/source hashes
for Remix. There was no generation, credit use, scheduling or modification of
existing assets. The captions are a car/music/focus dialogue, not instructions.

Upload and hash evidence is stored locally in
`.tmp/nota-slideshow-2026-10-19/{review,verification}.json`. The upload manifest
contains only this addition, so no existing catalogue media was re-uploaded.
A temporary module loader resolves the worker's already-installed GCS package;
no application dependency or lockfile was changed for uploading.

Validation: all 18 catalogue contract checks pass, including ordered Focus slide
IDs, dimensions, exact reviewed text, first-slide cover and unchanged hashes for
earlier catalogue releases. All six public GET/source-hash checks and scoped
`git diff --check` pass. Broader import/MCP checks could not start because the
shared root dependency directory is currently missing (`zod`/Next and other
packages). No dependencies were installed or altered by this import.

The source catalogue and reviewed-text changes are ready locally. The deployed
frontend uses its bundled catalogue and requires a web release to expose this
reference. No deployment of the shared worktree was performed by this import.
