# Landing hero rotating badge — 27 October 2026

Status: PARTIALLY VERIFIED; local implementation, not deployed.

Latest27October2026 user instruction supersedes alternating badge on Home: show Instagram/TikTok/YouTube only until explicit later reveal. showMcp defaultsfalse in both wrapper/clientcomponent; no timer when disabled. No MCPnames/status on initialrender or after6.4seconds in actualbadge fixture; hero fixture verifies same aftermultipleheadline cycles. Existing opt-in design retained for future instruction, tested explicitly via isolated mcp-preview fixture query, never enabled in Home. Updated homepagebrowserassertions require socialstate/#workflow. Scopedlint/types/gallerytestsPASS; no deployment. Full details/reference follow-up in docs/landing-rotating-text-2026-10-27.md. Header/footer/otherMCP sections unaffected.

## Scope and interaction contract

User explicitly superseded the previous social-only badge decision: initially show Coming soon / Claude / Codex / Grok with real brand icons and an arrow. After three seconds show the existing Post right away / Instagram / TikTok / YouTube with their existing icons. Alternate every three seconds. Pause while hovered or keyboard-focused so a link destination cannot change during interaction. Agent state links to /mcp; social state retains #workflow. Fresh navigation/reload starts with agents. Keep hero copy, gallery, header and lower publishing sections intact.

User's final refinement separates the status from the action: the agent row now says Control from / Claude / Codex / Grok, with Coming soon in a separate small tag at the pill's upper-right edge. The social state remains unchanged. This replaces Coming soon as the leading row label.

Implementation boundary: isolated client component for timer and focus/hover state; existing server wrapper supplies the unchanged social marks. Locally bundled SVG paths from LobeHub lobe-icons, MIT license included. No dependency, global CSS, backend, auth, schema or publishing change. Fixed state dimensions avoid heading movement; stacked mobile styling follows the previous badge's breakpoint treatment. No media, prompt or scheduling calls required.

## Files changed for this task

- components/marketing/landing-platforms.tsx — preserve shared social exports; wrap hero badge.
- components/marketing/landing-rotating-badge.tsx — two states, three-second timer, link arrow, focus/hover pause.
- components/marketing/landing-agent-mark.tsx — local Claude/Codex/Grok SVGs.
- public/marketing/agent-icons-LICENSE.txt — asset license and provenance.
- scripts/marketing-layout.browser.mjs — adapt existing homepage assertion to both badge states and four SVGs.
- scripts/landing-badge.fixture.browser.cjs — actual-component browser acceptance, HEAD before baseline and screenshots.
- docs/ai-context/clear.md — append approved contract change under UGC-UI-020.
- this receipt.

## Preflight sources

AGENTS.md; EXPLORE_CONTEXT.md and docs/ai-context/clear.md (prior context reads retained; latest relevant entries reviewed); docs/ai-context/nonnegotiables.md; docs/landing-badge-investigation-2026-10-27.md; ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity and ugc-regression-gate SKILL.md files; installed Next.js 01-app/01-getting-started/04-linking-and-navigating.md; badge, Home caller, social visibility, MCP routing and existing browser checks.

Preflight command: python tools/preflight.py --repo . --task 'Replace landing hero social badge with Coming soon Claude Codex Grok and arrow link to existing MCP information page; preserve lower social display and hover gallery' — PASS. Later user refinement adds icons and alternating social state as described above.

## Verification and limitations

