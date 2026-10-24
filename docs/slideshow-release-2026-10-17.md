# Slideshow attachment and history correction — 17 October 2026

The slideshow remains selected reference images plus one editable user prompt
and optional uploaded images, submitted to AI image editing. The star rewrites
text only. No manual placement UI, region-selection contract, vision planner or
compositing implementation is included.

Composer drafts retain prompt and ordered attachment IDs across reloads, scoped
to owner and reference selection. Recovered assets are verified through the
owned media API. Recovery errors prevent generation until retry or explicit
attachment clearing. A conservative explicit uploaded-screenshot preflight also
rejects missing attachments before credit reservation. This does not understand
every language or prove visual fidelity.

Image list/detail history now recovers submitted prompt and model from the
linked owned image job, including older results without prompt metadata. New
worker outputs retain submitted and effective provider text. Existing request
fencing, reference roles/order and grouped slideshow positions remain in place.

The release includes the other intentional workspace corrections: Hook Remix
final-frame captions, bounded media-start timing support, source-selection menus
and related recovery. Already released gallery, fonts, assembly and one-box
rewrite work is preserved together with newer production SEO/preview changes.
No intentional source path is excluded; ignored credentials, local environment
files, caches, generated previews and temporary release artifacts are not shipped.

Local validation: application TypeScript and worker compilation; 158 focused
slideshow/API/editor checks; 23 image-worker checks; 12 prompt receipt/assembly
checks; desktop/mobile real-component composer recovery fixture. The broader
Explore suite first found stale test import boundaries; these were updated to
load actual pure helpers without weakening behavioral assertions. Release build
and production deployment identities are recorded separately in deployment
receipts, not inferred from these local tests.

Production evidence distinguishes a latest request missing its attachment from
an earlier one that included the screenshot but redesigned it. User explicitly
chose “Deploy first; I'll test the generation” on 17 October. No paid canary is
therefore performed for this release. Passing delivery/history checks must not be
reported as proof that exact screenshot reproduction or generation quality is fixed.

Final combined Explore regression: 1,143 tests passed, zero failed. Merged-release
TypeScript passed with the Next-generated declarations; worker compilation and
23 image-worker tests passed. The local browser recovery fixture passed.
