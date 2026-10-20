# Email authentication

The public sign-in entry opens a choice between Google and email. Email users can
sign in, create an account, and request a password reset. Firebase owns user IDs,
passwords, verification status, and action codes. Resend delivers the published
templates. Supabase only stores hashed rate-limit counters; Supabase Auth is not
used.

## Existing credentials and required settings

- `RESEND_API_KEY` exists in Vercel Production. Its saved Secret value cannot be
  retrieved in the dashboard; actual Resend validity remains to be tested.
- `GOOGLE_CLOUD_CREDENTIALS_JSON` exists in Vercel Production and Preview. The
  owner confirmed that it belongs to `ugc-app-sa@ugcsaas.iam.gserviceaccount.com`.
  The code reuses it through the project's existing Google credentials helper.
- Firebase Email/Password is enabled. Both production domains are authorized.
- `email-verification` and `forgot-your-password` are the template aliases
  supplied by the owner. They are the defaults, and can be overridden with
  `RESEND_VERIFICATION_TEMPLATE_ID` and `RESEND_PASSWORD_RESET_TEMPLATE_ID`.
- Resend's `getugcpilot.com` domain is verified and ready to send. The recent key
  named `sd` has Full access. The saved Vercel secret cannot be compared with that
  key, so successful delivery still needs a real production inbox test.
- The `email-verification` template was corrected and published with a registered
  String variable `VERIFICATION_URL`, using `{{{VERIFICATION_URL}}}` in all three
  HTML placeholders. Its template UUID is `561a530d-5b60-40a4-a442-de220c138626`.
- The `forgot-your-password` draft was corrected with a registered String variable
  `RESET_URL`, using `{{{RESET_URL}}}` in all three placeholders. The subject is
  `Reset your UGC Pilot password` and the preview is `Use this link to create a new
  UGC Pilot password.` Its safe fallback is `https://getugcpilot.com/sign-in`.
  Its template UUID is `b12008e8-710e-422e-b3e3-8a7ceec5cc9b`. Publication is pending
  owner approval: automatic review rejected it twice because Resend's AI still
  claims the reset body contains verification copy. The saved HTML was checked
  after reloading: it says `Reset your password` and contains no verification text.
  An older reset version remains published; the corrected draft has not replaced it.
- Sender defaults to `UGC Pilot <admin@getugcpilot.com>`. Set `EMAIL_FROM` to
  `UGC Pilot <hello@getugcpilot.com>` to use that address. Sending needs domain
  verification and a key authorized for the sending domain; a mailbox alias is
  not needed solely to send from an address on the verified domain. Replies need
  a real mailbox or a forwarding alias.
- Set `EMAIL_AUTH_APP_URL` if needed. It defaults to `UGC_INTERNAL_APP_URL`, then
  `https://getugcpilot.com`. It is never derived from an incoming Host header.

The following nonsecret configuration was added to Vercel Production on
2026-09-30. A deployment is required before these values take effect:

| Variable | Value |
| --- | --- |
| `EMAIL_AUTH_APP_URL` | `https://getugcpilot.com` |
| `EMAIL_FROM` | `UGC Pilot <admin@getugcpilot.com>` |
| `RESEND_VERIFICATION_TEMPLATE_ID` | `email-verification` |
| `RESEND_PASSWORD_RESET_TEMPLATE_ID` | `forgot-your-password` |

Preview does not have `RESEND_API_KEY`. Email integration acceptance uses the
production domain and credentials; an isolated preview is sufficient for layout.

## Permission and rollout prerequisites

The custom role `projects/ugcsaas/roles/ugcAuthEmailSender` was created on
2026-09-30 and bound to `ugc-app-sa@ugcsaas.iam.gserviceaccount.com`. Its only
permission is `firebaseauth.users.sendEmail`, which permits Firebase's link
generation API. The binding was read back and verified. Existing project bindings
were preserved. `scripts/configure-auth-email-gcp.mjs` performs an idempotent dry
run by default and applies with `--execute --yes` using operator ADC.

`infra/gcp/foundation/auth-email.tf` declares these same resources. They were
created through the Google API, so import the existing custom role and IAM member
into the foundation Terraform state before applying that configuration. Do not
attempt to create duplicate resources.

`supabase/migrations/20260930160000_auth_email_rate_limits.sql` was applied to the
production database on 2026-09-30. The service-role-only RPC atomically enforces account/email cooldowns,
IP limits, and a global send budget across Vercel instances. Missing or unavailable
storage fails closed. Counters contain HMACs, not plaintext emails or IPs.
Production checks confirmed RLS and the service-role-only permissions. A rollback
transaction confirmed the initial request succeeds and an immediate repeat is
denied without consuming another request; no test counters were retained.

Publish the corrected reset template after owner approval. Then deploy the auth
changes and test on `https://getugcpilot.com`: create an account,
receive the Resend verification email, follow the branded action link, verify the
email, sign in, request and complete a password reset, and sign in with the new
password. Also verify expired/reused links, repeated requests, and a selected
paid plan across verification. Use an owner-approved test mailbox.

## Security behavior

- Verification recipients come only from a valid Firebase ID token; submitted
  recipient addresses are ignored. Product APIs still require verified users.
- Firebase generates links with `returnOobLink: true`, so it does not send a
  second default email. The secure code and mode are preserved in `/auth/action`.
  The existing Firebase action-handler setting does not need to be changed.
- Verification requires a button click on the action page, avoiding automatic
  code consumption by email scanners. Action codes and passwords are not logged.
- Password reset returns a neutral response before checking whether an account
  exists. Delivery runs in Next.js `after`; provider failure logs contain only
  the email kind. Logs contain no recipients, credentials, or action links.
- Continue links retain only a valid plan and billing interval on the same
  app's `/sign-in` route. They cannot point to arbitrary external locations.
- A created account survives email-delivery failure and gets a retry screen.

## Validation

Run focused tests with:

```powershell
node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/auth/email-client.test.mjs lib/auth/email-service.test.mjs lib/auth/email-rate-limit.test.mjs lib/auth/email-auth.test.ts lib/auth/account-isolation-contract.test.ts lib/firebase/in-flight-auth-requests.test.ts
```

On 2026-09-30, the focused suite passed all 39 tests, the production Next.js build
passed, and final TypeScript and targeted ESLint checks passed. Browser checks
confirmed the two-option entry, email-only form after selection, selected-plan
preservation, and mobile layout. Isolated HTTP checks covered unauthenticated
verification, cross-origin rejection, invalid reset input, and action-page headers.
The action-page browser check also confirmed incomplete links show a clear error
and return safely to the two-option sign-in screen with no console errors.

The app changes have not been deployed. Production email delivery remains
unverified until reset-template publication, deployment, and the real inbox/action
flow are completed. No credentials were exposed and no test emails or password
changes were made during implementation.
