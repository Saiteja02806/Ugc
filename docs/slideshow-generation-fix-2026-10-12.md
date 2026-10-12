# Slideshow generation fixes — 2026-10-12

Implemented locally following the agreed reference, text and sizing behavior.
No production records, schema, deployment or paid generation were changed.
The earlier findings remain in `slideshow-reference-audit-2026-10-11.md` as an
historical audit; the fixes below address its recreation, role and crop findings.

## Resulting behavior

1. **Gallery references guide style and composition.** The selected slide is
   identified explicitly; other checked slides guide the same slideshow style.
   Unchecked slides are still excluded.
2. **Prompt attachments supply content or guidance.** Their numbering is separate
   from gallery references. The complete user prompt determines how each attached
   person, product, object or background is used. No ambiguous “supporting
   examples” role is introduced.
3. **Recreate slide edits the existing image.** Its owned image is the main edit
   target with or without attachments, including when gallery references have
   been removed. One image can have several roles without duplicating its bytes.
   Choosing the result retains the slide's Remix Text and neighboring slides.
4. **Text overlays are omitted by default.** Editable copy is handled through
   Remix Text. Explicit requests for text inside the generated image override
   that default and request readable placement, preferably central, with margins
   and without hiding the main subject. Incidental product labels are preserved
   unless the prompt asks to change them.
5. **Slideshows default to 4:5 and preserve the whole output.** GPT Image 2.5
   receives the selected native dimensions; Nano Banana receives the selected
   ratio. Matching native output adds no margins. An unexpected provider ratio
   is fitted inside the canvas with white margins rather than cropped or stretched.
6. **Long prompts fail before charging.** The API checks the complete composed
   prompt, including reference instructions, against 32,000 characters before
   reserving credits. The worker checks it again before provider submission.
   User instructions are preserved rather than shortened.

## Contract and compatibility

New jobs freeze a server-derived `slideshowReferenceContract` with version 2 and
one-based indices for style references, ordered attachments and the optional
existing slide. Every physical input has a role. Overlap is allowed when the
same image serves multiple roles. Clients cannot supply arbitrary role indices.

The API still validates ownership, readiness, supported image types, individual
and aggregate reference sizes, and total image count. Both providers receive the
actual ordered image inputs and composed instructions. Request fingerprints
include the V2 roles, so role changes cannot reuse an incompatible paid request.
Existing paid-request fencing and staged-output recovery are preserved.

Jobs without the new contract retain their old prompts, fingerprints, provider
dimensions and output normalization. Standalone image generation keeps its
previous default. No schema or credit-cost change is required.

## Verification evidence

| Boundary | Evidence | Result |
| --- | --- | --- |
| Real image panel → API payload | Isolated headless browser using real React components: attachment-free recreation, two attached images, recreation with attachments, 4:5 defaults and separate edit target | Passed |
| API → queued jobs | Server-side tests for frozen ordered roles on each version, attachment/target overlap, ownership and invalid inputs, long prompt rejection before reservation | Passed |
| Worker → provider | Actual job handler with mocked providers; all references and intact prompt transmitted to both supported providers; invalid roles rejected before submission | Passed |
| Provider request | OpenAI SDK request tests confirm all four native dimensions and ordered edit files; Nano Banana context tests confirm image input blocks | Passed |
| Output pixels | Actual Sharp processing preserves distinct top and bottom markers; matching 4:5 pixels remain unchanged | Passed |
| Result → slideshow | Editor tests retain Remix Text, slide identity and neighboring image on recreation; browser covers owned lookup, busy locks, save/reload, retry and account changes | Passed |
| Legacy behavior | Existing jobs retain raw/legacy role prompts, legacy native-size flag and crop mode; existing non-slideshow tests pass | Passed |
| Compile and lint | Website TypeScript, worker build, scoped ESLint and Next.js production build using Webpack | Passed |

The focused run completed **171 tests, 171 passed, 0 failed**. Browser tests use
mock authentication, storage and generation responses; they make no paid calls.
Local evidence logs are `.tmp/slideshow-fix-tests.log`,
`.tmp/slideshow-fix-browser-unsandboxed.log`, `.tmp/slideshow-fix-typecheck.log`,
`.tmp/slideshow-fix-lint.log`, `.tmp/slideshow-fix-browser-lint.log`,
`.tmp/slideshow-fix-worker-build.log` and
`.tmp/slideshow-fix-website-build-unsandboxed.log`.

Initial sandboxed build/browser attempts encountered Windows filesystem/process
permission errors. The same isolated checks passed outside that sandbox. One
browser assertion needed its prompt refilled after the preceding successful
generation cleared it; no editor product change was required for that assertion.

## Release and remaining verification

Deploy the updated worker before deploying the website that enqueues V2 jobs.
For rollback, stop new V2 submissions and drain those jobs before rolling the
worker back. Older workers do not understand the new roles or native-size flag.

These changes are not deployed. Signed-in production acceptance must run on
`https://www.getugcpilot.com/explore/slideshows` after release. The prior audit
reached the production sign-in page without an authenticated session.

No paid model output was inspected in this implementation. The checks prove
correct input transmission, role instructions and preservation of returned
pixels; they do not prove visual likeness, exact baked text or compliance with
every prompt. Release acceptance should inspect a gallery-style request with
ordered attachments, recreation with and without attachments, an explicit text
request, and a default request that omits reference text.

The native-size change follows the current [OpenAI image edit API reference](https://developers.openai.com/api/reference/resources/images/methods/edit).
