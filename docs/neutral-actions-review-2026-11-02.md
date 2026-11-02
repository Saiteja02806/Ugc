# Neutral media and Settings actions

Scope: white primary actions, existing gray secondary actions, red destructive states retained. Explicit Button variant; shared default remains blue for unrelated callers. No dependencies, APIs, storage, prompts, layout or configuration changed. Rollback boundary is the neutral variant and its call-site choices.

Files changed in this task:
- components/ui/button.tsx
- components/workspace/ugc-chat-workspace.tsx
- components/video/video-generation-workspace.tsx
- components/generation/ai-studio-copy-button.tsx
- components/settings/business-context-settings.tsx
- components/settings/instagram-account-manager.tsx
- components/settings/publishing-preferences-settings.tsx
- components/settings/settings-workspace.tsx
- components/settings/support-feedback-settings.tsx
- components/settings/tiktok-beta-account-manager.tsx
- components/settings/youtube-beta-account-manager.tsx
- components/media/image-library-browser.tsx
- components/media/music-library-manager.tsx
- EXPLORE_CONTEXT.md
- docs/ai-context/clear.md
- this receipt

Preflight: AGENTS.md, nonnegotiables, context-memory/immutable-contracts/UI-clarity/regression-gate skills, installed Next CSS guide, current call sites and dirty worktree inspected. Large Explore/clear context reads exceeded tool output limits; relevant neutral-action/Settings incidents reviewed separately. Read-only tools/preflight.py passed prerequisite discovery. Existing user work preserved. UGC-UI-102 records the reported issue and code-confirmed cause.

Validation: TypeScript noEmit PASS. Scoped ESLint zero errors (two pre-existing unused-variable warnings in ugc-chat-workspace). Seven workflow-studio-ui tests PASS; strict UTF-8 PASS; scoped diff check PASS. Handlers, disabled conditions and settings payloads VERIFIED unchanged by diff. Production account mutations, provider generation, billing and publishing NOT TESTED. No deployment. Local Settings route redirects to sign-in as expected without a session. Actual SettingsWorkspace rendered using existing isolated account-service preview: Upgrade idle #f5f3f0/dark text and hover #dedbd7 PASS at 1440 and 390 pixels in light and dark themes. Final dark screenshots .tmp/neutral-actions/settings-1440.png and settings-390.png visually inspected. Actual local Hook result Edit is gray rgb(23,23,28), with light text; screenshot video-result.png inspected. These checks do not exercise a signed-in AI Studio library or real account mutations. Copy success neutrality source-checked; clipboard permission behavior unchanged and not exercised. Deferred Settings section bodies are stubbed in the isolated preview; their variant call sites are source/diff verified, not individually rendered. Overall PARTIALLY VERIFIED for hosted acceptance.
