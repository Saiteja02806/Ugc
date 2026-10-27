# Centered Talking Head resume prompt - 27 October 2026

## Scope
Located the screenshot in `components/explore/workflow-draft-entry.tsx` (`WorkflowDraftEntryBoundary`, ambiguous old-link ask state). Replaced the top-left prompt with a centered440px card, quiet history icon, concise description, full-width primary Resume and secondary Start new video, and separate Back to Explore link. Existing design tokens and Geist font retained. Mobile reserves the existing64px navigation header; short landscape screens scroll without clipping actions. No new permanent controls or modal trap.

Only presentation changes: recovery effects, request identities, browser storage, resume/start URLs, error/loading views, active editor and saved-draft list behavior preserved. Isolated production source changes only the entry component and its new scoped CSS module. Prior62reference files and both deployed runtime fixes compare byte-identical. All unrelated user changes excluded from this targeted release; marketing, Hook optional face-photo work, scheduling, Wall references and migrations preserved locally. No Git push claimed.

## Files changed
- components/explore/workflow-draft-entry.tsx
- components/explore/workflow-draft-entry.module.css (new)
- scripts/workflow-draft-lifecycle.browser.cjs (existing acceptance fixture, scoped CSS/real Button/font and visual checks)
- docs/ai-context/clear.md (append-only UGC-UI-019)
- EXPLORE_CONTEXT.md (presentation decision)
- docs/resume-work-prompt-ui-2026-10-27.md (this receipt)

## Checks and evidence
- TypeScript noEmit and scoped ESLint PASS.
- Draft lifecycle/session tests13/13PASS: old-link intent, refresh, owner isolation, exact media, completion state and durable request provenance.
- Actual entry boundary/session-hook browser fixture PASS after change: refresh, selected source/demo/caption, fresh independent work, saved draft reopening, duplicate-tab lock, confirmed schedule fixture state, closed-tab reopening, ambiguous URL asks before loading media, and new-work navigation. Fixtures use owned fake media/auth and do not create paid jobs or real schedules.
- Visual geometry PASS at1536x864,1907x912,390x844,320x568,844x390. Compact centered card, no horizontal overflow,44px actions and Resume/Start/Back keyboard order checked. Short landscape allows safe scrolling rather than clipping the card.
- Matched original-source baseline fixture also PASS. Desktop before/after, phone and landscape screenshots manually inspected: clear hierarchy, spacing and fit. Artifacts `.tmp/workflow-draft-lifecycle/resume-{before,after}-WIDTHxHEIGHT.png` and geometry JSON. Logs `.tmp/resume-work-ui/{before,after}-browser.log`.
- First geometry assertion incorrectly required a400px card to fit a390px landscape viewport; corrected assertion to account for scrollable padding, preserving product behavior. A parallel before/after run shared fixture output; discarded that result and final after run was sequential and PASS. No application failure inferred from these fixture issues.
- Staged hosted build PASS, including types/static generation/native-route bundle checks: dpl_7RCmDsbfGBjZsX8E3M78p15keGgE, https://ugc-jb8aa9mx5-ugcpilot.vercel.app. Build evidence `.tmp/resume-work-ui/build.log`.

## Sources and contracts
Read root AGENTS.md applicable rules, nonnegotiables, actual Explore draft/history sections, ledger/UI incidents and exact component/callers/AppShell/sidebar/draft lifecycle tests. Applied mandatory context-memory, immutable-contracts, ui-clarity and regression-gate skill files, plus frontend-design guidance. Installed Next16.4.2 use-client and CSS Modules guides consulted. Preflight readability script ran for this exact request. Historical context-read truncation limitation remains as disclosed in earlier receipts; no claim that every historical paragraph was reread.

Protected behaviors VERIFIED by diff/tests: resume exact old ID, new-work entry, Back URL, saved drafts, refresh/duplicate-tab recovery, keyboard focus; reference media/prior fixes hash-identical. New generation, publication/provider behavior NOT TESTED because no change to those paths. No paid generation/transcription/social action.

UGC-UI-019 records user screenshot separately from verified cause: ask-state renderer had only unbounded top-left padding, no centered container. Local fix verified; live acceptance recorded below. Rollback boundary: previous deployment dpl_8BRwiJK2Kanr75D6CGPLEgqqADX2 or restore only the backed-up entry component and remove its stylesheet import/file. Do not revert unrelated work.


## Production acceptance
Promoted dpl_7RCmDsbfGBjZsX8E3M78p15keGgE after verifying prior live deployment identity. Production in-app browser opens the exact old-work URL and displays the new copy/card. Live desktop1280x720 card440x399.8 at420,160.1 gives exact640,360center. Live phone390x844 card at20,242.55 with422.9height centers at454within content below64px header. Visually inspected both live screenshots and verified Tab advances Resume to Start new video. Existing Back URL retained. Viewport override cleared; updated page left open as deliverable. No draft choice clicked in production, so user work remains unopened.

Live screenshots: `.tmp/resume-work-ui/live-desktop.jpg`, `live-mobile.jpg`. Status: UI PRESENTATION VERIFIED LIVE; production resume/new mutations not exercised (existing behavior validated in local browser fixture). No claim of a fresh complete media generation/publishing journey.

Runtime source SHA256:
- components/explore/workflow-draft-entry.tsx: f774b003306a8ff258a4b30b16da615b099f7684558a8ef5f4e370dcd13c26ae
- components/explore/workflow-draft-entry.module.css: 250c894a426e92287d7c3995a23587b7c147da40d7d80a9a0357d2b88bedaaea
