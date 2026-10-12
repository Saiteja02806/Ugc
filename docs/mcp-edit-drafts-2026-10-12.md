# Existing Edit draft MCP capability — 12 October 2026

Status: implemented and verified locally; production migration/deployment and authenticated host acceptance are pending. Source registers 29 tools; the existing production release has 26. The complete agent-first application objective remains unfinished.

## Selected scope and behavior

The user chose existing Edit-page drafts as the first saved-draft implementation. `list_edit_drafts`, `get_edit_draft`, and `update_edit_draft` use the same owner-scoped `editable_videos` records as the website. They support the dedicated editor's trim range and up to three text blocks, including unfinished blank text. They do not create new projects, render, generate, delete drafts, or replace Explore/slideshow draft persistence.

Read tools require `assets:read`; saving requires the existing `creative:write` grant. Caller-supplied account identity and unsupported fields are rejected. Responses omit canonical/private media URLs, storage keys, raw render IDs and owner identifiers. A ready owned supported source ID can be resolved separately through `get_asset`.

The additive `edit_draft_revision_safety` migration adds a working-draft revision, an update trigger, service-only save receipts, an owner pagination index and two service-only invoker RPCs. A save locks the owned row, checks the expected revision, and commits the update and receipt together. Replaying identical inputs returns the originally accepted snapshot and never restores it over later edits. The browser resolves an ambiguous save before sending newer edits; conflicts preserve local editing state and require explicit reload/reconciliation. Old editor tabs without revision/request data receive a reload message instead of overwriting another session.

`edit_queue_render_snapshot` commits render queue status and the immutable job snapshot together. It preserves the current working draft. Existing terminal-render logic continues to mark a differing current draft as unfinished after an older snapshot renders. No worker or billing change is included.

## Verification

- Complete `npm run test:mcp` passed, including actual HTTP discovery of all 29 source tools and prior generation, finishing, upload and operation regressions.
- Five database tests execute the real baseline tables/finalizer and new migration in PGlite: conflicting editors, exact lost-response replay, ownership/deletion/source guards, unchanged content, immutable rendering and failed insertion rollback, revisions, RLS and service-only permissions. PGlite's queued calls do not establish hosted multi-session concurrency.
- Eight service/tool/browser tests include the actual website GET/PATCH adapters and MCP handlers against one mocked REST store, scoped identity/cursors, safe responses, blank content, correction of rejected drafts and browser recovery. These are offline tests, not production account acceptance.
- TypeScript and targeted ESLint passed. Twelve existing private-media, Creative Assets display and terminal-render regressions passed. Migration reconciliation guard and six parity tests passed.
- Local Next.js production build passed with synthetic public Firebase configuration; the first build without public configuration stopped at `auth/invalid-api-key`. Hosted builds must use their existing real environment.
- `edit:boundary:check` fails an existing Creative Assets/influencer catalog assertion on both exact pre-feature HEAD sources and the candidate. This feature does not change those files; the unrelated failure remains unresolved.
- Production preflight confirmed the existing schema, no public/authenticated Edit RLS policies, and no pre-existing new revision/functions. No production draft was changed and no video/provider job was generated or rendered for these tests.

## Remaining work

Apply the exact reviewed additive migration and verify privileges. Stage website and MCP from one reviewed commit; verify hosted builds, then promote the website before MCP. Verify production aliases, authenticated discovery and account reads. Customer edit/reopen/recovery acceptance in Codex and Claude remains required. Explore hook/demo composition drafts, slideshows, public plugin distribution and the other application capabilities remain separate unfinished work.
