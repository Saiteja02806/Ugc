# Explore scheduling and video preparation — October 10, 2026

## Changes

- Selecting a platform selects its sole eligible connected account after the
  authenticated lookup completes. Multiple eligible accounts remain a choice;
  blocked accounts are never selected. Existing selections and an explicit
  deselection stay intact while the control is mounted. This shared control
  serves Hook, Phone, Wall of Text and Slideshow scheduling.
- Finishing continues checking the same receipt if the completed video's media
  lookup fails. Focus, visibility and reconnect events retry that lookup.
  Status, output and cancellation requests have a 30-second network timeout;
  no timed-out request automatically creates another render.
- An unchanged Hook opening can use the authenticated ready MP4 directly.
  Its trim must match the authoritative complete duration, volume must remain
  100%, and there must be no visible text or added audio. The cross-tab lock
  and saved-request recovery run first. Existing receipts, actual edits, other
  containers and Wall of Text retain the rendering path. Hook/demo joining
  still renders one ordered final video.

## Production diagnosis

The completed Hook edit created October 10 at 01:09:31 IST waited 157.54 seconds
before worker claim, then rendered in 30.74 seconds. Its receipt completed and
the media asset became ready. The subsequent join created at 01:12:55 IST waited
117.94 seconds, then rendered in 15.36 seconds and also completed successfully.
Cloud Run execution conditions independently locate this delay before container
startup. Image import finished within about one second for these executions.

Seven completed Explore finishing jobs in the preceding day averaged 151.61
seconds before claim and 12.95 seconds of processing. The largest queue wait
was 189.58 seconds. These measurements prove startup latency; they do not prove
that the screenshot's browser missed a successful response.

The shared frontend did have a separate recovery gap: it marked the receipt
completed before fetching its media, and a failed media GET stopped polling.
The regression checks now exercise failure followed by successful recovery
without a new POST, for both Hook and Phone, plus browser-return recovery.

Hook and Phone finishing, Wall-of-Text exports, and demo joins use the same
one-shot Cloud Run video job. Slideshow saves persist images directly and do
not use that processor. Image/video generation has a separate provider path;
the one completed Hook generation in this sample started after 0.56 seconds
and ran for 30.70 seconds. This is a limited production sample.

## Remaining startup work

The video HTTP service is a compatibility receiver; production dispatch launches
one-shot jobs through the durable ten-slot gate. Warming that HTTP service would
not warm these job executions. Moving short renders to a warm service requires
preserving capacity leases, cancellation, idempotency, retries and long-render
fallback, and needs its own production canary. This change removes an unnecessary
unchanged-opening render and repairs result recovery; it does not claim that
necessary one-shot renders now start immediately.

No schema change, automatic posting or paid generation is part of verification.

## Verification and release scope

All 656 Explore regression tests, MCP checks, the production Next.js build and
scoped lint pass. The browser regression uses
the real editors and scheduling controls with isolated authentication, media and
publishing boundaries. It verifies one join for untouched Hook/demo inputs,
automatic selection of the sole Instagram account, two independently timed text
blocks before joining an edited demo, and immediate review for an unchanged
Hook-only MP4. No live social post is created.

The authenticated production browser flow cannot be accepted from the signed-out
test session. Production receipt and Cloud Run execution inspection provide the
latency evidence above; deployment checks separately verify real-domain health,
authentication boundaries and published package integrity.

All intentional source, test and documentation changes in this worktree are
included. Local environment files, `.tmp` verification output, build caches and
the superseded `.release-worktrees` checkout remain excluded because they are
local configuration or generated artifacts. The package verification script
normalizes CRLF/LF for checksum text while preserving exact archive-byte checks.
No worker, infrastructure or schema source changed since production commit
`3f352026e9ecefeba5877242738efdc65b3d86b1`; existing Cloud Run images and settings
remain appropriate for this application release.
