# Original opening pilot and model reference audit

28 October 2026. Prepared locally only. No application runtime edit, production prompt change, deployment, external media upload, paid generation, database write or settings change.

## Scope and result

User requested identification of all middle-frame cases, checking model support for influencer photos alongside a literal opening frame, and preparation of one original-t=0/automatic-trim test. Reviewed current local bindings and source files; production job contents were not queried. Existing receipt bindings and prompts remain untouched. Scope boundary: new inventory/report and isolated diagnostic artifacts only. Roll back by removing only this task's new artifacts and appended documentation, never reset the shared dirty worktree.

31 later-frame bindings confirmed:21 public and10 Recreate-the-account entries. All31 source SHA256 values were recomputed and matched. Each currently selected index/time/hash matches the earlier inventory; no additional nonzero curated binding exists in the two current selection catalogues. All31 original-frame evidence files exist. Public IDs/hashes also match active local release manifests. Private IDs were checked against creator-source-frames.json; no private package decrypted or released. Creator-account-1-04/05 remain frame0.

Complete per-video list: [middle-frame-recheck-2026-10-28.md](middle-frame-recheck-2026-10-28.md). Machine-readable result: outputs/original-opening-pilot-20261028/middle-frame-inventory.json. This identifies stored later clarity selections, not31proven current provider errors. Existing v4 routes already distinguish original-opening reconstruction from a later clarity anchor; old literal-anchor receipts are a separate compatibility path. Do not relabel historical images as source t=0 or rewrite accepted jobs.

## Connected model capability

Checked actual worker routing, not only model names. Hook starting-image animation permits google_omni, seedance_2_5 and wan_3_0; Kling is outside that dedicated route. Current local code evidence: worker/src/lib/hook-starting-frame-video.ts, gemini-omni-video.ts, reapi-video.ts, worker/src/jobs/generate-hook-video.ts and lib/ai-studio/video-reference-policy.ts. Legacy OpenRouter/Runway adapters are not the newly selected starting-frame route.

| Hook model and route | Literal opening plus extra influencer photos | Finding |
|---|---|---|
| Omni Flash1.1, direct Gemini, gemini-omni-1.1-flash | Supported role separation; app allows5optional photos | Worker declares FIRST_FRAME Image1 and IMAGE_REF references Image2 onward and appearance-only instructions. Google documentation explicitly shows this combination. Not a face-embedding API or a guarantee of likeness. |
| WAN3.0, ReAPI, wan3.0-video | Not supported by this connected frame route | Provider separates frame and reference families. Adding general-reference portraits cannot retain the documented strict frame task. App rejects extras before submission. |
| Seedance2.5, ReAPI, doubao-seedance-2.5-face | Not supported by current connected frame route | Provider distinguishes frame and reference task types, disallows mixing roles in one array, and makes image_urls/image_with_roles mutually exclusive. Documentation's suggestion to put references in image_urls does not establish a valid combination with frame fields. Keep extras disabled; do not infer support from the model name or its general reference mode. |

Primary documentation checked on28October2026:
- https://ai.google.dev/gemini-api/docs/omni — source/reference tags and first-frame plus appearance-reference example.
- https://reapi.ai/docs/wan-3-0 — media families cannot mix; bare second image can mean last frame.
- https://reapi.ai/docs/seedance-2-5 — validation/task types and duration4–30; mixed image roles are prohibited.

Omni supports this request shape; visual adherence remains unverified for this pilot. Earlier project evidence records a Hook100 ending cut to portrait scenery despite reference labels, so labels alone are not an acceptance result. WAN and Seedance support general reference images, which is different from supporting additional identity photos while enforcing an exact first frame. No unsupported workaround, alternate provider or model setting enabled.

## One prepared pilot

Hook12 stable ID explore-paired-hook-03d314d5268b8c31ec390bf1; source SHA0e261c745ea8a9957168683b5d7e5271a8f5e83884a58d53011149ea4ca03f57. Existing later selection is frame36 at1.2s. This trial instead supplies only original source frame0 and the already selected influencer identity photo to image preparation. No later source image is attached.

Source was re-probed:73decoded frames at30fps, first presentation0, final presentation2.4s and final frame duration0.033333s. Container stream duration2.433984s has minor header rounding; action endpoint from decoded presentation is2.433333s. Editor integer endpoint2433ms. Actual exported marker test retained all73frames. Original t=0 was freshly extracted and matches the earlier verified opening PNG SHA b8e86b9251009be1ee54b358167081c1ab760e7d85cb4b84c382c44792324b20.

