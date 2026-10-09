# TikTok Direct Post audit runbook

## Purpose

Product release on 2026-10-01: the owner requested Everyone and Your brand
as the defaults for new TikTok posts. These defaults remain editable, are
checked against fresh creator capabilities, and preserve explicit music consent.
This differs from TikTok's current [Content Sharing Guidelines](https://developers.tiktok.com/docs/en/content-sharing-guidelines),
which require no default audience and content disclosure off by default. The
manual-visibility audit steps below describe that provider requirement; they
are not a claim that the new product defaults comply with it.

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

Before turning on TikTok scheduling, verify the domain or exact URL prefix of
each media source used by the social-publish worker in TikTok Developer Portal
**URL properties**, in the app's **Production** configuration. For shared
storage hosts, verify the owned bucket prefix rather than the provider domain.
Configure the verified media hosts in the social-publish worker and audited
posting consistently in both the web app and worker:

```text
TIKTOK_VERIFIED_MEDIA_HOSTS=<comma-separated verified hostnames>
TIKTOK_DIRECT_POST_AUDITED=true
```

Photos always use `PULL_FROM_URL`. `TIKTOK_MEDIA_TRANSFER_MODE` selects the video
transfer method only: existing video `FILE_UPLOAD` can remain enabled, while
video `PULL_FROM_URL` also requires verified media URLs.

The worker refuses unverified media URLs before sending a URL-pull Direct Post request.
For the GCP social-publish worker, set the matching Terraform variables:
`tiktok_media_transfer_mode`, `tiktok_verified_media_hosts`, and
`tiktok_direct_post_audited`.

### Slideshow recovery with the existing GCS bucket

Production check on 2026-10-01 confirmed that slideshow images use
`https://storage.googleapis.com/ugcsaas-media/`. A real rendered slide returned
HTTP 200 with `image/webp` and no redirect. The live social-publish worker
revision `ugc-social-publish-worker-00056-jz4` had an empty
`TIKTOK_VERIFIED_MEDIA_HOSTS`; the latest six-slide target was action-required
with `tiktok_url_ownership_unverified`. No successful slideshow target was found.

1. In the correct TikTok app's Production URL properties, add the **URL prefix**
   `https://storage.googleapis.com/ugcsaas-media/`, including the trailing slash.
2. Download the signature file generated for that property. Upload that exact
   file, with its filename and contents unchanged, to the root of
   `gs://ugcsaas-media`. Its public URL must be
   `https://storage.googleapis.com/ugcsaas-media/<filename>` and return HTTP 200
   with no redirect. The signature file already used for the website does not
   establish verification of this media prefix.
3. Complete verification in TikTok and confirm the property is **Verified**.
   The local environment setting is a runtime allowlist, not proof of TikTok
   ownership verification.
4. After that confirmation, set the worker's
   `TIKTOK_VERIFIED_MEDIA_HOSTS=storage.googleapis.com` and preserve the same
   value in `infra/gcp/social-publish-worker/terraform.tfvars` through
   `tiktok_verified_media_hosts`. Only URLs under the verified bucket prefix
   are authorized by TikTok; other buckets on the same hostname are not.
5. Reconnect the exact intended TikTok account through production Settings.
   Both Clara account records inspected during this check were revoked; do not
   change a database status manually or replace the selected account silently.
6. Schedule one explicitly approved slideshow on https://www.getugcpilot.com.
   Confirm the provider returns `PUBLISH_COMPLETE`, the target becomes
   `published`, and the photo post appears on the selected TikTok account.

The photo publisher always sends `PULL_FROM_URL` to
`/v2/post/publish/content/init/`, regardless of `TIKTOK_MEDIA_TRANSFER_MODE`.
Changing the existing video `FILE_UPLOAD` setting is not necessary to recover
slideshows. The optional `media.getugcpilot.com` CDN remains disabled per
`CAROUSEL_CONTEXT.md`; this recovery uses the existing public bucket and does
not require a new CDN or image migration.

The two production commands below document the recovery. Run the upload only with
the signature file from the correct property, and run the service update only
after TikTok marks that property Verified:

