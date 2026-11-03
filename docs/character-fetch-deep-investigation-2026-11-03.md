# AI Character “Failed to fetch” — deep investigation, 3 November 2026

**The matching production attempt stopped while preparing references, before a generation job was created.** The exact original browser transport error was not captured; it cannot honestly be narrowed to DNS, TLS, a disconnected request, an extension, stale CORS cache or another network cause from the screenshot alone. This is an OPEN investigation result, not a fix or successful paid-generation receipt.

## Evidence that locates the failure

Vercel production alias `vidmake.io` resolved to deployment `dpl_2gafCZHSurw9UW3zZKUSibdWUeFh`, commit `b09e721f56d295304da91b362ec9c0f4133bf1ff`. The workspace preparation code in this commit matches the code inspected locally. HEAD was the same commit at the audit snapshot. Other billing/registry edits appeared concurrently; they were not changed by this investigation.

Read-only Supabase queries found this sequence under the same owner:

| Reference | Reserved UTC | READY UTC | Prepared JPEG bytes |
| --- | --- | --- | ---: |
| Extreme (`3.jpg`) |12:28:32.668|12:28:36.084|207,419|
| Bedroom (`cozy-floral-bedroom.jpg`) |12:28:38.267|12:28:40.862|93,450|
| Middle Eastern (`middle-eastern.jpg`) |12:28:55.435|12:29:03.639|205,129|
| Vibrant Open (`vibrant-open.jpg`) |12:29:04.884|12:29:07.116|40,212|

This is **5:58:32–5:59:07 PM IST** on 3 November. All four are READY, not failed provider jobs. No Natural / Casual build reference or later catalog upload is recorded for that owner that day. This screenshot selection's actual reference order puts Natural / Casual fifth, followed by neck, height and headphones.

No `background_jobs` record with `input_json.characterSource = 'ugc-pilot-characters'` exists for this owner since November 1. Its latest returned character jobs are older completed October27jobs. Thus this matching attempt never entered paid character-job admission. No conclusion about every account or unrelated image jobs is implied.

The sequence is strongly correlated to the screenshot by its exact selections/order and four byte sizes, which match fresh real-browser JPEG preparation exactly. There is no original browser request ID tying the screenshot to these rows; keep that qualification.

## What the red banner means in the actual code

`components/characters/character-workspace.tsx`:
- `ownedStudioAssetId` at line48 first fetches the raw catalog image, converts it, calls the owned upload service, and caches a ready asset ID.
- `handleGenerate` awaits all references sequentially at line188. Only afterward does it call `builder.generate.mutateAsync`.
- `submitted` is set before the generation mutation. Its red-banner catch at line212 runs only while `submitted` is false. A generation-mutation failure has a different amber banner.
- The red catch displays the original message without adding the reference role, image path or failing upload phase.

`lib/ai-studio/reference-media-upload.ts`:
- Create-upload POST precedes direct storage PUT, then complete-upload POST.
- Valid non-2xx HTTP responses usually produce specific application messages; a rejected browser fetch bubbles up as generic `Failed to fetch`.
- Create/complete/PUT have deadlines; raw catalog GET in the workspace does not.
- A lost complete acknowledgement has an owned-asset recovery read. Do not remove this protection or blindly repeat paid generation.

The lack of a fifth reservation narrows this matching occurrence to the fifth raw catalog fetch or preparation before a fifth reservation was persisted (including auth/token or create-upload transport/signing stages). It weighs against a fifth storage PUT failure: that would normally leave a fifth `uploading` record. It does not prove the exact failed URL retrospectively.

## Tests that actually exercise the failing boundary

New ignored investigation harness `.tmp/character-failure-deep/full-preparation.browser.mjs` mounts the **actual CharacterWorkspace and actual uploadAIStudioReferenceMedia**, using actual catalog image bytes/browser canvas. Only account auth, API/storage responses, builder admission and canvas/history presentation are controlled. No real customer upload/provider call occurs.

