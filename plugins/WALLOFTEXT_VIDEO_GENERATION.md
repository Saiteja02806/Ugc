---
name: wall-text-video-generation
version: 2.1.0
description: >
  VIDEO-ONLY skill. Converts exact, already-approved text from an upstream writing skill
  into realistic reference-matched 9:16 social-video footage prompts plus a deterministic
  text-overlay render plan. Routes among close selfie, moving selfie, everyday activity,
  lifestyle POV, environment-only, persistent-text montage, short statement, and
  exceptional demo hybrid. Does not author or revise the overlay words.
---

# Wall-of-Text Video Generation Skill — Audited v2.1

## 1. Boundary: this is NOT a writing skill

The upstream writing skill owns every word of the on-screen copy, including wording, line breaks, punctuation, emoji, CTA and marketing claims. This skill **never writes, paraphrases, extends, fixes, or truncates copy**. It outputs (a) a ready-to-paste moving-footage prompt and (b) an editing/render specification for the **exact** approved text.

**Generator outputs video frames. Renderer outputs the precise text.** Long text is generally unreliable if entrusted to generative video alone. Default: generate video **without baked-in text**, then composite the exact approved copy with an editor/renderer. The `ready_video_prompt` is for the VIDEO GENERATOR and does not include the paragraph. `overlay_render_spec.exact_text` is a lossless pass-through to the RENDERER.

## 2. Evidence this version is designed to match

The reference audit covers **49 supplied vertical videos** (40 earlier plus 9 new). The earlier 40 and new 9 were inspected at four spaced points per clip, with metadata checked. Sampled frames support classification but cannot prove every single frame, exact lip-sync/audio content, retention, or video-model output fidelity. See `references/reference_audit.md`, `references/reference_annotations.csv`, and `references/new9_audit.md`.

Observed repeatable patterns:

- Close-up selfie footage and ordinary activities are both common. Text often **overlaps the creator's face, chest, food, desk, or clothing**; a perfectly clear empty text box is NOT necessary for reference fidelity.
- Stationary full-block text over continuous motion is very common, but **upper-placed text, short statements, questions, lists, POV/environment backgrounds, movement-heavy selfies and a few edits/montages** also occur.
- The **median new-sample duration was ~6.7s**, with 12/20 under eight seconds. This is evidence for a short reference-style default, NOT proof that the words can be read fully in that time.
- 2/40 examples were **demo hybrids** with reactions, app/game visuals and changing text. They are not good defaults for full wall-of-text clips.
- The earlier 40 clips were found to have audio signals; **among the nine latest clips, six have an encoded audio stream and three have no audio stream**. Do not presume the sound content is speech or music without listening. Generated footage may remain silent while a later soundtrack is optional.
- The examples have no analytics; never infer reach, watch time, conversion, virality or causal performance.

**Correct primary objective:** MATCH THE REFERENCE STYLE, not merely generate a technically readable paragraph over the most generic founder-at-desk shot.

## 3. Input contract and orchestration

Required at skill invocation: `overlay_text` (finished exact string). The user can ask broadly, such as “make a wall-of-text video for mobile app marketing”; the surrounding plugin should FIRST call its existing writing skill to supply copy, THEN call this video skill. If the upstream result is absent, return `needs_upstream_copy` rather than inventing the copy. Never make the end user manually repeat the copy when the plugin already has it.

Useful optional inputs:

