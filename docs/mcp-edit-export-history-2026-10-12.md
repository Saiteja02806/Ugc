# Recover saved Edit exports from operation history — 12 October 2026

## Problem and change

An agent could discover an owned Edit render using `list_operations`, but `get_operation` did not expose its saved export request UUID. The dedicated `get_edit_export` tool required that UUID. Also, the Edit worker reports a video URL; generic output-field scanning could not recover the immutable asset created by the export receipt's completion trigger.

The candidate adds nullable `edit_export_request_id` to the existing `get_operation` output. For a `render_edit_video` operation with the `edit-export:` identity, the shared export service validates the owner-scoped receipt, its job binding, frozen render payload and render identity. It uses the existing export status/output validation to return the exact owned ready immutable asset. Raw inputs, URLs, text, storage/provider details and receipt payload remain hidden. Reads do not submit, dispatch, retry or reserve credits, and remain available with creation disabled.

Legacy website renders retain their existing generic output behavior and return no export handle. Finishing handles remain separate. A malformed export key exposes no handle/output; a missing or mismatched receipt/render, corrupt payload or storage outage returns a sanitized retryable error. Pending, failed or cancelled work keeps a verified export handle without advertising an output. A removed/foreign/misidentified output is omitted.

No migration, additional OAuth scope, worker change, registration-count change or public plugin/archive update is required. Source registration remains 33. Agents can use the updated server description: list the desired final_render operation, read it, then pass its recovered `edit_export_request_id` to `get_edit_export` and retrieve the returned output with `get_asset`.

## Verification

Sixteen targeted operation/export adapter checks pass, including five new history recovery scenarios using the actual shared service and Supabase query code against an offline HTTP database fixture. The first fixture used a nonexistent history category; it was corrected to the application's existing `final_render` filter. Every recovery database request is read-only and owner-scoped; no dispatch occurred. Existing finishing, operation controls and dedicated export checks pass.

The complete npm run test:mcp suite, TypeScript, touched-file ESLint and Next.js 16.3.8 production compile passed. The production receipt table was checked read-only: RLS enabled, service_role SELECT allowed, anon/authenticated SELECT denied. CI and release verification are recorded below as they complete. Offline fixtures do not prove customer render/download execution. No customer media operation was submitted for acceptance. Wider full application parity remains unfinished.

## Release status

Candidate only. Production remains on `8cac394b4114306a3f35b4e66158f91f934b06d0`; the new history field is not yet deployed. Private upload creation remains disabled.
