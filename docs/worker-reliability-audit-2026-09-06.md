# Content worker reliability audit — 6 September 2026

Account: `m28013655@gmail.com`. Investigation covers the production database,
Cloud Run/Cloud Tasks, deployed application, and real model calls using the
account's business context. Source baseline: `465718f`.

The account's immediate inventory is recovered. The two previously failed
Carousel positions, 13 and 17, are now ready; the other 18 decided positions
are unchanged. Both recovered Carousels have six ready slides. All 12 rendered
image URLs returned HTTP 200 with nonempty image bodies on 6 September at
17:58 UTC. This is API/database/output verification, not an authenticated
browser walkthrough as the customer.

The architecture was not robust enough at its failure boundaries. Database
repairs are live. The additional application and worker hardening described
below is prepared and tested but still requires production deployment.

## Findings and repair status

| Failure | Evidence | Repair status |
| --- | --- | --- |
| Wall planning empty responses and timeouts | Historical 10 failures among 12 planning jobs; failed waits of 94–408 seconds | Compact ten-item chunks, bounded provider requests, and durable transient-error classification were already present. This repair removes a second inline request after an empty response and adds per-chunk timing. Code prepared. |
| Wall reservations outlive their parent | Two batches remained processing after their parent jobs exhausted all three attempts; one contained nine completed creatives and one unfinished assignment | Database trigger now terminalizes only matching unfinished work. Both old batches repaired live; all nine completed creatives preserved. Late claims are fenced by the parent job. |
| Wall uniqueness errors treated as infrastructure failures | The same persisted background constraint rejection was repeatedly retried | SQLSTATE 23505 and wrapped uniqueness errors now classify as terminal. Code prepared. Existing transactional background-reservation guards remain in place. |
| Wall copy incompatible with layout | Previously saved copy repeatedly failed deterministic fit checks | Typed terminal fit handling and stale-layout cleanup were already present in the deployed baseline. No claim that every generated text will fit; invalid output must fail and be replaced. |
| Carousel six-slide database failures | Arrays initialized before slide count; sixth image rejected by old constraint | Both earlier migrations were verified in production. Successful six-slide output now verifies the path. |
| Carousel recovery rejects an empty composite as an ownership mismatch | Real RPC returned an object whose fields were all null; actual feed ownership matched | Application normalizer prepared. Populated or malformed rows still undergo ownership checks. |
| Fully failed Carousel reservations cannot recover | A released reservation attached to a durable worker cannot be reopened, but the replacement function only handled partial success | Database now creates a fresh successor for fully failed durable reservations, preserving historical provenance and excluding active workers. Live and tested. |
| Word-count guidance becomes a hard publishing failure | Reference word ranges were documented as advisory, but Structure 2 put all diagnostics into blocking errors | Word counts are advisory again. Measured overflow, slide structure, claim safety, and other existing hard checks remain blocking. Code prepared. |
| One invalid Carousel discards valid siblings | The planner threw at its first exhausted repair before later candidates could be used | Failed candidates retain their response/diagnostics; later valid candidates continue to rendering. One isolated repair remains the limit. Code prepared. |
| Fresh job IDs bypass the overall retry budget | After the database recovery was enabled, the old deployed validator caused 22 failed replacement jobs before the 23rd succeeded | Both database replacement and cumulative-extension paths now stop after three successor batches per daily feed/profile version. This guard is live, including for older application versions. |
| Reaction catalog, validation, and SQL ambiguity failures | Earlier job eventually produced four videos; most elapsed time was waiting between retries | Existing fixes verified in source/deployment and covered by the targeted worker suite. They were not reimplemented here. |

## Measured delays

The full Wall canary used the actual current planner, the account's business
context, its prior 200 ideas, and local persistence. It produced all 200 new
ideas in **462.102 seconds (7 minutes 42 seconds)**, with 20 successful model
requests and 20 saved checkpoints. Model request time totalled 461.555 seconds.
There were no empty responses, timeouts, validation failures, or retries.
The canary did not write new plan items into production.

This isolates a remaining architectural cost: the application requires a fully
active 200-item plan before Wall writing starts, and the planner generates its
20 chunks sequentially. Removing database contention or increasing queue
capacity cannot remove that model latency. Starting planning before inventory
is needed, or implementing bounded parallel planning with cross-chunk
deduplication and ordered durable persistence, is the next performance change.
Partial-plan publishing was not introduced by this repair.

The final Structure 2 canary produced four valid six-slide plans in **14.920
seconds**, using two model calls. The prior canary under hard word-count gates
took 28.648 seconds and six calls. Both used the real account context; model
outputs are stochastic, so this is a measured example, not a latency guarantee.
One generic-copy candidate remained rejected, while four usable siblings were
retained. These local canaries validate planning and fit rules, not new image
reservation/rendering in the deployed worker.

Historical queue admission was typically about six seconds, with a ten-second
maximum in the sampled generation jobs. The database inspection found no
blocking sessions, long queries over 30 seconds, or retained deadlocks. Neither
was supported as the primary bottleneck. The Reaction job's approximately
2.6-hour elapsed time was dominated by waits between failed attempts, not its
roughly 72-second final successful execution.

## Validation

- 75 application/contract tests and 51 worker tests passed in an isolated
  checkout, including Reaction behavior and Carousel rendering tests.
- Worker TypeScript build, complete application typecheck, and the Next.js
  production build passed. Three existing test/type fixture problems were
  corrected so the complete application check could run cleanly.
- Real database transaction tests verified retry-budget preservation, exact
  parent ownership, terminal cleanup, preservation of nine completed creatives,
  rejection of late claims, active Carousel writer protection, creation of one
  successor, stale replacement no-op behavior, and unchanged generation history.
  Fixture mutations were rolled back.
