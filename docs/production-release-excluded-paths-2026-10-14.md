# Excluded release paths — 14 October 2026

Only generated local QA files in `outputs/` are excluded from the visible worktree changes. They remain on disk. Product source, scripts under `scripts/`, fonts and documentation are included.

| Path | Reason |
| --- | --- |
| `outputs/check-reference-duration.cjs` | Generated local test, screenshot or diagnostic artifact; no production runtime role. |
| `outputs/demo-editor-preview.jpg` | Generated local test, screenshot or diagnostic artifact; no production runtime role. |
| `outputs/demo-picker-preview.jpg` | Generated local test, screenshot or diagnostic artifact; no production runtime role. |
| `outputs/mcp-hook-demo-test-2026-10-13.mp4` | Generated local test, screenshot or diagnostic artifact; no production runtime role. |
| `outputs/reference-duration-hook-1342.png` | Generated local test, screenshot or diagnostic artifact; no production runtime role. |
| `outputs/reference-duration-wall_text-1342.png` | Generated local test, screenshot or diagnostic artifact; no production runtime role. |
| `outputs/reference-tile-multiple.png` | Generated local test, screenshot or diagnostic artifact; no production runtime role. |
| `outputs/reference-tile-single.png` | Generated local test, screenshot or diagnostic artifact; no production runtime role. |
| `outputs/reference-tiles-updated.png` | Generated local test, screenshot or diagnostic artifact; no production runtime role. |
| `outputs/reference-tiles/hook-1342-image-video.png` | Generated local test, screenshot or diagnostic artifact; no production runtime role. |
| `outputs/reference-tiles/hook-1342-multiple.png` | Generated local test, screenshot or diagnostic artifact; no production runtime role. |
| `outputs/reference-tiles/hook-1342-single.png` | Generated local test, screenshot or diagnostic artifact; no production runtime role. |
| `outputs/reference-tiles/hook-390-image-video.png` | Generated local test, screenshot or diagnostic artifact; no production runtime role. |
| `outputs/reference-tiles/hook-390-multiple.png` | Generated local test, screenshot or diagnostic artifact; no production runtime role. |
| `outputs/reference-tiles/hook-390-single.png` | Generated local test, screenshot or diagnostic artifact; no production runtime role. |
| `outputs/reference-tiles/remove-check-failure.png` | Generated local test, screenshot or diagnostic artifact; no production runtime role. |
| `outputs/reference-tiles/talking-head-1342-multiple.png` | Generated local test, screenshot or diagnostic artifact; no production runtime role. |
| `outputs/reference-tiles/talking-head-1342-single.png` | Generated local test, screenshot or diagnostic artifact; no production runtime role. |
| `outputs/reference-tiles/talking-head-390-multiple.png` | Generated local test, screenshot or diagnostic artifact; no production runtime role. |
| `outputs/reference-tiles/talking-head-390-single.png` | Generated local test, screenshot or diagnostic artifact; no production runtime role. |
| `outputs/reference-tiles/wall_text-1342-image-video.png` | Generated local test, screenshot or diagnostic artifact; no production runtime role. |
| `outputs/reference-tiles/wall_text-1342-multiple.png` | Generated local test, screenshot or diagnostic artifact; no production runtime role. |
| `outputs/reference-tiles/wall_text-1342-single.png` | Generated local test, screenshot or diagnostic artifact; no production runtime role. |
| `outputs/reference-tiles/wall_text-390-multiple.png` | Generated local test, screenshot or diagnostic artifact; no production runtime role. |
| `outputs/reference-tiles/wall_text-390-single.png` | Generated local test, screenshot or diagnostic artifact; no production runtime role. |

Existing ignored secrets/local environment files, `.vercel/`, `.tmp/`, `.next/`, `node_modules/`, `worker/node_modules/`, `worker/dist/`, TypeScript caches and Terraform credentials/state/provider caches are also excluded. `.env.example` is included because it contains safe configuration examples.

## Additional ignored QA logs

- `outputs/explore-action-audit-audio-transport-tests.log` — generated local diagnostic log.
- `outputs/explore-action-audit-final-lint.log` — generated local diagnostic log.
- `outputs/explore-action-audit-final-targeted.log` — generated local diagnostic log.
- `outputs/explore-action-audit-final-tests.log` — generated local diagnostic log.
- `outputs/explore-action-audit-final-video-tests.log` — generated local diagnostic log.
- `outputs/explore-action-audit-full-tests.log` — generated local diagnostic log.
- `outputs/explore-action-audit-lint.log` — generated local diagnostic log.
- `outputs/explore-action-audit-slideshow-browser.log` — generated local diagnostic log.
- `outputs/explore-action-audit-targeted-tests.log` — generated local diagnostic log.
- `outputs/explore-action-audit-typecheck.log` — generated local diagnostic log.
- `outputs/explore-content-demo-tests.log` — generated local diagnostic log.
- `outputs/hook-reference-verification-20261013.log` — generated local diagnostic log.
- `outputs/reference-duration-browser.log` — generated local diagnostic log.
- `outputs/reference-duration-tests.log` — generated local diagnostic log.
- `outputs/reference-duration-video-tests.log` — generated local diagnostic log.
- `outputs/reference-remove-browser.log` — generated local diagnostic log.
- `outputs/reference-remove-lint.log` — generated local diagnostic log.
- `outputs/reference-remove-mobile-browser.log` — generated local diagnostic log.
- `outputs/reference-remove-typecheck.log` — generated local diagnostic log.
- `outputs/reference-remove-wall-mobile-browser.log` — generated local diagnostic log.

Changes on unrelated branches, including the isolated Business candidate, are outside this worktree release. Existing MCP experimental gates retain their recorded production settings.
