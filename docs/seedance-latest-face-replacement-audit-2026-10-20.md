# Latest Seedance face replacement audit

## Confirmed request and provider

App job: `cc899a93-7ad1-44a6-82f9-943399d7982c`.
Provider task: `task_01a1596a5eb3749d8606a7384e159cd2`.
An authenticated GET of this existing completed task independently returns
`model: doubao-seedance-2.5-face`, with output on `reapiflexible.b-cdn.net`.
It does not return the original filter or task-mode fields.

Cloud Run logs identify the submitting worker as
`ugc-ai-generation-worker-hookfix2-fac61da3`. Its pinned request builder sets
`content_filter:false`; for this five-image/one-video request it constructs the
same body as the current adapter. The saved input reconstructs the exact
persisted request fingerprint
`91ae7089e09497b6c1f9c689519c13e60310bd80b825a90664d861977845c56c`.
This is deterministic reconstruction, not a historical raw HTTP capture.

| Setting | Reconstructed value |
| --- | --- |
| Provider / model | ReAPI / `doubao-seedance-2.5-face` |
| Less Restriction | `content_filter:false` |
| Task mode | `omni_reference_task_type:reference` |
| Output duration / shape | 4 seconds / 9:16 |
| Provider audio flag | `generate_audio:true` |
| Source | `cdds.mp4`, 3.1 seconds |
| Face images | Five ready, owned original uploads |
| Main/supporting order | Correct main first, four supporting |
| Prompt | 8,374 characters, face replacement and silence requested |
| Provider-specific media tokens | No `@Image N` or `@Video N` |

The current task is separate from the earlier three-photo `cdd.mp4` job.
Missing uploads or the earlier primary-image ordering issue do not explain
this current request: all five inputs are present and the main role matches.

## Creative result versus delivery

The recovered provider output is not byte-identical to the source. The source
is 949,529 bytes, 3.1 seconds, 93 frames at 30fps; output is 2,880,386 bytes,
4.064 seconds, 97 video frames at24fps, plus an AAC audio stream. At0.5,1.5 and
2.5 seconds, the output removes visible source captions but does not achieve
the requested appearance from the supplied face portraits. The samples show
performance timing differences. An AAC stream alone does not prove audibility.

Confirmed integration mismatch: the requested existing-footage edit was sent
as reference generation. ReAPI documents edit as a separate contract requiring
a source of4–30seconds, task type`edit`, duration`-1` and size`adaptive`.
The current ReAPI adapter does not implement that edit contract, and this
3.1-second source is ineligible as supplied. A fixed four-second output does
not make the shorter input eligible. The Less Restriction flag does not change
those task rules or establish face-replacement quality.

The exact internal reason the model retained source-like facial appearance is
not exposed. Do not claim the mode mismatch is proven to be its sole cause.
The long prompt, missing explicit media tokens and lack of a validated identity
replacement backend are additional gaps; more portraits alone have not solved
this demonstrated failure. The provider audio flag also conflicts with silence
requested in prose, independently of facial fidelity.

Four seconds is a documented edit-mode eligibility boundary, not a demonstrated
quality threshold. Both audited roughly three-second inputs were accepted and
completed in reference mode, which permits clips from two seconds. We have no
controlled comparison holding the task mode, face inputs and other settings
constant while varying duration, nor a passing four-second edit benchmark.
The two failures therefore do not establish duration as their major cause.
Making a source four seconds would permit an edit request with the other
required settings; it would not prove identity accuracy. Padding/repeating
frames must not be advertised as a face-fidelity solution. A valid edit test
and a separate duration comparison answer different questions and both require
approval before paid generation.

Provider documentation: [Seedance task and filter contracts](https://test.reapi.ai/docs/seedance-2-5).

## Audit boundary

All cloud operations were existing-record/task/file GETs. No provider
generation POST, database write, code deployment or paid test occurred.
Local evidence and comparison images are under
`outputs/seedance-latest-face-audit-2026-10-20/` (excluded from Git).
Do not rerun the same paid request as a fidelity fix. Any proposed edit test
must first resolve source eligibility, explicit asset binding and audio flags,
then request approval for one bounded paid acceptance test.
