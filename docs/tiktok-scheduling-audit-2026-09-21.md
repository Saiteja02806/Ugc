# TikTok Scheduling Audit

**Audit date:** 2026-09-21
**Scope:** repository source and Git history. No production account was used and
no secrets were inspected.

## Conclusion

Yes. UGC Pilot previously supported scheduling content to TikTok. The feature
was introduced in commit `a77e52a` on 2026-07-17, **Add TikTok analytics and
direct video scheduling**.

It is **not available for new posts in the current product UI**. Commit
`60c7fd6` on 2026-07-27, **Restore Instagram-focused product experience**,
intentionally restricted all current scheduling entry points to Instagram.
The underlying TikTok integration remains in the repository to protect legacy
scheduled targets and allow a future reactivation.

## Where users could schedule TikTok content

Before the Instagram-only restriction, TikTok was selectable in these
scheduling experiences:

| Experience | Historical location | Current state |
| --- | --- | --- |
| Main Scheduling page | `/scheduling` drawer, implemented by `components/scheduling/schedule-editor.tsx` | Filters available accounts to Instagram only; its save guard requires an Instagram target. |
| Inline Carousel scheduler | `components/social/platform-selection-modal.tsx`, opened from Carousel/Library flows | TikTok is defined but removed from `visiblePlatforms`; only Instagram is rendered. |
| Trending Hook video scheduler | `components/trending/hook-video-schedule-drawer.tsx` | Keeps TikTok code in state but renders/selects Instagram connections only. |
| Connected Accounts page | Historical `/connected-accounts` page using `components/social/connected-accounts-workspace.tsx` | The route now redirects to `/settings#instagram-publishing`; settings expose only the Instagram manager. |

The previous TikTok form included account selection, a publish time, account
specific visibility, comments, duet/stitch, branded-content, and synthetic
media settings. The implementation still exists in the relevant components but
is unreachable through the current account filters.

## Evidence of the current restriction

- `components/scheduling/schedule-editor.tsx` filters both the initial and
  available accounts to `connection.platform === "instagram"`. It comments
  explicitly that TikTok/YouTube support is preserved as dormant future
  multi-platform support.
- `components/scheduling/scheduling-workspace.tsx` rejects any submission that
  does not include an Instagram target.
- `components/social/platform-selection-modal.tsx` defines TikTok but assigns
  `visiblePlatforms` to Instagram alone, and filters carousel connections to
  Instagram.
- `components/trending/hook-video-schedule-drawer.tsx` describes new Reel
  scheduling as Instagram-only and filters its visible connections accordingly.
- `components/settings/instagram-account-manager.tsx` states that TikTok and
  YouTube account-management UI is intentionally dormant while the product is
  Instagram-only. `app/connected-accounts/page.tsx` redirects to that
  Instagram-only settings area.
- `CAROUSEL_CONTEXT.md` records the same product decision: visible new-post
  scheduling is Instagram-only, while legacy TikTok targets must be retained.

## The retained TikTok scheduling/publishing pipeline

The feature was not deleted; the following pieces are still present:

| Layer | Location | What remains |
| --- | --- | --- |
| OAuth | `lib/social/tiktok-oauth-config.ts`, `lib/social/oauth.ts`, `app/api/social/tiktok/callback/route.ts` | TikTok authorization with `video.publish` and `video.list` scopes, callback handling, refresh, and revoke support. |
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
3. **Current code**: Still supports processing a legacy TikTok schedule target
   in the worker, but the normal UI cannot create a new one.

## Practical implication

There is no need to rebuild the provider integration to bring TikTok scheduling
back. Reactivation would require deliberately restoring TikTok to the four UI
entry points above and validating production TikTok credentials, app approval,
media-host verification for photo posts, and an end-to-end scheduled publish.
That work is out of scope for this audit; no product behavior was changed.