- A second real transaction verified that an exhausted Carousel recovery budget
  cannot create another successor or increase its cumulative requested count.
- Live migrations: `20260906172732_repair_terminal_generation_recovery` and
  `20260906175631_bound_daily_carousel_recovery`.
- Source repairs are isolated on `codex/repair-content-worker-recovery` in
  `.tmp/worker-reliability-release`. Other ongoing typography, editor, rendering,
  and configuration changes in the original worktree are preserved separately.

Detailed local evidence is retained in
`.tmp/account-worker-investigation-20260906/`: the original investigation,
transaction-test SQL, provider timings, generation results, test/build logs,
and production output checks. Credentials and local environment files are
excluded from the release.

## Release boundary

Database repairs and customer inventory recovery are complete. Deploy the
prepared application and worker revision together, then verify release identity,
production reconciliation, and fresh generation output. The initial Vercel
deployment request was rejected by automatic approval review because it did
not identify a specific release commit and the newly discovered Carousel
failure was unresolved. Production code rollout awaits approval of the concrete
validated repair release; it has not been worked around through another tool.

The result is stronger failure isolation and bounded recovery, not a guarantee
that a model always returns valid content or that a new 200-item plan is fast.

## Follow-up: all formats and the ten-piece wait — 7 September local time

Starter is configured as 20 daily pieces in both production entitlement rows
(`pro`, the internal Starter key) and application policy. Free has 10; Growth
has 50. This account's 6 September feed reserved all 20 positions together at
08:56:42 UTC. There is no ten-piece checkpoint, cooldown, or delayed second
allocation. The browser shows Generating when currently deliverable cards run
out while other reserved slots remain unresolved. Same-day upgrades can
intentionally add a full paid pack; this account's 30-slot 30 August feed was
created before its Starter activation, whereas its later feeds have 20.

The observed failures were format-specific:
- Wall: reservation uniqueness conflicts, incompatible saved text/layout, then
  incorrect infrastructure retries. Its already-active September plan did not
  cause the later September 6 writing failures.
- Carousel: six-slide SQL failure, recovery-result parsing, advisory word
  counts treated as hard failures, and a rejected candidate aborting siblings.
- Reaction: absent catalog coverage, deterministic caption errors, and a SQL
  ambiguity. Successful rendering was about 72 seconds; the historic 2h36m
  elapsed time was mainly failed/requeue intervals.
- Hook: all five stored copy jobs for this account succeeded. No historical
  Hook recovery failure was demonstrated, but its SDK still retried requests
  invisibly and transient errors were not consistently classified for the
  durable worker.

Additional fixes prepared in this follow-up:
1. A Carousel provider exception no longer aborts the shared feed read or
   prevents the other three formats from preparing.
2. Every terminal format has a public failure object. The retained review
   shell can show recovery instead of a misleading Generating spinner.
   Physical slots missing after an interrupted reservation count as pending.
3. Exhausted Carousel recovery marks missing slots failed immediately when
   no viable work remains active. All active worker stages count as in-flight
   inventory, including provider waits, rendering, and uploading.
4. Explicit retries use the persisted daily retry token for Reaction as well
   as Wall. Carousel gets one new bounded three-successor window per explicit
   retry, without resetting historical sequence numbers. A repeated click
   with no newly failed slot does nothing.
5. Wall, Hook, Reaction, and Structure 1 copy requests use explicit 60-second
   timeouts with no SDK retries. Transient Hook/Reaction requests enter the
   durable retry path. Reaction empty output yields after one request;
   refusal and deterministic invalid copy are not treated as provider outages.
   Wall gateway/network failures now retry through the durable worker too.
6. Expired/exhausted trial reconciliation returns skipped so its outbox entry
   settles. Browser generation polling stops when an upgrade is required.

Database changes live:
- `20260906183128_allow_explicit_bounded_format_recovery`
- `20260906184412_restrict_carousel_recovery_rpc_access`

The latter closes public execution of an internal security-definer Carousel
recovery function found by the advisor. The replacement, reservation, and
explicit restart RPCs were verified inaccessible to anon/authenticated roles
and executable by service_role. The existing service-only table RLS notice
is unchanged; [Supabase explains that notice here](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Ten obsolete reconciliation callbacks had reached 196–442 attempts each.
All were still pending solely because their free trials had expired. After
checking current trial expiration and absence of paid access, those ten were
settled live. The verification snapshot has 301 completed outbox rows and
zero pending rows. Existing account content remains 18 decided and two ready
for the 6 September pack; no test changed those assignments.

Validation:
- 96 application/feed/billing/recovery tests and 105 worker tests passed.
- Worker compilation, complete app typecheck, and final production build passed.
- Real database transaction tests exercised server-role ownership rejection,
  explicit restart, duplicate no-op, unchanged ready/decided content and
  generation history, successor budget inheritance, stale expected-batch no-op,
  and limits on both replacement and cumulative extension. All fixture changes
  were rolled back.
- Fresh real-model canaries using the account's context returned six of six
  Hook copies in 7.587 seconds, four of four Reaction plans in 33.054 seconds,
  and one Wall copy with layout validation in 9.358 seconds. Outputs were
  local only. Reaction timing excludes MP4 rendering. The prior Carousel
  canary and verified production outputs remain described above.
- The production app is still `465718f`. No authenticated customer browser
  session was available; these checks are not a new deployed UI acceptance
  test. The expanded application/worker repair still needs coordinated
  production deployment and verification.

Evidence: `format-app-tests.log`, `format-worker-suite.log`,
`format-app-build-final.log`, `format-live-model-canaries.json`,
`explicit-recovery-tests.sql`, and `explicit-recovery-successor-tests.sql`
in the investigation artifact directory.
