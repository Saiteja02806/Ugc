# Gemini result handling and starting-frame pricing

## Verified failure evidence

Read-only hosted operation inspection for jobs b4d21840-b2ff-4fbb-852b-64b271167848 and6e2a3d19-d0fb-4d23-b0a2-11f682c545fd confirmed saved provider operation IDs, failed state and generic incomplete error. Google GET of those same operation IDs returned status incomplete, no explicit error, and output_image.data. Strict Sharp decoding succeeded for both JPEGs:1536x2752,2038974and1953673bytes. No new image request was created. These diagnostics do not assess identity fidelity or explain why Google chose incomplete; they establish the application discarded usable encoded images based on status alone.

Worker change: incomplete plus final output_image.data is accepted only after strict full decoding; absent/corrupt data and failed states remain failures. Existing completed response path and operation-ID persistence retained. Image still requires the usual user review. This change does not resurrect the two already terminal failed jobs or restore their credits. No production state was mutated, and hosted credit/refund status was not checked.

## Price and button state

CODE CONFIRMED: price query retry=false plus undefined data always displayed Checking price, even after failure, with no retry UI. Local result actions now distinguish failure and expose Retry price. Existing cached valid cost still displays while refetching. Server-owned cost verification remains required. Unknown/running requests still block a new batch to prevent double charging; this fix does not claim every observed Generate delay has the same cause or remove pending-job protections.

60starting-frame UI tests PASS, including failed-price retry enabling Generate with zero image submissions.12Gemini worker tests PASS, including strict valid/invalid incomplete data handling, operation recovery with no resubmission and ordered source/identity input labels. Worker build, application TypeScript, scoped lint and diff check PASS. Browser layout/live acceptance NOT TESTED. No paid generation, deployment or job rewriting.

Files changed for this request: components/explore/hook-starting-frame-workspace.tsx, scripts/hook-starting-frame-ui.test.mjs, worker/src/lib/gemini-image.ts, worker/src/lib/gemini-image.test.ts, EXPLORE_CONTEXT.md, docs/ai-context/clear.md and this receipt. Existing unrelated work preserved. Preflight PASS; same-session context-memory/immutable-contract/UI-clarity/starting-frame/regression procedures and Supabase read-only audit procedure applied. Incidents UGC-VID-041 and UGC-UI-078-PRICE updated append-only.

Rollback boundary: incomplete-image decoding branch and price error/retry presentation only. Original prompts, selected identities, frame timestamps, request IDs, other models and scheduling unchanged by patch inspection. Worker and web require release for these fixes to affect new live requests.
