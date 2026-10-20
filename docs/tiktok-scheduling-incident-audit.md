# TikTok scheduling incident audit

**Audited:** 2026-09-23

## Scope

The audit covered the active TikTok connection for the verified UGC Pilot user
account, its most-recent persisted TikTok schedule, the corresponding worker
job, and a live Creator Info query. OAuth tokens were not displayed or written
by the audit.

## Finding

TikTok rejected the publish request before it created a publish operation. The
failure was **not** caused by the scheduler, expired OAuth credentials, or a
missing authorized scope.

The failed target requested `PUBLIC_TO_EVERYONE`. TikTok returned HTTP 403
with `unaudited_client_can_only_post_to_private_accounts` and the message that
the app could publish only with `Only me` visibility. The worker started the
job within seconds of its scheduled time, so dispatch itself was operating
normally.

A follow-up control test on the same connection succeeded on 2026-09-23 at
12:59 IST. It explicitly selected `SELF_ONLY`, included the required music-use
confirmation, started seven seconds after its scheduled time, and reached
TikTok's completed publish state. This proves that the scheduler, connection,
credentials, granted scopes, and file-upload media path all work for this
account when TikTok's unaudited-client restriction is respected.

The live Creator Info query now returns only:

- `FOLLOWER_OF_CREATOR`
- `MUTUAL_FOLLOW_FRIENDS`
- `SELF_ONLY`

It does **not** return `PUBLIC_TO_EVERYONE`. That is consistent with the TikTok
account being private. A private account cannot be used to test a post that
should be visible to everyone.

## Classification

| Area | Result | Evidence |
| --- | --- | --- |
| Scheduler / worker | Working | The failed job started at the scheduled time, and a later `SELF_ONLY` control test completed successfully. |
| OAuth credentials | Working | The access and refresh tokens were valid; the Creator Info request succeeded. |
| Authorized scopes | Working | `user.info.basic`, `video.publish`, and `video.list` were present. |
| TikTok app status | Blocking | TikTok has not approved this client for public Direct Post publishing. |
| TikTok account state | Test-only | The live privacy options show that the connected account is private. |

## Required remediation

### Private test

1. Keep the account private.
2. Create a **new** schedule and select `Only me` for that target.
3. Do not reuse the failed target: it permanently stores the previous
   `PUBLIC_TO_EVERYONE` selection.

This validates the integration, but the resulting post is visible only to the
account owner. The 2026-09-23 control test has already passed.

### Public publishing

1. Submit and obtain approval for TikTok's Direct Post audit.
2. Make the TikTok account public. At the next Creator Info request,
   `PUBLIC_TO_EVERYONE` must appear in TikTok's returned options.
3. Deploy the application and social-publish worker with
   `TIKTOK_DIRECT_POST_AUDITED=true` only after the audit is approved.
4. Keep the frontend dynamically driven by the current Creator Info privacy
   options; never preselect a visibility value.

The implementation source now blocks an unaudited public schedule up front,
rather than creating a job that will later receive this provider 403. Deploy
that change before treating the safeguard as active in production.

## Media-transfer follow-up

The failed video used `FILE_UPLOAD`; media host verification was not involved
in this incident. Before enabling `PULL_FROM_URL` in production, verify the
exact public media host (or serve media via a TikTok-verified custom domain) and
configure that host as `TIKTOK_VERIFIED_MEDIA_HOSTS`. The current application
media URLs use the GCS public host, so a different verified host must not be
configured unless URLs are served from it.

## References

- TikTok: [Content Posting API — Get Started](https://developers.tiktok.com/doc/content-posting-api-get-started)
- TikTok: [Content Sharing Guidelines](https://developers.tiktok.com/docs/en/content-sharing-guidelines)
