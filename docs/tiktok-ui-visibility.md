# TikTok UI visibility

TikTok visibility is enabled locally on 2026-10-09 after the owner confirmed
approval and the required permissions/scopes. This supersedes the temporary
UI hiding implemented on 2026-10-03 while approval was pending.

## Rollout switch

`socialPlatformVisibility.tiktok` is `true` in
`lib/social/platform-visibility.ts`. Rebuild and deploy the frontend to release it.
Verified-user access remains required. The source platform definitions, icons,
OAuth, publish settings, analytics panel, and account manager are retained.

## Covered surfaces

- Homepage badge, hero description, workflow, publishing preview, footer, and
  page/global metadata derive their platform names from the visibility switch.
  The publishing preview has three destination rows and three connector arrows.
- Trending's hook drawer and shared Reel/Carousel account modal show TikTok
  accounts, connection actions, settings, and submission selections. YouTube
  remains available for supported videos; Carousel format rules are unchanged.
- Explore scheduling choices and post preview show TikTok. An existing browser
  draft is retained without selecting another platform automatically.
- Settings, Connected accounts, Analytics, and Scheduling show TikTok controls
  and provider details. Platform selection layouts adapt to the visible choices.
- The camera-style label remains "Casual UGC" with its existing `tiktok_ugc`
  value retained. The vertical aspect-ratio hint uses generic format names.

## New-post publishing defaults (2026-10-09)

At the owner's request, new TikTok targets start with Your brand, commercial
disclosure, and Music Usage Confirmation enabled. Paid partnership stays off.
The defaults are shared by Explore, Scheduling, and every Trending scheduler.
Existing saved brand and partnership settings are preserved, including when
creator capabilities are refreshed.

## Simplified publishing controls (2026-10-09)

The owner subsequently requested that these defaults run in the background.
Explore, Scheduling, and Trending's Hook, Text, Reaction, and Carousel forms no
longer render commercial disclosure, Your brand, paid partnership, or music
confirmation controls. Hook's extra music-consent popup is also removed.
Audience, available interactions, AI disclosure, and account errors remain
accessible in their existing settings surfaces.

A short agreement remains visible beside the final scheduling action. Clicking
that action confirms music in the submitted TikTok settings, including for older
drafts with false or missing confirmation; loading a draft does not mutate it.
The agreement includes the Branded Content Policy if a selected saved target has
paid partnership enabled. Saved brand/partnership choices, dormant legacy targets,
and other platforms' settings remain intact. Account and audience validation
still block submission; the server still rejects false or missing music
confirmation in direct API requests.

This supersedes the earlier visible-checkbox and fallback-popup behavior. It is
the owner's requested product behavior, not a claim that TikTok approval waives
its UX guidelines.

Validation: 65 focused tests passed, including real settings rendering, all
three scheduling components' final callbacks with older music settings,
preservation through creator-capability refresh, backend preflight, and actual
scheduling route handlers with fixture dependencies. Full TypeScript and scoped
ESLint passed. These are local checks; no real TikTok post or deployment was
performed.

## Preservation and verification

Provider enums, access policies used by API routes, tokens, connections, workers,
and database records are unchanged. Existing TikTok connections and scheduled
targets become visible again with their saved settings. Historical status and
backend processing semantics remain unchanged. The Direct Post policy already
defaults to approved in web and worker; an explicit false environment override
still enables private-testing restrictions.
Privacy/terms disclosures continue to cover retained provider data.

Regression checks render the real marketing, Explore, analytics, and Trending
components with verified-user/connected-account fixtures; check supported
video/photo destinations, verification requirements, and saved-draft preservation
if the visibility switch is disabled again.

On 2026-10-09, 50 focused component, OAuth, analytics, scheduling, preflight, and
access-policy tests passed, along with full TypeScript and scoped ESLint. Browser
checks confirmed the three-platform landing badge, copy, metadata and publishing
preview at 1280px, no horizontal overflow at 390px, and a selectable TikTok
destination in the Hook workflow's development scheduling preview. No console
errors were observed in that preview.

The production homepage was also checked on 2026-10-09 and still showed only
Instagram and YouTube. This change has not been deployed; authenticated
production connection and publishing acceptance remain pending.
