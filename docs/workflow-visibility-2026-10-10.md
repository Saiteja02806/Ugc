# Talking Head + Demo and Audio visibility

October 10, 2026: expose Talking Head + Demo in Explore at `/explore/create-hook`, restore `/audio-generation`, show Audio generation in the shared sidebar, and add its Explore quick start.

Both screens use their existing connected implementations. Production already has `EXPLORE_GENERATION_ENABLED`, `EXPLORE_DEMO_FRAMING_ENABLED`, `EXPLORE_FINISHING_ENABLED`, `AUDIO_GENERATION_ENABLED`, and `AUDIO_GENERATION_PUBLIC_ENABLED` set to `true`; no rollout flag change is needed. Existing authentication, ownership, subscription, provider and credit checks continue to apply. Audio is visible to Free users for voice browsing and samples; generation requires an active Starter or Growth subscription.

Creator Shows App on Phone remains hidden. This release contains only the requested workflow visibility changes and the related navigation tests.
