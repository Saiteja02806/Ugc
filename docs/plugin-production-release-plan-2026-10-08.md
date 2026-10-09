# UGC Pilot plugin production release plan — 8 October 2026

The objective is a customer who can install UGC Pilot, authorize their own account, generate an image or short video, retrieve the result, and recover from an interrupted connection without an extra charge. Completion requires evidence from the installed plugin in each supported client and the real production domains.

This is the implementation and acceptance plan. The hosted release was executed on 8 October 2026 from the verified production baseline; the user chose to finish that release before signing in to the publishing and installed-client sessions. The [release report](plugin-production-release-2026-10-08.md) records deployments, tests, unresolved issues, and rollback targets.

| Stage | Execution status on 8 October |
| --- | --- |
| 1. Baseline and rollback | Complete: both deployed projects matched `9390357231e31cfb72cdb67df6098d5b3c87aa4d`; an isolated checkout and 42-path hashed inventory preserve the candidate. |
| 2. Package | 0.1.1 built, validated, and downloadable with its matching checksum. Review metadata, cases, and onboarding are implemented; the real walkthrough recording remains pending. |
| 3. Dependencies | Website/MCP release lock passes the production dependency audit with zero findings; the worker candidate also builds and audits clean. Its hosted worker image has not been redeployed. |
| 4. Reliability | Safe request tracing is live; concurrent reads and exact generation replay passed. Unexplained client send failures remain open. Upload rejection is separately explained by the connection's missing `assets:write` permission. |
| 5. Hosted release | Complete: MCP first, then website; protected staging and production verification passed. All 18 public release checks and 20 public SEO checks passed. |
| 6. Installed-client acceptance | Partial: existing authenticated Codex connection, new paid image, replay, owned retrieval, and no extra charge passed. Fresh ChatGPT/Claude/Claude Code sessions, renewed upload consent, full lifecycle, and two-account live tests are deferred until user sign-in. |
| 7. Platform review | Materials prepared; identity/domain verification, live host recording, reviewer access, platform scans, submission, approval, and public listing remain pending. |
| 8. Customer rollout | Private beta remains the declared scope. Broad rollout has not started and the production-ready verdict remains withheld. |

The remaining acceptance gates below continue to apply. Successful hosted deployment does not mark the whole plan complete.

**1. Establish a stable release and rollback baseline**

- Record the current production commit, deployments, settings, and artifact hashes for the website and MCP projects. Check that the 7 October candidate still matches that baseline; do not assume its earlier provenance remains current.
- Use an isolated checkout for this plugin release. Include the reviewed MCP fixes, consent, onboarding/downloads, package changes, regression checks, and dependency changes required by those fixes. Review its entire diff and locked dependencies.
- Keep the MCP endpoint, tool names/input/output schemas, OAuth scope names, account ownership rules, and existing generation request IDs compatible. Keep the initial public scope at the current twelve tools.
- Record the previous website/MCP deployment identities and package version. A failed rollout must have a concrete restore target. Reversing a security patch can restore its known vulnerability, so a rollback also halts customer expansion until a corrected release passes.

Acceptance: a reviewed release inventory, an exact source snapshot, and rollback targets. No unrelated workspace feature is included accidentally.

**2. Finish the package independently of runtime changes**

- Add verified HTTPS website, support, privacy, and terms URLs to the OpenAI interface metadata. Check the destination content and publisher identity, not just the HTTP status. Create a support page if the intended support URL does not exist.
- Map five positive and three negative cases into the supported OpenAI review fields. Keep the additional manual scenarios for wider host acceptance. An ordinary `evaluation-cases.json` file is not a substitute for the supported submission fields.
- Point the optional onboarding-skill field to the existing connection skill to make first use easier. Align the instructions with current ChatGPT, Codex, Claude, and Claude Code installation flows.
- Use a new package version, proposed `0.1.1`, preserving the stable plugin identity. Rebuild the ZIP/checksum and update download references. Retain the reviewed `0.1.0` artifact for traceability.
- Extend validation to check the required public-review fields, review-case structure, referenced files, and artifact equality. Public publishing account state remains a separate check.

