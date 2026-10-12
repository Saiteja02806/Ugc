# Audio plugin distribution candidate — 12 October 2026

Full application parity remains unfinished. Plugin 0.1.9 is a distribution candidate stacked on saved-audio import PR #43; it does not activate backend capabilities, change private storage policy or prove a customer workflow. Production remains the prior 33-tool release and public 0.1.8 download until a coordinated release.

## Package behavior

The existing ten skills now route requested speech/private audio to a focused audio reference in media management. The package includes the exact actual-byte-tested audio transfer helper as `skills/manage-ugc-media/scripts/transfer-audio.mjs`. Voice selection/bookmarks, speech cost/model/voice checks, saved request recovery, local exact/reference uploads, verified private downloads and independent eligible audio-to-video imports use discovered tools and live capability gates. A package update cannot enable a missing server feature.

Stable client UUIDs and exact inputs are saved before submissions. Upload receipts contain no signed URL/OAuth credentials and are not proof of accepted bytes. Speech/output IDs, client request IDs and private audio IDs remain distinct from ready finisher media attachments. Voice references/free tests cannot become video audio. The reference discloses the current default public editing copy while its original remains private, and rejects private-policy fallback. Deletion instructions target only the user's requested independent copy. No audio sample/generation is used for connection checks.

The existing Edit workflow now explains `get_operation.edit_export_request_id` recovery already released in production. Existing visual transfer/finishing instructions are retained. A Claude.ai connector cannot run a local Node helper; terminal-capable Codex/Claude Code requires actual process/file access and its own authenticated account connection.

All three compatibility manifests use version 0.1.9. Source, ZIP, checksum and standalone guide are coordinated. The setup page points to the three new downloads. Older versions are preserved; public directory approval and a review recording remain separate unfinished requirements. Five new evaluation scenarios specify expected routes; they are criteria, not host behavioral passes.

## Verified artifacts and checks

- ZIP: `public/downloads/ugc-pilot-0.1.9.zip`, 112705 bytes, 37 files, ten skills. SHA-256 `16a171c466f29e476f5a326c0525e0cfe586931a7c0fb233c1893f0c28a9e435`.
- All 14 older archive/checksum/guide download artifacts retain their pre-change SHA-256. No existing release bytes were rewritten.
- Seven package metadata/schema/resource checks passed. The validator also enforces normalized byte equality between the packaged audio helper and the implementation covered by shared actual-byte audio tests.
- Five deterministic package-builder checks passed, including real execution of the helper extracted from the ZIP: measured WAV hash/size, stable saved request recovery, duplicate receipt refusal and no persisted URL. These local files are disposable test fixtures, not customer audio or network transfer.
- TypeScript, touched-file ESLint, helper syntax and Next.js production build passed, exit 0. Build uses only inspected synthetic public Firebase values. No secrets were read.
- Full 46-tool MCP and actual decoder/SQL regressions passed locally and in the parent exact-source Linux CI recorded in PR #43. This package change has separate exact-commit remote CI pending at review creation.

The primary root holds only matching evidence/audit updates. Package implementation lives in the attached isolated checkout. `.tmp` helpers/logs/hash manifests and build/cache output are excluded from release; generated versioned public downloads are included intentionally.

## Still required

Coordinated migration/backend/website release, live catalogue/capability checks, exact served download checks, installed private plugin/IDE package refresh, Claude Code sign-in/OAuth, and an intended real hook → demo → finished local download workflow in both IDEs remain pending. The two import RPCs are absent from production. No bucket/IAM activation, global private-media cutover, customer transfer, paid generation or render occurred.

Sample delivery/default music, clone/verification/removal, wider generation/draft/editor/reference features, slideshow rendering, Trending/Carousel, Library, business/settings, social publishing and analytics remain in the [main audit](mcp-remaining-work-audit-2026-10-11.md). This candidate makes audio operations usable from an IDE once released; it does not establish complete application access.


## Review, remote checks and production approval

