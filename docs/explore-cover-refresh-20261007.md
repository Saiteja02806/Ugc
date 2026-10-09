# Explore workflow 2 cover refresh

The replacement WOT clips supplied on October 7 are incorporated in
`public/explore/covers/recreate-v4.mp4`, with its WebP poster and JSON manifest.
The existing Explore catalogue and renderer select the new version in this
workspace. Playback order, card layout and workflow behavior are preserved.

A release-ready copy of this scoped change is isolated on
`codex/explore-cover-refresh-20261007` in
`.tmp/explore-cover-refresh-20261007`, based on `origin/main` at `9390357`.
It contains the catalogue update, backwards-compatible renderer options,
three cover assets and documentation. This avoids carrying the primary
workspace's unrelated changes into a future scoped release.

The cover passed full decoding and isolated desktop/mobile browser media
checks. Original source hashes were unchanged. Review frames, screenshots
and results are in `.tmp/explore-cover-refresh-review-20261007`.

Nothing has been pushed or deployed. See `docs/explore-launch-cards-design.md`
for the exact source hashes, framing and reproduction command.
