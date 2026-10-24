# UGC Pilot plugin verification playbook

Last reviewed: 2026-10-17

Use this checklist to decide whether an MCP plugin release is ready. It is deliberately layered: a passing unit test or healthy endpoint does not prove that an IDE completed OAuth or that an account can complete a media workflow.

See `ugc-pilot-plugin-context.md` for the current release record and `mcp-current-capability-audit-2026-10-17.md` for the product-parity boundaries.

## 1. Source and package checks

Run these from the repository root before creating a candidate build:

```powershell
npm run test:mcp
node --test scripts/validate-ugc-pilot-plugin.test.mjs
node scripts/validate-ugc-pilot-plugin.mjs
cmd /c .\node_modules\.bin\eslint.cmd components\explore\hook-workflow-preview.tsx
node --test scripts/hook-workflow-preview.test.mjs
```

Expected result: every command exits successfully. The MCP suite simulates OAuth/PKCE, scopes and owner isolation, media receipts, upload recovery, Demo composition, finishing, Edit drafts/exports, audio, references, groups, Library and account settings. The workflow test confirms that the visible Hook flow remains non-spending until an explicit creation action.

Record the commit SHA, plugin version, registered tool count, tool-contract result, and any skipped test environment requirement. Treat a source build that hangs, is stopped, or lacks its required environment values as **inconclusive**.

## 2. Candidate deployment preflight

Deploy the exact reviewed source only to a protected staging target. Then confirm:

1. `/mcp/health` reports ready.
2. The protected-resource and authorization-server metadata resolve from the staging endpoint.
3. An anonymous MCP request receives the expected OAuth `401` challenge.
4. Package version, deployment source commit and registered tool count match the reviewed candidate.

This stage uses no customer data or media writes. A healthy endpoint only proves server availability and OAuth discovery.

## 3. Clean IDE-host acceptance

Use a clean Codex profile, then repeat in a clean Claude Code profile. For each host:

1. Install the exact candidate package through the host's normal plugin flow.
2. Confirm the host opens UGC Pilot's OAuth sign-in/consent page.
3. Sign in through the normal browser flow and return to the host.
4. Run only `get_profile`, `get_entitlements`, and `get_capabilities`.
5. Confirm the tools list is available and that the returned account is the signed-in user.

Save a credential-free screen recording or screenshots of install, OAuth return, and the three read-only calls. Never put passwords, access tokens, verification codes, OAuth `state`, or PKCE values in a recording, test log, issue, or documentation.

Passing this stage proves installation, OAuth return and authenticated safe reads for that particular host. It must be repeated after material plugin manifest or authentication changes.

## 4. Bounded real media acceptance

Only after the account owner selects specific owned media, test one hook-to-Demo journey:

1. Read capabilities and verify the required generation, finish and transfer gates are enabled.
2. Select one explicit hook and one explicit Demo. Use the smallest requested trims and change set.
3. Open or create an Edit draft, save the requested revision, reopen it, and export it.
4. Download the result through the approved path.
5. Check the immutable saved receipt, output bytes, duration, requested trims/text/audio, and ownership.

Record the receipt ID and non-sensitive result metadata. Do not run this step merely to test connectivity; it creates account content and may consume credits.

## 5. Release decision

Promote only when all of the following are true:

- Source/package checks pass for the exact source commit.
- Staging health and OAuth discovery pass.
- Codex and Claude Code both pass clean-install OAuth and the three safe reads.
- Any enabled write path has a bounded acceptance result, or remains visibly gated.
- The deployment's commit, release archive and setup instructions agree.

If a stage is unavailable, document it as a release blocker or explicitly keep its dependent write feature gated. Do not mark it as passed based on a different host, a local mock, or a healthy deployment.