Acceptance: package validation passes; required links work; the archive matches the intended source; supported capabilities and credit use are stated accurately. Reviewer credentials remain outside the ZIP and repository. [OpenAI submission reference](https://developers.openai.com/plugins/deploy/submission)

**3. Address dependency security in small changes**

Inspect the exact release lockfiles and determine which advisories affect deployed runtime paths. Update compatible patched dependencies one group at a time, or remove unnecessary dependency paths. Do not run an automatic forced Firebase downgrade. Read the new installed Next.js guides before any framework-related code adjustment.

After each affected group, run relevant MCP, OAuth, billing, storage, generation, and worker checks. Run the full production build and both production dependency audits for the final candidate. An existing audit result for another checkout does not validate this release.

Acceptance: no untriaged high/critical findings; applicable findings are remediated, and any nonapplicable findings have an explicit evidence-based exposure decision. The candidate builds with type checking enabled.

**4. Diagnose transport reliability before changing its behavior**

Use the prepared request tracing to correlate MCP responses and server logs without recording bearer tokens, prompts, or account emails. Test sequential calls, concurrent calls, a new conversation, idle/reconnect behavior, and token refresh. Compare native HTTP/Inspector results with the affected client. Establish whether failed requests reached the server.

Fix the demonstrated boundary. Do not treat extra retries as proof of a fix. Preserve bounded retry behavior: an uncertain generation reuses its exact arguments and request ID; existing jobs are checked before a new generation is considered. Authentication and input errors should produce actionable errors, and queued work should be reported truthfully.

Acceptance: repeated recorded scenarios complete without unexplained failures; uncertain submissions recover the original job and do not create another charge. Request correlation works in the deployed environment.

**5. Stage, then release the hosted changes in order**

Validate preview deployments for build, layout, consent wording, downloads, and package integrity. Test preview OAuth only with separate test clients/tokens and deliberately configured preview resource/issuer URLs. Never repoint production OAuth configuration to a preview endpoint.

When the reviewed release is authorized, release the MCP project first. Check discovery, an existing authenticated connection, safe rejection, owned asset/job retrieval, and a small generation canary on `https://mcp.getugcpilot.com`. Then release the website setup/downloads and check them through `https://www.getugcpilot.com` and its canonical redirect.

Acceptance: existing users remain connected; the twelve tools retain their contracts; consent correctly describes image/video access; `/connect-ai` and ZIP/checksum/guide return 200; production artifact hashes match reviewed files. Restore the affected project's previous deployment if acceptance fails. Final authenticated acceptance uses the real production domains, not localhost.

**6. Run installed-client and fresh-account acceptance**

Use dedicated test accounts with an explicit generation-credit budget. Keep reviewer/test-account credentials in the secure client/dashboard flow. Test both the intended free-account behavior and the paid generation path.

| Scenario | Required evidence |
| --- | --- |
| Fresh installation and OAuth | Correct account, explicit consent, expected scopes, tools discoverable |
| Account/credit/capability reads | Accurate result; no unexpected allowance or billing mutation |
| Image and image-to-video | Finished owned outputs can be retrieved and used |
| Interrupted submission/replay | Same job IDs; exactly one reservation/charge for the intended work |
| Upload/confirm/delete | Real bytes uploaded; matching owned asset; deletion targets an explicitly selected test item |
| Expiry, refresh, revoke, reconnect | Recovery works; revoked access cannot continue; no shared-account credentials |
| Two-account isolation | Neither account can retrieve or operate on the other's test assets/jobs |
| Insufficient scope/credits and unsupported requests | Safe, useful failure; no invented tool or output |
| Installed workflow skills | Correct activation, resource loading, tool selection, and truthful results |

Run the applicable scenarios in ChatGPT, Claude, Claude Code, and Codex. Record pass/fail, selected tools, inputs, outputs, errors, billing, and recovery. These checks require actual host sessions; server-side unit tests alone cannot complete this stage. [Installed-plugin testing guidance](https://developers.openai.com/plugins/deploy/connect-chatgpt)

Acceptance: every advertised client completes its intended workflow, all critical boundary cases pass, and the recording/demo account is usable by a reviewer.

**7. Complete platform review and publish**

The later [directory application check](plugin-directory-applications-2026-10-08.md) adds Claude eligibility and licensing gates and corrects the submission types: our own remote server and its workflow bundle require separate connector and plugin submissions. Complete that eligibility check before proceeding with Claude review.

For OpenAI, verify the publishing identity and MCP domain, connect/scan the server in the submission portal, supply reviewer access and the required cases/video, resolve required findings, and submit the candidate. Publish the approved version when rollout acceptance is complete.

For Claude, after eligibility is resolved, submit our hosted server as an MCP connector and the GitHub-hosted skills/configuration folder as a plugin bundle from the same organization. The bundle needs a declared license and a repository that is public before publication. Keep the shared backend compatible across clients. [Claude distribution process](https://claude.com/docs/directory/publish)

Account identity, verification, and policy attestations may require the owner's participation. Prepare the complete reviewable package before requesting those final owner actions.

Acceptance: approved public listings exist, a different eligible account can discover/install them, and installation leads to the customer's own UGC Pilot OAuth flow.

**8. Start with a limited customer rollout and observe it**

Use a small initial customer cohort. Observe connection failures, generation completion/failure, queue delays, credit mismatches, and support issues. Maintain a traceable package-to-server release record and keep the rollback targets available. Broaden distribution only after the installed customer path has been verified.

The production-ready decision requires all earlier acceptance gates, an independently installable customer path, safe account boundaries, correct billing/retry behavior, resolved reliability findings, and operational visibility. A ZIP upload, a health response, or one successful generation is insufficient evidence for that decision.
