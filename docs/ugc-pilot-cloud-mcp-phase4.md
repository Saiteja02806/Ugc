# UGC Pilot Cloud MCP: Phase 4 media mutations

Status: locally implemented and validated on 2026-09-27; deployed to the separate `ugc-mcp` project on 2026-09-28. No live upload or GitHub push has occurred. The Phase 2/5 migrations are applied; Phase 4 needs no additional migration. See the [live rollout record](ugc-pilot-cloud-mcp-live-image-validation.md).

New MCP upload rows contain an `mcpUpload: true` marker in the existing `media_assets.metadata` JSON. This distinguishes them from website upload rows without storing a confirmation deadline. No new database column or migration is needed for Phase 4.

## Tool behavior

- `create_upload` requires `assets:write`, validates collection, filename, MIME, declared size, and optional title with the existing `createMediaUploadTarget` rules, then uses the existing GCS signed PUT service. It stores an owner-scoped `uploading` media row with the MCP marker before returning the HTTPS URL, its 10-minute expiry, and required `Content-Type`. The URL is intended for a client that has the file bytes and can send an HTTPS PUT; calling the MCP tool alone does not transfer the file.
- `confirm_upload` requires the same scope and an owned MCP upload row. It checks the GCS object exists and matches the declared MIME and byte count, validates dimensions and video duration, and conditionally changes `uploading` to `ready`. An object uploaded while the signed URL was valid can be confirmed after URL expiry. A matching retry of an already ready upload returns the same asset. Website upload rows without the MCP marker cannot be confirmed through this tool.
- `delete_asset` retains the existing owner-scoped soft delete and destructive annotation. It does not purge the backing object.

## Local evidence and limits

- The MCP integration fixture covers signed URL failure, MIME and size rejection, cross-user confirmation, missing object, storage outage, object mismatch, confirmation after URL expiry, successful image and video confirmation, required video duration, safe retry, and deletion ownership.
- The pure upload tests cover shared target rules, MCP upload marking, exact object match, dimensions, video duration, and collection size limits. Targeted ESLint and the optimized Next.js build pass.
- The signed PUT URL is not a server-side file transfer. Phase 9 must verify that each target client can access user-selected file bytes and perform the PUT, or the upload UX needs a separately approved client-specific path.
- OAuth migration and MCP domain routing are complete. Production acceptance remains pending for authenticated uploads, real GCS object checks, and client interoperability. The missing Google Cloud service-account credential prevents storage operations in `ugc-mcp`. The existing website deployment and aliases are unchanged.
