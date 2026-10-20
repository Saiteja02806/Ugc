# Seedance result delivery and model-specific image limits

## Production diagnosis

Read-only checks on 20 October confirmed two Seedance jobs completed at ReAPI
but failed locally with `PROVIDER_OUTPUT_COLLECTION_FAILED`:
`a9619070-8517-4d56-b213-d44bab46c141` and
`cc899a93-7ad1-44a6-82f9-943399d7982c`. Both retain a `primary-reapi`
operation in `provider_succeeded`, a task ID, and no persisted media output.
Both exhausted three collection attempts. The result is therefore absent from
the user's library even though the provider rendered it.

The exact CDN correction (`reapiflexible.b-cdn.net`) is committed in release
`85ea6ce1` and merged main `dc73f0d1`. It is not an unpushed local patch.
Production Cloud Run still sends 100% of AI generation traffic to
`ugc-ai-generation-worker-hookfix2-fac61da3`, built before that correction.
Updating only the website cannot update the collection code running there.

The website was separately verified READY at deployment
`dpl_4D5yTk2Zh2aDXaCpF5kDpGUf5uqr`, reporting main `dc73f0d1`.
The live Hook chooser and Photo guide dialog open successfully. This supersedes
the earlier incomplete Vercel CLI deployment investigation; it does not establish
AI worker parity or recovery of the failed jobs.

## Reference limits

The previous blanket six-file rule counted images, source video and audio
together. A source clip consequently reduced the chooser to five images. The
new policy gives images their own count, shared between the picker and API:

| Connected route | Images | Separate application media slots |
| --- | ---: | --- |
| Seedance 2.5 through ReAPI | 30 | One video and one audio |
| WAN 3.0 through ReAPI, reference mode | 10 | One video and one audio |
| Omni Flash 1.1 through Google | 6 | One source video in supported Explore editing |
| Kling 3.0 through Runway | 2 | First and last keyframes; no source-video editing |

Sources reviewed: [ReAPI Seedance](https://reapi.ai/docs/seedance-2-5),
[ReAPI WAN](https://reapi.ai/docs/wan-3-0),
[Google Omni](https://ai.google.dev/gemini-api/docs/omni), and
[Runway inputs](https://docs.dev.runwayml.com/assets/inputs/).
Google's guide demonstrates six images but does not establish a numeric maximum;
six remains our supported application limit, not a claimed provider maximum.
ReAPI supports more timed clips than our single video/audio controls expose;
this patch changes image capacity only. Legacy recovery adapters keep the
contracts of requests already submitted through them.

Selection order remains main face first and supporting photos afterward.
Changing models preserves selected images and blocks unsupported excess before
credit reservation; it must not silently drop images. More allowed uploads do
not promise exact facial identity. Clear, different views of the same person
remain more useful than duplicates.

## Recovery and rollout

Exhausted failed jobs need explicit, bounded collection-only recovery in addition
to the worker fix. Recovery must retain the owner, task ID and fingerprint, check
the completed saved operation, and never submit a paid replacement or reserve
credits. Database/API and worker validation must fail closed when proof of that
saved completed operation is missing. Implementation and local test status are
tracked separately from production deployment and customer result recovery.

No paid generation is part of this investigation or regression validation.

## Local verification

- Production webpack build passed, including 168 pages; application TypeScript
  and worker compilation passed.
- Combined policy/API/forwarding/job tests: 76 passed. Additional workflow
  selection/client tests: 72 passed. Scoped ESLint passed.
- Recovery database tests: four passed, executing the migration in PGlite with
  ownership, permissions, settled-credit, audit-event and retry-boundary checks.
  Worker/provider regression checks passed, including no-POST collection from the
  isolated Seedance CDN and preservation of all 30/10 ordered image references.
- An independent review verified the no-charge recovery checks and identified
  the existing maximum-attempt limit of 20; recovery now refuses an exhausted
  attempt count of 20 before mutation and permits a final 19-to-20 pass.
- Build/test logs under `outputs/seedance-delivery-*` are generated local evidence
  and excluded from Git, along with ignored credentials, dependencies and caches.
  All intentional source, migration, test and documentation changes are included.

Production rollout and actual customer-result recovery remain to be verified
after deployment; these local checks do not establish either outcome.
