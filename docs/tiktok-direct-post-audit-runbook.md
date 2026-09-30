# TikTok Direct Post audit runbook

## Purpose

As of 2026-09-30, the owner confirmed TikTok Direct Post audit approval. UGC
Pilot enables connections, scheduling, and analytics for every verified
signed-in user. The web app and publish worker default to audited posting.
An explicit `TIKTOK_DIRECT_POST_AUDITED=false` override restores private testing:
an unaudited TikTok app may post only with the creator's **Only me** visibility
and a private creator account.

The scheduler checks fresh creator information for the selected connection
before accepting an unaudited TikTok target (including pending-render plans).
The publish worker repeats the check before initializing a new video or photo
post. `PUBLIC_TO_EVERYONE` identifies a public account;
`FOLLOWER_OF_CREATOR` identifies a private account. `SELF_ONLY` alone does not
establish account privacy. Missing or ambiguous account privacy is blocked with
a refresh message. Both runtimes use the dependency-free policy in
`worker/src/lib/tiktok-direct-post-policy.ts`.

The app never changes the account, substitutes visibility, or switches the
selected connection. Existing provider sessions retain their publish ID on
retry; this preflight does not initialize a duplicate. Provider error
`unaudited_client_can_only_post_to_private_accounts` must explain both privacy
requirements, not suggest Only me alone fixes it. Account-privacy failures are
action-required, not automatic retries.

For a private test, make the exact selected TikTok account private and choose
Only me. If that connection was disconnected, reconnect it or explicitly select
the intended connected private account. Recheck with `scripts/diagnose-tiktok.mjs`
before authorizing a new test post. Website/domain verification is separate
from Direct Post audit approval.

## Required production configuration

Before turning on TikTok scheduling, verify every media hostname used by the
social-publish worker in TikTok Developer Portal **Manage URL properties**.
Then deploy the same values to the app and the social-publish worker:

```text
TIKTOK_MEDIA_TRANSFER_MODE=PULL_FROM_URL
TIKTOK_VERIFIED_MEDIA_HOSTS=<comma-separated verified hostnames>
TIKTOK_DIRECT_POST_AUDITED=true
```

The worker refuses unverified media URLs before sending a Direct Post request.
For the GCP social-publish worker, set the matching Terraform variables:
`tiktok_media_transfer_mode`, `tiktok_verified_media_hosts`, and
`tiktok_direct_post_audited`.

## TikTok review submission

Keep Login Kit and Content Posting API enabled with only these scopes:

- `user.info.basic`
- `video.publish`
- `video.list`

Record an end-to-end review video on production that shows:

1. A verified signed-in user connecting their TikTok creator account.
2. The connected creator identity and TikTok-provided visibility choices.
3. An editable caption/title and the selected interactions/disclosures.
4. Manual visibility selection and explicit Music Usage Confirmation consent.
5. A scheduled video and a 2–35-image photo carousel reaching TikTok.
6. The resulting post and the per-video analytics view.

The product is available to all verified users and remains creator-controlled.
The former email allowlist is retired.

## General availability release verification

1. Replace any old `TIKTOK_DIRECT_POST_AUDITED=false` override with `true` in
   both the web app and GCP social-publish worker deployment. Terraform's
   `tiktok_direct_post_audited` variable must also be `true`.
2. Redeploy both runtimes.
3. Confirm the TikTok account is public, select **Everyone** manually, and
   schedule a real public post.
4. Verify target status becomes `published`, then refresh TikTok per-video
   analytics.

Never set `SELF_ONLY` automatically. TikTok requires the creator to choose
visibility from the options returned for that account.
