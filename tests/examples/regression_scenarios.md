# Required UGCPilot Regression Scenarios

These are scenarios, not assertions against an unknown app codebase. Convert into Playwright/Cypress/unit/integration tests using real selectors, routes, auth, seeded media and a controlled publishing sandbox.

## UI 1: Single loaded frame
- GIVEN a user already has a valid selected starting frame
- WHEN opening Hook Video > Create > Generate
- THEN exactly one frame thumbnail is visible with Change
- AND there is no permanently displayed Choose Photos tile beneath it
- WHEN clicking Change, THEN the supported chooser opens
- WHEN cancelling, THEN the original frame and panel dimensions remain unchanged.

## UI 2: Restore lifecycle
- GIVEN a saved image and slow response
- WHEN opening page
- THEN placeholder reserves the same dimensions as eventual preview
- AND restoration eventually resolves or shows retry; no indefinite blank/collapsed panel
- AND no stale response changes user-selected replacement frame.

## UI 3: No collateral changes
- WHEN starting-frame code changes
- THEN Create / Demo / Schedule nav, references grid and Your videos tab remain functional at known desktop/mobile sizes
- AND no new permanent controls appear; compare approved visual baselines.

## FRAME 1: Clear initial frame
- GIVEN source video t=0 contains identifiable face and valid continuation
- THEN choose t=0, create stable photorealistic image of influencer in source scene.

## FRAME 2: Occluded initial frame
- GIVEN face is covered at source t=0 but visible at t=1.5
- THEN list candidate timestamp(s) and rationale
- AND select clear valid anchor, recording timestamp 1.5
- AND video prompt generated t=0 maps to source t=1.5; do NOT replay source t=0..1.5 as if from original starting state.

## FRAME 3: Full reconstruction from mid anchor
- GIVEN selected frame source t=1.5 and user wants complete t=0..end source
- THEN plan early pre-roll + post-anchor clip OR explicitly document inability to reconstruct earlier portion with the available model
- AND evaluate edit boundary for seamless continuity.

## PROMPTS: Video analysis and image/video roles
- WHEN changing any prompt template
- THEN verify actual source-video ID, correct selected anchor and influencer ID through all pipeline stages
- AND assert that camera, pose, hand gestures, action order and timing are represented
- AND no source-person identity leakage/contradictory prompt instructions occur.

## SCHEDULE 1: Time picker
- GIVEN valid ready media and connected account
- WHEN selecting time 21:30 in Asia/Kolkata
- THEN interactive 24h picker shows 21:30 before and after reload
- AND backend stores the correct UTC instant for date.

## SCHEDULE 2: Durable targets and worker
- GIVEN two account targets and valid datetime
- WHEN submitting once
- THEN exactly one schedule and two publication targets persist
- AND a backend job/outbox exists
- AND it publishes even if browser is closed
- AND duplicate job delivery cannot blindly re-post twice.

## SCHEDULE 3: Negative states
- Account not chosen -> disabled submission
- Past/invalid time -> blocked with explanation
- Worker timeout -> no false published state
- One of two accounts fails -> per-target status, retries where appropriate
