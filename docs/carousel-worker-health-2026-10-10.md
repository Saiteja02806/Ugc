# Current carousel generation and worker health

Checked 10 October 2026, with job counts read at approximately 11:34 IST and
the initial report assembled at 11:38 IST. This is a production snapshot,
inspection and supersedes the earlier report's deployment-state observations.
No customer generation, retry, schedule, publishing or deployment was started
by this inspection. Concurrent uncommitted project changes were preserved.
Accounts below are identified by short hashes rather than names or emails.

**Follow-up:** A real generation run started at 11:36 IST and completed at
11:40 IST after the initial job-count snapshot. It completed nine of ten
candidates, with all 54 expected slides ready and nine final product screenshots
persisted. The affected feed is now seven ready and three decided Carousel
slots, with zero failed slots. One candidate was rejected for generic copy.
The initial verdict and counts below describe the earlier snapshot; current
repair and acceptance evidence is in `carousel-generation-repairs-2026-10-10.md`.

## Verdict

Carousel workers are currently healthy and have no outstanding generation or
edit tasks, but complete automatic generation after the latest fixes remains
unverified. A user still has seven failed carousel slots in today's feed.
Healthy infrastructure alone does not establish that these missing carousels
have been generated or delivered.

## Failed jobs and user impact

In the last 24 hours, excluding two explicitly marked invalid-payload canaries:

| Operation | Completed jobs | Failed jobs | Outstanding jobs |
| --- | ---: | ---: | ---: |
| Automatic carousel generation | 0 | 14 | 0 |
| Existing carousel edit rendering | 4 | 1 | 0 |

All 14 generation failures belong to account `658705a6` and occurred before the
latest release. Each job contains five candidate carousel IDs: the resulting
70 failed generation records comprise 35 copy/planner-validation failures and
35 database screenshot metadata failures. These counts represent batch jobs
and candidate records, not 70 missing daily-feed slots.

Of the failed batch jobs, eight ran on worker commit `1a9ec5d` and six on
`3f35202`. Their last failure was `2026-10-09T20:13:09.933Z` (10 October,
01:43 IST). The separate failed edit ran on `c85b414` and reports that hook
text could not fit within four lines at fixed 84px.

Across the last seven days there are 29 failed generation batch jobs across
three accounts, excluding explicitly marked canaries. Four generation jobs
are completed in that window. Batch status alone is not a per-carousel success
rate: candidates can complete independently within a failed batch.

The affected account's actual 10 October feed has ten carousel slots:

- Three are `decided` and point to complete owned outputs.
- Seven are `failed`, with none awaiting queued/processing carousel jobs.
- `recovery_attempt_count` is 3. The persisted recovery message is:
  "Carousel generation stopped after its automatic recovery attempts. Try
  again to restart the missing pieces."

The feed's overall status is `ready`; that does not mean every format's slots
are fulfilled. Other formats have delivered content. On 9 October this account
had six ready and four decided carousel slots, all with complete owned outputs.

## Current release and worker health

Production website lookup resolves to READY Vercel deployment
`dpl_8we8uoSu1GCvr6HfxUwhdBYJAR38`, source
`bb83ce32773011562702adb90ed6966a4279cc7e`.

| Worker | Active revision | Source | Readiness | Traffic |
| --- | --- | --- | --- | ---: |
| Generation | `ugc-carousel-worker-00109-gsd` | `bb83ce3` | True | 100% |
| Edits | `ugc-carousel-edit-worker-00002-7hw` | `bb83ce3` | True | 100% |

Both services have one warm minimum instance and one maximum instance.
The edit service accepts `render_trending_carousel_edit` on `carousel-edit`;
its dedicated `ugc-carousel-edit` queue is running. The `ugc-carousel`
generation queue is also running. Both inspected queues are empty, there are
no nonterminal carousel jobs, and no generation rows remain in the inspected
queued/pending/processing/generating/rendering states. The reconciliation
outbox has 1,192 completed entries and no unfinished entries.

No Cloud Run ERROR records or HTTP responses of 400 or greater were returned
for these two services after `2026-10-09T21:35:08Z`. Vercel's feed/reconciliation
error query returned none in the most recent hour. These bounded observations
do not prove that all application operations have run successfully.

The applied migration `20261009202401_align_six_slide_product_screenshot_metadata`
is recorded in production. The live check now permits eligible product assets
on Slides 4, 5 and 6, preserving the other required metadata predicates.
The former Slide 6 database incompatibility is therefore corrected in the
current schema. The shipped Structure 2 planner is v22 with role-specific
copy guidance and actual renderer fit validation. The dedicated edit service,
independent reconciliation and reservation recovery changes are in this release.

## Successful output evidence and remaining acceptance gap

In the last seven days, 76 completed carousel records across three accounts
have their expected slide count, ready statuses and nonempty rendered URLs:
62 for `658705a6`, eight for `83e3e787`, and six for `591e540b`. None of these
completed records has an incomplete expected output. Recent ready/decided feed
assignments join to the same authenticated owner and complete carousel outputs;
no ownership mismatch or incomplete assignment was found in that query.

The newest completed automatic carousel predates the latest fix release:
`2026-10-09T05:52:56.887Z` (9 October, 11:22 IST). Since the generation worker
became ready at approximately 03:05 IST on 10 October, the only generation job
is an intentional invalid-payload canary. It failed as expected and is excluded
from customer-failure findings. No real automatic generation was submitted
after the fixes, so there is no post-fix automatic success or failure to assess.

A real post-fix edit did succeed: job `23a92421-6bf6-4c08-9747-40549ca04684`,
edit `e96587ee-a0a8-45d6-a170-0f8b09176112`, revision 1. It was claimed after
0.908 seconds, rendered/finalized in 2.803 seconds and completed at
`2026-10-10T05:43:58.049602Z` (11:13:58 IST). Its output has six slides and
renderer `story-native-full-frame-product-inter-tight-v13-normalized-edit-v4`.
The output-file HEAD checks returned HTTP 200 with nonempty WebP content.

No Explore slideshow image jobs tagged with `input_json.exploreFormat = slideshow`
were found in the seven-day query. This does not establish manual Explore
generation acceptance and is not treated as evidence of failure by itself.

The next meaningful acceptance check is an explicitly authorized bounded
generation/retry using the current release, followed through candidate creation,
all six stored slides, feed admission and actual image delivery. The exhausted
user feed needs an explicit restart rather than waiting on a nonexistent job.
Do not mass-retry historical batches or equate an invalid-payload canary with
successful customer generation.
