# Local sender correction — 2 November2026

User explicitly selected **Vidmake <hello@vidmake.io>**, replacing the earlier admin address. Scope: local sender default and example only; no deployment or hosting/provider settings changed.

Files changed:

- `lib/auth/email-service.ts`: fallback From now `Vidmake <hello@vidmake.io>`; explicit `EMAIL_FROM` override remains supported.
- `lib/auth/email-service.test.mjs`: existing outgoing verification payload assertion updated to hello; configured sender/reset tests retained.
- `.env.example`: same hello sender.
- `docs/ai-context/clear.md`: append clarification/evidence for UGC-OPS-021 without rewriting earlier sender history.
- This receipt.

Preflight: repository AGENTS instructions and relevant Explore/auth history, nonnegotiables, prior domain/current-production receipts applied; ugc-context-memory, ugc-immutable-contracts and ugc-regression-gate re-read. Python preflight passed. Existing targeted diffs inspected and all unrelated work retained. This does not claim a fresh full reread of every historical context line.

Verification:

-19email service/client/auth tests passed using the existing loader/module-mock command recorded in `docs/email-current-production-audit-2026-11-02.md`; log `.tmp/email-current-audit/hello-tests.log`.
- Actual local `getAuthEmailConfiguration()` after loading development env resolves From to hello, app URL to `https://vidmake.io`, both expected template aliases and configured key. No local `EMAIL_FROM` override exists. No key printed.
- Scoped ESLint and diff checks passed. `npx tsc --noEmit` failed with13missing-name errors in the unrelated, already-untracked `remotion/HookVideoPromo.tsx` (including `RemixHookTextCard`, `showRemixDropZone`, `remixZoneOpacity`). That file was not edited in this task; no email-file diagnostics reported. Full project type gate remains red, and no fix or deployment of unrelated Remotion work was attempted.
- Local app remains running at `http://localhost:3000/sign-in`. Verification without authentication returns401 and invalid-email reset400, without sending. Actual local Google ADC can acquire a token when networking is allowed; read-only email permission inspection returned403. This unsuccessful inspection is not proof that send permission is absent. No real action link or mail was requested.

Protected behaviors: recipient ownership, authentication, rate limits, reset privacy, template variables/links and explicit sender overrides **VERIFIED by isolated tests**; palette/layout unchanged by diff. Actual Firebase email generation, Resend send acceptance, inbox arrival and signed-in continuation **NOT VERIFIED**, pending designated test recipient/account. Earlier production audit still shows explicit old-domain sender/origin; local changes do not alter production.

No email sent, local secret/env file rewritten, account changed, staging/commit/push/deploy or remote configuration mutation. Rollback only the three sender-specific hunks; earlier domain/default/example work remains intentional. UGC-OPS-021 remains open for actual end-to-end delivery.
