# Main functionality audit — 4 November 2026

Result: PARTIAL verification, not an all-workflows acceptance. Read-only live database inspection plus current-source local tests. No builds, development server, deployment, new paid generations, schedules or publication requests were started.

Database clock at final check: 2026-11-03T20:40:35Z (4 November 02:10:35 IST). Aggregates use the preceding seven days and all application accounts, not only the Trending pilot account. Historical successes are evidence of past execution, not a fresh end-to-end test of today's UI or credentials.

## Production evidence

| Function | Observed evidence | Acceptance boundary |
|---|---|---|
| Scheduling/publishing | 19 targets marked published: Instagram 8, TikTok 11. All 19 have saved provider IDs; 19 provider-operation records also have IDs. Media assets account for 13 targets and library items for 6. No overdue active scheduled/queued/publishing/retrying targets older than 15 minutes. | Recent backend execution supported; no new publication or external platform retrieval performed. No recent YouTube proof. |
| Schedule integrity | One recent parent has zero targets: e7fc84f1-fd29-46c8-a175-99b137ef8f55, created October 28, status failed. | Not falsely reported as scheduled/published. Cause UNKNOWN; requires investigation. Older failed targets also remain for media-format and authorization errors; those are historical, not proof of current failures. |
| Video generation | Eight generate_hook_video jobs completed, all tagged Hook. Eight ReAPI operations have output_persisted. Ten render_demo_video jobs also completed. | Hook backend success supported. This does not establish Talking Head, Text on screen, AI Studio video, every model or current UI coverage. |
| Image generation | 68 completed generate_image jobs: 54 Hook starting frames, 8 slideshow images, 6 character images. Ten failed image jobs are all starting frames. | Real outputs exist; universal reliability not established. |
| Starting frame | 54 completed, 10 failed. Six failures report HTTP 402; two Gemini results were incomplete without image data; two input starting-image jobs could not be verified. | Provider-side cause of 402 beyond recorded response is not established. No claim that every model currently fails. |
| Stage 1/2/harmonizer | Recent live operations contain gemini-image, openai-image, openrouter-image and primary-reapi only. No separate openrouter-image stage operations in this window. Current local generate-image.ts contains the durable staged route. | New staged pipeline NOT VERIFIED in production. Local failure/retry tests pass; they are mocked provider tests. |

All 76 completed image/video jobs in the window join to ready, non-deleted media_assets. This verifies database linkage, not present-day storage bytes, visual quality, playback or downloadable URLs.

### Reproducible sample receipts

- Hook video job b784bf42-85e7-47c1-b480-c7a79d347e72: ReAPI task task_01a18e36c2137702b31e0350341def18; output persisted October 30; asset 0faa9fb3-d2e6-4776-b8fe-6ca566bafcb0.
- Starting-frame job 02707612-221e-4ae1-b17c-c23f560a0dd7: OpenRouter gen-1793564123-Qg7XIE7bgHNFMiHwzfbn; requested/output metadata 9:16, 720×1280; asset 00d04801-7f3f-4713-97bf-884a59c28b19. This single-operation receipt does not prove two-stage processing or unchanged composition.
- Character job 844fc959-4b49-4887-a53e-7bfcc6963977: OpenRouter gen-1793736667-MmGACtkRBQKsIgyDCKzE; asset 82aac232-02b2-498e-a399-95e678f9a3d9; persisted November 4 IST. Existing character-eye-accessory-repair-2026-11-04.md documents a real canary with improved eyes/accessories but incomplete identity fidelity. Its visual assessment was read, not independently repeated in this audit.
- Instagram target fe71e450-ee27-4fa3-b130-90dc32108c78: due October 30 06:30Z; published_at 06:30:51.111Z; matching target/operation post ID 17906360460605692.
- TikTok target e60784be-9397-48a7-9588-a8dbcbe1e66c: due October 30 15:30Z; published_at 15:30:32.210Z; matching target/operation ID p_pub_url~v2.7702483569796548630. This is a stored provider identifier, not an independently verified public post URL.

