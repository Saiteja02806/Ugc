# MCP Business Context candidate — 13 October 2026

Branch: `codex/mcp-business-context`. Base: deployed account-settings source `21866e2287501bf5b13b355a2fa103c0258a8afc` (PR #50). This candidate adds six tools to the released 79-tool contract. Its 85 source registrations are not evidence of deployment or installed-host acceptance.

## Behavior

The tools read active Business Context and the shared Settings draft, save unfinished context, apply reviewed context to a new active profile version, and recover accepted changes through immutable owner-scoped receipts/history. Reads never initialize onboarding, analyze a website or generate content. Save leaves active context/version unchanged. Apply uses the existing atomic `apply_business_context_v1` without replacing it, clears its draft, preserves existing primary goals and uses the shared factual-readiness/content-hash helpers.

Exact context revision, profile version and draft timestamp fence website changes. The context revision hashes the complete stored profile, including owner, goals and metadata. Durable receipts commit in the same transaction as the draft/apply. Lost-response recovery checks accepted raw intent before reading or normalizing against newer goals. Replay returns historical accepted state and cannot overwrite later website choices. History uses stable owner-bound cursors.

Writes require fresh `brand:write` consent and `MCP_BUSINESS_CONTEXT_WRITES_ENABLED=true`; the flag defaults false. Existing account/assets/creative/generation grants do not cover brand changes, and old refresh tokens keep their original scope set. Reads and recovery require `brand:read`. The website consent explains shared drafts and change receipts. Applying changes future content; existing media and today's already-pinned Trending pack keep their prior version.

The additive migration creates one RLS-enabled receipt table, a paging index and three service-only security-invoker functions with empty search paths. Anon/authenticated have no receipt-table access or RPC execution. Service receipt permissions are SELECT/INSERT only, including under default ALL table grants. Existing application tables, apply function, onboarding guard and worker code are unchanged.

## Verified locally

- Full `npm run test:mcp` passed, including six canonical PostgreSQL cases and six actual MCP SDK/PostgREST cases for these new tools.
- Tests cover website/MCP draft and apply parity, preserved goals, factual readiness, owner boundaries, stale/invalid rollback, lost acknowledgement after commit, immutable recovery after later goal/context changes, stable history and the permission matrix.
- All 20 existing Business Context, Settings and daily-feed version-policy checks passed.
- TypeScript and targeted ESLint passed. The complete Next build passed using existing public Firebase configuration loaded only into the build process. The first unconfigured build failed at Firebase initialization; no source workaround was introduced.
- Skill validation, seven plugin checks, five deterministic ZIP/extracted-helper checks and the migration reconciliation guard passed.
- All 23 earlier tracked download artifacts and both transfer helpers/MCP configs are byte-preserved (canonical LF for text). The built setup page points to all three new 0.1.13 artifacts and retains noindex.

Plugin candidate 0.1.13 has 15 skills and 42 allowlisted entries. ZIP: 126407 bytes, SHA-256 `b4baacfb7e82d6d1e62ad3098124b549722e78688d3f9401340241fabd5511cb`. The new Business Context workflow is portable; it does not activate a server feature, install itself or prove measured Claude execution. Evaluation cases are criteria, not measured host outcomes.

Migration `20261013112752_mcp_business_context.sql`: 6680 canonical LF bytes, SHA-256 `636a11250215c968c20267e87f508ceeccd7c4822a83961cb5aecc9fb6a283e6`. It is local and unapplied. Local fixtures do not establish multi-connection production race acceptance.

## Current production and remaining work

Production was rechecked through the existing authenticated Supabase MCP and both Vercel custom domains: website/MCP remain READY at `21866e2287501bf5b13b355a2fa103c0258a8afc`; 131 migration versions exist and this candidate receipt table is absent. No CLI sign-in is needed. This chat now exposes all 79 released tools, and actual native account capability/settings reads pass with writes disabled and existing timezone `Asia/Calcutta`. The earlier current-chat account-read gap is closed.

No Business Context migration, production deployment, gate activation, customer context mutation, media generation/render, provider analysis, social publishing, bucket/IAM change or worker release ran for this candidate. Production promotion/schema changes require separate authorization for the concrete release; prior account-settings approval does not cover this new migration.

Website reanalysis, onboarding/goal edits, logos/screenshots, broader generation/characters, Explore draft parity, backend slideshow text rendering, Trending/Carousel actions, social publishing, analytics and full installed Codex/Claude acceptance remain unfinished. The private account plugin is still 0.1.11; its update tool is unavailable in this session, while public 0.1.12 remains live. Existing gated features are still disabled. This candidate closes manual Business Context implementation only after release and acceptance; full application access remains the goal.

Ignored logs, temporary helpers, dependencies, credentials/local environment files and build output are excluded. Intentional unrelated primary-workspace UI/worker/infra/migration work is outside this isolated candidate and was neither reset nor included in its release.
