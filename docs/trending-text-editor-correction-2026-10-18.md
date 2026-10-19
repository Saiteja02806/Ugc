# Trending slideshow text editor correction

The user reported that horizontal movement unexpectedly added a white text
background, intentional three-line hooks were impossible, and appearance fields
occupied excessive space.

The position handler initialized a manual style whose shared markup always
rendered heading panels. A single-line Hook input and fixed wrapping width
also prevented deliberate text layout. These were implementation defects.

## Changes

- Multiline Hook/headline input; explicit line breaks survive save and reopen.
- Compact font, size, color and weight fields, alignment buttons, outline,
  wrapping width and line spacing. Position stays available in a disclosure.
- Explicit per-heading/body background choice, optional color and opacity.
  New overlay edits do not add panels. Existing v1 styles preserve their old
  appearance until changed; original source pills remain explicit source style.
- Shared versioned layout and worker glyph rendering honor the same fields.
  Newline edits use this layout; unmodified legacy slides retain existing paths.
- A sticky desktop preview remains visible while scrolling the inspector.

The editor controls a slide's existing text group. It does not extract editable
objects from image pixels or change AI image generation. This is Trending
Carousel Edit; manual Explore Slideshows retains its separate workflow.

## Validation and limits

- Worker compilation and 45 renderer/worker tests pass, including actual image
  compositing, safe extents, three explicit lines, alignment, width, weight,
  spacing, explicit backgrounds and saved-v1 compatibility.
- 19 persistence/containment/schema tests pass, including complete style JSON
  and multiline copy through PATCH serialization, merge, stored-content reopen.
- Application TypeScript and scoped ESLint pass.
- Actual Trending editor with isolated auth/API boundaries verifies no implicit
  panel on movement, compact fields, dark selects, Enter-created lines, explicit
  backgrounds, failed save/retry, reopen/reset and mouse/touch/keyboard movement.
  Saved fixture output uses the actual worker glyph renderer. Browser fixtures
  do not perform a production save or authenticate a customer account.
- Visual checks cover 1366×768, 1536×864 and 390×844 at normal browser zoom.
  Other zoom settings and authenticated production acceptance remain untested.
- An initial sandbox image run hit its memory limit; the complete serial worker
  suite passed outside the sandbox. An application check raced unrelated
  temporary worker-file changes; a fresh complete check subsequently passed.

No deployment or production data changes were made. The compatible worker must
be deployed before the updated website; no database migration is necessary.