## Current-source tests

435 checks: 429 PASS, 6 FAIL, no skipped app checks. No app/worker build commands ran. Direct Node source execution used existing loaders. Test harnesses include mocks and source assertions; passing them is not production acceptance.

- App: 373 tests, 368 pass, 5 fail. Scheduling directory suites plus Explore workflow transport/pending schedule, image/video admission, keyframe admission, appearance and retry-credit suites.
- Worker: 62 tests, 61 pass, 1 fail. Publishing handler, durable image stages, Hook keyframe image contract, video provider routing and MP4 output validation.
- Durable stage tests pass: Stage 2 rejection and harmonizer rejection cannot report success; saved paid stages survive retry, lost acknowledgements and runner restart; uncertain submissions, corrupted inputs and concurrent deliveries do not blindly resubmit.
- Publishing tests pass for early execution rejection, saved-operation reuse, reconciliation, cancellation races, permanent/transient errors, account serialization and attempt limits. Schedule-time tests exercise local/UTC semantics. These checks use controlled test doubles.

Failure diagnosis:

1. Four account-picker-render.test.mjs cases fail with SocialAccountAvatar undefined. The test extracts a function and evaluates it without injecting the avatar dependency; the real editor imports that component. This is a harness failure, not proof of an undefined production import.
2. account-picker.test.ts expects a literal href="/settings#instagram-publishing". Current editor uses a platform-specific helper returning Instagram/TikTok/YouTube settings anchors. Source assertion is outdated.
3. generate-hook-video.test.ts expects Kling 3/ReAPI to throw. Current resolver explicitly accepts Kling 3/ReAPI. Test and implemented routing contract disagree. No test was altered to hide this failure.

Commands (logs preserve full output):

```powershell
node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/scheduling/*.test.ts lib/scheduling/*.test.mjs lib/explore/workflow-schedule-transport.test.ts lib/explore/pending-schedule-client.test.ts lib/ai-studio/image-generation-api.test.mjs lib/ai-studio/video-generation-api.test.mjs lib/explore/hook-keyframe-generation-api.test.mjs lib/explore/starting-frame-appearance.test.ts lib/jobs/generation-retry-credits.test.mjs
node --import ./scripts/worker-source-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test worker/src/jobs/publish-social-post.test.ts worker/src/lib/durable-image-stages.test.ts worker/src/jobs/generate-image.hook-keyframe.test.mjs worker/src/jobs/generate-hook-video.test.ts worker/src/lib/video-output.test.ts
```

Logs: .tmp/main-functions-app-audit.log and .tmp/main-functions-worker-audit.log. PowerShell's subsequent Get-Content returned zero; the Node test summaries above, not that shell wrapper exit, determine failure.

## Sources, protections and remaining work

Read context-memory, immutable-contracts and scheduling skills; consulted scheduling-contract, nonnegotiables, prior real starting-frame and current character audit/repair receipts, current git status, scheduling service, publisher and provider/stage source and failing tests. Large Explore/incident ledgers were not freshly reread in full; no application-code edits were undertaken. This audit does not claim a completed implementation preflight.

Only this report was added by the audit; ignored test logs were written. Existing dirty user work remains intact. No palette, layout, prompt, credentials, IAM, schema, billing, queue or production records changed. No new incident was marked fixed.

Browser check failed before navigation: cua.getState returned "failed to write kernel assets: The system cannot find the path specified". Therefore signed-in desktop/mobile UI, fresh scheduling after closing the browser, newly generated media fidelity, all workflow/model combinations and current deployed staged-pipeline acceptance remain NOT VERIFIED. Existing November 2 real starting-frame receipt records ratio/composition and text/scene failures; it is historical evidence, not a new test of subsequent fixes.

Next acceptance needs a working authenticated browser and explicit selected test media/accounts for any actual publication, plus an intentional current-generation canary. Releasing local changes still requires explicit build authorization under the user's standing rule. Do not infer deployment readiness from these database counts or mocked checks.
