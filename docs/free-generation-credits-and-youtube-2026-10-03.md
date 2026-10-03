# One-time free AI credits and YouTube plan benefits

Free accounts receive 2 AI generation credits once per Firebase account. The allowance has no monthly renewal or expiry and is separate from the 7-day daily-content trial and the existing assisted character generation. It becomes available on the first authenticated free billing/AI Studio access; existing free accounts qualify too.

The private free_generation_credit_balances ledger preserves spending across sign-ins, trial expiry, and subscription changes. Reservations use the same per-account transaction lock as paid billing, enforce the remaining budget, and remember their source. Successful jobs commit once; failed or cancelled jobs return the reservation once. Free completions never enter the Dodo usage outbox. Subscription cancellation cannot release free reservations or change the lifetime ledger.

Paid and complimentary accounts continue to use their existing monthly balances. A remaining free allowance is retained while a paid subscription is active and becomes available again if the account returns to free access. Paid plans retain 200 / 600 monthly credits, including annual subscriptions. AI Studio remains accessible after credits are spent so users can view history and pending results; starting a new generation still requires sufficient credits. Generation prices depend on the selected model and video duration, so 2 credits do not promise a video generation.

Pricing cards, the comparison table, workflow benefits, FAQs, the sidebar, and settings billing show the free allowance separately from monthly paid credits. YouTube connection and video scheduling are available on every plan for verified users with a connected channel. YouTube accepts videos, and no new channel-count limit is advertised or imposed by this release.

Validation includes real Postgres migration tests with PGlite (budget cap, idempotence, refunds, free billing isolation, paid/complimentary behavior, subscription changes, and browser-role permissions), server subscription/access tests, the billing recovery suite, pricing rendering and checkout tests, focused ESLint, and a production build. Production rollout and browser checks are recorded after deployment.

Production migration: `20261003110411_one_time_free_generation_credits.sql`, applied to project kltxwijhluawgveykfbt. A service-role transaction verified the real deployed grant, reservation cap, idempotence, refund, and settlement, then rolled back all test data.
