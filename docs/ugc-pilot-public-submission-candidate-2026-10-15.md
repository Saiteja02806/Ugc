# UGC Pilot public-submission candidate — 15 October 2026

This document records what is ready to hand to the publisher and what must be completed in the publishing portals. It does not claim a public directory approval.

## Included in version 0.2.0

- A portable MCP package pointing to `https://mcp.getugcpilot.com/mcp`.
- A square UGC Pilot PNG logo used as the listing logo and composer icon.
- Fourteen skills, including the five creative workflows: hook text, hook-video prompts, wall-of-text copy, wall-text video prompts, and slideshow plans.
- Clear starter prompts that route to each creative workflow.
- Five positive and three negative OpenAI review cases with real tool names.
- A checksum, standalone setup guide, and deterministic ZIP build.

## Evidence already checked

- Source-package schema, resource links, skill front matter, version alignment, icon dimensions, and credential scanning.
- Offline creative checks, including exact preservation of selected text through hook and wall-video handoffs.
- A production read-only MCP preflight: health, OAuth discovery, authenticated account/capability reads, video-finishing capability discovery, and edit-export capability discovery.
- The public website, privacy disclosure, terms, support page, MCP authorization errors, and archive route regression checks.

## Reviewer walkthrough to record manually

Host a short HTTPS-accessible recording for the reviewer. It should show a fresh, permitted test account and no passwords, tokens, personal media, or account balances.

1. Install or connect UGC Pilot and complete normal OAuth.
2. Run the read-only connection prompt and show that it reports real capabilities without generating anything.
3. Ask for business-specific hook text, then ask for a hook-video prompt using the selected hook unchanged.
4. Ask for wall-of-text copy and a wall-video prompt, showing the selected words remain unchanged in the overlay plan.
5. Demonstrate one approved media action only if the reviewer test account is meant to spend credits: preflight cost, submit a single request, and retrieve or truthfully poll the real job result.
6. Show an unsupported social-publishing request receives a truthful limitation instead of a fabricated result.

Add the final public HTTPS recording URL to `extensions.com.openai.review.demo_recording_url` before running the strict submission validator. The source deliberately has no placeholder URL; a made-up recording link would make the package look ready when the reviewer cannot use it.

## Publisher portal tasks

1. Sign in to the OpenAI publishing portal as the UGC Pilot publisher and complete organization and domain verification.
2. Upload the final 0.2.0 ZIP, use the included UGC Pilot icon, review the displayed name, description, category, website, support, privacy, and terms links.
3. Enter the reviewer recording URL and configure any requested reviewer account through the portal's secure fields.
4. Choose the supported countries in the portal. The source deliberately omits `publication.countries` because the target market has not been confirmed.
5. Confirm whether users buy UGC Pilot plans or credits, and where that purchase occurs. Add the truthful commerce declaration in the portal; the source deliberately omits it rather than guessing.
6. Run the current MCP discovery scan and the five positive / three negative review cases in a real installed client.
7. Submit to the public ChatGPT/Codex directory. Approval is platform-controlled.
8. Use the separate Claude connector or Marketplace process, install the same signed package in a Claude test session, complete OAuth, and run the matching read-only and creative-skill cases.

## Acceptance decision

The package is ready for the portal-preparation stage and a public versioned download. It is not ready to claim public-directory availability until the walkthrough URL, publisher verification, country and commerce choices, installed-client tests, and platform approvals are complete.
