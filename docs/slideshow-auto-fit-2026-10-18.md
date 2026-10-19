# Automatic 4:5 slideshow uploads

The manual Explore slideshow editor now prepares device uploads and replacement
images at 4:5 before uploading, including 9:16, landscape and square photos.
Non-4:5 inputs produce a 1080×1350 PNG; existing exact-4:5 files retain their bytes.

The full foreground remains visible, proportionally scaled and centered. A blurred
cover copy fills unused space, avoiding distortion and accidental removal of text
at the top/bottom of a portrait slide. Bitmap decoding applies EXIF orientation;
resources are released on success/failure. Invalid/oversized input or failed
conversion prevents that upload without replacing the draft with broken media.

The fitted file goes through the existing owned-media upload/save contracts.
Preview and saved/scheduled output therefore use the same actual image. Slide
order, text, identities and pending-save protections are retained. Preparation is
bounded to two concurrent images, preserving partial-success source order.

This does not change generation attachments, already saved posts, reference
originals or existing Library selections. No AI/image-generation credits are used.
4:5 is the chosen workflow format; it is not asserted as TikTok's sole valid ratio.

Validation covers aspect geometry, resource cleanup, byte-preserving 4:5 pass
through, failure handling and actual-editor browser uploads. A marked 9:16 image
checks both top and bottom remain, the uploaded PNG has 1080×1350 dimensions and
save/reopen uses that fitted asset. Square replacement also returns to 4:5 and
invalidates prior scheduling output. These checks use local mocked upload APIs.

Implemented locally; production deployment/acceptance are separate.

Final verification: 130 focused tests, application TypeScript, scoped ESLint and
the actual editor/Add slides browser suite pass. Existing save/retry and owner
recovery portions of the broader slideshow suite also pass. Its final recreation
assertion fails because changing the edit target loses previously attached IDs.
The same failure occurs in a temporary in-memory baseline that restores the old
upload implementation. That separate issue remains unresolved; no claim of full
generation-flow acceptance is made by the successful ratio conversion checks.
