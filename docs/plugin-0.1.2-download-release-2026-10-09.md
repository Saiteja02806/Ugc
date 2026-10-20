# UGC Pilot 0.1.2 private-beta download release

The combined release now includes the complete 0.1.2 plugin bundle in the existing
private-beta download flow. `/connect-ai` links to its versioned ZIP, checksum and
standalone setup guide. The prior 0.1.0 and 0.1.1 archives and existing setup guide
are retained. This packaging change does not submit a directory listing or certify
installed-client acceptance.

The bundle contains 31 allowlisted files, eight skills and the existing twelve-tool
MCP connection at `https://mcp.getugcpilot.com/mcp`. All three manifests agree on
version 0.1.2. Every ZIP entry matches the release checkout's source bytes, the
inventory and CRC checks pass, and deterministic rebuilds preserve the archive.
The [release manifest](plugin-0.1.2-release-manifest.json) records every source-file
hash and all three artifact hashes.

Archive: `public/downloads/ugc-pilot-0.1.2.zip`, 84,471 bytes.

SHA-256: `f655694302524f9c02bba46bd8e1acaea0b5319418de1eb63ac5eaea4f21b0b3`.

Validation passed: 16 package/creative-output tests and three real ZIP-build tests.
The earlier local-candidate report records a different checkout's artifact bytes;
the linked manifest describes the bundle prepared for this combined release.
Hosted verification remains pending deployment. Installed-host activation,
fresh-account OAuth, the review recording and applicable platform approval remain
the acceptance items documented in the preceding private-release report.

Reproduce the package and offline checks from the repository root:

```powershell
node --test scripts/validate-ugc-pilot-plugin.test.mjs scripts/validate-ugc-creative-output.test.mjs
python scripts/test-ugc-pilot-plugin-build.py
python scripts/build-ugc-pilot-plugin.py --output-dir public/downloads
```

The builder refuses to replace a versioned artifact with different bytes. After
deploying the complete release, run the existing production-domain verification:

```powershell
node scripts/check-ugc-pilot-release.mjs --output .tmp/plugin-0.1.2-production-check.json
```

This last command checks deployed links, exact download bytes, OAuth metadata,
unauthenticated rejection and website/MCP route isolation. It makes no generation,
upload, deletion or authenticated account mutation.
