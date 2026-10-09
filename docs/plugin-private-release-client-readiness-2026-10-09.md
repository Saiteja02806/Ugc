# Private release and client-testing readiness

The next phase has started: the existing owned UGC Pilot account plugin was updated from 0.1.0 to **0.1.2**, preserving its USER scope and PRIVATE visibility. The local implementation report remains the earlier checkpoint; this document records the subsequent saved release and hosted read-only checks.

Plugin: [UGC Pilot](https://chatgpt.com/plugins/plugins_6ac5dfae127081919c929c4fdfe29b1c).

Current release: `pluginrel_6ac8fd3c061481919b2f985b6508282a`.

## Verified

- Read back the full 31-file inventory and all 30 text files from the same new release. All eight skill entrypoints and their resources are present; the creative content matches the validated local candidate.
- Preserved the saved author/developer identity, starter prompt value/type/order, original three connection/generation/media workflows, canonical MCP endpoint, scope and private audience. The omitted existing logo was retained; no files were deleted.
- The platform regenerated compatibility manifests from the portable manifest. Its account `.mcp.json` retains `streamable-http`; the local Claude Code ZIP uses the separately validated `http` compatibility type. Use the local package for Claude Code testing; do not treat account-package compatibility as tested Claude execution.
- Live calls through the connected hosted MCP succeeded for `get_profile`, `get_entitlements` and `get_capabilities`. At the check, the Starter plan was active with 185 available credits, zero reserved credits, one credit per image and four credits per video second. Images and 3–10-second videos were available with the advertised supported formats/counts. These values are account-specific and can change.
- No generation, upload or delete operation was run. Claude Code authentication status remains `loggedIn: false`.
- Rechecked all 20 protected local file hashes. The original documents and released public download files remain unchanged.

The update used a 26-file overlay archive, omitting unchanged binary/connection/workflow files. The saved endpoint and all original workflow instructions were checked against the prior release. The same hosted MCP remains in use; no application/worker deployment was performed.

## Next acceptance sequence

1. Refresh/reload the installed private plugin and start a fresh conversation. Confirm the client loads version 0.1.2 and discovers all eight skills. The currently running conversation was initialized with cached 0.1.0 descriptions, so it cannot certify automatic activation of the updated package.
2. Run the creative cases in `plugins/ugc-pilot/evaluation-cases.json`: separate hook words/prompts, wall words/prompts, combined exact-copy handoffs, slideshow count/fields, missing-context behavior and prompt-only requests without generation calls. Check the actual chosen skill and tool trace in the target host.
3. Sign into Claude Code when ready and load the local package with its supported `--plugin-dir` flow. Complete UGC Pilot OAuth through that client's normal connection UI. Do not copy tokens or credentials between clients.
4. After installed activation passes, perform the requested real generation acceptance check on the production MCP, using current live entitlements/capabilities, one stable request ID, actual job polling and real result retrieval. A five-second video would currently cost 20 credits; the execution test has not yet been run in this turn. Confirm retries reuse the same work without a second charge. Exact-text composition still requires a separate editor.
5. Complete the demo recording and applicable platform review/submission requirements before customer rollout. The private release is saved; a public ChatGPT/Claude listing has not been submitted or approved by this action.

There is no remaining manual source-file repair for this phase. Client reload/sign-in and target-host acceptance remain. The live download is still the previously released package; this private account update does not deploy a new website download or change the public application.

Evidence: `.tmp/ugc-pilot-private-update-plan.json`, `.tmp/ugc-pilot-private-update-verification.json`, `.tmp/ugc-pilot-client-readiness-evidence.json`, and before/after source snapshots. The account-update ZIP is `.tmp/plugin-packages/ugc-pilot-0.1.2-account-update.zip`; it is an overlay for the existing plugin, not a standalone installation ZIP. The complete local install candidate remains `.tmp/plugin-packages/ugc-pilot-0.1.2.zip`.
