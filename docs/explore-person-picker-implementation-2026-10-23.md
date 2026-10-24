# Person picker implementation — 23 October 2026

Status: implemented and verified locally. Deployment remains paused at the user's request.

## Implemented behavior

Hook, Talking Head and Wall of Text share the updated Recreate preparation:

- **My AI influencers** contains saved generated person images; **Uploaded photos** contains Explore reference uploads. The inventories remain separate.
- **UGC Pilot images** is a small labelled control that switches the same grid. Back returns to the prior owned source. Empty sources offer the relevant upload or influencer-builder action instead of silently opening stock images.
- Choose/Change photos expands the library inline within preparation. Selecting a photo keeps it open. Done collapses it and returns keyboard focus to the trigger.
- Main and supporting photos remain explicit, with promotion/removal and upload behavior retained. Selecting a different saved influencer retains the existing main replacement and previous-support reset semantics.
- Starting frames stay **below** setup. Result cards have bounded widths and align to the start of the grid.

The regular shared image chooser and separate Talking Head upload chooser also use Uploaded photos and a compact catalogue control. This does not add generated influencer history to the normal video composer; that source remains in Recreate preparation. Composer Starting frames history remains distinct.

## Blank preview handling

Job completion and image display now have separate state. Each generated preview shows loading feedback, an error after a failed load or 15-second timeout, and Retry preview. Approval requires the exact selected asset's current URL to have loaded, in both the button and its handler. Retry remounts the image and reads the saved job; it preserves generation identity and does not create a paid request.

This handles the unsafe blank-but-approvable state. The original screenshot's production failure has not been independently reproduced, so its underlying media-delivery cause is still unconfirmed.

## Local verification

- 88 focused starting-frame, influencer-picker, upload, history, navigation and variation tests pass.
- `scripts/explore-person-picker.browser.cjs`: 12 scenarios pass across Hook, Talking Head and Wall of Text at 1536×864, 1280×600, 390×844 and 320×568. Checks include inline selection, stock switching, upload/main promotion, retained support, failure/retry without resubmission, four results, selection/approval, enlargement, visible footer and no horizontal overflow.
- `scripts/workflow-image-library.browser.cjs`: six regular Hook/Talking Head desktop/mobile scenarios pass. Pagination, multi-selection, original upload URLs, hidden-catalogue loading and warm-cache reuse checks pass for the 114-item fixture.
- Scoped ESLint and TypeScript checks pass.
- The existing image-picker-performance test fails before running because this installed Next version does not export its imported internal optimizeImage helper. Optimizer implementation/configuration is unchanged by this patch.

Browser fixtures use the actual picker/workspace components with synthetic account/job responses. Upload IDs are replaced with fixture UUIDs and the fixture serves thumbnail pixels, so these checks do not verify real uploads or the Next optimizer. No paid generation was submitted for these UI changes. Receipt and screenshots are under `.tmp/explore-person-picker/`; regular picker evidence is under `.tmp/workflow-image-library-browser/`.

Production Hook redirected the available browser to sign-in. Authenticated media delivery and hosted acceptance remain unverified. Physical touch and browser zoom were not tested. No website, worker, schema or API deployment was performed.
