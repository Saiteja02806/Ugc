# Character OpenRouter route and long prompts — 2 November 2026

Status: new route implemented locally; real image generation and >4000-character acceptance VERIFIED. Not deployed. Google billing balance was not changed or repaired.

## Scope
User requests ReAPI or OpenRouter instead of direct Google. Existing ReAPI integration covers video; existing OpenRouter Gemini adapter supports character image inputs. New gemini_3_pro character admissions set provider=openrouter, as Seedream already does. Recovering a saved batch reuses its frozen provider and original reservation; historical absent-provider Google jobs stay on original path. No fallback to Google and no automatic repurchase of old402failed requests. UI selected model remainsGemini3Pro, same compiler, trait IDs, owned-reference order, batch sizing and credits.

Character call supplies imageSize2K, emits image_config aspect_ratio9:16/image_size2K and allows120s for its synchronous request. Optional image config leaves older starting-frame/standalone payloads unchanged. Existing operation ledger guards remain; uncertain requests cannot safely be blindly replayed. Deployed worker has OPENROUTER_API_KEY secretopenrouter-api-key version1 already configured; test reads existinglatest inference credential in memory. Running revision secret bytes were not compared and no environment value saved/printed. Website/API and worker require release to activate new character behavior.

## Real selected-trait test
Used same actual UI compiler and ordered/resized catalog references from previous Google test, actual OpenRouter helper and verified inference credential. Selected navy1950ssuit, black naturalbob, warmwood bedroom, default face/other traits, halfbody.10images. One real requestgen-1793603644-OFlc99LoGbFcZVcb0OuS HTTP200, output1536x2752/9664434bytesPNG, SHA256cabd56e9a781edc896f4886af21d355040909a4a606cf0ba11f3c839b0099e19, providerreportedUSD0.146158.

Viewedoutput: navy tailored suit with hat/tie, blackbob and warmwood headboard/whitebed present. Hat/tie come from selected suit reference, not an unrequested accessory. Exactwaist-only framing FAILS: crop extends below waist. Identity/ethnicity/age cannot be certified by selected labels or this single picture. No claim of perfecttrait conformity. Artifacts `.tmp/character-openrouter-real-2026-11-02/`.

This invokes actual provider helper with local prepared reference bytes, not authenticated UIupload→billing→queue→worker→savedasset. Localsharp JPEG86 approximates browsercanvas JPEG86. No hosted jobs/customer records mutated.

## >4000-character comparison
Latest user asks whether OpenRouter rejects prompts over4000characters. One real Gemini request with13383characters and10referenceimages returnedHTTP200/image1536x2752/8221875bytes. Submittedlength13383 and SHA256 equal frozenprompt: not truncated or summarized. Usage8074inputtokens,1577completiontokens,9651total; includes multimodal inputs, not a text-only tokenizer measurement. ProviderreportedcostUSD0.145322. Requestgen-1793603914-LdsPl8mHNpK7xc9zkeT5. Artifacts `.tmp/character-openrouter-long-prompt-2026-11-02/`.

Application limits unchanged: Gemini32000characters, Seedream4000characters. Isolated current Gemini builder accepts4000/4001/13383/32000, rejects32001. Existing character tests verify long text reaches job/provider untruncated. No upstreamSeedream >4000test was paid for or implied. Seedream guard is localmodel-specific policy, not proof of OpenRouter-wide cap or its exact upstream ceiling.

Official read-only metadata https://openrouter.ai/api/v1/models/google/gemini-3-pro-image/endpoints returnedcontext_length131072 forGoogleAIStudio and65536forGoogleVertex, completionmax32768. Context is tokens, shared with images/output, not characters; max_prompt_tokens isnull (unspecified), not unlimited. Official model page https://openrouter.ai/google/gemini-3-pro-image advertises131072context. Livecaps may change; single13383character success doesn't prove every32000character prompt or arbitraryreferencecombination succeeds.

## Validation and files
-54character selection/generation/reservation/UItestsPASS, including newadmission/replay invariant. `.tmp/character-openrouter-tests.txt`.
-64worker dispatch/OpenRouter/provider-ledger testsPASS, including allorderedrefs/fullprompt, Google notcalled for newroute, explicit2K/ratio and unchanged historicalpayloads. `.tmp/character-openrouter-worker-tests.txt`.
-1strictUTF8checkPASS. workerbuildPASS after fixing nullableJSONnarrowing; npx tsc --noEmit --incremental falsePASS; scopedeslintPASS/nooutput; scoped diffcheckPASS (lineendingadvisory). Logs `.tmp/character-openrouter-types.txt` and lint.txt.
-A test expected trailingwhitespace that worker historically trims; fixture trimmed without changing production normalization. No new providerretry behavior.

Files changed: lib/characters/generation-service.ts; lib/characters/generation.test.mjs; worker/src/jobs/generate-image.ts; worker/src/jobs/generate-image.test.mjs; worker/src/lib/openrouter-gemini-image.ts; worker/src/lib/openrouter-gemini-image.test.ts; EXPLORE_CONTEXT.md; append-only docs/ai-context/clear.md; thisreceipt. Testharness/prompt/receipts/outputs under both.tmpdirectories above. Existing unrelated work preserved.

Preflight: applicable priorAGENTS/context/ledger/nonnegotiables/Nextguide retained; relevant sources and immutable/regression procedures reread; PythonpreflightPASS. Inspected admission/compiler/refupload/caller/worker/ledger/providercredentials; OpenRouter official docs/modelmetadata consulted. No UI/layout changes or newdependency/config/schema. Protected prompt/reference/credits/historicalrecovery VERIFIED bytests; palette/layout UNCHANGED. Browser/mobile/hostedbilling/persistence/fulltraitfidelity NOT VERIFIED. IncidentUGC-VID-052 updated for requested localrouting solution; framingquality limitation remains. Rollback admissionflag and character-onlyconfig, keeping acceptedjobprovider immutable; do not route alreadyacceptedGooglejobs to paidOpenRouter requests on retry.
