# Authentication sender domain — 2 November 2026

User scope: set sender to vidmake.io and check, without deployment. Incident: UGC-OPS-021.

Changed files:
- `lib/auth/email-service.ts`: default From is now `Vidmake <admin@vidmake.io>`.
- `lib/auth/email-service.test.mjs`: assert the new sender in the outgoing verification payload.
- `.env.example`: document the same sender, Vidmake name and vidmake.io link origin.
- `docs/ai-context/clear.md`: append discovery and local verification.
- This receipt.

The current local Resend key was already added by the user; no key was created, copied, printed or changed by this task. No local EMAIL_FROM override was found, so changing the established fallback changes the effective local sender. Explicit EMAIL_FROM overrides remain supported. No production environment, DNS, Resend setting or deployment was changed.

Evidence:
- Authenticated read-only Resend GET /domains:200; vidmake.io status verified, sending enabled, receiving disabled, region ap-northeast-1. This key lists only vidmake.io. The previous fallback selected getugcpilot.com; no actual rejection was elicited by sending a message.
- Public DNS-over-HTTPS: resend._domainkey.vidmake.io TXT present; send.vidmake.io CNAME, SPF TXT and MX resolve. The provider's actual verified status takes precedence over assumptions about the MX provider hostname.
- Read-only Resend template retrieval: email-verification and forgot-your-password both200 and published.
- Actual getAuthEmailConfiguration invoked after loading development env: sender admin@vidmake.io, app URL https://vidmake.io, configured API key, expected template aliases. Only non-secret fields printed.
- Email service/client/auth suites:19/19 PASS. Verification outgoing From, template and link are asserted through isolated provider boundaries; configured sender override, reset path, recipient protection, rate limits and safe errors preserved.
- Scoped ESLint, TypeScript (`npx tsc --noEmit --incremental false`) and diff whitespace checks PASS.

Preflight: AGENTS.md and relevant Explore/auth historical entries and nonnegotiables previously read in this ongoing investigation; context-memory/immutable-contracts re-read before edit; regression-gate read after edit. Preflight script passed prerequisite discovery. Full unrelated million-character historical ledger/context was not re-read. No new UI or schema behavior; minimal boundary is sender fallback/example and its regression. Existing user/concurrent changes retained.

Protected behavior: VERIFIED locally for sender configuration, explicit overrides, verification/reset URL/template construction and recipient/auth guards. UI, onboarding and scheduling source unchanged. Real Firebase link-generation permissions, Resend send acceptance and recipient inbox delivery remain NOT VERIFIED. No confirmation email was sent by this task. A future production release must also inspect any production EMAIL_FROM override, which takes precedence over this fallback.
