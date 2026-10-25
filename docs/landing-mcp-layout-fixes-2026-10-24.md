# Landing page and MCP layout fixes — 24 October 2026

## Requested changes

- Restore the homepage's Instagram, TikTok and YouTube artwork in the hero pill.
  The label is **Made for social**; it links to the existing creative workflow.
  The previously removed one-click publishing claim stays removed.
- Remove MCP from the shared desktop navigation and mobile menu. The homepage's
  secondary hero action now says **See how it works** and links to the workflow.
  The dedicated MCP pages and their footer links remain available.
- Repair the MCP marketing page's responsive layout without changing the server,
  account authorization, setup values or OAuth scopes.

## Observed cause and correction

Read-only inspection of `https://getugcpilot.com/mcp` at 1050px showed the heading
squeezed to approximately 243px wide while the setup card extended offscreen.
Unbroken preformatted content supplied a minimum width to the grid columns.
The page's outer overflow clipping hid the oversized content rather than making
the layout fit.

The hero now stacks below 1280px. Its desktop columns and the OAuth detail columns
use zero-minimum grid tracks; setup cards and shared copy blocks can shrink within
their parent. Human-readable server/prompt blocks wrap, while configuration and
commands retain their exact whitespace in contained, keyboard-focusable scrollers.
The shared template applies these corrections to the hub, Claude and Codex pages.

## Verification and release boundary

- Application TypeScript, scoped ESLint and whitespace checks pass.
- All 12 existing routing and theme tests pass, including the website/MCP-host
  routing boundary.
- Local desktop/mobile screenshots confirm the restored pill and repaired layout.
  All 40 browser checks pass across the homepage and three MCP pages at 360,
  390, 768, 1050 and 1440px in both themes. Both clipboard checks and the setup
  anchor pass, with zero browser runtime errors.
- Browser artifacts are ignored under `.tmp/marketing-layout-browser/`.
- Initial website deployment `dpl_AkPNUyGCP5XabNYH8wZpX5rUfFF7` reached READY,
  passed staged reads, and was promoted. All 40 live layout checks passed,
  along with clipboard, anchor, logo, video and asset checks.

Three pre-existing, untracked resource cover images are unrelated to these edits
and are left untouched.

## Deployment supersession and recovery — 25 October 2026

The resumed verification found a newer Git deployment,
`dpl_CT2mR998nfbxPXXbmmHgBdowMtvW`, serving commit
`6363054c37349b6a8659918de946cd87cdadfa94` (PR 86). It includes three newly
published articles but superseded the direct working-tree deployment, restoring
the old MCP pill and header. The live browser regression correctly failed on
the missing social pill. The original passing receipt is historical evidence,
not acceptance of that newer deployment.

The recovery source uses an isolated archive of the newer production commit
with the eight reviewed landing/MCP source, test, documentation and upload-ignore
files overlaid. The newer commit does not change any of those files, so its
articles, links and public-page inventory remain intact. Recovery deployment:
`dpl_Cv66ztrbe5xGgfGbavaw94YEDydD`. Source receipt and digest are recorded under
`.tmp/marketing-release-20261024/restored-source-receipt.json`.

The recovery deployment reached READY and was promoted to the apex and www
domains. All 40 live browser layout cases pass again, including both themes,
copy buttons and the setup anchor, with zero page errors. Desktop and mobile
screenshots were visually inspected. The social pill, header removal, 28px
theme-specific logos, replacement Hook video playback/pause and corrected MCP
layout are verified live. No failed image, font, script, stylesheet or media
responses were observed in the smoke check.

Both requested pages and all three retained article URLs return HTTP 200 and
identify `dpl_Cv66ztrbe5xGgfGbavaw94YEDydD` in their HTML. The www URLs retain
their existing redirect and resolve to the same release. The independent MCP
health endpoint returns HTTP 200. Receipts:
`.tmp/marketing-layout-browser-live/receipt.json` and
`.tmp/marketing-release-20261024/live-smoke.json`.

The three superseded cover previews remain explicitly excluded in `.vercelignore`:
`public/resources/reaction-hook-library-cover-v2.webp`,
`public/resources/reaction-hook-library-cover-v3.webp`, and
`public/resources/ugc-pilot-hooks-cover.webp`. Credentials, private plaintext,
local environments, caches, build output and temporary evidence remain excluded.
Unrelated Explore audit documents, context edits and test changes created after
the original deployment are not part of this focused website release and are
left untouched in the shared worktree.

No commit or push is created. The direct deployment contains the reviewed edits;
future Git deployments need those edits incorporated into their source to retain
them. Public-page checks do not exercise paid generation or signed-in OAuth.
