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

The existing 1,000-character application safeguards for Seedance and Runway are
preserved by this change; they are not a claim that every model has that native
limit. Higgsfield's [Seedance 2.5 schema](https://open.higgsfield.ai/models/bytedance/seedance-2.5/text-to-video/api-reference)
publishes a minimum prompt length but no maximum. Verify each exact provider
model's contract before changing these safeguards. Direct prompts are rejected,
rather than silently shortened, if they exceed a character safeguard. Legacy
UGC-template processing retains its existing normalization.

This needs both the frontend/API and the AI generation worker to be released.
