# Next business media parity step

The new onboarding candidate can attach an existing owned business logo key,
preserve it when omitted, or remove it with null. It cannot yet upload a local
logo or manage Settings/Carousel screenshots. These are separate application
resources; a generic MCP image asset does not supply their storage keys or scope.

The current website logo endpoint is
`app/api/business-profile/logo/upload-url/route.ts`. It accepts PNG/JPEG/WebP,
1–2 MB, creates an owner-hashed logo key and issues a ten-minute signed PUT.
`lib/business-profiles/logo.ts` inspects actual owned bytes, decoded MIME and
64–4096 dimensions before identity persistence. Upload URL creation currently
has no durable reservation/request receipt. MCP must add reservation recovery
and renewal before treating this as an interruption-safe IDE upload flow.

Settings screenshots use `lib/carousel/product-asset-service.ts`, not generic
media uploads. The service derives the profile/category scope from an owned,
completed business; unsupported categories fail. PNG/JPEG/WebP files are capped
at 25 MB, named without paths and persisted as pending product assets. Completion
checks the exact pending key/scope, reads bytes, decodes dimensions and deduplicates
by SHA-256. Archive behavior preserves completed historical objects and deletes
pending objects best-effort. Carousel-generation scoped screenshots need the
existing owned generation check as well as Settings scope.

Use those shared scope, probe, hash and archive semantics in the new adapters.
Require owner-bound immutable request UUIDs, exact-input collisions, pending
reservation discovery, expiring URL renewal and recoverable completion. Persist
the target before issuing an upload URL so a lost URL response cannot lose the
reservation. A dedicated logo reservation cannot reuse a generic image ID.
Validate actual bytes before making an upload available to onboarding or the
Carousel matcher. Do not change buckets/IAM or historical media as part of this
adapter work.

The current `transfer-media.mjs` handles generic image/video/influencer
reservations and therefore is not evidence of logo/screenshot acceptance. Extend
its supported contract deliberately or provide a dedicated helper that preserves
local path/size/checksum identity, accepts ephemeral upload links through stdin,
recovers the same reservation after interruption and probes the uploaded bytes
through the server. Preserve the existing helper behavior and release artifacts.

Before modifying screenshot/matcher/schema behavior, read the current
`CAROUSEL_CONTEXT.md` and update its product/architecture decision when needed.
Final acceptance requires the released domains and an intended user file, with
the shared website seeing the same saved logo/screenshots. Local SQL/SDK checks
alone do not establish this acceptance.
