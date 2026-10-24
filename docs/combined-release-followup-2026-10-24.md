# Combined release follow-up

Initial complete source `4ff070d20393ac2d9bbed802d3a08fdae28cc1ba` contains all
189 audited paths. Its image was verified on six production services and two
production jobs. Dedicated edit service max instances and queue concurrency are
two. Website/MCP promotion stayed held while final CI checks were examined.

The MCP functional suite passed in CI. Its production dependency audit failed
on [body-parser](https://github.com/advisories/GHSA-27r3-jxmh-p828),
[Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) and
[fast-uri](https://github.com/advisories/GHSA-w74x-v6f9-j3xg). Compatible root
lockfile updates select body-parser 2.4.0, Zod 4.6.7 and fast-uri 3.1.9 plus
their compatible transitive updates. The root production audit now reports zero
vulnerabilities. The worker audit already reported zero; its lockfile is unchanged.
Application regression tests again pass all 1,316 cases with the new root lock.

A cross-workflow trace found that the starting-image API correctly tags Wall
jobs `wall_text`, while the image worker allowed that verified preparation
contract only when tagged `hook`. The worker now accepts those two supported
workflow tags, retaining all owner, receipt, image-order, prompt, scene-byte and
incompatible-input checks. A worker regression verifies Wall admission and
preserved scene/person provenance; unrelated slideshow inputs remain rejected.

The follow-up source and worker image must deploy before website/MCP promotion.
Updated build/test/CI receipts remain in `outputs/release-2026-10-24/`.
No customer post or paid generation is started by these release checks.