| Controlled case | Upload reservations | PUTs received | READY confirmations | Generation admissions | Red banner |
| --- | ---: | ---: | ---: | ---: | --- |
| No fault |8|8|8|1|None|
| Fifth catalog GET aborted |4|4|4|0|Failed to fetch|
| Fifth create-upload POST aborted |4|4|4|0|Failed to fetch|
| Fifth PUT aborted |5|4|4|0|Failed to fetch|
| Fifth complete-upload POST aborted; recovery unavailable |5|5|4|0|Failed to fetch|
| Token helper rejects |0|0|0|0|Failed to fetch|

All assertions pass. The clean case verifies selected Half framing, Gemini3Pro, eight reference IDs and unchanged ordered input. A second same-mount submission reuses ready reference uploads. This test proves preparation wiring, not live database/provider delivery.

Recovery harness `.tmp/character-failure-deep/recovery.browser.mjs`:
- Hold fifth catalog GET: four ready references, no admission, Generate remains disabled until the request is aborted. No application-owned raw-fetch deadline exists.
- Abort and manually retry on same page: reuse first four ready uploads and finish the remaining four.
- Reload and reselect: all eight upload again; total reservations rises from8to16.
- Final assertions PASS. Two earlier harness attempts timed out because they searched for “Generate” while the actual busy label was “Synthesizing...”; those are corrected harness errors, not evidence of another application failure.

Current character/builder suite:143tests,142PASS/1FAIL. The failure remains the historical307-versus308redirect expectation. Command and output: `.tmp/character-failure-deep/current-tests.log`. Earlier generic-worker39tests and workerbuild passed in the preceding audit; not represented as newly executed in this investigation. No test count here proves full production acceptance.

## Confirmed bottlenecks and why failures recur

1. **Browser relays stock catalog references before admission.** This selection downloads13,239,527bytes of original PNGs, decodes/resizes them to1,066,780JPEGbytes, then uploads all8through authenticated preparation/PUT/confirmation. This is up to32sequential network operations (GET + create + PUT + complete per reference), plus authentication work, before the model starts. The provider never sees a partially prepared list.
2. **Serial work amplifies latency and exposure.** A real browser on `https://vidmake.io` took27.643seconds for public GET/decode/JPEG preparation alone in one observed run, excluding all authenticated upload steps. MiddleEastern alone took16.29seconds; this is observed variability, not a universal performance figure or proof it caused the original failure. The production first-four record interval is34.448seconds, excluding time before the first reservation.
3. **A single failed raw GET stops the chain without application retry or a deadline.** Safe idempotent catalog reads have no bounded retry here. Do not extend that statement to paid requests: those need durable replay semantics, not generic retries.
4. **No durable preparation cache.** Ready references are cached in component refs only; same-page retry works, reload loses those IDs and repeats work. Failed attempts can leave upload reservations. Nine old Nov1/2catalog rows remain `uploading`; that is evidence of unfinished preparation, not proof all have the same cause. No cleanup was performed.
5. **No stage-specific diagnosis.** Auth, catalog, reservation and storage failures can display the identical banner. There is no preparation attempt ID, role/phase context, or client failure telemetry in this path, so backend logs cannot reconstruct a failed client request that never reached a server.
6. **Earlier verification missed the full path.** `scripts/character-studio-layout.browser.mjs` mounts only the dock and provides `onGenerate={()=>{}}`; its upload service is isolated and its “Failed to fetch” text is static fixture text. It is appropriate for visual/bounds checks, not generation acceptance. The previous report explicitly left hosted acceptance unverified, but the test totals did not exercise this failure boundary. This investigation adds that missing evidence.

## Live checks and exclusions