```powershell
$signaturePath = 'C:\path\to\the\TikTok-generated-signature.txt'
gcloud storage cp $signaturePath gs://ugcsaas-media/ --project=ugcsaas --content-type=text/plain --cache-control=no-cache --no-clobber

gcloud run services update ugc-social-publish-worker --project=ugcsaas --region=us-central1 --update-env-vars=TIKTOK_VERIFIED_MEDIA_HOSTS=storage.googleapis.com
```

Official references: [URL property verification](https://developers.tiktok.com/docs/en/getting-started-create-an-app),
[media transfer and URL prefix rules](https://developers.tiktok.com/docs/en/content-posting-api-media-transfer-guide),
and [photo posting](https://developers.tiktok.com/docs/en/content-posting-api-reference-photo-post).

Signature deployment completed on 2026-10-01 after the owner supplied and
authorized hosting `tiktok41KhPT9XDx2y5CeAK5W5o2L5LF1GHnOu.txt`. The unchanged
file is retained at
`infra/gcp/social-publish-worker/verification/tiktok41KhPT9XDx2y5CeAK5W5o2L5LF1GHnOu.txt`
and uploaded to the bucket root with `text/plain` and `Cache-Control: no-cache`.
Its [public verification URL](https://storage.googleapis.com/ugcsaas-media/tiktok41KhPT9XDx2y5CeAK5W5o2L5LF1GHnOu.txt)
returned HTTP 200 without a redirect, exactly matching the original 68 bytes.
SHA-256: `d3052bcd6de44b57846141029cab6b026718df314897704aca6609458dfeac0f`.

The owner subsequently supplied a screenshot showing the storage URL prefix
under **Verified properties**, with the `getugcpilot.com` domain still verified.
After that confirmation, the production worker was updated to
`TIKTOK_VERIFIED_MEDIA_HOSTS=storage.googleapis.com` and the same setting was
persisted in the ignored production `infra/gcp/social-publish-worker/terraform.tfvars`.
Revision `ugc-social-publish-worker-00057-btp` is Ready and serves 100% of traffic.
The worker image, service account, and all other environment settings match the
pre-deployment snapshot, including video `FILE_UPLOAD` and audited posting.

Cloud Run confirms **ContainerHealthy** after its configured internal HTTP
startup probe at `/healthz`. The worker retains internal-only ingress; direct
external requests return Google's HTTP 404 and are not an application health
test. The public signature file still returns HTTP 200 with matching bytes.
No new TikTok post has been sent. Reconnecting the exact intended account and
one approved real slideshow reaching `PUBLISH_COMPLETE` remain the final
production acceptance steps.

### Remaining release and acceptance work after URL verification

The 2026-10-01 TikTok release builds on current production/main, preserving
the Runway video-generation update. The web changes set Everyone / Your brand
defaults and validate fresh creator capabilities in the three scheduling forms.
The social-publish worker forwards the saved AI-content choice as top-level
`is_aigc` for photos and explains media ownership failures without suggesting
regeneration. The existing PHOTO / DIRECT_POST / PULL_FROM_URL flow,
`video.publish` scope, stored slide order, and video FILE_UPLOAD setting remain.

Worker build and 50 focused tests passed, as did 46 Trending scheduling tests
and scoped lint. Deploy the web app and social-publish worker from the isolated
release commit; bake that SHA into the worker image and match its runtime
release identity. Verify the production alias, worker readiness, preserved
`TIKTOK_VERIFIED_MEDIA_HOSTS=storage.googleapis.com`, and signature-file bytes.

A read-only creator-info request for the newly connected `mrcool9251` account
returned HTTP 200 and permits Everyone. It has `video.publish` and valid access
and refresh authorization. The Clara connections remain revoked; reconnect
Clara only if that is the intended destination. Use the account chosen by the
creator rather than substituting another connection.

All six stored images for the latest blocked slideshow returned HTTP 200
without redirects, use WebP, and are below 20 MB. Their 1080x1350 size remains
unchanged. Previously blocked targets still require an explicit retry or a new
schedule with an available connection and current per-post settings/consent.
Do not rewrite statuses or automatically publish old drafts to prove recovery.

The production workspace redirects this browser session to sign-in. A real
scheduled photo post reaching provider `PUBLISH_COMPLETE`, a `published`
target, and the selected account remains required to verify provider acceptance
and the full authenticated UI flow. The audit did not create a post.

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
