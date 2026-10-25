# Slideshow workflow changes — local implementation

## Behavior

1. Create → Source slides has Select all. It selects the reference IDs in source
   order, retains individual toggles, and never triggers generation. Original
   reference import in Add slides remains separate.
2. Use my finished slides opens the existing multi-file picker directly from
   Create and the editor's Your slides section. The upload source in Add slides
   also opens it immediately. The editor's hidden inputs remain mounted so Create
   can open the file dialog during the user's click, without an asynchronous hop.
3. Upload reference slides feeds generation guidance; Use my finished slides
   feeds the output sequence. Helper copy explains the distinction. Existing file
   validation, partial-success handling, ownership and 4:5 fitting remain intact.
4. Save & return saves Hook/Talking Head clip edits (including Demo) and returns
   to the overview. Save & review post saves Wall/Slideshow edits before opening
   review. Save-only remains available. Failed/uncertain saves do not navigate;
   slideshow recovery uses the same request ID. Reviewing does not schedule.
5. Edit slides → Apply appearance to other slides supports all or selected
   slides. It copies only typography/layout/background appearance, never heading
   or body words. Undo restores the prior affected appearance fields while keeping
   later words and manually changed styles. Sequence/image changes clear that
   temporary undo entry. The existing text fitting and export path remains shared.
6. Recreate slide opens a responsive dialog over Edit, reusing the mounted image
   generation composer and results. The request uses the owned regeneration asset
   and omits catalogue sources and slideshowSlideCount (the API forbids combining
   whole-sequence generation with a regeneration target). Generation remains an
   explicit cost-bearing action. Choosing a result replaces only the intended
   slot; original text, ordering and other slides survive. Restore previous image
   remains available. Closing the dialog keeps the old slide and clears the
   replacement target; accepted jobs retain the existing recovery/history behavior.

## Validation

276 unique automated tests pass:

- 242 UI/component/render/request tests across slideshow editor, actions, text
  tools, click actions, clip editor, Demo state, live clip controls and generation
  composer suites. Includes real SVG/PNG text rendering; external services mocked.
- 34 image-generation API tests, plus rerunning the six workspace action tests
  after correcting the single-slide request contract.
- Application `tsc --noEmit --incremental false`, scoped ESLint and diff checks.

New assertions exercise all/selected appearance, exact text preservation, Undo
after subsequent typing, direct file-picker callbacks, reference Select all,
save-only versus save-and-leave, failed save/recovery, Wall review, Demo return,
stale replacement rejection, dialog close, editor portal targets and prevention
of whole-sequence replacement during recreation. Existing generation tests also
verify regeneration without catalogue references or attachments.

The generation test fixture was updated to support the earlier automatic Hook
text query hook and its empty context fragment; no runtime behavior was changed
to satisfy that fixture.

## Production acceptance still required

This change has not been deployed. Browser access was previously disabled in Work
settings; no bypass or production visual acceptance was attempted. No paid model
calls, production uploads, saves or schedules were submitted in these tests.

After deploying, verify on https://www.getugcpilot.com with a signed-in account:

- Desktop/mobile direct file-picker gestures, file cancellation, upload progress,
  scroll behavior, dialog focus/Escape and readability of the two upload paths.
- Eight-slide Select all and individual deselection; generation cost/count still
  requires deliberate submission.
- Bulk styling/Undo, saved/reopened exact words and rendered text fitting.
- Successful/failed save-and-return and save-and-review with real persistence.
- A paid single-slide recreation, cancel before replacement, explicit replacement,
  restored prior image, neighboring slides/text unchanged, and reload recovery.

No migration or worker change is needed for these UI changes. Earlier stored
starting frames and automatic Hook text have their own rollout requirements.
