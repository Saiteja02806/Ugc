---
name: manage-ugc-business
description: Read UGC Pilot Business Context, edit its shared Settings draft, apply reviewed brand changes for future content, and recover accepted changes through MCP. Use for existing business profile edits; onboarding, website reanalysis and logo uploads require separate capabilities.
---

# Edit Business Context

Discover `get_business_context_capabilities` and `get_business_context`. Reads use `brand:read` and never start website analysis, onboarding or generation. A missing profile is null; these tools do not create it. Storage configuration alone does not prove the additive schema is deployed. Package installation does not activate writes.

The response contains active context, primary goals and the application's shared Settings draft. Keep `context_revision`, `active_profile_version` and the draft's exact `updated_at`, or null when no draft exists. Treat revisions as opaque. A receipt contains historical state; a fresh context read gives current website state.

For requested edits, start from the current draft or active context and preserve fields the user did not ask to change. Use the discovered complete `context` schema. Preserve factual claims and identify missing facts instead of inventing capabilities. Existing primary goals determine campaign purposes; context edits cannot change goals. For business onboarding, use the separate onboard-ugc-business workflow when its tools are discovered. Use the separate manage-ugc-media workflow for a supplied local logo when its dedicated tools are discovered. Website reanalysis and screenshots remain separate operations.

`save_business_context_draft` saves unfinished work without changing active context or its profile version. `source` is optional draft source text, limited to 4000 characters. The website immediately reads the same draft. `apply_business_context` promotes exactly reviewed context into a new active version and clears its draft. Apply has no `source` argument and requires factual anchors; a saved draft can still report `needs_facts`.

Both writes require an enabled gate and a separate `brand:write` OAuth grant. `save_business_context_draft` writes the shared draft directly and does not change the active profile. `apply_business_context` returns a preview and does not replace the live profile until an explicit yes and `confirm_token`. Account, assets, creative or generation grants do not cover brand editing. Use normal OAuth reauthorization when that deployed scope is needed for the user's intended change. Applying affects future content; it does not regenerate today's pinned pack, rewrite saved media or publish anything.

Before submission, save a fresh random `request_id` and exact inputs in a non-secret workspace record. Pass `expected_revision`, `expected_profile_version` and `expected_draft_updated_at` from the current read. For a lost response, recover with `get_business_context_request`, or discover accepted UUIDs using `list_business_context_requests`. Recovery reads work while writes are disabled. Replay only the same UUID and identical inputs when writes permit; an accepted replay returns the historical receipt without overwriting later website edits.

On conflict, recover first, read current state, and reconcile the user's intended change. Do not replace the revision or UUID merely to force stale context over later edits. A newly reconciled change is a new operation. Report the actual draft/active version and distinguish saved, applied, disabled, missing consent, needs facts and unconfirmed results.
