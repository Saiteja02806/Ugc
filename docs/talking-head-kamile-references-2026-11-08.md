# Four silent-mouth Talking Head references — 8 November 2026

Status: LOCAL CATALOGUE + BACKEND FRAMES VERIFIED; HOSTED UI/DEPLOYMENT NOT VERIFIED.

## Sources

All four clips are from TikTok creator `@kamile.eats`, supplied in `D:/talking head links/notbeen` and `D:/talking head links/notbeen 1`. The files are short vertical selfie reaction cuts. Their audio tracks are effectively inaudible background/noise (mean volume -24 to -44 dB); the performance is carried by silent mouthing of the burned-in caption, not audible speech.

| Folder | Source URL | Duration | Output ID | Title | Visible caption (transcript source) |
| --- | --- | --- | --- | --- | --- |
| `notbeen` | tiktok.com/@kamile.eats/video/7661748122833407254 | 2.433 s | `talking-kamile-mirror-discovery` | Mirror discovery reaction | "Been shopping at Lidl for 8 years and NOW I FIND THIS??" |
| `notbeen 1/New folder` | tiktok.com/@kamile.eats/video/7665993957603675414 | 4.334 s | `talking-kamile-kitchen-discovery` | Kitchen discovery reaction | "been shopping at Aldi for 8 years and NOW I FIND THIS" |
| `notbeen 1/New folder (2)` | tiktok.com/@kamile.eats/video/7699540151675915553 | 2.730 s | `talking-kamile-car-what` | Car what reaction | "I'm sorry but LIDL WHATTTTT?????" |
| `notbeen 1/New folder (3)` | tiktok.com/@kamile.eats/video/7698810635085384983 | 2.300 s | `talking-kamile-lowlight-what` | Low-light what reaction | "LIDL ARE YOU KIDDING ME???!?!?!" |

The kitchen clip ends on a brief phone/price insert. The source MP4 is kept complete; the generation prompt explicitly excludes the phone, price screen and app UI so the reference stays talking-head only.

## What the `what` convention means

`D:/hookswithlinks/notbeen2/what` and `what 1` are user-side annotations: the folder name records the word being mouthed. Those two clips are **not** in the 27 October notbeen2 review package, have no prompt/hook/review row in the repo, and must not be treated as reviewed references. Repo policy (`docs/five-hook-mouth-size-review-2026-11-04.md`, `docs/hook-mouth-prompt-corrections-2026-11-04.md`) forbids inferring exact words from lip shapes. For the four Talking Head clips the words come from the **visible burned-in captions**, not from lip-reading.

## Prompt policy for silent mouthing

Each prompt describes the scene, the reaction and the visible silent performance. It states that the source has no audible voice, requires the visible lip and jaw articulation and the hand-to-temple gesture at the same timing, and forbids replacing the mouth performance with a closed or motionless mouth. A follow-up clause resolves the silent-reference versus spoken-output conflict: the reference supplies only the visible performance; when sound is enabled the model speaks the user's own script, and when sound is off the mouth performance stays silent. It does not quote the Lidl/Aldi claim; that claim stays in the source caption and transcript as provenance. The fixed suffix keeps the existing contract:

> Use the reference for framing, scene and delivery. Follow the user's own spoken message and product instructions; do not copy the original script or claims. If appearance images are attached, use them for the person's appearance. Keep this clip talking-head only: do not add the source's phone demonstration, app screens, captions, logos or watermarks.

Mouthed reactions named in the prompts: mirror — surprised discovery; kitchen — surprised store discovery; car — incredulous "what?"; low-light — pained "are you kidding me?". The prompts do not add brand claims, captions or the phone insert.

## Transcript policy

No ASR was run: there is no audible speech to transcribe. Each transcript row is a manual on-screen-caption read, bound to the exact source hash and marked `cross_checked_draft` with `provider: "manual"` and `model: "on-screen-caption-review"`. Review notes state that the caption is provenance only and that brand claims must be replaced before generating. The kitchen row records that its caption begins mid-sentence because the clip is trimmed.

## Storage and verification

- MP4s copied byte-for-byte; posters generated at 0.2 s (360 px wide); exact frame-0 PNGs decoded and stored.
- Local files: four MP4/JPG pairs in `public/explore/talking-head-references/v1`; four PNGs in `public/explore/talking-head-frames/v1`.
- Backend: four frame PNGs and four `frame0-png-v1.json` indexes uploaded to `ugcsaas-media` under `explore/hook-starting-frames/...`; all four public reads returned 200 and the downloaded PNG SHA-256 matched each index.
- Source, frame, transcript and hook-review manifests each have 33 rows; catalogue has 33 rows and 23 visible cards.
- Tests: 27/27 focused talking-head references/full-sources/script/source-registry tests and 3/3 hook-trims tests passed; the new silent-mouth prompt test checks the four prompts contain the silent-performance contract and no Lidl/Aldi claim, and the transcript test checks the manual caption provenance.
- Files changed: `lib/explore/talking-head-reference-catalog.json`, `talking-head-source-manifest.json`, `talking-head-frames.json`, `talking-head-transcripts.json`, `talking-head-hook-reviews.json`, four MP4/JPG/PNG triplets, `scripts/prepare-talking-head-references.py`, the four test files, `EXPLORE_CONTEXT.md` and this receipt.
- NOT VERIFIED: signed-in gallery playback, Recreate starting-frame preparation, Script/Remix for the new rows, generated-video quality, responsive layout and any deployment. No generation or publishing was performed.

## Rollback

Remove the four new catalogue/source/frame/transcript/hook-review rows and their four MP4/JPG/PNG triplets; revert the test count/expected-list changes and the `SOURCES` additions. The uploaded GCS frame objects are content-addressed and immutable; they can remain unused without changing any existing reference identity.
