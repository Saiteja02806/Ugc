# Upload recovery draft — 11 October 2026

The released production server has nineteen tools. Upload recovery is now implemented in the isolated `codex/mcp-upload-recovery` branch. Its source registers twenty-two tools. Production migration/release and installed-host acceptance remain pending. Earlier draft files in `.tmp/mcp-recovery-candidate/` are working notes; the isolated checkout is authoritative.

## Intended behavior

- Optional stable `request_id` on `create_upload` prevents duplicate reservation after a lost response. Owner-scoped database replay uses the same asset/key; changed inputs conflict, and deleted reservations cannot be resurrected. Legacy requests remain supported.
- `get_upload` accepts exactly one owned upload ID or request ID. `list_uploads` discovers pending reservations, including legacy ones, using bounded signed owner/filter pagination. Responses exclude URLs, keys and raw metadata.
- `renew_upload` preserves the reservation and returns a create-only link. Ready/deleted/foreign uploads are rejected. Existing bytes or storage uncertainty direct the client toward confirmation rather than another PUT.
- A database URL lease is allocated before signing. Deleted-upload cleanup honors the last lease; renewal cannot acquire a lease after deletion.
- Confirmation downloads bounded bytes from the already owner-checked storage key into a temporary directory and probes their actual container, dimensions and duration using ffprobe. It accepts no caller-supplied source URL, executable path or shell command. Private-media rollout support remains separate.

The migration was created with `supabase migration new mcp_upload_recovery`, producing `20261011150832_mcp_upload_recovery.sql`. It adds a unique owner/request index, a pagination index and service-role-only invoker RPCs while preserving existing quotas and legacy creation behavior. The cleanup function retains its service-role-only grants and now runs as invoker. PostgREST filters use the matching metadata expressions so the indexes apply.

## Evidence and limits

Six local offline checks passed against the saved candidate: five database tests using the real baseline media table and existing upload quota SQL, plus one actual-byte probing test. They cover same-ID replay at quota, account isolation, input conflict and deletion, URL lease ownership/state, invoker grants, cleanup respecting a live lease, and probing local MP4/PNG fixtures with rejected mismatches/private media. No production media was uploaded, generated, rendered, registered or deleted.

The integrated implementation passed the complete MCP regression suite, five actual-baseline database recovery tests, six recovery service/tool tests and a real-byte server-probe fixture. Tests cover read/write permissions, trusted ownership, strict input schemas, hidden internal metadata, account/filter-bound signed cursors, lost signing-response recovery, unchanged reservation identity, no overwrite/renewal of committed bytes, storage uncertainty, false client dimensions, concurrent confirmation recovery and private rollout failing closed. Confirmation stores server-measured duration with a 50 ms tolerance for client probe differences.

The full Next.js 16.3.8 production build generated all 153 static pages and passed TypeScript. Its MCP trace includes the Linux ffprobe binary. A final correction uses that explicitly traced binary path instead of an untraced dynamic package import; the actual default path fixture and full TypeScript passed after the correction. Hosted release validation remains required for that final source. Local build configuration forwarded only six existing public Firebase values, with generation/finishing disabled.

Plugin source is now 0.1.5. `prepare` saves a stable request ID and exact normalized creation inputs in an exclusive non-secret intent receipt before MCP reservation. `recover` distinguishes reservation intents from transfer/confirmation receipts. Thirteen actual-byte transfer/helper tests, seven package/schema tests and three deterministic package-build tests passed. The package validator now checks all twenty-two source tools, including Demo and recovery tools. Public downloads and installed plugins were not changed.

Read-only production preflight confirmed no recovery migration, request-key metadata or URL-lease metadata exists yet; RLS and required service-role table/RPC access remain enabled. Security advisors reported an INFO-only existing RLS-policy notice. These checks do not establish hosted concurrency, production storage probing or installed Codex/Claude execution. No production media operation or paid generation was submitted.

An earlier automatic approval review failure prevented the initial copy/type-check command because of an account usage limit. On the next continuation, normal approval review succeeded; the checkout was revalidated before integrating the saved draft. The boundary was not bypassed.

Next steps are the scoped review PR, remote checks, additive migration/catalog verification, staged production MCP build, promotion of that exact tested build and fresh authenticated discovery. Installed-host operation remains distinct from deployment/discovery. The broader application-access goal remains unfinished as recorded in `mcp-remaining-work-audit-2026-10-11.md`.
