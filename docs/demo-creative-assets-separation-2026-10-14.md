# Demo and Creative Assets separation

The user identified product demo footage appearing while replacing a Hook video. Creative Assets should list opening/creator/generated footage; dedicated demo footage belongs on the Demo screen and its picker.

The generic media-list visibility policy omitted `demo_upload`. Explore's Creative Assets picker likewise accepted any ready video, although its Demo picker correctly required `demo_upload`. Both filters now exclude dedicated demos from Creative Assets. Original uploads, generated hooks and creator footage remain available. Demo inventory reads its own records and ready projections directly, so it is unaffected by the generic filter. The separate scheduling query and Secondary clip policy explicitly retain ready demos, preserving existing demo scheduling.

The specific WhatsApp video in the screenshot, asset `b86a9464-c50e-49e4-8b4f-9973cfaf5f82`, was originally uploaded as `upload` under `explore-source`, with no Demo record. The user explicitly identified this clip as a demo. Its 19.2-second duration and 4.53 MB size satisfy existing Demo limits. A guarded, owner-bound, atomic data correction registers that exact asset on Demo using its existing ID, title, storage key and file URL. No filename-based classification, upload, render, deletion or duplicate file is performed. Other generic uploads retain their existing classification.

Registered generic-namespace Demo sources are recognized only after exact owner, project, source-record, storage-key, collection and undeleted checks, plus their server-owned registration marker. This preserves their original editor and the existing metadata-only Demo removal path that retains bytes for completed compositions.

## Previous release acceptance

The complete validated release `c6a2e13f1371ebd5cc70d18d88f690eeb41fbdcd` is on GitHub main. Website `dpl_YcmpHrBQ8HEixqai5DgnboFJtsph` and MCP `dpl_CYnqA7wTxshCQodyxaNjjPL199Y2` reached READY and own the live domains. The worker service and one-shot job use immutable digest `sha256:464b0153737e41b33441eac3c746c57c8262eff9df642200a36901a51d8fe5de`. The service has one warm instance, internal ingress, concurrency one and a 900-second timeout, with preserved secrets. GitHub MCP CI passed; all 36 production baseline checks and exact production font-byte checks passed.

An authenticated production caption test on the same uploaded 19.2-second clip generated 75 words and opened the centered review dialog. Job `f3b4e97e-b126-4909-975f-21d094a0353d` started 0.948 seconds after creation and completed 10.392 seconds later: 11.340 seconds total, compared with 130.626 seconds before warm activation. This is one measured run, not a promised duration for every video. It used the service directly and has no Cloud Run Job operation. The live Serif overlay uses Instrument Serif and shows “Most mobile apps” on one line; changing the first word updated the preview immediately and the original text was restored. Preview Continue to edit measured 166 pixels and Edit talking-head video measured 198 pixels at the checked viewport.

## Release scope

The user explicitly selected deploying the validated release now, deferring ongoing SEO source work. New inline Demo actions from another chat arrived after that source freeze and are also outside this targeted follow-up. The follow-up commits only the shared visibility filter, defensive picker filter, registered-source recognition, related tests and this release record. Every deferred/generated path remains on disk; exact paths are recorded in the local release exclusion manifest.
