# Recreate cleaner-frame implementation and visibility plan

Implementation update: the local wiring is now prepared; see
`cleaner-hook-frame-implementation-2026-10-24.md` for verified scope and remaining
acceptance. The steps below preserve the original plan. Actual PNGs are bundled
with the website/API routes rather than separately uploaded, so release order is
backward-compatible worker, then website/catalog plus bundled assets. Deployment
remains paused.

User requests hiding Hooks 27/84/89 from production discovery and making Recreate
use the twenty approved source frames. This document is the implementation plan;
no live visibility, extraction, prompt or deployment change is claimed here.
Deployment remains paused until a coordinated release is ready and resumed.

## Product decisions

Hide by immutable reference ID, without deleting originals, soundtracks, generated
outputs or stored history:

| Hook | Reference ID |
| --- | --- |
| 27 | explore-paired-hook-917cba028b9bc9cfda3e9f9b |
| 84 | explore-paired-hook-e5870158a2ad1494edc92741 |
| 89 | explore-paired-hook-6365d336034633aa5070eb48 |

Use each owning release manifest's existing `excludedReferenceIds` mechanism.
Trace discovery and direct-ID admission separately: exclude from gallery/search/
filters and new Recreate preparations, while keeping archival identity/media lookup
available for existing saved work. Do not rely on CSS hiding or delete assets.
Current local discovery should move from 107 to 104 references. Old soundtrack
resolution and completed-job recovery must continue independently of eligibility
to start a new recreation; inspect result approval's current active-gallery lookup.

Approved cleaner replacements: Hooks 12, 14, 18, 19, 25, 29, 34, 38, 46, 47, 50,
52, 64, 71, 85, 93, 94, 96, 101 and 104. Exact frame indices, presentation and
elapsed timestamps, source hashes and frame hashes are frozen in
`docs/approved-hook-frame-selections-2026-10-24.json`.
Hook 18 approval supersedes the earlier window-opening requirement in this adaptation.
Hook 88's proposed frame 23 is not approved: keep its existing opening.
Hooks 45/63/73/78/83 retain user-accepted openings, including their known limitations.

## Implementation order

1. Add a versioned curated selection catalog keyed by reference ID and source hash.
   Prepare twenty exact approved PNGs as immutable source assets. Validate hashes,
   dimensions and provenance against the approved records before upload. Serve
   these curated PNGs from server-controlled storage paths rather than accepting
   browser-provided frame URLs/indices. Other visible videos keep frame-zero decode.
   Do not replace, trim or rehash the original videos, posters, soundtrack or text.
   This avoids rescanning each video or paying for frame selection on every click.

2. Introduce a new generation receipt version for curated selections. Keep legacy
   version parsing and input keys unchanged; do not simply loosen every existing
   frame-zero validator. Bind the source revision, selection revision, index,
   timestamps and served PNG hash to a new request. Extend extraction headers,
   browser verification, cache/query keys, drafts, workers and result resolution
   together. The UI and server-paid admission must resolve the exact same selection.
   A changed source hash or unavailable curated file should request refresh/review,
   not silently generate from the old opening. Invalidate stale approvals for new
   preparations while preserving recovery of immutable prior paid requests.

3. Recreate interaction: clicking Recreate loads the selected reference, obtains the
   approved cleaner source frame, shows it in the source preview and retains the
   existing influencer-photo choice. Image generation sends that exact PNG as
   Image 1 with unchanged main/supporting photo order. Use the tested shared v4
   prompt without frame-zero-specific opening prose for curated later frames.
   Existing original-frame references keep their selected behavior. Review and
   Use this frame remain explicit before video submission. No paid submission is
   triggered simply by opening Recreate.

4. Bind animation to the actual approved generated image. Review the complete
   performance around each of the twenty selected moments and adapt opening pose,
   key actions, duration and end state. Do not attach old frame-zero motion plans
   or describe a source video the provider does not receive. Selected source pose
   and generated pose can differ; user edits and meaningful drift need validation
   before labeling directions ready. Do not automatically promote untested motion
   plans to visual-qualified status. Generate the complete reviewed workflow clip,
   not an unexplained truncated tail of the reference. Preserve its important
   action/emotion subject to the chosen opening pose.

5. Update recovery and Starting frames history: label selected reference provenance,
   retain approved source association, and ensure changing the generated frame
   recomputes or validates its motion directions. Existing generated images and
   historical receipts must not be rewritten to appear generated from the new PNG.
   Hidden references remain recoverable as saved work without reappearing as new
   library choices.

6. Test combined changes: three hidden IDs absent from discovery and rejected for
   new preparations; archival identities still resolve. Verify all twenty curated
   source frames and original-frame fallback for every other eligible reference.
   Check API header/body hashes, browser admission, worker input/receipt binding,
   cache refresh, stale drafts, job recovery and history replacement. Exercise
   source-version changes/missing snapshots without paid submission. Update
   hardcoded 107-count tests to assert intended 104 discovery plus intact archived
   membership; do not rewrite historical audit fixtures as if they originally
   excluded these videos. Test the real authenticated local flow and a bounded
   reviewed image/video pilot before production acceptance.

7. Coordinated release after deployment is resumed: immutable verified source PNGs
   first; backward-compatible worker accepting new receipts second; website with
   selection/exclusion catalogs and new receipt producer third. Verify each target
   runs the intended revision. Finally verify authenticated Recreate and library
   visibility on https://www.getugcpilot.com, including real hosted asset access,
   history and final motion behavior. Local audit gallery is not production proof.
   Rollback the website producer/selection policy before retiring worker support;
   retain prior snapshots and receipt parsing for saved job recovery.

## Concrete code surfaces identified

- `worker/src/lib/explore-hook-reference-*-release.json` and shared release selector:
  gallery exclusions; getReleaseItems remains archival source of truth.
- `lib/explore/hook-source-frame.ts`, source-frame API and browser client: presently
  decode/return/verify index and time zero, with a frame0 cache key.
- `lib/explore/hook-keyframe-draft.ts`, generation API and worker contract: currently
  bind frame zero to requests and draft recovery.
- `lib/explore/hook-keyframe-result.ts`: currently returns startingFrameIndex zero;
  approval also looks up active gallery membership, which needs historical handling.
- `lib/explore/hook-keyframe-image-prompt.ts`, motion compiler, prompt preview and
  starting-frame workspace: source-specific descriptions and reviewed motion frame
  bindings must agree with selected frame provenance.

No new per-click AI selector, model change, production source-video edit or extra
user screen is needed to deliver the curated selection behavior.