Fresh visual review: all73native thumbnails on three contact sheets, plus full-resolution opening and frame45. Opening: cup tilted against lips, partially hiding face; other fingers on laptop edge. Then cup lowers, eyes rise/widen, mouth opens and drink trickles toward cup as subject leans closer. The image prompt preserves the real opening occlusion and removes baked caption/emojis, retaining physical laptop logo. This is deliberately difficult identity preparation; do not clear the cup away just to improve face visibility.

Image candidate: Gemini3Pro2K, exactly two inputs (source t=0 scene/pose and existing influencer identity), frozen local hashes and prompt. No request submitted. Starting image must pass identity/scene/pose/mug/hand/caption-cleanup review before video preparation can be submitted. Image2 is the influencer, not a later source image.

Video candidate: Omni Flash1.1,3seconds,720p,portrait. Approved generated opening becomes literal FIRST_FRAME; same influencer portrait becomes IMAGE_REF_0 appearance guidance. Motion preserves source speed: original actions0–2.433s, then final hold2.433–3s. Exact video prompt is in outputs/original-opening-pilot-20261028/video-prompt.txt. Plan and image instructions are adjacent. No generated image or video currently exists for this new trial.

Important existing difference: current normalized sourceMotionPlan/retimeSourceMotionDirections maps the full source across the chosen generated duration. Applying a2.433s trim to that existing3s timeline could cut off its ending. The prepared candidate instead keeps event timestamps in source seconds and appends a hold. Do not switch on automatic trimming globally without coordinating prompt timing and reviewing actual completion before the cut. This task does not modify that runtime helper.

Prepared initial edit uses trimStartMs0/trimEndMs2433, with raw generated output retained and user override allowed. This is a local initial-edit fixture, not an implemented production automatic trim or a change to existing saved edits. Automatic Hook overlay/audio/demonstration timestamps must be checked against the trimmed duration when integrated; no integration claim here.

## Verification and next gate

Local marked-frame surrogate through the actual worker finishExploreVideo function PASS:3-second90-frame input, true ending marker at frame72, excess red tail frames73–89. Export retained73frames, green ending frame and blue opening; excluded red tail. Draft round-trip and invalid4-second trim rejection PASS; original source and raw surrogate hashes unchanged. Evidence: trim-verification.json and trim-export/composed.mp4. This proves trim mechanics, not AI action fidelity or live UI persistence.

Existing adapter tests rerun with mocked providers:15Omni PASS (including role binding, optional photos and recovery),19ReAPI PASS (frame/reference rejection, fixed duration, audio choice and recovery). No real provider acceptance test. Logs: omni-role-checks.log/reapi-role-checks.log. Prepared scripts node syntax/execution PASS; inventory unique IDs/count/source-hash checks PASS. No application-code change required, so no new website build or UI baseline comparison was performed.

Next gate: explicitly authorize one image generation; inspect it against original t=0 and influencer. Only after image acceptance and video authorization, run one3-second video, compare all output frames with the source at1:1time, and check the untrimmed final0.567s too. Reject or retain longer output if a source action spills past2.433s; do not silently crop a late ending. Do not automatically retry uncertain provider submissions, change other references or deploy.

Protected status: VERIFIED locally — source/identity separation in prepared roles, exact source frame0/hash, source timestamps, full source-action timeline plus hold, unchanged original media, no paid calls/deployment. NOT TESTED — generated image identity/pose/caption cleanup, generated video gestures/pacing/ending, hosted model acceptance, editor integration/save/refresh and production behavior. Existing saved jobs, pickers, fonts, Remix, scheduling and current production data untouched.

Sources/skills actually read: current AGENTS excerpt and supplied full rules; relevant EXPLORE_CONTEXT font/retirement/Remix and existing middle-frame receipts; relevant clear.md incidents plus protected nonnegotiables from ongoing session; context-memory/immutable-contracts/regression-gate previously read in session; starting-frame/frame-analysis/video-prompt/opening-frame/middle-frame/ui-clarity fully read in this phase. Used REPEATABLE_SOURCE_PROMPT_REVIEW.md and prior31case source inventory. Large historical ledgers were inspected by relevant sections, not entirely reread. This is a draft/research phase, not an application-code patch.
