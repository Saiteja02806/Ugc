# TikTok slideshow publishing correction — 17 October 2026

## Production finding

The reported **My slideshow** schedule was saved for 11:10 Asia/Calcutta
(`2026-10-17T05:40:00Z`). TikTok began at 11:11:24 and rejected its media with
`file_format_check_failed`. The job exhausted its three attempts at 11:14:11.
The publish handler nevertheless stored a retry for 11:16:11 because it used a
separate default limit of four. The processor then terminally failed the job,
leaving the target and parent marked Publishing. Its historical reconciliation
function is not called by the current application/worker paths.

Slides 1, 4 and 5 are actual PNG files, confirmed by their response MIME types
and binary signatures. Slides 2 and 3 are JPEG. TikTok's photo Content Posting
API accepts JPEG and WebP:
https://developers.tiktok.com/docs/en/content-posting-api-media-transfer-guide

This schedule also has a successful Instagram publication at 11:11:23.
Accordingly its correct parent outcome is **Partially failed**, not Failed.

## Changes

- Shared publishing preparation creates separate deterministic JPEG assets in
  `social-publish/tiktok/carousels/<library-item>/...`. It decodes the image,
  corrects orientation, flattens transparency on white, encodes JPEG at quality
  92 with 4:4:4 chroma, and fits TikTok dimensions without cropping/upscaling.
  It preserves originals, Library records, slide order and saved text/edits.
- Instagram keeps its existing JPEG preparation. TikTok prepares media before
  initializing a new post; resumed provider IDs skip conversion/reinitialization.
  Preparation failure cannot call the publishing API.
- The handler's retry budget is bounded by both the configured publisher limit
  and the actual job's `max_attempts`. Format rejection is terminal and has an
  actionable media-specific message, rather than a generic video/transient error.
- A service-only invoker trigger settles currently linked owned targets when a
  publishing job fails, including recovery exhaustion. It clears `next_retry_at`
  and updates the parent while preserving cancellation, published receipts,
  other platforms and replacement jobs. It does not grant browser table access.
- A separate guarded trigger resets an inactive TikTok format-rejected provider
  operation only when an explicit retry creates a new matching owned queued job.
  Successful or actively claimed operations are never erased.
- UI helper text differentiates future retry schedules from overdue pending
  retries and uses “post” for the generic publishing message.

## Verification and release boundary

- Worker build, root TypeScript and scoped ESLint passed.
- 86 worker tests passed across publishing, TikTok API, media conversion and the
  processor; 9 SQL/status tests passed. Tests cover actual JPEG encoding, mixed
  source formats/order, deterministic copies, transparency, bounded dimensions,
  bad downloads, provider resumption, final attempts, production-shaped stale
  status, explicit retry guards, owner/payload mismatches, sibling publications,
  cancellations and browser-role access.
- All five exact affected files converted successfully in memory. Resulting
  dimensions: 941×1672, 1080×1444, 1080×1444, 941×1671 and 941×1672. No storage
  upload, Library edit, provider initialization or publishing call was made.
- Applied `20261017105341_social_publish_terminal_status_and_tiktok_retry.sql`
  to production. The Supabase tool assigned version 20261017105341; the CLI-created
  local file was renamed to match that actual ledger entry.
- Production verification: reported target is Failed, no `next_retry_at`, same
  original scheduled time; Instagram remains Published with its existing receipt;
  parent is Partially failed. The backfill found only one stale active target.
  Security advisors before/after have the same existing 146 informational
  RLS-without-policy notices, consistent with the existing server-only tables;
  no new security warning was introduced.
- **Worker conversion/retry changes and website wording are not deployed.**
  The database guard and historical correction are live. New successful TikTok
  publication acceptance awaits rollout and an explicit publishing request.
  Do not auto-retry the old post or duplicate its successful Instagram target.

## Reported record identities

- Schedule: `a0b293a0-60b9-4057-80c5-89b36e10b5c2`
- TikTok target: `623a368d-7800-44d7-8c55-a3aace6bf587`
- Failed job: `4fa6da80-cae6-46fa-98c7-f6a3a56da57e`
- Library item: `5fc8bb5f-c3ad-4831-ba64-fc0437995f9b`