- Scoped eslint for three TSX files and two browser scripts — PASS.
- npx tsc --noEmit --incremental false — PASS.
- node --test scripts/landing-gallery-motion.test.mjs — 5/5 PASS. Initial attempt used a nonexistent lib/marketing/landing-gallery-motion.test.ts path; corrected command above actually passed.
- node scripts/landing-badge.fixture.browser.cjs — PASS in headless Chrome after elevated localhost access. Sandboxed first attempt failed ERR_NETWORK_ACCESS_DENIED. Actual React badge, actual CSS, actual brand and platform SVGs; static shell and stub MCP destination, not a Next.js server or production acceptance.
- 320, 390, 1440px in dark/light: agents first, social after three seconds, four SVGs per state, exact stable bounds, no badge clipping or page overflow. Desktop bounds 440x34; mobile 280x76. Before screenshots from HEAD captured at the same widths. Manually inspected agents-dark-1440, social-dark-1440, agents-dark-320 and social-light-390: visible marks, border and labels.
- Hover/focus pause, resumed rotation, repeat cycle, keyboard workflow navigation and MCP click pathname — PASS. No page errors. Generated evidence: .tmp/landing-badge-browser/receipt.json and before-*, agents-*, social-* PNGs.
- git diff --check — PASS for this patch. Existing unrelated line-ending warnings retained.

VERIFIED by scoped tests/diff: gallery motion/source identity remains unchanged; lower shared social marks/visibility exports unchanged; hero/header/backend source untouched. Authenticated Create/Demo/Schedule flows NOT TESTED in this badge task. Full Next.js build and complete marketing browser suite NOT RUN against the combined worktree; six unrelated paths remain unmerged in the index. No conflict resolution, staging, commit or deployment performed. Public MCP fetch via web tool returned inaccessible; current live MCP page/production badge NOT VERIFIED here. Local proxy source confirms website /mcp rewrites to /mcp-server, distinct from the MCP protocol host.

UGC-UI-020 remains OPEN for its original unstyled screenshot; this approved behavior change is not proof of that screenshot's root cause. No new reported defect in this task. Rollback boundary: only the eight files above; preserve all other worktree and merge changes.

## Visual polish follow-up — 27 October 2026

User requests the premium illuminated edge/depth in supplied reference ef961d0d and a straight right arrow as drawn in e32f730c. Changed only landing-rotating-badge.tsx, this receipt and the append-only ledger in this follow-up. Replaced ArrowUpRight with ArrowRight, added a neutral vertical highlight, inset top rim, subtle exterior glow and restrained hover lighting, with a separate light-theme treatment. Existing dimensions, status tag, text, local icons, timer, focus/hover pause and both destinations preserved. No animated shine, global CSS or dependency added.

Preflight: four mandatory UGCPilot skills re-read; AGENTS/nonnegotiables/current Explore and ledger entries reviewed with prior context retained; actual badge/test/source and full git status inspected. Ran tools/preflight.py with actual visual-polish request — PASS. Unrelated six unmerged paths remain untouched.

Verification: scoped eslint for component and fixture PASS; git diff --check scoped PASS; actual-component Chrome fixture rerun PASS across320/390/1440px and dark/light, including both states, stable dimensions, no overflow, repeat timing, pause/resume, keyboard workflow and MCP pathname navigation. Inspected updated desktop agent/social,320px dark and390px light screenshots. Pre-glow baselines retained at .tmp/landing-badge-browser/pre-glow-dark-{1440,320}.png. New screenshots and receipt remain in the same evidence directory. Fixture screenshot borders crop part of the exterior shadow; actual CSS renders the full glow. Full typecheck, full app build, authenticated workflows and production acceptance NOT rerun for this styling-only follow-up. Prior typecheck passed before this follow-up. Backend and gallery source unchanged by diff; no prompt/scheduling evidence applicable. Local visual/interaction scope VERIFIED; deployment remains NOT VERIFIED / not performed.

## Grok bot and edge status follow-up — 27 October 2026

User supplied 9d95e1bc PNG and marked the further-right status position in 7a709a7e. Use the supplied image unchanged, label Grok bot, and move the status to right:0 with a quarter-tag-width overhang at desktop; align exactly to the edge on mobile to avoid viewport overflow. Preserve glow, straight arrow, sizes, timer, labels for other clients/platforms and destinations. Slightly tighter mobile gaps accommodate the longer name within the original280px badge. Two TSX components, two browser scripts, public/marketing/grok-bot.png, this receipt and append-only ledger changed in this follow-up. Claude/Codex remain SVG; Grok is now Next Image with explicit16px dimensions, decorative alt and unoptimized local asset. No generative image edit or external image request. Removed unused Grok SVG rendering branch.

