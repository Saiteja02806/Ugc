# Seedance 2.5 Hook failure investigation — 19 October 2026

The later screenshot showing `Choose the workflow's supported video model.` is
a separate app-side admission failure, not the historical provider rejection
described below. See [the admission investigation](seedance-explore-admission-fix-2026-10-19.md).

Follow-up key/model research verifies the current deployed ReAPI key and Less
Restriction request configuration, while preserving the historical/live-output
distinction below. See `seedance-less-restriction-verification-2026-10-19.md`.

The latest recorded Seedance Hook failure was an upstream reference-image
privacy rejection during submission, not a render timeout or missing-output
download. Production database records and the original worker log agree.

## Latest Hook failure

- Job: `61b3ec72-d214-42fe-b6e6-b3443a46734e`.
- Created: 17 October 2026, 17:41:01 IST. Failed about 20 seconds later.
- Saved workflow: `workflowKind: hook`; model `seedance_2_5`; provider
  `openrouter`; 17-second output, 720p, a 1,729-character prompt, one image,
  and a 7.923023-second reference video.
- Provider response: HTTP 400 with exact structured code
  `InputImageSensitiveContentDetected.PrivacyInformation`, identifying
  image `content[1]` as potentially containing a real person.
- No accepted provider operation ID, no provider completion and no output asset.
  Submission reached the provider, but its input check rejected the image before
  a recoverable generation task was returned.
- The settings shown above fit the saved OpenRouter Seedance adapter's input
  contract. The stored response identifies the image, not the prompt length,
  duration, resolution or reference-video duration, as the reason for rejection.
  The error does not establish whether the image actually depicts a real person;
  realistic synthetic portraits can only be described here as flagged by the
  provider, not independently proven to be the cause of its internal decision.
- The current public operation message correctly classifies this historical
  rejection as `PROVIDER_REFERENCE_IMAGE_REJECTED`, with retry disabled. No
  raw provider diagnostics or private media URLs need to be shown to customers.

## Previous Seedance history for the same owner

The owner's 11 saved Seedance generation jobs contain one completion and ten
failures. Four jobs explicitly tagged as Hook (three on 5 October and the latest
on 17 October) all failed: three image-privacy rejections and one credential
preflight configuration failure. Older jobs without workflow tags are kept
separate from those confirmed Hook requests.

| Recorded cause | Jobs | Route / dates |
| --- | ---: | --- |
| Reference image privacy rejection | 3 | OpenRouter, 5 and 17 October |
| Provider content moderation after task acceptance | 4 | Runway, 1 October |
| Regular inference key required | 1 | OpenRouter preflight, 5 October |
| Insufficient provider credit balance | 2 | Higgsfield, 30 September |
| Completed with persisted output | 1 | Higgsfield, 30 September |

These are different causes. Neither insufficient credits nor key configuration
explains the latest Hook rejection. Unlike the audited WAN result-collection
failure, these Seedance failures have no completed video waiting to download.

## Current routing and limits of this conclusion

The current production AI worker sends 100% of traffic to revision
`ugc-ai-generation-worker-release-1323837c`. Its committed web admission code
freezes new Seedance requests to `reapi`, and the worker preserves recorded
OpenRouter/Runway/Higgsfield routes for older jobs. The shared adapter uses
model `doubao-seedance-2.5-face` for new ReAPI requests.

There is no saved Seedance generation for this owner after the 17 October
failure, and none through ReAPI. The five newer saved video jobs on 19 October
are two Omni and three WAN jobs, all completed. Their success does not validate
Seedance. Therefore the historical failure is diagnosed, but live Seedance
success through the new route remains unverified. Switching providers is not
proof that any particular reference image will be accepted.

No new generation, paid retry, database update, provider change or deployment
was performed for this investigation. Existing records and the original worker
log were read only. No product code was changed.
