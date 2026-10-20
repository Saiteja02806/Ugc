# Slideshow thumbnail controls — 17 October 2026

Every thumbnail in Edit slides now has a visible remove button and a dedicated
reorder handle. Remove changes this draft only; the underlying owned media is
retained. The existing Earlier/Later controls remain available.

Mouse and touch gestures show the destination and commit one move on drop.
Long thumbnail rows scroll when the pointer is held near an edge. Escape,
pointer cancellation and dropping outside the row preserve the existing order.
Handles also support Left/Right and Home/End with a live announcement.

Reordering/removal uses stable slide identity. Image, text, appearance and
reference provenance stay together; removing a preceding thumbnail retains the
selected image, while removing the selected one selects the next available
neighbor. Existing draft persistence, save invalidation and saving limits apply.
Save, upload, recovery and generation lock the new controls.

Validation: 123 slideshow/editor/reference/API tests, application TypeScript and
scoped ESLint passed. The real-component browser fixture passed desktop and
mobile layout, mouse and real touch-pointer drag, edge scrolling, cancellation,
keyboard movement, thumbnail removal, retained text, save and reload. It uses
fixture media and makes no paid generation or production publishing requests.

This release changes only the slideshow editor, its drag hook/styles, related
tests and context notes. It preserves the newer production Trending and Demo
corrections. Worker/model/prompt contracts are unchanged. Deployment identity
and production checks are recorded separately from these local tests.