### Final status placement clarification and header check

User explicitly confirms: Coming soon starts at the right edge and extends outward, and becomes only slightly smaller. Updated component to sm:left-full/sm:right-auto,9px text (previous10px) and6px horizontal padding (previous8px). Mobile keeps the tag inside the right edge to avoid overflow. This supersedes the quarter-tag overhang above. Changed only landing-rotating-badge.tsx, landing-badge.fixture.browser.cjs, this receipt and ledger for this follow-up; header source remains untouched. Baselines pre-outside-status-dark-{1440,320}.png retained.

Chrome actual-component fixture PASS320/390/1440dark/light, with explicit desktop status-start boundary and mobile alignment, smaller tag, unchanged badge geometry/rotation/icons/links/focus/hover pause and zero errors. Scoped eslint/diff check PASS. Screenshots inspected. Earlier attempted tool batch was not executed because automatic approval review hit a usage limit; retry after user asked to continue executed successfully. Full build/types not rerun for this class-only update; no deployment.

Live real-domain header check HTTP200 redirected www to https://getugcpilot.com/. Desktop1440header shows UGCPilot, Guides, Pricing, Sign in; zero /free-tools header anchors. Mobile390 opened navigation menu and Free tools is not visible. Current local landing-header.tsx navItems includes Free tools -> /free-tools, rendered in desktop and mobile menus, and Home uses that header. Therefore local source contains the item but live header does not. No cause beyond this observed release difference established. Evidence .tmp/landing-badge-browser/live-header-receipt.json and live-header-{desktop,mobile}.png. User requested check/report, not an additional header edit or deployment. Header presence observation VERIFIED; production badge remains NOT DEPLOYED/NOT VERIFIED.

### Slight attachment correction — 27 October 2026

Latest30816fd0 screenshot/user report requests slight physical touch instead of detached status. Changed top offset -12to-8px, desktop inward offset12px from leftfull. Status intersects the top-right corner while retaining9px text/small padding. Desktop/mobile dark/light screenshots inspected: visible attached corner, no clipping; actual-component Chrome six size/theme cases PASS including >3px vertical overlap,12px horizontal inward overlap, initial/repeated3s rotation,pause,icons,links,stablegeometry. Baseline pre-touch-1440.png retained. User also removes footer socials; see footer receipt follow-up. This supersedes the previous external-only geometry. Incident UGC-UI-023 recorded and locally verified; original020 screenshot cause remainsopen. Not deployed; full-app build/production acceptance not performed.

Preflight sources: mandatory four skills re-read, AGENTS/nonnegotiables/current Explore and ledger context retained/reviewed, installed Next.js Image guide read for explicit dimensions/local src. Ran tools/preflight.py with this actual request — PASS. Existing merge/index conflicts untouched.

Verification: copied41916-byte240x240 image matches supplied SHA256 2b89317b3e8d8382b349a2255b8fe5be08280a21c6d94bfc03e80561253cb270. npx tsc --noEmit --incremental false PASS; scoped eslint and diff check PASS. Browser fixture initially timed out before rendering baseline after adding Next Image; no production failure inferred. Expanded its build-time process.env shim and retained actual Next Image instead of an image stub; rerun PASS with zero page errors. Tests explicitly confirm natural240px icon loaded, status right edge, both names/icons/states, stable440x34desktop/280x76mobile dimensions, no overflow, initial/repeated3s timing, hover/focus pause and navigation. Chrome320/390/1440dark/light all PASS. Inspected final agents-dark-1440, agents-dark-320, agents-light-390 screenshots. Pre-change images saved pre-grokbot-dark-{1440,320}.png; new screenshot clips include the status overhang/glow. Evidence remains .tmp/landing-badge-browser/receipt.json and PNGs. Full Next app build, live site, authenticated flows NOT VERIFIED; fixture MCP navigation target remains a stub. No backend/prompt/scheduling change or evidence needed. No deployment. Status PARTIALLY VERIFIED overall, local requested scope VERIFIED.
