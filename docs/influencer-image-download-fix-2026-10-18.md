# Saved influencer image download repair — October 18, 2026

## Confirmed cause

The character download endpoint called the shared media download handler with
kind `image`. The handler required `asset.collection === "image"`. Completed
builder images are automatically saved by promoting that same asset into the
`influencer` collection. Saving therefore made valid owned images fail the
download check and display “This image is no longer available to download.”

A read-only production audit at 06:52 UTC checked the latest eight completed
builder images, across Gemini 3 Pro, ChatGPT Image and Sunburst. All eight had
matching owners and output asset IDs, were ready and undeleted, and had existing
PNG objects. All eight were in `influencer`, so the old collection check rejected
them. Their files are intact and do not require regeneration or a data migration.

## Change

Image downloads now accept `image` and `influencer`. Video downloads remain
restricted to `video`. The server still authenticates the owner, validates the
saved storage key, checks the object exists, restricts image MIME types to
PNG/JPEG/WebP and issues a five-minute attachment URL. The existing private-media
rollout guard is preserved; these affected production files use the primary
media bucket.

The endpoint is shared by generated result cards and My influencers, so both
surfaces receive the fix.

## Validation and release status

- Eleven image/video download API and client tests pass. The regression checks
  downloading the same PNG/JPEG/WebP asset before and after promotion to
  `influencer`, plus foreign, deleted, unfinished, non-image and unsafe assets.
- Targeted ESLint and diff whitespace checks pass.
- Production database and storage metadata checks are read-only.
- An additional local-handler check against production data reached GCS signing,
  but local application-default credentials lack `client_email` and cannot sign
  URLs. This is a local verification limit, separate from the confirmed production
  collection rejection.
- Implemented locally, not deployed in this task. Final acceptance requires an
  authenticated download from a generated result and My influencers on
  `https://www.getugcpilot.com` after website deployment. No worker or database
  deployment is required for this repair.

## Seedream provider availability research

OpenRouter's official model page and model endpoints API list
`bytedance-seed/seedream-5-0-pro` with image output and text/image input:

- https://openrouter.ai/bytedance-seed/seedream-5-0-pro
- https://openrouter.ai/api/v1/models/bytedance-seed/seedream-5-0-pro/endpoints

This confirms availability, not successful generation with this application's
OpenRouter account. No paid test was submitted and no provider routing was
changed by this task. A migration must pin the provider for new jobs and preserve
already admitted Runway operations, retries and credit accounting.
