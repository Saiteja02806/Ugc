# Hook hosted rollout recheck — 19 October 2026

The 18 trimmed references are **not active in the hosted Hook workflow**. Fresh published catalogue reads returned all 98 Hooks. Each approved trimmed reference still uses its original content-addressed MP4 key. None uses the verified corrected hash. Fresh readback of all 18 original-import files on D: matches the corrected hashes, so the earlier physical replacement succeeded while hosted activation was missed.

Affected Hook ordinals: **1, 2, 3, 4, 6, 7, 20, 30, 39, 40, 42, 43, 53, 54, 71, 78, 88, 89**. Hook 18 remains unchanged as requested.

The website's current READY production deployment is `dpl_Dfbks1DRK3L4AMnmWQRJFU9ohNSM`, source commit `4c22c19e30eeeab6c24be8c40658a1deae05d98e`. Its release manifests use the same old video keys; the deployed active-gallery resolver uses those manifests. Normal references also have separate preview objects, so replacing only a source MP4 without updating previews would leave old gallery footage visible.

The audio request **is applied** for Hooks **3, 13 and 59**:

- Current published references return `paired_audio: null`; their videos remain available.
- Website deployment manifests mark all three `audioPolicy: silent`.
- Their background MP3s are absent from the manual-review folders and the review map has no active background track for them.
- Fresh read-only Cloud Run inspection shows the AI generation service READY, with 100% traffic on `ugc-ai-generation-worker-hookaudio-0df6a7d3`, commit `0df6a7d39ae043eff0a9da0be9c0a61a0bf4c8fe`, image digest `54d28565616dc8391c1e02cc179f9d3c81f306b8aa981039a6370b4a162d51e5`. This is the earlier verified build that strips provider audio for these references and skips their separate soundtrack download.

The exclusions affect automatic playback/mapping and new output. Historical generated files and explicit saved soundtrack receipts are retained. This is not a claim that the immutable original soundtrack objects were purged from cloud storage.

Evidence: `outputs/hook-reference-audit-2026-10-19/live-rollout-recheck.json`, with the complete 18-way comparison, three audio checks and current worker identity. `published-catalogue-recheck.json` contains the fresh paginated catalogue response.

Direct browser playback could not be accepted: the production workspace remained at Opening your workspace after refresh. Source/deployment identity comparisons establish the rollout gap without claiming fresh frame-by-frame playback. No production mutation or paid generation was performed in this check.

Required next release: publish the verified trimmed source objects and matching preview objects, activate matching duration, prompt and caption source/timing across website/catalogue and generation workers, then verify actual production playback and source hashes. Preserve Hook 18, the three audio exclusions, all other audio, and historical source identities. Do not overwrite immutable old hash keys or release unrelated worktree changes as part of this correction.
