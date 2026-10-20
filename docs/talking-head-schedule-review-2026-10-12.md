# Talking Head + Demo Schedule presentation

The Talking Head + Demo Schedule stage now uses the same review form styling as Hook video and Wall of Text. The final preview remains on the left and publishing settings on the right, with a draft summary and a shared-style bottom action row. Create, Edit and Schedule remain in the existing left-side header navigation.

Back to Edit returns to the existing edit stage. Review schedule forwards the existing finishing boundary action, including its disabled state, busy state, recovery refresh and errors. The change does not modify generation, clip preparation, continuous preview playback, saved media verification, connected-account validation, schedule receipts or server submission. Layout previews continue to disable scheduling.

Real stage changes also reveal the workflow root and reset inner panes. Selecting the already-active stage leaves scrolling and playback intact. Caption, timing and clip sources survive navigation.

The combined local validation passed 160 focused tests, including summary and bottom action forwarding, preview guards, source/audio preservation, scheduling recovery and cross-tab safety. TypeScript and scoped ESLint passed. The main agent verified the desktop continuous preview and retained schedule fields, plus the phone form and sticky actions without horizontal overflow. This change has not been deployed or accepted against production.
