# Reference performance prompt pilot

The agreed original detailed approach is implemented locally for the first
three current Hook gallery references. It is not the numbered five-part template.

## Content coverage

Local catalog inventory: 98 Hook, 97 Wall of Text and 58 slideshow entries.
The user's clarified scope is only the 98 active Hook video references: three
pilot prompts and 95 remaining. The earlier 195-video scope accidentally added
97 Wall videos; its 192-remaining figure was therefore incorrect for this task.
Wall of Text and slideshows are excluded. No Wall prompts were prepared.
The previous experiment's legacy Hook 03/04/07 are archived references, so their
performance paragraphs were not copied onto current cards with matching numbers.

Pilot entries bind stable IDs to SHA-256 content-addressed source filenames.
The initial pass inspected 12 samples per clip. The subsequent individual pass
hash verified and inspected all 92, 92 and 110 decoded frames respectively.
This is all-frame inspection, not real-time playback or a claim of confirmed
generation quality. Full sequences are under `.tmp/hook-reference-prompt-review/`.
Each contains a single-frame screen-view tail, retained at its brief timing in
the version 2 prompt. See `hook-reference-individual-review-2026-10-15.md` for the
superseding content review. Output quality and UI acceptance remain separate.

Every assembled suggestion includes overlay-text/caption/emoji removal, natural
reconstruction and no new text, preserving physical object text. The replacement
instruction is conditional on an attached image and retains source hair/clothes
unless the user asks otherwise. No specific influencer is embedded in the catalog.

## Section and action map

| Existing task | Location after change |
| --- | --- |
| Select, replace or remove source video | Existing Create reference controls |
| Select appearance images or audio references | Existing Create reference controls |
| Read/edit reference direction | New Reference prompt block in Create's prompt section |
| Exclude suggestion while retaining video | Remove prompt in that block |
| Restore approved suggestion | Restore prompt in that block |
| Explain suggestion | About this prompt disclosure |
| Write additional instructions | Existing Your instructions field |
| Model, duration, quality, count, ratio and Generate | Existing controls |
| Demo, editor, Remix, audio setup and Schedule | Existing entry points; unchanged |

The visible reference field and personal instructions are combined at submission.
Removing a suggestion excludes it; the server does not reinsert it. Combined
length is checked before submission; no silent truncation is added. Accepted or
uncertain requests continue to use their frozen recovery payload. The reference
suggestion is suppressed when restoring an already combined saved request.

## Validation and rollout

- 13 focused behavior checks pass: content/hash matching, no unknown-video
  fallback, actual submitted combination, edits, removal retaining the video,
  reference switching, user text preservation and existing Hook/Wall media paths.
- Web TypeScript check and scoped ESLint pass.
- A broader pre-existing Explore fixture suite cannot load
  `../../worker/src/lib/slideshow-generation-batch.ts` with its custom loader.
  Its failure is separate from the focused passing reference controls suite.
- Browser test: `scripts/reference-prompt-pilot.browser.cjs`; local evidence is
  saved only after successful completion under `.tmp/reference-prompt-pilot/`.
  The MCP browser was already occupied. An isolated browser launched after
  sandbox escalation, but the actual Next preview could not be verified:
  Turbopack's CSS worker crashed and the webpack fallback timed out loading
  the page. No successful browser screenshots or acceptance are claimed.
- Production acceptance is pending. No deployment, migration or paid generation
  was performed for this implementation.

Next: inspect the remaining 95 Hook videos individually
individually, and expand approved entries in batches. Never infer an action
paragraph from a card title, transcript or thumbnail alone. The user-visible
prompt must reflect what is submitted even after edits/removal.
