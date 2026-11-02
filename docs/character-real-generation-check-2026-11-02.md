# Character studio real generation check — 2 November 2026

Result: real image generation NOT VERIFIED; both tested credentials returnedHTTP402, no image or interaction ID. Local request wiring tests PASS. No application-code, palette/layout, credential, billing setting or deployment changed.

## Follow-up bottleneck diagnosis

Read-only checks on 2 November establish that BOTH tested keys can read the exact `models/gemini-3-pro-image` resource with HTTP200. The SDK2.10.0 interactions bridge constructs requests against its parent Google API base URL and wraps HTTP errors; the captured failure's sparse SDK text does not itself contain the billing account balance.

Google's official Interactions error reference explicitly maps `payment_required`/HTTP402 to depleted Prepay credits and instructs not to retry until credits are added: https://ai.google.dev/gemini-api/docs/api-errors . Official billing documentation says a zero Prepay balance stops Gemini requests across projects sharing the billing account, and that available Prepay balance must be checked in Google AI Studio Billing: https://ai.google.dev/gemini-api/docs/billing . This identifies the observed rejection as Gemini's payment gate, rather than a model-not-found/authentication/rate-limit response. It does not prove exact account balance or the relationship between the two keys.

Deployed Cloud Run `ugc-ai-generation-worker` in us-central1, latest ready revision `ugc-ai-generation-worker-r-17fe15f2b`, references GEMINI_API_KEY via secret `gemini-api-key:latest`, not an inline key. This agrees with the tested worker secret reference; a secret version's in-memory value in an already running instance was not inspected, so this is config evidence, not an exact running-key fingerprint.

Attempted Google API Keys project lookup for both keys using the existing signed-in identity. Both return403 missing `apikeys.keys.lookup`; no permissions expanded. Therefore associated key-project/billing-account mapping and exact Prepay balance remain NOT VERIFIED. General Cloud Billing enabled status alone would not establish positive Gemini Prepay balance anyway. Read-only reports: `.tmp/character-402-diagnosis/read-only-results.json`; no extra generation calls in this diagnostic follow-up, no purchase, auto-reload or account changes.

Action needed: inspect the Gemini project's billing account on Google AI Studio Billing for depleted/unconfigured Prepay balance and restore inference billing there if confirmed. Do not rerun generation repeatedly or replace trait/identity prompts to treat this402. Once the gate is resolved, one bounded real character request still needs image review against selected traits. UX can separately surface a clear provider-payment error rather than opaque SDK text; no error-handling patch is implemented by this investigation.

## Actual application route
CharacterWorkspace.handleGenerate compiles current selection with compileInfluencerPrompt, resolves orderedStudioReferences, resizes catalog images to1280px longest-side JPEG86, uploads owned references, appends studioReferenceOrderLine and submits modecustom/modelgemini_3_pro. generateCharacterBatch freezes prompt and ordered owned references in generate_image jobs with no OpenRouter route for Gemini. Worker dispatch uses Google Gemini3Pro interactions with2K/9:16. The earlier OpenRouter starting-frame success does not prove this different provider path works.

Older scripts/test-generate-influencer-image.mjs uses OpenRouter Flash and scripts/generate-live-ai-influencer.mjs uses DALL-E3 with a hand-authored prompt; neither represents the current character-studio route, so neither was used as success evidence.

## Test selection and provider requests
One distinctive sample: existing default female character face, warm wood bedroom, black natural bob, brown eyes/lightolive skin,1950s suit recolorednavy, athletic/tall, no accessories and half-body framing. Prompt includes the selected traits and exact ten-reference role order: characterface,background,ethnicity,headshape,eyeshape,hairstyle,outfit,build,neck,height. Outfit references fit in ten-image budget. Exact selection, display labels, prompt/hash, source and submitted reference hashes stored in receipts.

Harness uses real UI compiler/reference ordering and actual compiled worker buildGeminiImageRequest, GoogleGenAI interactions.create, same model/2K/9:16 with selected catalog bytes. Local sharp resize/JPEG approximates browser canvas processing; it is not proof of signed-in owned upload or UI admission. Test bypasses customer billing/jobs and hosted storage; no customer records mutated. API keys held only in memory, not logged/saved. One request per credential, SDK retry attempts1, no fallback model or repeated ambiguous submit.

1. Existing worker Secret Manager gemini-api-key/latest: real create failedHTTP402, SDK message `API error occurred` with empty serialized httpMeta; no operation ID or image. `.tmp/character-real-test-2026-11-02/receipt.json`.
2. Local .env Gemini credential differs from worker (boolean equality checked without outputting values). Same real sample submitted once with local credential; also failedHTTP402/noimage/nointeractionID. `.tmp/character-real-test-2026-11-02-local/receipt.json`.
3. Worker credential read-only GET /v1beta/models?pageSize=1:HTTP200. This shows model-list access, not successful paid image inference. Exact cause of402 remainsUNKNOWN: response did not establish payment/credit/quota/model entitlement cause. No account settings changed; actual debit not independently reconciled.

No generated output exists to inspect. Cannot certify selected wardrobe, room, hairstyle, likeness or framing fidelity from prompt text/tests alone. Prior unrelated images are not reused as outputs.

## Local checks
56 tests PASS: studio references, generation/reservation/promptskills and influencerstudio UI source contracts.3worker character dispatch/promptlength tests PASS. Logs `.tmp/character-real-test-2026-11-02/local-tests.txt` and worker-tests.txt. Commands:

`node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/characters/studio-references.test.mjs lib/characters/generation.test.mjs lib/characters/reservation.test.mjs lib/characters/prompt-skills.test.ts components/characters/influencer-studio.test.mjs`

`node --experimental-test-module-mocks --test worker/src/jobs/generate-character-image.test.mjs`

These mock provider/storage/billing boundaries and verify request construction/reservation/dispatch, not successful real inference. No new build required for a read-only audit; existing compiled helper from preceding verified build used.

## Completion boundary
Inspected character UI submit/compiler/registry/references, generation-service/API, worker image dispatcher and Google adapter; mandatory project context from prior work retained, relevant context-memory/nonnegotiables rechecked. No reference video/motion work or generic imagegen substitute. Palette/layout/settings UNCHANGED. Signed-in local UI upload→job→saved output, hosted worker credential activation, production and actual image fidelity NOT VERIFIED. Incident UGC-VID-052 OPEN. Files added: this report, append-only clear.md incident, local test harness/prompt/receipts in the two `.tmp/character-real-test-*` directories. No secret values saved, commit/push/deploy or remediation performed.