Draft PR https://github.com/Saiteja02806/Ugc/pull/44 is stacked on PR #43. Package/runtime commit `f0147361e2fb4200c533764396f2d7823882263d` matches the pushed remote. Both exact-commit Linux workflows succeeded: https://github.com/Saiteja02806/Ugc/actions/runs/38266966578 and https://github.com/Saiteja02806/Ugc/actions/runs/38266958103. They run the full MCP suite, seven package checks, five builder checks and application/worker production dependency audits. PR #43's documentation head `21deb6b10ac455f360856acef3fb214b2671fca1` also has successful MCP/migration guard status. No inline review comments were returned for either PR; this is not a claim of independent behavioral acceptance.

The release verifier now includes the prior 0.1.8 archive/checksum and every older standalone guide, in addition to the new version. Those hosted checks remain pending deployment; a syntax check is not a production pass.

Automatic approval review rejected applying the new import migration: the prior explicit authorization covered PR #39, not this new production schema change. No migration ran and no indirect execution/workaround was used. The user has been asked to authorize this exact reviewed migration and the coordinated backend/plugin release with new imports and private uploads disabled. Until that response arrives, production release work remains pending. This is separate from Claude Code sign-in and the broader unimplemented application domains.

Approval follow-up: the human chose “Approve migration and gated deployment.” Migration `20261012150824` is now applied with matching source body hashes and service-only invoker privileges. No rejection bypass occurred. Application/MCP deployments will preserve `MCP_AUDIO_VIDEO_IMPORT_ENABLED=false` and `MCP_PRIVATE_UPLOADS_ENABLED=false`; no customer transfer/generation/render, bucket/IAM or media migration is authorized by this release. Final verifier-follow-up CI at `d3677a619bdcdcf339c11a947ef19337b90ee6ca` passed in runs `38267518442` and `38267514206`.


Production baseline preservation: immediately before promotion, authoritative domain inspection found a newer release `4d7947a62b783a93f37d2bc3ceefdc0c1132b1e1` on both website and MCP. Website alias maps to `dpl_APkxhGiNzNPGiAWBezoc1zPWgD9W` (`ugc-amwvs6q7u-ugcpilot.vercel.app`); MCP maps to `dpl_FoAACavGxABJ5mZBRvZ796gLEfSr` (`ugc-7hi8zv01h-ugcpilot.vercel.app`). This supersedes the earlier export-history runtime baseline. The isolated audio branch is merging this production release so no newer application/migration/font changes are reverted. Only two evidence-document conflicts arose; the newer audio records were preserved. The imported-audio fixture now reads the production-reconciled existing audio constraint filename, without changing its SQL.

The already-created stages `dpl_G75Y3uJNv7TB4vKWsYysm9pFPPSv` (website, READY) and the pending MCP stage were built from pre-merge `c499e9c9ec7816a1cad24e05ca00a8dac9a73cfd`. They must not be promoted because they do not include the new production baseline. Revalidation and replacement stages from the merged commit are required. No custom production domain was promoted by this task, and the approved import migration remains applied. The worker is not redeployed in this audio release.

Merged release validation: preserving production `4d7947a62b783a93f37d2bc3ceefdc0c1132b1e1`, the full MCP suite (including all 24 audio import SQL/service/decoder checks), TypeScript, scoped ESLint, Next production build, worker build, seven plugin checks and five deterministic builder/extracted-helper checks all completed with exit 0. The feature delta against production passes whitespace validation. Incoming production documentation has inherited blank lines at EOF; no unrelated source was edited to remove them. Both pre-merge stages are now READY but superseded: website `dpl_G75Y3uJNv7TB4vKWsYysm9pFPPSv` and MCP `dpl_2RHvCDjgjDWgg8CgySSUYjhHjpwF` must not be promoted.

Current status supersedes earlier pending-approval/missing-RPC paragraphs: approval is received and the migration is applied. Remaining release steps are replacement merged-source builds, exact-commit CI, gated promotion, served artifact/auth/isolation checks, catalogue refresh and independent intended IDE acceptance. PR #44 will compare the complete audio release directly to the preserved production branch.