- Fresh production bucket policy and real HTTP OPTIONS allow `https://vidmake.io`, `https://www.vidmake.io`, legacy GetUGCPilot, and localhost3000. localhost3001 and127.0.0.1:3000 are not allowed. These are exact-origin rules, not permission to add wildcard CORS. No evidence that this production-correlated attempt used those disallowed local origins.
- All8actual registered public URLs returned200, decoded, resized and JPEG-encoded successfully in a browser on the real Vidmake origin. Four output sizes exactly match the production rows. No missing/corrupt NaturalCasual file reproduced. One preliminary guessed headphones.png path returned404; it was not a registered selection and is excluded. Registered over-ear-headphones.png passes.
- Current Cloud Run AI worker:revision `ugc-ai-generation-worker-r-f7723049`, Ready/ConfigurationsReady/RoutesReady true,100percent serving traffic. The returned48hERRORlogs were Nov1startup errors on a superseded17fe15f2revision. They do not explain this pre-admission screenshot.
- Vercel runtime log at12:28:35.969UTC on `/api/media/complete-upload`, request `qxpf4-1793708915644-a96200668bae`, production `vidmake.io`, contains a Node url.parse deprecation warning. The matching Extreme reference becameREADY; the warning is not established as a failed upload. No other character error was returned by those console-log searches. No-console-log does not mean no HTTP request happened.
- Vercel observability query rejected with400twice; no request-count/status proof is claimed from that endpoint. Browser-side failed transport cannot be recovered from a missing console record.
- No new provider call, new paid generation, cloud configuration change, database write, retry/cancel, push or deployment. Model quality, live saved identity/download and actual signed-in end-to-end success are still NOT VERIFIED. Production diagnostic browser ends at sign-in; no credentials were extracted or sign-in bypassed.

## Repair order supported by the evidence

1. Add preparation-stage errors and safe telemetry: attempt ID, trait role/ID, phase and elapsed time; exclude tokens/signed URLs/prompts. Distinguish loading a build image from storage upload and API admission. Retain existing UI geometry and a useful retry action.
2. Bound catalog GET/decode waits, retry only definite safe GET transport failures with a short bounded policy, and retain each completed reference. Explicitly test stalled reads, disconnects, non-image responses and each upload phase. Do not blindly retry a create-upload POST with a new reservation or any uncertain paid request.
3. Persist/recover owner-scoped catalog preparation receipts across reloads; validate ready/ownership/content revision before reuse. Create-upload reservations also need stable recovery for lost acknowledgement if that boundary is changed.
4. Reduce stock-reference transfer and serial latency: serve prepared catalog derivatives/reuse validated owned assets; consider bounded concurrency preserving role order. A server-side catalog-reference resolver could remove browser round-tripping of stock assets, but is a separate architecture choice, not an already implemented fix.
5. Run the real signed-in workflow with a selected account, inspect accepted job/provider/output receipts and save/download. Only then close the incident. Keep the newly created full-preparation fault cases as persistent regressions when implementing the patch.

No repair is declared implemented in this audit. The strongest proven finding is the fragile pre-admission reference-preparation path. The exact original network trigger remains UNKNOWN; adding diagnostics is necessary to distinguish the narrow remaining alternatives on the next occurrence.

## Artifacts and scope receipt

Ignored local evidence under `.tmp/character-failure-deep/`:
- `backend-receipts.json`: retained read-only result excerpts, no email/token.
- `selected-manifest.json`, `source-hashes.json`: exact selection and source snapshot.
- `cors.json`, `live-browser-catalog.json`: fresh live preflights/public browser reads.
- `full-preparation.browser.mjs`, `fault-matrix.json` and six screenshots.
- `recovery.browser.mjs`, `recovery.json`: retry/reload checks.
- `current-tests.log`: current143-test outcome.

Repository files changed by this investigation only: this report, appended `EXPLORE_CONTEXT.md`, appended `docs/ai-context/clear.md` (UGC-UI-20261103-CHARACTER-FETCH-RECURRENCE). Concurrent billing/pricing/registry changes were preserved. Application source untouched by this task.

Skills/sources actually used: context-memory, immutable-contracts, UI-clarity and Supabase SKILL.md read; existing regression-gate retained from preceding task; AGENTS/core contracts, relevant Explore/clear recurrence and prior CORS/OpenRouter/deployment receipts inspected. Megabyte historical context reads were truncated; no full fresh-history read claimed. Read-only audit has no application-code edit or production acceptance claim. Supabase changelog.md browsing failed due markdown content handling; no database feature/API/schema implementation was undertaken. Backend reads were SELECT only.
