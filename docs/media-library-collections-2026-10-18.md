# Shared media library and slideshow background collections

Implemented locally on 18 October 2026. No push or deployment was performed.

## Product behavior

- Settings → Media library manages reusable Images and Music. Creative Assets →
  Images retains its existing workspace and links to the same collection manager.
- Trending has a Library pill beside Adjust and Edit. It opens management without
  changing the current creative. Trending's selected-slide editor also has
  Choose from library and Add to library.
- Image collections reuse `creative_asset_groups` and their memberships. Users
  can create, rename and remove collections, upload into them, and add/remove
  existing images. One image may belong to several collections. Removing a
  collection or membership does not delete its image files.
- Explore slideshow Add slides can add selected library images in selection
  order. Edit and Your slides can replace one background or all backgrounds.
  Optional generation references can also choose a saved library image.
- A chosen image offers selected-slide or every-slide preview. Applying an entire
  collection follows its displayed order and repeats from the beginning if it
  has fewer images than the slideshow. Extra images are unused. Collection
  membership order is added time, with asset ID as a stable tie-breaker; manual
  collection reordering is not included. Search does not redefine that order or
  narrow a whole-collection application. The preview identifies each target.
- Apply rechecks every used image before a single local draft change. It preserves
  slide identities, order and editable text, and invalidates the saved sequence.
  A failed recheck or cancelled preview does not apply a partial replacement.
  Ordinary explicit save and scheduling review remain required.
- Library changes do not propagate to existing slideshows or scheduled posts.
  Image archive hides future selection and generic gallery tiles through metadata,
  retaining the original ready asset for existing drafts, renders and saved posts.
  Archived images can be restored. This introduces no permanent image deletion.
- Music uploads use the existing owned signed-media flow, up to 25 MB/10 minutes.
  Users can upload from the Library pill or Add music to library inside an audio
  picker without navigating away from Edit. Uploaded tracks appear in those
  existing pickers. Whole-video music directly reuses the verified media asset
  without another upload and preserves the user's current music On/Off choice.
  Other audio attachments retain their existing file-validation/upload path.
- Music library storage does not attach music automatically, generate a video or
  add native Instagram/TikTok photo-slideshow soundtrack publishing. Existing
  video/demo audio and platform publishing contracts retain their scope.

## Implementation and safety

- Shared components are under `components/media/`: the image browser, image
  picker, music manager and media-library dialog. They follow the existing app
  theme and use bounded, scrollable dialogs on desktop and mobile.
- `/api/media/image-library` authenticates with Firebase and applies owner,
  ready, undeleted, image and source filters. It pages 60 raw rows at a time;
  post-filtered pages retain a next-page control even when they contain no
  eligible rows. Search escapes PostgREST filter values. IDs and URLs are checked
  again through owner-bound asset reads before application.
- Trending's save normalizer now accepts ready owned uploads from other workflows
  and owned generated images, deriving URLs and centre crop from server records.
  Catalogue imports, foreign/unready/deleted/unsupported assets remain rejected.
  Existing app screenshot and reviewed-hook eligibility paths remain in place.
- Image archive is an owner-checked metadata update, not `deleted_at` or storage
  deletion. Existing asset reads and save paths continue resolving archived sources.
  Metadata changes compare the current update version and reload on contention,
  preserving a concurrent worker's newer metadata instead of overwriting it.
- Music uses `media_assets`, separate from private voice-reference/test recordings
  in the dedicated audio-generation library. Only the explicit music-library
  upload purpose receives the existing ten-minute background-track allowance;
  ordinary AI audio references keep their thirty-second completion limit.
- No schema migration, worker release, provider call or production data write is
  required. A read-only production schema check confirmed all three reused
  tables have RLS and the membership ownership/availability guard is installed.

## Validation

- 312 focused tests pass, covering slideshow saves/recovery, owned image
  admission, repeated image assignments, archive/restore, server-derived Trending
  backgrounds, new listing/PATCH endpoints, existing reference/audio controls,
  direct owned-music reuse and music upload duration limits.
- TypeScript and scoped ESLint pass. The React review checked stable owner keys,
  hooks, bounded reads, functional updates, explicit selection/Apply, accessible
  button names and dialogs, keyboard dismissal and small-screen containment.
- `scripts/media-library.browser.cjs` exercises actual library, Trending image
  section, Explore slideshow editor, saved-audio picker and background-music hook
  against isolated auth/storage APIs. It verifies collections/membership, music
  upload from the header and Edit, ordered/repeated backgrounds, one-slide
  replacement, cancellation, atomic failed rechecks, preserved text, archive,
  unsaved state and music reuse without a second upload or automatic playback.
  Desktop 1366×768 and mobile 390×844 bounds pass. Screenshots were inspected;
  collection-panel contrast was corrected and the checks rerun.
- The existing `slideshow-add-slides.browser.cjs` also passes its complete
  assembly, save/reload, capacity, failure, pointer/touch reorder, text identity,
  mobile and responsive-footer checks.
- Browser scripts needed execution outside the sandbox so Edge could initialize
  its temporary profile. They used fixture APIs and made no generation,
  scheduling or publishing calls. Logs/screenshots stay in `.tmp/`.
- Authenticated production feature acceptance remains pending a web deployment.
  These component and API-boundary checks do not establish hosted storage or
  published-post acceptance. Existing unrelated worktree changes were retained.
