# TikTok Direct Post audit runbook

## Purpose

UGC Pilot supports TikTok Direct Post only for the verified Firebase beta
account. Public posting remains blocked until TikTok approves the Direct Post
audit. This is intentional: an unaudited TikTok app may post only with the
creator's **Only me** visibility and a private creator account.

## Required production configuration

Before turning on TikTok scheduling, verify every media hostname used by the
social-publish worker in TikTok Developer Portal **Manage URL properties**.
Then deploy the same values to the app and the social-publish worker:

```text
TIKTOK_MEDIA_TRANSFER_MODE=PULL_FROM_URL
TIKTOK_VERIFIED_MEDIA_HOSTS=<comma-separated verified hostnames>
TIKTOK_DIRECT_POST_AUDITED=false
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

1. The approved user connecting a TikTok creator account.
2. The connected creator identity and TikTok-provided visibility choices.
3. An editable caption/title and the selected interactions/disclosures.
4. Manual visibility selection and explicit Music Usage Confirmation consent.
5. A scheduled video and a 2–35-image photo carousel reaching TikTok.
6. The resulting post and the per-video analytics view.

Do not present the final product as an internal-only posting tool. The
single-email restriction is a controlled beta boundary; the audited product
must remain creator-controlled and eligible for its intended users.

## After TikTok approves the audit

1. Set `TIKTOK_DIRECT_POST_AUDITED=true` in both the web app and GCP
   social-publish worker deployment.
2. Redeploy both runtimes.
3. Confirm the TikTok account is public, select **Everyone** manually, and
   schedule a real public post.
4. Verify target status becomes `published`, then refresh TikTok per-video
   analytics.

Never set `SELF_ONLY` automatically. TikTok requires the creator to choose
visibility from the options returned for that account.