```yaml
overlay_text: "<UNMODIFIED APPROVED TEXT>" # required from writing skill
creative_topic: "mobile app marketing"  # context only; not a script to write
primary_emotion: auto              # mood inferred from text, not required for acting
format_mode: auto                  # auto | close_selfie | moving_selfie | everyday_activity | lifestyle_pov | environment_only | lifestyle_montage | product_demo_hybrid
text_kind: auto                    # auto | paragraph | stacked_list | sparse_statement | question | short_hook | changing_demo_text
scene_brief: null                  # optional user's actor, situation, wardrobe or location
character_reference: null         # exact supplied identity reference
visual_reference: null            # user-supplied exemplar image/video, prioritized
product_assets: []                # real screenshots, phone recordings, brand visual assets
visual_goal: "reference_match"     # reference_match | readability_first | product_clarity
aspect_ratio: "9:16"
resolution: "1080x1920"
duration_seconds: null            # explicit user target overrides suggested clip length
shot_policy: auto                 # auto | one_take | mobile_selfie | persistent_text_montage | product_demo_hybrid
behavior_mode: auto               # auto | passive_presence | conversational_expression | sustained_activity | handheld_walk
lighting_mode: auto               # auto | soft_daylight | warm_indoor | night_available_light | colored_ambient | reference_exact
overlay_palette: auto              # auto | reference_exact | soft_white | yellow | pink | other_from_brand
overlay_density: auto              # auto | sparse | medium | dense | very_dense
overlay_layout: auto              # auto | reference_over_subject | face_clear | upper | lower | product_clear
audio_mode: "silent_generated_footage" # final audio can be added later on request
render_mode: "clean_plate_plus_overlay"
output_mode: "full_handoff"        # full_handoff | footage_prompt_only
model_name: null                  # optional target video model / clip duration limits
```

Priority: explicit user constraint > visual reference > specific product/character assets > matching visual archetype > generic topic. Preserve reference identity and supplied wardrobe. Do not invent the user's actual app UI, download counts, store ratings, logos or other product proof.

## 4. Format classifier: choose BEFORE writing any video prompt

Classification is by **approved text shape + reference style + topic/asset requirement**, in that order. Choose one type:

| Type | What should be generated | What overlay does |
|---|---|---|
| `close_selfie` | Real phone-facing close-up; subject may be slightly off-center, blink, change gaze, touch face/hair | Usually dense text fixed mid-frame, often ON TOP of face/torso |
| `moving_selfie` | Creator walking outside, in hallway, gym, airport, etc.; arm-held natural phone motion | Fixed to screen coordinates while background and creator move |
| `everyday_activity` | Person eating, writing, applying skincare, fixing hair, checking phone, typing | Static block stays on screen; action should not demand attention |
| `lifestyle_pov` | View from or toward an everyday environment, person may face away; movement can be noticeable | Text stays anchored in a visibly contrasting area |
| `environment_only` | Plausible dark/neutral real environment, even without a visible human face | Dense structured list or thought block anchored to calm screen area |
| `lifestyle_montage` | 2–3 restrained related shots or B-roll inserts when reference specifically uses cuts | ONE UNCHANGED overlay across every shot; verify contrast shot by shot |
| `product_demo_hybrid` | Hook/reaction plus genuine supplied screen-recording insert and changed captions | NOT conventional wall-of-text; only route when user explicitly asks for demo or text/asset structure requires it |

A short one-line statement or question may use any suitable visual family with **larger overlay typography**. It is not automatically a full dense-text wall. Do not mix different structures simply because all are “text on screen.”

**New check from latest nine:** all nine sampled clips belong to a continuous text-first human-footage family rather than a product demo. Use a one-take layout when the reference shows one, and avoid proposing montages just to add visual interest. A walking selfie, close expressive selfie, and person working at a laptop require distinctly different camera/movement instructions, despite sharing a static overlay.

## 5. Choose scene independently of emotion

The approved words define a **message mood**, but the actor does not need to *mime the writing*. Real references frequently put emotionally serious text over unrelated everyday motion. Use one of three relationships deliberately:

1. **Directly relevant action**: skincare list while applying skincare, app marketing thought while checking a phone, travel observation while walking.
2. **Mood-compatible but not literal**: vulnerable reflection over ordinary selfie; motivational line over sunset or café clip.
3. **Incidental/contrast action**: relationship reflection over gym selfie or meal; user sees relatable unpolished life rather than dramatized emotion.

Avoid the previous skill's “frustration → dramatic realization → satisfied smile” formula unless the supplied reference truly depicts it. Prefer **one plausible activity or expression** over choreographed emotional transformations. One subject is common but **not mandatory**. No forced pointing or fake smiling.

For mobile app marketing: subject might be an indie founder, ordinary app user, creator at a café, commute POV or supplied product footage. Never reflexively select a male founder at a laptop. If a user supplies app screens, do not fabricate replacements; use those assets only when a cutaway or phone view is actually requested.

## 6. Camera and movement grammar

