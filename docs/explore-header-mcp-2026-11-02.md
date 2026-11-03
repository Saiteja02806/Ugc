# Explore header MCP availability — 2 November 2026

Implemented only header presentation: gray disabled MCP / Coming soon control; existing white Upgrade and anonymous-only Sign up retained. Native disabled control has no handler or destination. Action group wraps on phone widths, preserving existing shortcuts.

Files changed by this task: components/explore/explore-workspace.tsx; components/explore/explore-workspace.module.css; scripts/explore-navigation-ui.test.mjs; EXPLORE_CONTEXT.md; docs/ai-context/clear.md; this receipt. These source/context files already contained user work; existing modifications preserved. No dependency, global style, provider, billing, auth, actual MCP endpoint or deployment changes.

Preflight sources read: AGENTS repository rules; nonnegotiables; applicable Explore context/header decisions and ledger history including UI097/110/112; ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity and ugc-regression-gate skills; bundled Next Link usage. Full large historical Explore context and ledger were not reread in full. Existing before-change source/diffs and user screenshots inspected. Edit contract: header controls and narrow-screen wrapping only; rollback only own MCP markup/styles/assertions.

VERIFIED: 20 existing navigation/cover tests pass, including real component renderer assertions for disabled MCP/nohandler/nohref, both auth states, unchanged Upgrade/Sign up destinations and existing shortcuts. Scoped ESLint and scoped git diff --check pass. No tests weaken existing navigation assertions.

NOT VERIFIED: browser after-change appearance, desktop/mobile bounds, real authenticated auth/billing navigation and hosted acceptance. Local app browser stalled compiling; isolated fixture browser could not connect. Temporary fixture used real TSX/module CSS with isolated auth/tool data and simplified utilities, but no screenshot acceptance is claimed. No production changes made. TypeScript result recorded in ledger follow-up.

Incident UGC-UI-121: source/behavioral verification only; visual/production pending. New product decision appended to EXPLORE_CONTEXT.md. Existing covers, route strings, signup gating and billing functions preserved by scoped diff and render tests.

Compact follow-up: Only .mcpComingSoon and .comingSoonLabel rules in the CSS module changed:82x36px, flexcolumn,1pxgap,12pxMCP/9pxComingsoon. Existing20testsPASS, diffcheckPASS. Screenshot .tmp/explore-header-mcp/compact-mcp.png measured/viewed from actualTSX/moduleCSS isolated browser fixture (simplified utility styles). Additional task changes: appended context/ledger/this receipt. MCP disabled and Upgrade/signup source unchanged. No deployment; fullapp/mobile visuals NOTVERIFIED. Skill/contract routing inherited from header task; rollback these twoCSSrules only.

Plain-text correction: User rejected button entirely. Replaced button with noninteractive span; removed fill/border/padding/fixedsize/buttoncursor; MCP11px/Comingsoon8px. Updated existing regression to assert span/nointeractive semantics.20tests/scopedlint/diffcheckPASS; isolatedactualTSX/CSS screenshot .tmp/explore-header-mcp/plain-mcp.png inspected. Fullapp/mobile/productionNOTVERIFIED. App fileschanged: sameTSX,CSS,test; context,ledger,thisreceipt appended. Existing Upgrade/signup links preserved. No deploy.
