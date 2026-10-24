# Demo library and Explore editing

Local implementation on 14 October 2026. Not deployed.

The former Content screen is now named Demo. Navigation, the screen heading,
page metadata, loading text, Explore/Trending pickers and editor return links
use the new name. Existing `/library` links and storage/API identities remain
compatible.

Explore's Demo picker reads the authenticated account's dedicated demo inventory
through `/api/demo/sources`. It requires a current demo record and its ready
`demo_upload` media projection. Opening clips retain their existing source picker.
New demo uploads use the existing demo upload/completion APIs and their 100 MB,
1–60-second limits. A lost completion acknowledgement reads the same owned asset
before reporting failure and never deletes a potentially completed demo.

Apply demo edits saves the existing versioned Explore draft. The Demo screen
discovers those saved revisions and opens the same full editor for the chosen
demo, retaining text, trim, original sound, added audio, framing/pan and workflow
music. Its header reads Demo / Edit demo and returns to the Demo screen. Edit
original keeps the older editor and existing exports accessible.

Reads, draft restoration and Apply do not start rendering or schedule posts.
Draft saving and owned audio restoration work independently of render capability;
final video preparation keeps its existing renderer and scheduling checks. No
schema migration, worker change or historical-output conversion is introduced.

## Validation

- 169 focused regressions pass, including owned inventories, upload recovery,
  source replacement, rich draft restoration, slow-response protection, editor
  entry/return navigation and existing scheduling behavior.
- The draft persistence tests run against an isolated PGlite database, including
  ownership, revision conflicts and replay. No production data is changed.
- Web TypeScript passes. Scoped ESLint reports no errors and one existing unused
  `video` parameter warning in the Trending composer.
- The local browser fixture verified Choose from Demo, dedicated demo selection,
  the full trim/text/sound/framing controls, and retained trim/text after Apply
  and reopening. Direct demo entry shows Demo / Edit demo and Back to Demo.
  Screenshots: `outputs/demo-picker-preview.jpg` and
  `outputs/demo-editor-preview.jpg`. The fixture never uploads, renders or
  publishes. Production acceptance remains a check for the next authorized
  deployment.
- `git diff --check` passes. Other in-progress worktree changes are preserved.

Test output: `outputs/explore-content-demo-tests.log`.