Defaults to natural portrait 9:16 smartphone footage with realistic light, skin, hands, environment and modest compression/noise. Choose among:

- **Locked or nearly locked selfie:** tiny handheld drift, expression/eye/hair movement.
- **Active one-take selfie:** walking/panning/arm reframe as in outdoor or gym references. Do not outlaw motion merely because dense copy is present.
- **Static activity shot:** person engaged in one ordinary thing (drinking water, writing, putting on a mask, scrolling phone). Camera usually steady.
- **POV/environment:** viewer watches everyday scenery or background; may have no subject/eyes.
- **Montage:** several coherent clips with a persistent global overlay, or controlled text handoffs for exceptional demo mode.

For one-take footage, supply a precise **start state, a sustainable ordinary action, and an unforced ending**. A timeline is optional for visually static clips; never invent an elaborate 3-act plot. Avoid inventing an event or emotional shift every 2–3 seconds. Real-world actions can continue without narrative payoff (typing, handling a bag, adjusting hair, walking, looking at a laptop). For any supplied avatar/image identity, preserve facial structure, natural skin-tone family, eyes, hair, hairstyle, outfit and scene geometry. Keep physics plausible.


## 6A. Behavioral fidelity and visual realism — nine-clip correction

Do NOT confuse *emotion inferred from text* with *physical action displayed by the creator*. Choose an explicit behavior mode:

- `passive_presence`: almost still face, small gaze/head/hair shift, soft blink. Suitable for short intimate/confessional text.
- `conversational_expression`: natural lip motion and hand gestures are permitted if reference shows an expressive selfie; **do not fabricate spoken words or claim intelligible lip-sync**. Facial expression need not match every sentence.
- `sustained_activity`: laptop typing, sorting belongings, working at a desk; the action persists through the clip, with tiny shifts and no required "realization".
- `handheld_walk`: subject walking with realistic parallax and handheld motion; paragraph is fixed to SCREEN, not the moving face.

**Choose lighting from the reference, not from generic UGC stereotypes.** Daylight desks, warm indoor selfies, genuine night outdoor available light, and colored/red practical light are all acceptable. Don't replace a specific red-lit intimate clip with a generic sunlit apartment. Avoid large blown-out highlights directly behind overlay glyphs; maintain enough local contrast.

**Visible speaking vs generated audio:** some subjects appear to move their lips or gesture toward camera. If source video uses expressive facial movement, allow it in a silent video plate, but avoid precise generated dialogue/lip-sync unless requested. An encoded audio stream alone cannot establish dialogue.

**Start-state specificity:** Describe what is already happening in the FIRST frame (e.g. already walking, already typing, already seated at desk). For a persistent text layout, the compositor should normally show the approved full block immediately with no blank intro; any text animation should be expressly requested.

**No unnecessary "viewer attention" theatrics:** avoid forced sighs, pointed eye contact, deliberate shocked expressions, staged app metrics and unrelated phone closeups just because the text mentions marketing.

## 7. Overlay placement is reference-driven, not always face-clear

Plan layout before video generation. The compositor overlays the precise copy later.

Possible layout choices:

- `reference_over_subject`: common example style; a fixed white/light yellow/pink bold-or-regular text block across central face, chest or torso. Mild shadow/stroke/backing controls contrast; no expectation of free negative space.
- **Match typography geometry rather than merely naming a color:** note approximate text-block width and height, vertical center, line count, relative type size, weight, stroke/shadow and line spacing. Use normalized coordinates 0–1 if returning structured layout, and verify at intended export size. These measurements describe VISUAL layout only, not new copy.
- `upper`: small quote/heading intentionally placed above the subject's head, as in face-mask or tutorial references.
- `lower`: paragraph/one-liner in the lower half (avoid app navigation UI overlap).
- `face_clear` / `product_clear`: use when user asks to preserve visible facial expression or actual app UI, even if it diverges from some viral-style examples.
- `environment_only`: stable neutral or dark area with deliberately visible paragraph/list.

Typography is a VISUAL instruction, not copywriting: choose system-supported sans-serif, white/off-white or subtle pink/yellow, reasonable stroke/shadow, center or reference-matched alignment, and optional heading emphasis. Fix text in SCREEN coordinates across a shot, do not track it to a face. Overlay may slightly cover a face: do not over-correct this when reference says match.

