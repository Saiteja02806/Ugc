# Video prompt limits

The UI, generation API and direct-prompt worker use the shared policy in
`worker/src/lib/video-prompt-policy.ts`. Select the policy using the actual
generation path: Google Omni text/image generation uses token validation;
reference-video requests currently route to Runway and retain their character
safeguard. Wall-text generation reserves room for its appended background
instruction only on character-limited paths.

## Google Omni

Google publishes a 1,048,576-token context window for
[`gemini-omni-1.1-flash`](https://ai.google.dev/gemini-api/docs/models/gemini-omni-flash).
Read-only `models.get` checks with this project's API key on 2026-10-09 returned
`inputTokenLimit: 131072` for both `gemini-omni-1.1-flash` and
`gemini-omni-flash-preview`. Both accepted `models.countTokens` requests.
These are tokens, not characters; there is no accurate fixed conversion.

Before submitting a new video, the worker reads the configured model's current
input token limit and [counts the full input](https://ai.google.dev/gemini-api/docs/tokens),
including an optional image and any workflow instructions. Over-limit input is
rejected before video submission. Preflight outages are known pre-submission
failures and remain retryable. Resuming a saved operation skips preflight.
The existing model selection and `GEMINI_OMNI_MODEL` override are unchanged.

## Other generation paths

Seedance 2.5 and WAN 3.0 retain the verified 10,000-character provider safeguard,
Kling 3.0 retains 2,500, and Google Omni video-reference requests through Runway
retain 1,000. Direct prompts fail before submission if they exceed the selected
limit; legacy UGC templates retain their existing normalization.

This needs both the frontend/API and the AI generation worker to be released.
