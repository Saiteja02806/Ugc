# TikTok Scheduling Beta Report

**Audit date:** 2026-09-21
**Scope:** repository source, Git history, and the implemented verified-account
beta. No production TikTok account was connected and no secrets were inspected.

## Conclusion

Yes. UGC Pilot previously supported TikTok scheduling. The feature was
introduced in commit `a77e52a` on 2026-07-17, **Add TikTok analytics and direct
video scheduling**, then intentionally hidden by `60c7fd6` on 2026-07-27.

It is now restored as a narrowly scoped beta for the **verified Firebase email
`vtu19403@veltech.edu.in` only**. The frontend reveals TikTok connection,
scheduling, and analytics only to that identity. The server enforces the same
identity check, so another signed-in user cannot use the routes by calling them
directly.

## Where users could schedule TikTok content

Before the Instagram-only restriction, TikTok was selectable in these
scheduling experiences:

| Experience | Location | Beta state |
| --- | --- | --- |
| Main Scheduling page | `/scheduling` drawer, implemented by `components/scheduling/schedule-editor.tsx` | The approved account can select connected Instagram and TikTok accounts; every other user remains Instagram-only. |
| Inline Carousel scheduler | `components/social/platform-selection-modal.tsx`, opened from Carousel/Library flows | The approved account can select TikTok for 2–35 image photo carousels; every other user sees Instagram only. |
| Trending Hook video scheduler | `components/trending/hook-video-schedule-drawer.tsx` | The approved account can select TikTok; every other user sees Instagram only. |
| Settings | `/settings#instagram-publishing` via `components/settings/settings-workspace.tsx` | The approved account sees the TikTok beta account manager to connect, reconnect, or disconnect TikTok. |
| Analytics | `components/analytics/tiktok-beta-analytics-panel.tsx` | The approved account sees per-public-video TikTok metrics and can request a refresh. |

The TikTok form includes account selection, a publish time, account-specific
visibility, comments, duet/stitch, branded-content, and synthetic-media
settings. Those controls are reachable only through the approved account’s beta
surface.

## Implemented access boundary

- `lib/social/tiktok-beta-access.ts` permits only
  `vtu19403@veltech.edu.in`, and only when Firebase marks that email as
  verified. Comparison is case-insensitive.
- Client surfaces use that rule to reveal TikTok in Settings, the main
  scheduler, inline Carousel scheduler, Hook scheduler, and analytics. TikTok
  remains absent for all other accounts.
- `app/api/social/oauth/start/route.ts` blocks TikTok OAuth for unapproved
  users. `app/api/analytics/tiktok/videos/route.ts` blocks analytics refreshes.
- All schedule draft create/edit, final schedule, publish, retry, Hook, Wall
  Text, and Reaction endpoints pass the verified identity into the scheduling
  service. `lib/scheduling/service.ts` rejects a TikTok target with HTTP 403
  when the user is not the approved beta account.
- Existing TikTok targets remain publishable by the background worker. This
  avoids mutating or breaking historical scheduled work.

## Required TikTok OAuth scopes

The app requests exactly these three scopes:

| Scope | Used for | Required? |
| --- | --- | --- |
| `user.info.basic` | Read the connected creator identity: open ID, display name, and avatar. | Yes |
| `video.publish` | Direct-post scheduled videos and photo carousels. | Yes |
| `video.list` | Retrieve the connected user’s public videos and their returned per-video metrics. | Yes |

`user.info.profile`, `user.info.stats`, and `video.upload` are not requested.
`video.upload` creates a TikTok draft for the creator to finish in TikTok; this
beta uses Direct Post instead. `user.info.stats` would be necessary for
account-level follower/following/total-like/public-video-count values, which
the product does not show.

## Analytics behavior

The TikTok panel intentionally shows only the metrics returned for each public
video: views, likes, comments, shares, date, and the share link. It does not
show account-level follower or profile statistics. A successful connection with
the three scopes above is therefore sufficient for this analytics surface.

## The retained TikTok scheduling/publishing pipeline

The feature was not deleted; the following pieces are still present:

| Layer | Location | What remains |
| --- | --- | --- |
| OAuth | `lib/social/tiktok-oauth-config.ts`, `lib/social/oauth.ts`, `app/api/social/tiktok/callback/route.ts` | TikTok authorization with `user.info.basic`, `video.publish`, and `video.list`, plus callback handling, refresh, and revoke support. |
| Data model | `lib/scheduling/types.ts`, `supabase/migrations/20260829093001_production_baseline_v1.sql` | `tiktok` remains a valid connection, schedule target, publish operation, and account-lane platform. |
| Target settings | `lib/scheduling/platform-settings.ts`, `lib/social/tiktok-publish-capabilities.ts`, `app/api/social/connections/[connectionId]/publish-settings/route.ts` | Per-account visibility and disclosure validation based on TikTok creator capabilities. |
| Durable scheduling | `lib/scheduling/service.ts`, `lib/scheduling/social-scheduler.ts` | A schedule target creates the existing `publish_social_post` background job and exact-time Cloud Task. |
| Publisher | `worker/src/jobs/publish-social-post.ts`, `worker/src/lib/tiktok-publisher.ts` | Direct Post publishing for videos and 2–35-image photo carousels, persisted provider operation IDs, token refresh, retry/error handling, and publish-status polling. |
| Worker deployment config | `.env.example`, `infra/gcp/social-publish-worker/` | TikTok credentials, media-transfer mode, and verified media-host configuration. |

For a TikTok video, the publisher can use `FILE_UPLOAD`; for a TikTok photo
carousel, it uses verified HTTPS image URLs with TikTok's `PULL_FROM_URL`
workflow. Both routes publish through the existing scheduled background job.

## Historical timeline

1. **2026-07-17 — `a77e52a`**: Added direct TikTok video scheduling and TikTok
   analytics.
2. **2026-07-27 — `60c7fd6`**: Reframed the product as Instagram-focused and
   hid TikTok from new scheduling/account-management UI. The change explicitly
   preserved old TikTok target rows rather than deleting or altering them.
3. **Current code**: Preserves legacy TikTok targets and exposes new TikTok
   scheduling only to the verified beta account.

## Before the beta can be tested end-to-end

1. In the TikTok Developer Portal, keep Login Kit and Content Posting API
   enabled, turn on Direct Post, and submit the app/revision for TikTok review
   with the required end-to-end demo and product explanation.
2. Confirm the deployed redirect URI exactly matches the Login Kit URI and the
   production website/domain values in TikTok Developer Portal.
3. Verify the production media domain with TikTok before testing photo
   carousels, because the existing carousel publisher uses TikTok’s
   `PULL_FROM_URL` flow.
4. Sign in to UGC Pilot as the verified approved email, connect the TikTok
   creator account in Settings, then test one scheduled video and one 2–35
   image photo carousel in production.
5. Use the TikTok analytics refresh on a creator account with public videos to
   confirm that per-video metrics appear. TikTok app approval, provider limits,
   and the real creator account determine final production availability; a
   repository build cannot validate those external conditions.
