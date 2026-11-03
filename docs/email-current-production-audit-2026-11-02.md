# Email configuration and live-route audit — 2 November 2026

Status: **partially verified**. Read-only inspection found that the Vidmake email-domain migration is not complete in the current production environment. This does not by itself establish an email delivery outage.

## Confirmed evidence

- Live `https://vidmake.io/sign-in` and `/auth/action` return200. Actual sign-in browser renders Continue with email.
- Old-domain `/auth/action?mode=verifyEmail&probe=email-audit` returns308 to Vidmake, preserving those query parameters. No real action code was used/applied.
- Vidmake production alias points to READY deployment `dpl_AmM4hkp74xSHCZZJ7sarBtmkzXYp`, source `b9becb4e48642131bd50f5b81274d0d0adbd85e3`.
- Vercel production variable read confirms:
  - `EMAIL_FROM`: `UGC Pilot <admin@getugcpilot.com>`.
  - `EMAIL_AUTH_APP_URL`: `https://getugcpilot.com`.
  - Template aliases: `email-verification`, `forgot-your-password`.
- Resend key and GCP service-account configuration variables exist in production as sensitive variables; their plaintext values are unavailable through the read endpoint. Presence is not proof of a valid production key or Firebase permission. Explicit production sender/link-origin variables override local code defaults. These variables predate the active deployment.
- Existing local Resend key reads: `vidmake.io` verified, sending enabled; both template aliases published, with expected `VERIFICATION_URL` / `RESET_URL` variables. DKIM TXT and send SPF/MX records resolve.
- The Resend account visible through that local key lists six older verification emails, all delivered from the old domain, latest26October2026. There is no recent Vidmake send in that visible history. The sensitive production key cannot be compared, so this is not a claim about an inaccessible separate account.
- Live unauthenticated verification POST returns401; invalid-email reset POST returns400. Both are intentionally non-sending negative probes and do not establish valid-user delivery.
- Sanitized Vercel verification request-log query returned the audit401 only in the queried24hours. Password-reset log query timed out. Earlier CLI log query also timed out; direct installed-CLI-equivalent read endpoint returned verification logs successfully. Absence of other returned records is not proof of no requests outside retention/filter visibility.

## Tests and limits

`node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --test lib/auth/email-service.test.mjs lib/auth/email-client.test.mjs lib/auth/email-auth.test.ts` — **19 passed**. These isolate Firebase/Resend transport; they verify recipient ownership, signup/resend handoff, URL/template construction, reset privacy, rate-limit behavior and safe failures. They do not prove production delivery.

Real sending, Firebase action-link generation permissions, Resend acceptance/delivery, inbox arrival, clicking the received action and the authenticated continuation remain **NOT VERIFIED**. A test recipient and access to the signed-in test account were requested. Verification route derives the recipient from the authenticated account; an arbitrary email supplied in a request cannot redirect it. No account or password was created/reset and no message was sent in this audit.

## Read-only access and artifacts

The old workspace Vercel token returned403; the existing desktop CLI authentication succeeded. No new credentials were created. API keys, private keys, recipients and email action codes were not printed. Environment-list encrypted field payloads were excluded from the saved sanitized summary after resolving the individual read endpoint; no plaintext secrets saved.

Artifacts under `.tmp/email-current-audit/`: `config-and-provider.json` (sanitized metadata), `production-config.json` (safe effective fields only), `live-logs.json`, `hosting-routes.json`, `tests.log`. Temporary read-only scripts remain there. Initial sandbox networking was denied; authorized read-only external requests ran outside the sandbox.

Application source, Vercel/Resend/DNS settings and deployment were unchanged. Tracked documentation changes for this audit: this receipt and append-only `docs/ai-context/clear.md` follow-up to **UGC-OPS-021**. Prior sender/domain evidence and source: `docs/auth-email-domain-2026-11-02.md`; `lib/auth/email-service.ts`, `email-policy.ts`, `email-handlers.ts`, `email-runtime.ts`; actual Vercel/Resend/DNS responses. Existing unrelated worktree changes are preserved.

Next concrete verification step: use the user's designated test account to request one real verification email on production, correlate its route response and Resend event, then verify the received link/continuation with that recipient. Sender/link-origin alignment is a separate production setting/release change and was not performed under this audit request.