The renderer must preserve raw `overlay_text` exactly: wording, emojis, punctuation, line breaks and case. Purely visual line-wrapping at word boundaries is allowed if the stored string remains unchanged. Most dense overlays appear at frame one and persist until the final frame. A separate `changing_demo_text` mode is for approved timed segments only: each timed text piece must still come verbatim from upstream assets, not be invented by this skill.


## 7A. Exact overlay geometry and validation

Before prompt writing, produce a small internal `overlay_visual_profile` (not copy):

```yaml
text_persistence: first_frame_to_last_frame  # or approved_timed_segments, only when truly supplied
position_anchor: [0.5, 0.56]               # normalized canvas coordinates, example only
maximum_width_fraction: 0.82               # set from reference + text density
block_height_fraction: auto                 # after rendering, varies by copy
alignment: center                           # or left if actual reference demands it
color: '#FFFFFF'                            # or sampled/matched yellow/pink
weight: regular_or_semibold                 # inspect font in user-provided reference
outline_shadow: subtle_dark_contrast
line_spacing: reference_consistent
rendered_text_mode: composite_exact_approved_text
```

Numbers are examples, **not universal positions**. Always inspect or simulate the final exact approved text on 1080×1920 output; font size depends on wrap width, line count, script/emoji, and platform display. Use the user's exemplar when available, instead of random white/yellow/pink styling. For dense copy, provide an honest readability warning rather than pretending all words can be read in six seconds. Never crop off final lines or shrink below functional phone legibility without flagging a constraint.

If target is 720×1280 or 576×1024, use normalized positioning, then scale typography to the chosen export resolution. Preserve exact glyphs; rendered line wraps may vary for display only. Text must not shake with the filmed subject.

## 8. Duration: fidelity vs first-pass readability are DIFFERENT products

Two legitimate outputs exist:

- `reference_match`: if unspecified, propose approximately **6–9 seconds** for conventional short wall-of-text UGC *when the supplied copy and user's reference style allow*. It can be longer for slow activities, timed lists or longer footage. If approved text is dense, warn that **pause/replay may be necessary**. This is a visual style choice, NOT a promise of readability or a growth tactic.
- `readability_first`: plan longer based on text length/complexity and mobile font size (a provisional estimate of ~2.5–3.5 English words/sec plus orientation time). Treat as a heuristic, not a rule inferred from the reference performance.

Always obey an explicit clip duration unless impossible within model limits; then ask or return a technical constraint. NEVER solve a short dense overlay by silently removing words, replacing emojis, inventing abbreviations, or shrinking type to unusable size. For longer generated videos, extend/montage visual footage if the video model supports only shorter individual shots.

For short statements and questions, use intentionally large fonts; for dense lists, smaller text and more height may be necessary. Technical warnings must be surfaced without mutating upstream copy.

## 9. Audio is a two-stage decision

- **AI footage generation** default: no generated dialogue, speech, lip sync, narration, music or sound effects. This keeps the asset reusable and avoids unpredictable audio. Respect explicit user requests for complete silence.
- **Final edited social video**: may add separately provided/licensed music or ambience **only if requested by the user/workflow**. Since the supplied references do contain audio streams, do not claim silent final video is equivalent to the examples.
- Product-demo flow can use separately supplied voiceover/audio ONLY if explicitly requested and appropriately synchronized.

## 10. Produce the actual prompt

`ready_video_prompt` (for footage only) must contain:

1. format and authentic smartphone footage level, frame 9:16 + duration;
2. specific setting and subject, OR environment-only if chosen;
3. framing plus intended overlay placement (including permission for center overlap);
4. natural behavior, light, realism and continuity;
5. motion type and clip-level action (not needless invented story beats);
6. user-supplied reference/brand constraints and app asset rules;
7. no baked-in text, artificial captions, fake UI or watermarks;
8. no generated audio unless separately requested.

Then output `overlay_render_spec` with unchanged text, placement, typography, start/end, static vs edited motion, `baked_into_generated_footage=false`. Include structured positioning, text-block scale, color, and stroke details when your downstream renderer supports them. The v2 schema keeps these extra settings optional for backward compatibility. For video-only requests, show just `ready_video_prompt` if the user only wants that, while the plugin's internal handoff still retains the render spec.

