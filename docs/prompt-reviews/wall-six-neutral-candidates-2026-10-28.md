# Wall placement candidates: six neutral comparisons

Local review only; these are not activated profiles. The source-hash-bound candidates for Wall 49, 52, 56, 58, 62 and 63 were rendered using the original caption and compared side by side with their source opening. All six match the observed original line count: 11, 7, 6, 4, 5 and 7 respectively. The text placement and width appear close in these neutral comparisons; font identification is not established.

For each, one locally authored business-context example was evaluated with the same formatter. The examples fit within the source line budget plus two lines and the bottom safe boundary. These examples are not AI outputs and cannot prove that arbitrary Remix output will fit. No saved draft or video was changed.

Reproduce with `node --import ./scripts/next-server-only-test-loader.mjs --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON outputs/wall-layout-batch-20261028/candidate-review-49-52-56-58-62-63.mjs`. The script verifies source identity and exact hash, requires a ready single-block source, and saves `candidate-<number>-comparison.png` in that directory. Compare source (left) with neutral rendition (right).

Wall 49's quarter-second contact sheet was inspected from 0 to 6 seconds of its 6.36-second source: the caption remains in place as the person moves. The last 0.36 seconds and all videos' rapid transitions are not proven frame-accurate. Existing notes document sampled temporal reviews for the other five; none of these neutral comparisons establishes contrast on generated footage.

Remaining review: Wall 50 uses very small text below the current 36px fitter minimum. Wall 51, 53 and 61 contain headings or lists requiring structural handling. Wall 55 has text-fit and contrast risks; Wall 60 has low source contrast. Wall 27 has separate regions; Wall 37's caption is incomplete; Wall 42 has duration eligibility to verify. Other candidates still need source and output comparison. Before enabling any new profile, test source mismatch, source and representative longer/shorter text, overflows, edit/save/reopen, and full-duration behavior with the actual runtime. Actual AI output, generated-scene contrast, export and hosted acceptance remain unverified.

No application code, deployment, model call or video generation was performed. The review used existing sampled source evidence and did not independently reread the complete Explore context and incident ledger; therefore it is not a complete code-change preflight.
