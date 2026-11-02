# Slideshow Face Swap implementation audit

Read-only application audit: slideshow-reference-picker, slideshow-face-choice, composer, format-workspace state, ugc-chat-workspace planning/reconciliation and face-swap-api credit admission, slideshow-face-swap planner and tests.

VERIFIED locally: composer person icon beside +; compact face picker; face mode switches thumbnail selection without changing source selection; no default face marks; marks restricted to generated source slides; Clear; outside-close; remembered reopening. Fresh .tmp/face-swap-final.cjs PASS. node --test scripts/slideshow-face-swap-ui.test.mjs:4 PASS. Four tests include no-face/no-marks planning, deduplication and Version1-only. Normal generation line remains base cost; face line appears only when selection open. API requests include target/face idempotency key; one reserve per dispatched swap. Actual billed execution not exercised.

UI flow: choose source slides; instructions; person icon; choose face; toggle eligible slides; click outside; Generate normally; marked Version1 images trigger follow-up swap after normal generation completes. Other slides/versions remain generated normally. State remembers opening/closing; initial face/slide choice uses component state and is not a durable saved setup across full page reloads.

OPEN UGC-UI-104: combined affordability is not checked before generating base images; insufficient later face balance may fail follow-up while preserving originals. Face library query failures have no explicit error/retry UI. These are code-confirmed gaps, not paid reproductions. Core selection behavior verified; production face fidelity, billed deduplication/recovery and browser-close completion NOT VERIFIED. No application files edited or deployment performed.
