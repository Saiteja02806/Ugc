# Local confirmation-email failure — 2 November2026

## Latest recheck: Google permission blocker cleared

After the user's local ADC login, Google token-info now identifies `srisaiteja03@gmail.com`. `testIamPermissions` returns200 and includes `firebaseauth.users.sendEmail`. The exact link API probe now returns400 `USER_NOT_FOUND` for the deliberately nonexistent `.invalid` address, rather than the prior project-use403. This confirms progress past the previous permission failure; it does not generate a real user's link or send a message. Sender remains `Vidmake <hello@vidmake.io>`. Evidence: `.tmp/email-current-audit/permission-restored-2026-11-02.json`. Actual signed-in resend, Resend delivery and clicked-link continuation remain unverified. Prior findings below are historical, not the current credential state.

**Verified local blocker: Google/Firebase action-link preparation returns403 before Resend delivery.**

Current local application configuration resolves to `Vidmake <hello@vidmake.io>`, `https://vidmake.io`, project `ugcsaas`, expected template aliases and a present Resend key. No explicit service-account credentials are configured in the loaded development environment; the diagnostic uses Google Application Default Credentials, matching the email service's fallback path.

The local flow is:

`Firebase account authentication → email configuration/rate limit → Google prepares verification link → Resend sends template → user follows link`.

Using the actual Google credential setup and the same `accounts:sendOobCode` request shape as `lib/auth/email-service.ts`, Google acquires a token but returns:

- HTTP403, `PERMISSION_DENIED`.
- Reason: `USER_PROJECT_DENIED`.
- Consumer: `projects/ugcsaas`.
- Required permission: `serviceusage.services.use`; provider suggests `roles/serviceusage.serviceUsageConsumer`.

The diagnostic uses a random nonexistent address under reserved `.invalid` with `returnOobLink:true`, never invokes Resend and prints no tokens/action codes. No message was sent or account created. This reproduces a real local preparation blocker independently of inbox/spam issues.

The separate `testIamPermissions` request returns the same project-use403; it cannot determine whether `firebaseauth.users.sendEmail` is granted. Do not infer that permission is missing from this response.

## Limits and repair boundary

### Confirmed local identity mismatch

Subsequent read-only Google token-info identifies local ADC as `chundusrinu111@gmail.com` (`UserRefreshClient`, stored `authorized_user`, quota project `ugcsaas`, no service-account impersonation). The user's IAM screenshot shows `srisaiteja03@gmail.com` as Owner and `ugc-app-sa@ugcsaas.iam.gserviceaccount.com` with an authentication-related custom role. Those grants belong to different identities from the failing local caller. The screenshot clips role details, so it does not verify every service-account permission.

Do not add more roles to the app service account solely to fix this local user-credential mismatch. First select the intended authorized identity for local ADC, then retest. `gcloud auth application-default login` prompts for that account; `gcloud auth application-default set-quota-project ugcsaas` selects the quota project. These commands were not executed by this audit. Source/evidence: `.tmp/email-current-audit/local-identity.json` and Google's ADC troubleshooting documentation. No tokens printed or retained in evidence.

The original user's failed HTTP response was not captured: current in-app-browser control failed to initialize, and Next's development log contains no underlying provider error. This fresh same-configuration reproduction is evidence of a sufficient blocker, not request-ID correlation with the original click.

Use the intended authorized local Google identity, or grant the current identity project-use permission on `ugcsaas`; then retry link generation and check `firebaseauth.users.sendEmail` if still denied. IAM/configuration changes were not performed under this diagnosis request. Changing the sender alone does not address the earlier Google failure.

After repairing credentials, a signed-in test account is still needed to verify real Resend acceptance, delivery and the clicked confirmation link. No claim of end-to-end success.

Evidence: `.tmp/email-current-audit/failure-diagnosis.json` and corresponding temporary diagnostic script; inspected `lib/auth/email-service.ts`, `email-handlers.ts`, `.next/dev/logs/next-development.log`. Existing19isolated email tests passed in the preceding local check but do not exercise real provider IAM. Incident **UGC-OPS-021** updated append-only. This receipt and `docs/ai-context/clear.md` are the only tracked changes for this diagnosis; no application code, credentials, IAM, DNS, hosting settings or deployment changed.
