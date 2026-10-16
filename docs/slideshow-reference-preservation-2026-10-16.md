# Slideshow reference preservation — 16 October 2026

Implemented locally; not deployed. The input audit confirmed that the latest
reported batch received saved business context, both selected references and
the manual upload. Its instructions allowed broad redesign and the inspected
output invented a different dashboard. This change corrects that prompt policy.

## Intended behavior

- Follow-up clarification: new generation is a close edit that reproduces the
  designated reference as closely as possible, not a mood-board reinterpretation.
  The new-job prompt does not describe references as inspiration. Keep every
  unrequested visual detail unchanged. A requested background replacement is
  limited to that background, without unrelated text or camera changes.
- Each output uses its corresponding selected reference as the base. Preserve
  visual style, composition, lighting, palette, background and tone by default.
- Make only relevant business/content adaptations. Saved brand tone, visual
  keywords and CTA ideas cannot independently authorize redesign or sales copy.
- Explicit user requests override preservation within their scope. Changing a
  background does not authorize unrelated layout, subject or text changes.
- Keep uploaded attachments distinct from selected slideshow references. Apply
  them to the requested output only; screen replacements should reproduce the
  uploaded interface rather than inventing a dashboard. Retain the base device,
  screen boundaries, perspective and surrounding scene unless explicitly changed;
  do not extend a screen replacement to another output.
- Keep the existing editable-copy split: reference headlines are omitted from
  generated pixels by default and handled through Remix Text. When visible text
  is explicitly requested, preserve reference typography, placement, scale,
  line breaks and boxes unless asked otherwise, using exact supplied wording.

## Implementation and compatibility

New slideshow requests freeze reference contract version 3. The worker selects
the matching preservation, business-context and output-position instructions.
The original complete user instructions remain unchanged. All reference bytes
remain in their existing order; the per-output role contract designates the base.

Version 2 and legacy prompt paths retain their original text. Versioned roles
already participate in provider-operation fingerprints, so a v3 request cannot
reuse a v2 result. Admission measures the actual complete provider prompt before
credit reservation, including the longest slide position and base-image index;
instructions exceeding 32,000 characters are rejected rather than truncated.

Deploy the compatible image worker before the web API starts admitting v3.
No database migration or new UI control is required for this policy change.
Do not rewrite frozen old jobs to upgrade their policy during retries.

## Verification and limits

- 27 API admission tests and 5 business-context tests pass, including exact
  32,000-character boundaries for one- and ten-slide requests before billing.
- 23 worker tests pass. Provider-boundary coverage checks all three slideshow
  models, both selected-slide positions, all three image inputs, saved facts,
  explicit redesign requests, regeneration targets and v2/v3 fingerprint changes.
- The separate saved-production-input replay passes and matches both historical
  v2 operation fingerprints, confirming unchanged retry prompts.
- Worker build, targeted ESLint, TypeScript and whitespace checks pass.

After the close-edit clarification, 32 API/business-context tests and 23
worker/provider-boundary tests passed again. The latest saved first/fourth-slide
batch replay also passed with both unchanged historical v2 fingerprints and
the new close-edit v3 prompt, without provider calls. Worker compilation and
scoped lint passed; no model, quality setting or generation cost was changed.

Provider calls in these tests are stubbed; no paid generation was requested.
These checks prove prompt construction and input delivery, not model obedience.
Slide-specific scoping is model guidance, not a deterministic instruction parser.
Uploaded UI is still reproduced by an image model, not composited from original
pixels. Fresh generated-output review and authenticated production acceptance
remain pending; exact screenshot fidelity is not guaranteed by prompting alone.

The two correction parts solve different failure modes. Close-edit and scoped
prompt guidance reduces unwanted redesign but requires real-output acceptance.
Exact screenshot insertion needs deterministic compositing of the uploaded
pixels into a confirmed screen region. That compositor is not implemented by
this prompt change. Higher image-quality settings alone do not guarantee either.
