# One-box slideshow prompt rewrite

Local implementation, 16 October 2026. Not deployed.

## Final user decision

The user rejected separate prompts/forms for each image. The existing slideshow
prompt box now has a sparkle action in its lower-right corner. Clicking it sends
the user text for rewriting and replaces the text in that SAME box with one
clearer prompt. The result stays editable. Undo restores the exact prior text.
The action shows a single four-point star with no companion sparkles, circle,
border or background. Keyboard focus remains visible. A reserved footer keeps
typed text clear of the star and attachment controls.
There is no modal, per-slide prompt editor, attachment-assignment UI or automatic
image generation. Clicking Generate continues to submit the current text box.

## Text interpretation

The endpoint accepts a strict `{prompt}` object, up to 8,000 characters. No images,
asset URLs, selected-slide metadata, attachment metadata, OCR, image captions or
saved business profile are sent to the text model. URLs typed by the user remain
ordinary text and are not browsed. Request content is never interpreted as an
image input or tool request.

The system instruction preserves user intent, exact replacement text, names,
URLs, slide-specific scope, reference labels and exclusions. It removes filler
and repetition without inventing visual details, props, brand claims, website
designs, calls to action or stylistic embellishments. Existing clear requests
receive minimal changes. It cannot inspect images or identify their fonts.

One structured response contains ONE rewritten prompt and up to three short
clarification notes. Notes appear beneath the existing field, allowing the user
to add details directly. They are not inserted into the generation prompt or
turned into a separate form. Shape validation does not prove semantic fidelity;
the user reviews/edits the text and actual provider quality evaluation remains
necessary before making image-quality claims.

## Compatibility and recovery

The earlier per-slide compiler, changed image API inputs, optional attachment
labels and worker modifications were removed. Existing image-generation API and
worker behavior, reference image delivery, owner validation, business snapshots,
image credits, models, output counts, grouping and generation recovery remain.
Actual source images/uploads still reach the image generator in the normal flow.
This feature does not implement exact screenshot compositing.

The hook ignores late results after text, owner or selected reference inputs
change. A synchronous click fence prevents duplicate clicks. While rewriting,
image submission is disabled. Failures leave authored text unchanged. Editing
the rewritten text hides Undo to avoid erasing subsequent manual changes.

Private receipts precede paid text calls. RLS and grants expose the receipt table
and security-invoker claim RPC only to service_role. Owner/request IDs and payload
hashes prevent cross-owner reuse and changed-payload replay. Per-owner advisory
locking enforces a rolling 24-hour limit of 20 attempts. Existing receipts remain
recoverable after quota exhaustion. SDK retries are disabled.

Browser request identities are saved before POST and serialized with Web Locks;
uncertain responses reuse the same identity. Terminal failures require a new
explicit click. Version 2 browser hints separate these unified rewrites from the
earlier local per-slide prototype. No image-generation credits are reserved by
the rewrite; normal provider text-generation costs still apply.

## Deployment

1. Apply `20261016133514_slideshow_prompt_improvements.sql`.
2. Deploy the website API and composer.
3. Enable `EXPLORE_SLIDESHOW_PROMPT_IMPROVER_ENABLED=true` in the web runtime.
4. Verify the signed-in production flow and evaluate representative actual model
   rewrites/image outputs separately from the local fixture checks.

No worker deployment is required for this feature. Existing OpenAI and Supabase
server configuration is required. `OPENAI_SLIDESHOW_PROMPT_MODEL` optionally
overrides `OPENAI_TEXT_REMIX_MODEL` / the existing default. Disabling the feature
does not prevent using the original generation flow. Preserve receipts on rollback.

## Local verification

The focused suites cover a single prompt response, text-only payloads, invalid
and oversized inputs/outputs, authentication, owner isolation, receipt replay,
provider failure, uncertain saving and original generation regressions. An
isolated PGlite database executes the migration and verifies RLS, service-only
permissions, invoker security, owner quotas, conflicts and recovery.

The actual composer/hook browser fixture checks sparkle placement alongside the
attachment button, in-place rewriting, one textarea/no dialog, Undo, manual edits,
duplicate clicks, uncertain response recovery, late results after text/reference/
account changes, inline clarification notes, empty input and desktop/mobile fit.
The workspace fixture checks that the rewritten/edited text enters the existing
generation request while selected images, counts and contracts are retained.

No paid provider calls or hosted database mutations were used for these checks.
Authenticated production acceptance is pending.

Final local checks passed: 161 focused/regression tests, TypeScript, scoped
ESLint, real desktop/mobile browser fixture, and production builds using both
the default Turbopack and supported Webpack builders (166 routes). Browser
assertions verify one SVG star path, no companion circles/sparkles, transparent
idle/hover background, and space separating prompt text from action controls.
Provider-quality evaluation remains pending; these checks use mocked AI output.
