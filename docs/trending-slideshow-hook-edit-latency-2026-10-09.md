# Trending slideshow hook-image edit diagnosis — 2026-10-09

Read-only production investigation of Edit → Hook library image replacement → Save → updated Trending hook slide. No application, infrastructure, database, or deployment changes were made during this investigation.

The investigation above was followed by the local implementation below on October 10. These fixes have not been deployed or applied to production.

## Confirmed delay

Production job records and Cloud Run logs show a successful six-slide edit created at 17:35:21 UTC:

| Stage | Duration |
| --- | ---: |
| Job created → worker claimed job | 26.27 seconds |
| Worker processing, rendering and upload → completed | 7.98 seconds |
| Total background-job time | 34.25 seconds |

Cloud Run received the request at 17:35:21.557 UTC, started a new instance at 17:35:21.623, started the worker HTTP server at 17:35:46.307, and passed its startup probe at 17:35:46.936. No other persisted Carousel job overlapped the waiting interval. This example establishes a cold start, rather than a five-slide rerender or a busy preceding generation job, as the main delay.

The worker rendered slide 1 and reused the other five immutable slide assets. The deployed service has minimum instances 0, maximum instances 1, and request concurrency 1. Generation and edit-render jobs share this service. Backlog is therefore another possible delay, but was not observed in this sample.

The production web deployment inspected was READY, commit `4adfe024e432cda25983dd44a434229464a6d378`; the worker service was serving revision `ugc-carousel-worker-release-4adfe02` at inspection. The measured jobs ran shortly before that worker revision replaced the preceding release.

## Separate failure matching the screenshot's hook text

A second six-slide edit, created at 17:37:34 UTC, began processing after 1.60 seconds and failed after approximately 0.99 seconds. Its source slideshow's hook text matches the screenshot supplied by the user. Matching the text does not prove this is the exact browser attempt pictured.

The persisted error is: `Carousel text could not fit within 4 lines at the fixed 84px font size.` The source slideshow used `story-native-tiktok-text-blocks-inter-tight-v11`; the attempted edit used the newer hook rendering path. An image-only replacement consequently subjects an existing hook to a newer text-fit contract. This is a compatibility failure, not an indefinitely running job.

## Why Trending appears unchanged

- The editor PATCH saves the edit and dispatches `render_trending_carousel_edit`; saving does not mean the final image is ready.
- Trending checks queued/rendering edits every 2.5 seconds, plus request and image-load time.
- The slideshow displays edited image URLs only when `renderState` is `ready`; queued, rendering and failed edits display the original slide.
- The green Edited badge currently depends only on the edit record existing. It does not distinguish a ready render from a pending or failed render. The failure message is surfaced when attempting to schedule, rather than being persistently displayed on the slideshow.

These behaviors were verified in the production commit's editor route and Trending component, production database job/edit records, and bounded Cloud Run logs. Production Vercel logs also show successful PATCH responses for these saves; a successful save response is compatible with a later background-render failure. No signed-in browser attempt was reproduced, and no new production edit was submitted.

## Recommended follow-up

Reduce the edit worker's startup delay (or use a warm, dedicated edit-render path), preserve renderability of existing hook text for image-only changes, validate text fit before accepting the save, and show Updating/Failed/Edited states accurately on the card. Continue reusing unchanged slides. A faster polling interval alone cannot remove the observed 26-second startup wait or resolve the text-fit failure.

## Local fixes implemented — 2026-10-10

- **Startup:** the tracked Carousel worker minimum-instance default/example is now 1, retaining maximum instances 1 and concurrency 1. Keeping an instance warm should avoid the measured scale-from-zero wait; it adds idle hosting cost once applied. No live setting was changed, and no new production latency measurement exists. A busy generation queue can still delay an edit.
- **Existing hook compatibility:** image/position replacements retain 72px for unchanged original hook copy from the diagnosed Structure 2 v11 renderer, and the matching Structure 1 v25 renderer. Both editor and worker use the same rule. The worker reads the original text and source renderer from its database records, rather than trusting submitted eligibility metadata. Changed text, unknown sources and current sources retain 84px. Edited renderer metadata advances to `normalized-edit-v2`.
- **Visible render state:** queued/rendering edits display Updating; failed edits show Update failed and a persistent recovery message; only ready renders display Edited. The old image remains visible while rendering or after failure, and scheduling keeps its existing readiness guards.
- **Refresh:** polling is serialized at one-second intervals, and a stale response cannot overwrite a newer revision or revert a newer render status. Unchanged slides remain reused.

The exact failing hook copy from the evidence renders successfully at its original 72px in a local renderer test. Four job tests cover both structures with unchanged and changed copy, including forged client typography metadata. The renderer, reuse and screenshot-crop suites pass 31 tests; the state, renderer contract and infrastructure contract suites pass another 16. Web TypeScript, worker build, scoped lint and Terraform configuration validation pass.

The actual Trending card shows Updating, Update failed with readable instructions, and Edited in the development fixture. Failure messaging fits both 1366 × 680 and 1536 × 776 layouts with the decision buttons below the card. Local proof: `.tmp/trending-revisit-20261010/slideshow-failed-15.png`.

Synchronous pre-save text-fit validation was not added: existing server-side rendering still validates changed text and may reject it, with the result now visible. The compatibility repair addresses image-only edits of the known legacy versions without weakening new hook layout rules.

## Rollout requirements

Deploy the web code and rebuilt Carousel worker together, then apply the warm-instance setting to the current worker service. Do not blindly apply the existing ignored Terraform variables file: its worker image digest predates the production revision examined here. Reconcile the worker image with the intended release first. After rollout, verify an authenticated image replacement and its rendered output on `https://www.getugcpilot.com`, then measure queue/processing times and confirm the warm configuration. No production edit, database mutation, worker update or web deployment was made for these fixes.
