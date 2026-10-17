# Publishing and Talking Head release — 17 October 2026

This release preserves production main 683d750c and all 244 intentional paths
in the current workspace inventory. 182 paths already match production; 62
pending paths contain the Talking Head reference gallery, shared Create/Demo
overview, demo original-sound controls, complete TikTok icon, and automatic JPEG
publishing preparation, retry-budget and schedule status corrections.

The publishing status migration 20261017105341 is already applied. Do not replay
it or retry old posts as deployment validation. The reported Instagram success
is retained; TikTok is Failed and the parent Partially failed.

Preflight: isolated worker build and 86 tests, 114 targeted workflow/database
checks, 10 MCP finishing checks, TypeScript and scoped lint passed. The actual
full Talking Head browser fixture passed laptop/mobile tabs, previews, demo
controls and TikTok icon bounds without API writes. Hosted builds remain required.

Release website/MCP from the exact commit with domains held. Build an immutable
worker image from that commit, deploy all six worker services and update the two
worker jobs without executing them; preserve all runtime settings. Verify image,
identity, readiness, traffic and domains before declaring success. No paid media
or publishing is performed as release verification. Authenticated customer-flow
acceptance remains separate from build and public boundary checks.

No intentional path is excluded. Ignored local-only paths remain outside Git:
.env* (except tracked .env.example), .tools/**, .tmp/**, .vercel/**,
.release-worktrees/**, node_modules/**, worker/node_modules/**, .next/**,
worker/dist/**, *.tsbuildinfo, logs, generated previews, private Terraform state,
variable/plan files and Supabase local state. These are credentials, local tools
or generated artifacts. Exact manifests and observed deployment receipts are in
.tmp/tiktok-publishing-release-20261017/.
