# Starting-frame animation: optional face photos and three-second output

Local implementation and mocked transport verification, 24 October 2026. Not a production or paid facial-fidelity qualification.

The approved starting image remains a separate input defining the literal first frame. Optional photos describe the same person's face as the head moves. Choosing photos does not turn them into opening or ending frames.

## Connected route support

| Model | Starting-frame durations exposed | Optional face photos |
| --- | --- | --- |
| Omni Flash 1.1 | 3–10 whole seconds | Up to five |
| WAN 3.0 | 3–15 whole seconds | Unsupported by connected frame route |
| Seedance 2.5 | 4–15 whole seconds | Unsupported by connected frame route |

Google's [stable Omni model page](https://ai.google.dev/gemini-api/docs/models/gemini-omni-flash) documents 3–10-second video output. Its [role guide](https://ai.google.dev/gemini-api/docs/omni#using-tags-in-prompts-to-set-image-and-video-roles) explicitly permits `FIRST_FRAME@Image1` and separate `IMAGE_REF_0@Image2`. Five optional photos is an application cap, not Google's maximum image count.

[ReAPI WAN](https://reapi.ai/docs/wan-3-0) documents 2–30-second output, so three seconds is within its range. It rejects mixing frame and general-reference media. [ReAPI Seedance](https://test.reapi.ai/docs/seedance-2-5) keeps a four-second minimum and disallows mixing frame roles with reference-image roles or combining its two image fields. These restrictions are preserved; no automatic conversion to reference-only creation occurs.

## Admission and provider contract

- Existing `startingFrameAssetId` / `startingFrameJobId` identify the owned approved scene. Existing `referenceImageUrls` plus `imageReferencePurpose: "person"` carry optional face photos only for Omni.
- Before either credit-admission path, the API resolves private references and verifies that every photo is distinct, owned, ready, not deleted, in the image or saved-influencer collection, PNG/JPEG/WebP, and at most 20 MB. The scene cannot also be selected as an optional photo. Unsupported models, excess photos, wrong roles and unknown ownership are rejected before credits. Other WAN timed-reference collection rules remain unchanged.
- The frozen job retains its existing `personReference` metadata with exact main/support order. The worker verifies those roles and requires an authoritative matching `job.user_id` for new mixed-photo requests before reserving a provider operation. It retains the original owner-checked private URL resolver; no input-owner fallback was added.
- Omni receives scene bytes first, then ordered face-photo bytes. The prompt binds Image1 to `FIRST_FRAME`, Image2+ to appearance references and instructs the model to preserve the scene's clothes/background/pose rather than borrowing them from face photos. All input images participate in token preflight.
- Existing one-frame jobs keep their previous prompt and request fingerprint fields. Optional-photo request fingerprints bind the ordered canonical URLs. Accepted operations resume without another create call or refreshing expired image links.
- Three-second output is admitted through shared duration policy, prompt compilation, API, worker and Omni/WAN provider serialization. Seedance's minimum remains four; existing reviewed source-motion duration sets are not automatically expanded or requalified.

## Checks

- 58 API/draft/motion tests pass, covering both billing paths, owned-photo and saved-influencer forwarding, foreign/unready images and influencers, incompatible models and 3-second Hook/Wall prompts.
- 36 worker and Omni adapter tests pass, including separate source/reference tags, input order/token counting, malformed-role rejection before reservation, canonical fingerprints and accepted-operation recovery.
- 19 ReAPI adapter tests pass, including literal WAN first-frame serialization at three seconds and unchanged Seedance minimum/mixed-input rejection.
- Worker TypeScript build passes. Local logs: `outputs/starting-face-*.log`.

## Combined review

- Independent review caught two regressions before release: the scene/person-strip needed its own photo-removal actions while the picker is disabled on unsupported models, and saved influencer assets use collection `influencer` rather than `image`. Both are fixed with targeted regression coverage. Unsupported combinations still block; existing selections remain removable. Foreign/unready influencer images are rejected before either billing path.
- The combined UI, request, API, draft, history, motion and curated-frame suites pass **297 tests**. The final production build passes, including TypeScript and native route bundle checks. Both source-preparation/image-admission traces include all **21** approved PNGs with exact hashes. Root reran worker/Omni and ReAPI checks after integration; scoped lint passes.
- The isolated browser fixture successfully simulated a version-3 starting-image result and approval, then selected an optional saved face image while the starting frame remained present. The later duration-dropdown action did not execute because automatic approval review hit the account usage limit. Do not count the remaining browser interactions or live production flow as accepted. Automated tests verify the rendered three-second options and unsupported-model removals; generated-video likeness has not been evaluated here.

No model request, paid generation, push or deployment was made for these changes. Whether the extra photos improve likeness on difficult poses still requires a separately reviewed output test.
