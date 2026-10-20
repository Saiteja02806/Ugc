# UGC Pilot Cloud MCP: video generation

Status: deployed and verified on 30 September 2026. Vercel access was restored and the corrected MCP release is live at `mcp.getugcpilot.com`. The additive video migration is applied. Both the original backend canary and a fresh public MCP video completed and settled once. See [the full production audit](mcp-production-readiness-audit-2026-09-30.md) for release identity, evidence and remaining acceptance gates.

The generate_video tool implements the approved V1 contract: a strict 1–1000 character prompt, vertical or landscape ratio, explicit 3–10 second duration, one optional owned ready image reference, 1/2/4 outputs and a stable caller request ID. Account identity comes from the MCP principal. Models, external URLs, provider selection and video references are excluded from the tool input.

The adapter reuses generate_hook_video, the existing duration-based credit price, Cloud Tasks, storage and completion functions. It selects google_omni for the complete V1 duration range; the website's Seedance default requires at least four seconds. Each child reserves credits and creates its durable job in one database transaction. Image and video retry keys are independent; changed normalized input conflicts. Partial batches and queue-delivery retries preserve existing jobs. get_job now validates owned ready image or video output as appropriate and normalizes real database timestamps.

Local MCP behavior tests, database transaction/rollback/privilege tests, production builds and lint pass. A framework/native Request compatibility bug found during deployment was reproduced, corrected and regression-tested before the successful release. Public discovery now has twelve tools, capabilities enable video, and public generation, polling and asset retrieval pass.

The fresh public three-second video was H.264, 720 × 1280, with a 3.008-second MP4 container. Exactly one 12-credit reservation was committed; an identical retry returned the same job. The new public image/video acceptance used 13 credits total, with no outstanding reservation.

The existing UGC Pilot connection in this chat still needs refreshed scopes and discovery: reads work, but job polling returns Insufficient scope and its cached inventory does not include generate_video. Firebase browser consent and target-client generation after reconnection remain acceptance gates, alongside the broader website/worker checks in the report.
