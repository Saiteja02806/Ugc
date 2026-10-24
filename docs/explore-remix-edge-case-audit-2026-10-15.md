# Explore reference text and scratch-generation audit

This is a local source-code and regression-test review. No application source
was changed during this audit. No live generation, upload, render, scheduling
or deployment was submitted.

## Verified paths

- Hook and Wall of Text catalogue generation records the reference ID and source
  URL on the original job. An opt-in owned-media read exposes these identifiers;
  the editor resolves the same reference rather than the current gallery choice.
  The source's content fingerprint is checked against its current catalogue
  asset. All 30 Hook and 97 Wall catalogue videos have ready prepared text.
- A scratch-generated clip has no linked catalogue source. Default clip text is
  empty, manual text editing comes first, and Remix stays empty until the user
  supplies text or an idea. It must not copy the generation prompt, another
  clip's text, or a newly selected gallery video's copy. Remix generation needs
  nonempty text and the signed-in user's business context; reviewed Apply is a
  separate action before the result enters the clip preview.
- Demo has its own draft and remix target. Its manual input does not inherit the
  opening's text. Applying demo copy preserves its trim, framing and audio.
- Slideshows resolve the original source image and stable slide ID, independently
  of later reordering. The catalogue has 326 slide units: 314 ready text entries
  and 12 explicit no-text entries, with no missing inventory records. No-text
  sources require user input rather than fabricated reference captions.
- Remix uses business context loaded on the server for the authenticated owner.
  Accepted requests recover the exact request key and payload. Uncertain results
  do not automatically create another paid request.

## Remaining gaps

1. Uploaded reference videos, including Talking Head's optional video-reference
   upload, do not have an automatic OCR/transcription path into this reference
   text catalogue. They guide video generation, but the user currently must paste
   their source copy into Remix. Gallery prepared text support must not be
   described as automatic extraction from every uploaded video.
2. TalkingHeadClipEditing mounts FormatVideoEditor without a reference catalogue.
   That editor can read original-source metadata, but resolves it against an empty
   list when neither remixReferences nor remixReference was supplied. Therefore,
   reusing a gallery-generated Hook video in Talking Head's opening can lose its
   reference-text association in the editor even though the owned-media read
   returns its provenance. This needs catalogue resolution wiring for that path.

## Evidence and limits

180 existing source-provenance, owned-media API, catalogue fingerprint, remix,
clip-draft, slideshow and workflow-generation tests passed. Catalogue counts
were independently compared with the local source inventory. These checks do
not demonstrate authenticated production behavior or live provider output.

Relevant implementation: lib/explore/remix-source.ts,
lib/explore/reference-text-store.ts, lib/explore/workflow-generation-client.ts,
components/explore/format-video-editor.tsx,
components/explore/talking-head-clip-editing.tsx,
components/explore/format-slideshow-editor.tsx and
components/explore/remix-text-section.tsx.
