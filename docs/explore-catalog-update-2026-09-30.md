# Explore reference additions — 2026-09-30

Local-only update requested by the owner. No cloud upload, commit, push, deployment, paid generation or publishing.

## Sources and additions

- Slideshows: `C:/Users/chund/OneDrive/Desktop/slideshow explore`. One category directory contains slideshow directories; each slideshow stays one ordered reference, with numeric filename ordering.
- Hooks: seven MP4 files directly inside `C:/Users/chund/OneDrive/Desktop/hook/videos (10)/New folder`. All are valid 720×1280 H.264 clips, approximately 2.6–4.1 seconds, with AAC audio. Original bytes and audio are preserved; gallery hover previews stay muted.
- Added 11 slideshows containing 70 slides: Habit (2), Interior Design (3), Relationship (3), Screen Blocker (3).
- New filter categories: Habit, Interior Design, Screen Blocker. Relationship remains an existing category and now has five references. Filters still display names only, without counts.
- Local Recreate totals: 49 slideshows / 272 slides across 12 categories, 21 hook references, and the unchanged 91 Wall-of-Text references (63 existing + 28 staged).
- Workflow 1's informational Library and both workflow covers remain unchanged. No example or cover media is added there.

## Preservation and release boundary

The first 66 imported items (38 slideshows and 28 Wall-of-Text videos) remain byte-for-byte identical as JSON, including IDs, titles, order, dimensions and filenames. SHA-256 of their item array remains `c892521201f30b3f2835aba8ab36b9738975ff991ce0515431921b0ec28fb842`. Existing dedicated Hook and Wall-of-Text assets are not replaced.

`prepare-explore-catalog.mjs` now supports optional `--hooks <directory>` and additive rescans. Existing items are never removed when a source disappears, or renumbered when a folder is inserted. Identical IDs with changed content are rejected; exact duplicate Hook bytes are skipped. Dry runs write nothing. Local staging atomically updates generated metadata after a successful complete scan. It refuses to downgrade a published catalogue or overwrite a catalogue changed during the scan.

The manifest remains `mediaStatus: staged`. Newly staged content is available only through the development-only local preview and allowlisted media route, not the authenticated live catalogue. A later explicitly approved cloud import must verify all assets before marking the manifest published. Published Hooks are exposed through the dedicated Hook library and recognized at its existing server-side generation ID boundary; Recreate does not duplicate them. Local Hook labels continue after the existing 14, so accessible names remain unique.

Refresh the local staging safely:

```powershell
node scripts/prepare-explore-catalog.mjs --hooks 'C:\Users\chund\OneDrive\Desktop\hook\videos (10)\New folder' --stage-local
```

Omit `--stage-local` for a read-only audit. The existing remote importer remains dry-run by default and still requires separate explicit execution and confirmation.

## Verification

- All source slides and clips were probed; all 342 staged media files exist and every content-addressed source file matches its SHA-256 filename. The remote importer dry run validated the same 342 assets, without uploads.
- A second complete source scan found zero additions, confirming repeatability. The original 66-item hash is unchanged.
- Browser checked every one of the 70 added slides, matching the manifest's source file, dimensions and order. Previous/Next bounds work, and the image retains its natural ratio without cropping or artificial side bars, including mixed-ratio Interior Design slides.
- Browser checked all seven new Hook posters and hover playback: ready state 4, muted, no media errors. Selecting a new Hook passes its exact ID and source URL; user instructions persist when switching references and Image/Video modes. These interactions issued no non-GET/HEAD requests.
- The 12 category names render without numeric counts. New-category and Relationship filters show the expected references. Desktop 1366×768 and mobile 390×844 / 320×700 layouts have no page-level horizontal overflow; slideshow dialogs fit and retain full images.
- TypeScript, targeted ESLint and all 50 catalogue/presentation/query regression tests passed locally. No claim of production authentication, provider generation, cloud media readiness or deployed end-to-end acceptance is made.
