# Explore slideshow instruction references

The plus button adds multiple owned reference images to the instructions box.
Uploaded or selected slideshow images continue to guide layout. Extra images
are general references used according to the user's instructions; they are not
assumed to be output slides or limited to one product image.

With six selected slideshow slides and two attachments, each generated version
receives image 1 (the primary layout), images 2–6 (additional selected layout
context), and images 7–8 (the attached references in the user's selected order).
The worker prefixes those roles to the exact user instructions and passes all
eight image inputs to GPT Image 2.5 Sunburst or Nano Banana 2. Without a slideshow
selection, the attached images provide the entire reference context. Business
profile information is not added automatically.

Regeneration preserves the visible attachment ordering. Its owned target image
comes after those references and receives the separate role “existing slide
being edited”; it cannot silently become the user's first attached image.
Legacy scalar request fields and previously queued job fingerprints remain
compatible.

The existing application bounds remain 14 images total, 25 MB per image, and
50 MB combined. These are application limits, not a claim of unlimited provider
capacity. All owned assets are checked before reserving credits. Worker download
checks also enforce the real byte and MIME limits before provider submission.

The UI uses a compact card stack with an image-only preview, at most 160px wide
and 200px high. Hover, keyboard focus and touch open it; Escape or an outside
press closes it. Removal is available in the plus picker. The writing area
reserves space for the thumbnails. Partial upload success is retained, duplicate
saved attachments are not appended, and switching owners clears prior errors.

Run the focused checks with:

```powershell
npm run test:slideshow-references
npx tsc --noEmit
npx eslint components/explore/format-instruction-image-reference.tsx components/workspace/ugc-chat-workspace.tsx components/generation/ai-studio-composer.tsx lib/ai-studio/image-generation-api.ts worker/src/jobs/generate-image.ts worker/src/lib/slideshow-reference-prompt.ts scripts/explore-slideshow.browser.cjs scripts/slideshow-reference-stack.browser.cjs
npm run build
```

The tests exercise the real UI components, API validation/queue construction,
and worker prompt/ordered provider inputs with isolated provider/storage fixtures.
The browser checks cover multiple uploads, saved attachments, hover, keyboard,
Escape, touch/removal, 320px layouts with 14 images, reduced motion, partial
failure, regeneration ordering and owner changes. They also retain the slideshow
save/reload/retry regression coverage.

No paid generation or authenticated production acceptance was performed for
these changes. They are local and have not been deployed. UI screenshots are
written under `.tmp/slideshow-reference-stack/`; those generated artifacts are
not source files for a release.