### Compact generator template

> Realistic vertical 9:16 [chosen shot family] smartphone footage, [seconds] seconds. [Actual subject and location or environment-only scene]. [Reference identity when provided]. Natural [lighting] and everyday production texture. Camera [selected motion profile] at [precise framing]. Keep the [upper/central/lower] visual area sufficiently contrast-consistent for an editor-added stationary [paragraph/list/statement] overlay, **even if it overlaps the subject as in reference clips**. Throughout the shot, [one believable continuous activity and restrained natural changes]. Preserve anatomy, identity, objects and background continuity; no unnatural motion, polished ad acting, inconsistent phone screens or fictional product UI. **Generate clean footage only: no on-screen text, subtitles, logos or watermarks. No generated audio.**

## 11. Return contract and hard checks

Use `schemas/video_output.schema.json`. Keep v1 fields for backward compatibility: `status`, `production_mode`, `visual_direction`, `ready_video_prompt`, `negative_prompt`, `motion_timeline`, `overlay_render_spec`, `duration_plan`, `audio_plan`, `quality_notes`.

A ready response passes all:

- **Copy preservation:** exact `overlay_text` pass-through, never modified.
- **Correct family:** selfie / moving selfie / activity / POV / environmental / montage / demo chosen for reason.
- **Authenticity:** plausible actor motion, genuine surroundings, accurate character reference identity.
- **Overlay fidelity:** reference-appropriate location, size and contrast, including over-face when appropriate.
- **Timing honesty:** reference-style replay warning when dense text is short.
- **Asset honesty:** no fictitious app UI or fabricated brand/statistics.
- **Audio distinction:** soundless generated plate vs final audio plan are separated.
- **Production feasibility:** separate renderer for text; output can actually be carried out.
- **No performance guarantees:** do not claim generated result will be viral or match an algorithm.

## 12. Regression scenarios

Evaluate against `tests/fixtures.json` and `examples/usage_examples.md`:

A. Topic-only app marketing request → `needs_upstream_copy` if orchestrator has not yet called writing skill; with approved text, produce a concrete non-stereotyped UGC scene.

B. Heartfelt supplied reflection + reference selfie → one candid portrait, mid-frame over-subject static overlay, not a polished ad.

C. Dense 50+ word paragraph + 6-second duration → preserve text, include pause/replay warning; don't rewrite.

D. Supplied skin-routine list + makeup reference → realistic application task, not generic desk shot.

E. Supplied list + empty night street reference → no forced actor; environment-only valid.

F. Supplied screenshot/demo + explicit reveal → limited hybrid product cutaway, do not let video model invent app UI.

G. User asks for just footage prompt → no extra authored copy in user-visible output.

H. Reference image with fixed avatar → preserve face, outfit and setting unless user overrides.

### Additional nine-reference spot tests (R41–R49)

- Walking at night + headphones + small fixed white paragraph → moving_selfie / handheld_walk / night_available_light; never fake a stationary desk.
- Extreme close expressive face + yellow dense centered paragraph → close_selfie / conversational_expression, not forced crying or smile transition.
- Indoor animated hand movements + lower-middle white paragraph → close_selfie / conversational_expression; avoid generated speech claims.
- Calm laptop typing + tiny dense paragraph → everyday_activity / sustained_activity; no "revelation" performance.
- Red-lit confessional selfie + white paragraph → close_selfie / passive_presence / colored_ambient, not generic natural daylight.
- Seated hair-shift selfie + lower-center copy → close_selfie / passive_presence.
- Side-profile woman working at laptop + very dense paragraph → everyday_activity / sustained_activity, keep equipment and action continuous.
- Seated person packing/handling objects + yellow paragraph → everyday_activity / sustained_activity, preserve consistent props and desk.
- Close smiling/hair-adjusting selfie + pink larger paragraph → close_selfie / passive_presence, reference-matched pink text and wider lines.

See `references/new9_audit.md` for the clip log and fidelity requirements.

**Caveat:** This skill is grounded in sampled clips and schema tests, not experimentally verified end-to-end video-model output quality. To claim consistent generation fidelity, run actual prompts through the target video model and score the renders.
