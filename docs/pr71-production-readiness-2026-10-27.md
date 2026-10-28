# PR #71 production-readiness audit — 27 October 2026

**Decision: source-validated candidate; not ready for a production release or a claim of complete agent-first application access.**

Audited [PR #71](https://github.com/Saiteja02806/Ugc/pull/71) at `729cc229102979fec2816d140a3fad97c7eefbdf`, base `adbfe49856f79d682fa7acc34aef281a32116296`. It is open, draft and mergeable. The API returned no review submissions or inline review threads; a green draft-skipped automated review is not reviewer approval. This audit changes documentation only. It does not authorize infrastructure work, enable features or change customer accounts.

## What this PR actually contains

Independent catalogue and package validation agree: **0.2.9 / 106 unique registered tools / 18 skills / 47 package files**. The committed ZIP and checked-out ZIP have SHA256 `409411370c124c6337570501068fde1f5d6a7f0fe737fd710ec621a6376b733c`. The [machine-readable inventory](pr71-release-manifest-2026-10-27.json) binds tool names, package-file hashes and all 158 migration-source hashes to this exact commit. These source hashes are not a current database attestation.

| Workflow | Included in this candidate | Remaining acceptance or scope limit |
| --- | --- | --- |
| Connection, account, plan, credits and owned-media reads | OAuth/PKCE/CIMD, owner-scoped tools, install-time auth policy | Clean installed-client sign-in, consent, callback and safe read in both hosts remain unverified |
| Image/video generation and job recovery | Three generation/job tools; operation discovery/cancel/retry | Actual candidate provider completion and recovery are not established by fixtures |
| IDE hook/demo upload and transfer | Upload, verification, renewal, Demo registration and packaged transfer helper | Private upload infrastructure/gates and real candidate bytes/ownership acceptance remain separate requirements |
| Hook plus Demo finishing | Capability, finish and receipt tools; trim/text/framing through existing contracts | Real candidate render/download not yet accepted |
| Edit drafts and export | Open/list/read/update and capability/export/status | Candidate persistence/reopen/export through an installed host still needs acceptance |
| Audio | Eleven speech/audio tools plus two video-audio import tools | Discovery does not enable speech, upload or import; each runtime/gate/provider dependency must be verified |
| References, remix, groups and Library | Six reference/remix, eleven group and ten Library tools | Enabled writes depend on capability/configuration; Library saving does not establish slideshow rendering parity |
| Account defaults | Six tools | Writes are separately scoped/gated; this audit changes no default |
| Business context, onboarding and logos | Seventeen tools plus two packaged business skills | Migration/gates, revision-bound recovery and normal consent still require matching hosted acceptance |
| Social connections and scheduling | Five tools: capabilities, existing connections, schedule list/read, gated future schedule creation | No provider connection handoff, edit, cancel, retry or publish-now tool in this PR |
| Social analytics | Five tools for capabilities and persisted reports | Provider refresh is outside this candidate |
| Important-action confirmation | Twelve tools preview before execution | Cross-isolate single-use enforcement needs durable storage enabled and verified on the actual deployment |

This is substantial core media functionality. A tool total is not a percentage of full product completion.

## Fresh release and hosting evidence

All five current GitHub check-runs pass: MCP, preserved-application, migration reconciliation, completed-video delivery and preview feedback. See [current exact-head checks](https://github.com/Saiteja02806/Ugc/pull/71/checks). The actual website preview `dpl_B4ES5dBLJX6uAvffRiGTsdmWJDNm` is READY at the audited head. The duplicate `trending-release-web-3f35202` deployment is intentionally CANCELED/ignored, not a repaired application build.

The deployment inventory filtered by the audited SHA contains the website preview and ignored duplicate only. No matching MCP deployment is listed. The dedicated staging projects still serve `dpl_GRpot4pMX791gUzQmaTYeg3nYaUr` (web) and `dpl_2odWChptPekvVbt3qWZNhD6F579f` (MCP), older snapshots with no exact-candidate Git metadata. Anonymous staging health returns HTTP302. This demonstrates deployment protection, not successful native MCP access.

Fresh production reads show:

- MCP deployment `dpl_6jMPY2yfUg9CV51EFPcXxM4Nv5QR`, READY, reported source `adbfe49856f79d682fa7acc34aef281a32116296`.
- Health reports `ready`; issuer metadata advertises PKCE S256 and CIMD; anonymous MCP returns its OAuth HTTP401 challenge.
- Protected-resource discovery advertises nine scopes, excluding candidate `brand:write`, `analytics:read`, `publishing:read` and `publishing:write`.
- `https://www.getugcpilot.com/connect-ai` redirects to the apex; the apex returns HTTP200 and a **0.2.0** bundle link.
- Consequently, the candidate's existing public OAuth preflight fails against production at `Saved analytics scope is not advertised`. This is a meaningful release mismatch, not a tested candidate failure.
- Website production is `dpl_7RCmDsbfGBjZsX8E3M78p15keGgE`, CLI source, with the same reported base SHA. Recent separate release receipts describe changes beyond that Git base. A CLI deployment's Git SHA alone does not prove its uploaded bytes equal that commit. Reconcile those released hotfixes before replacing the live website with a PR build.

The [26 October schema receipt](pr71-remaining-issues-2026-10-26.md) records UGC test reconciled to 160 versions (158 candidate migrations plus two preserved extras), 155 RLS tables, exact source-hash readback, unchanged existing row counts and rollback-only security/replay checks. This audit inspected that receipt, not the database again. Do not recreate staging, reset it or blindly replay SQL.

## Work that is outside this PR

The older unfinished `.tmp/mcp-analytics-read-20261018` checkout contains these files; the audited PR tree does not:

- `lib/mcp/social-connection-tools.ts`: three connection-handoff tools.
- `lib/mcp/schedule-action-tools.ts`: six action/capability/receipt tools for edit/cancel/retry/publish-now.
- `20261023052240_mcp_social_connection_requests.sql` and `20261023073218_mcp_schedule_actions.sql`.
- `lib/mcp/client-metadata-retry.test.ts` and the changed resolver in `lib/mcp/clients.ts`.

The PR resolver is identical to its base. The earlier retry patch is a locally tested resilience improvement; the original live invalid-link cause remains unconfirmed. Do not silently combine these older changes with the PR: their registry, scopes, confirmation behavior, migrations, tests and newer application callers must be reconciled first. Their deployment-wide gates are not an account-only rollout mechanism.

Full social lifecycle, provider analytics refresh, advanced generation controls, avatar parity and server-rendered slideshow workflows remain development work beyond this candidate. Consolidating tools or adding another broad feature before accepting this release would increase the validation surface.

## Existing real-media evidence, kept separate

The older checkout's `docs/live-agent-acceptance-2026-10-24.md` records a successful existing-production-account workflow: last one second of the selected Hook, first one second of the selected Demo, then composition and local download. Its final receipt is `0d392907-7189-430e-a5a7-a53f377eb1c4`, output `881c9c42-9699-4d66-bdff-ae53de9b25dd`: 866,952 bytes, two seconds, 720x1280, H.264/AAC, SHA256 `e2a50af04fa78c7ebc302e9c40b66387ce4d8d01ecff6798b93f6b86702df0ad`. The local output, receipts and frame evidence still exist there.

Its follow-up receipt records two successful normal Codex CLI logins. Those were repeat logins on an existing installation; chat tools were not proven to use the new CLI token. Neither receipt proves clean Codex installation, Claude Code acceptance, a new upload/generation, all tools, or this PR's confirmation flow. No media task was repeated during this audit.

## Most important next gap: one exact release through the real host

1. **Freeze scope and reconcile provenance.** Use this commit/archive inventory as the starting candidate. Inventory released website hotfixes that must survive; any source adjustment creates a new candidate and requires fresh exact-head checks. Keep social/action and speculative sign-in follow-ups separate unless explicitly included in the reviewed release.
2. **Build a matching pair in the existing staging projects.** Verify staging-only exported configuration before build using the existing isolation checker. Preserve protection; establish a supported native-client access route. A browser SSO session or health screenshot does not prove a native MCP client can connect. Do not put a temporary bypass secret in the shipped plugin or disable production protection.
3. **Verify deployment bytes and identity.** Bind website and MCP deployment IDs, Git/source inventory, package checksum, issuer/resource, schema and runtime targets. Discover the 106 tools from the authenticated candidate. Configure and prove durable confirmation storage before accepting single-use behavior across instances. Keep unrelated feature writes disabled.
4. **Perform clean install acceptance in both hosts.** Use a disposable client profile and the normal sign-in/consent UI. Record host/package version, callback completion, actual granted scopes and a safe owned-account read made by that client. Do not extract credentials to correlate a different connection. Test declined consent, missing scope, expired auth and reconnect without submitting media.
5. **Then perform one bounded media workflow.** Use the user's already selected short owned Hook/Demo inputs, a stable request UUID per stage and candidate receipt recovery. The new important-action preview must not dispatch work; execution requires the user's actual confirmation. Verify download bytes/hash, duration, order and saved receipt. No social posting. If staging workers/storage are unavailable, record that boundary and obtain a concrete plan for the exact live candidate; fixtures or the old production result do not fill it.
6. **Review and release separately.** Confirm current production migration differences read-only; do not assume staging history equals production. Only after host acceptance and review should an exact production migration/build/promotion plan be approved. Recheck the actual public bundle, issuer and capability gates after release. Public directory submission additionally needs the review recording and platform approval.

No additional database is needed. The immediate task is release alignment and acceptance, not another platform redesign.

## This audit's verification and change receipt

- Fresh local PASS: catalogue check (106), package validator (0.2.9/47/18/106), catalogue/isolation/plugin regressions **24/24**, Python archive suite **9/9**, confirmation contracts **4/4**. ZIP hash matches committed source.
- Fresh hosted reads: PR head/base/draft/checks/reviews, exact-source deployment inventory, dedicated staging inventory, live website/MCP deployment metadata, public health/discovery/challenge/download redirect/version.
- Restricted-shell public preflight initially could not resolve DNS. Network-authorized rerun reached production and failed the candidate scope assertion above; the unmodified test was not weakened. A separate bounded read gathered the remaining public evidence.
- Sources actually inspected: user-supplied AGENTS instructions; root nonnegotiables; context-memory, immutable-contracts, regression-gate and plugin-update skills; relevant root ledger/Explore sections; candidate context and both 26 October receipts; registry/catalogue/scopes, confirmation implementation/tests, scheduling implementation/skill, package/manifests/allowlist, public setup/health/OAuth preflight, CI workflow; older live acceptance and sign-in receipts. The full large Explore and incident histories were **not** reread; no application-code edits were made.
- Documentation changes: this audit, the JSON release inventory, and the current section in `docs/ugc-pilot-plugin-context.md`. Root incident ledger receives an append-only UGC-OPS-005 follow-up. Historical entries and all unrelated dirty work remain intact. No new incident ID or root-cause claim is invented for the known release drift.
- Protected behavior: runtime code/package bytes unchanged **VERIFIED by diff/hash**; production mutations/publication absent **VERIFIED for this audit**; new UI, source/identity behavior, scheduling delivery and host/provider end-to-end behavior **NOT TESTED**.
- Rollback: remove only this audit's documentation additions/current-section update if unwanted. No data, infrastructure or application rollback is needed. These documentation changes remain local until separately committed/pushed.
