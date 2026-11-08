# The WHAT hook format — existing-reference audit and prompt template

Date: 8 November 2026. Status: read-only audit plus proposed prompt corrections; no active prompt changed, no generation, no deployment.

## Why this document exists

The user supplied five "WHAT" hook examples and asked whether the existing Hook/Talking Head prompts capture the format correctly. All five are already registered Hook references with active motion plans. This document compares each active plan with the actual supplied video frames, defines the WHAT format, and gives exact corrections where the plan and the footage disagree.

## The five sources and their existing references

| Supplied source | Local file | Existing reference | Plan file | Muted hook duration |
| --- | --- | --- | --- | --- |
| TikTok `@viktoriasdiscounts` 7622494854978735373 | `D:\hookswithlinks\New folder (10)\trimmed_b743eca4.mp4` | **Hook 53** `explore-paired-hook-f216fd8e9397a7747a445ab7` | `hook-keyframe-motion-plans-b.json` | 2.800 s |
| TikTok `@viktoriasdiscounts` 7615847134142745870 | `D:\hookswithlinks\New folder (11)\trimmed_80d3f914.mp4` | **Hook 54** `explore-paired-hook-cdddd09fdd3b5a23d9949205` | `hook-keyframe-motion-plans-b.json` | 1.767 s |
| Instagram `DbV4y-vvPHN` | `D:\hook\videos (10)\New folder\HOOKS\New folder (24)\muted_e7e6dd38.mp4` | **Hook 24** `explore-paired-hook-43f2c2d266d23e3af05875d8` | `hook-keyframe-motion-plans-a.json` | 2.567 s |
| Instagram `DbSupmfPX0g` | `...\HOOKS\New folder (26)\muted_b27bb8dd.mp4` | **Hook 26** `explore-paired-hook-09c4e9b5de6a85f0f4c371da` | `hook-keyframe-motion-plans-a.json` | 3.367 s |
| Instagram `DbQaxhfvTs8` | `...\HOOKS\New folder (27)\muted_a9931b22.mp4` | **Hook 27** `explore-paired-hook-4ddf4d0f6dc4493f7eb6572f` | `hook-keyframe-motion-plans-a.json` | 2.567 s |

The Hook reference uses the **muted opening clip**, not the full 20–23 s Instagram reel. The full reel was used only to confirm the screen-demo cut that follows the hook. Source hashes match the active release rows.

## What the WHAT format is

It is a **wordless shock reaction** held for roughly half a second to three seconds, not a spoken sentence and not a generic smile:

1. **Eyes** — wide, whites visible, inner brows lifted.
2. **Mouth** — jaw dropped or open on a rounded "wha–" shape; not a smile, not a grimace.
3. **Head** — a small pull-back or lean-in toward the lens.
4. **Hand/prop** — frozen mid-gesture: fingers at the mouth/chin, glasses pulled up/down, or a sunglasses stem held in the mouth.
5. **Emotion** — shocked disbelief and sudden discovery: "*wait — what?!*" Not fear, anger, confusion, or early happiness.
6. **Release** — only after the hold: curiosity, a cheeky pout, a small smile, or a deadpan stare.

The reaction is **visual first**. The exact word "what" may be mouthed or spoken; the plan should describe visible lip/jaw action and not invent a full line. This follows the existing Hook mouth policy.

## Audit of the active plans

### Hook 24 — matches the footage

- Actual: clear glasses held at eye level, wide eyes/open mouth; small brow and lip changes; at ~2.2 s the glasses are pulled forward/up off the eyes and the eyelids close.
- Active plan: hold to 0.46, purse/round 0.46–0.70, reopen 0.70–0.85, pull glasses forward/up 0.85–1 with eyelids closing.
- Verdict: **accurate**. Keep it.

### Hook 26 — gesture starts too early; final shock is under-specified

- Actual: sunglasses stay at eye level for about 2.0 s while the mouth opens and the brows work; the sunglasses are pulled down/off at ~2.0–2.3 s; the bare-eyed cheeky pout holds to ~3.0 s; then the mouth opens into a final wide "what?" shock at ~3.0–3.367 s.
- Active plan: pull the sunglasses off at 0.297–0.594 (about 1.0–2.0 s), then "widen the eyes, open the mouth further, then narrow it" through the ending.
- Verdict: **gesture is early by about one second**, and the final open-mouth shock is not a distinct beat. Corrected normalized phases for the 3.367 s source:
  - `[0–0.59]` hold sunglasses at eye level; mouth open, brows raised.
  - `[0.59–0.68]` pull the sunglasses down/off; eyes widen.
  - `[0.68–0.89]` bare-eyed cheeky pout; brows high.
  - `[0.89–1]` open the mouth wide into a final "what?" shock and hold.

### Hook 27 — stem removal is wrong

- Actual: the sunglasses stem stays **in the mouth** through the whole muted hook. The jaw opens wider around it; the stem is not removed, and the glasses are at mouth level, not low at the chest.
- Active plan: "glasses low in front of the chest" and ending "move the glasses temple away from the lower lip as the jaw opens."
- Verdict: **contradicts the footage**. Corrected normalized phases:
  - `[0–0.58]` hold the sunglasses frame at mouth level with one temple arm between the lips; wide eyes, raised brows, jaw open around it.
  - `[0.58–0.78]` small head and mouth movements; keep the stem in the mouth; eyes stay wide.
  - `[0.78–1]` open the jaw wider around the stem into a stunned "what?" reaction; keep the stem in the mouth and hold.
  - Constraints: do not remove the stem, do not put the glasses on the eyes or head, do not turn the stem into a drinking prop.

### Hook 53 — matches the footage

- Actual: furrowed-brow skeptical stare with the hand at the chin/lower lip; brief purse; restrained disbelieving smile; closer framing; hold.
- Active plan: hold 0–0.344, purse 0.344–0.478, soften to a restrained smile 0.478–0.6, hold/settle through 1.
- Verdict: **accurate**. Keep it.

### Hook 54 — pursed lips are wrong

- Actual: white towel on the head, wide eyes and a **dropped open jaw** in a shocked "what?" reaction, then a small delighted smile; the mouth is not pursed.
- Active plan: "pursed lips", "lips briefly part, then return toward a purse".
- Verdict: **contradicts the footage**. Corrected normalized phases for the 1.767 s source:
  - `[0–0.34]` hold the towel, wide eyes, raised brows and a dropped open jaw in a silent WHAT shock; do not smile.
  - `[0.34–0.68]` keep the jaw open, small head movement; do not purse the lips or smile yet.
  - `[0.68–1]` let a small delighted smile break through and hold.
  - Constraints: keep the towel secure, hands outside the picture, do not start with a smile.

## WHAT prompt template

```
Opening at t=0: <scene, outfit, hair, prop/hand position>. The creator is already in a wordless WHAT reaction: wide eyes, lifted inner brows, a dropped/open jaw, and <prop/hand> held at <position>; the head <pulls back / leans in>.
<hold range>s: hold the shocked WHAT expression; keep <prop/hand> frozen; do not smile.
<release range>s: <pull glasses/sunglasses down or up, small mouth/brow changes>; the eyes stay wide and the jaw stays open.
<final range>s: <settle into the curious pout, cheeky half-smile, delighted smile or deadpan stare>; hold the face to the lens.
The WHAT reaction is the hook: shocked disbelief, not fear or anger. Do not add the source's screen recording, app UI, captions, logos or claims. If sound is enabled, use only a brief natural "what?" reaction when explicitly supplied; otherwise use a nonverbal shocked breath. If sound is off, preserve the visible lip and jaw articulation silently. Follow the user's own spoken message and product instructions; do not copy the original script or claims. If appearance images are attached, use them for the person's appearance. Keep this clip talking-head only: do not add the source's phone demonstration, app screens, captions, logos or watermarks.
```

Why each part matters:

- **t=0 pose** prevents the model from inventing a neutral opening; the prop/hand position is the signature of the hook.
- **Wordless WHAT + emotion** prevents the common failures: fear, anger, confusion, or an early smile.
- **Hold** preserves the pause that makes the hook work.
- **Release** must match the source: curious pout (Hook 24/26), cheeky confidence (Hook 26), delighted smile (Hook 54), skeptical smile (Hook 53), deadpan (Hook 27).
- **Screen-demo exclusion** keeps the Hook reference a talking-head clip, not the app/tool demo that follows.
- **Sound separation** prevents inventing dialogue and conflicts with the user's script.
- **Claims stay out**; the caption is provenance.

## Verification and limits

- Inspected the actual muted Hook clips at 12 fps, plus the full Instagram reels to locate the screen-demo cuts (2.93 s, 3.67 s, 2.70 s).
- The two TikTok files were inspected at 12 fps; the Instagram hooks at 12 fps for the opening and final 0.9 s.
- These are sampled observations, not native-frame-exact timing or a transcription.
- The audit is read-only: no active Hook plan, prompt, source hash, audio or release row was changed.
- No provider generation was run, so generated adherence remains NOT TESTED.

## Applied corrections (local, uncommitted)

The three corrected plans have now been applied locally to the active Hook plan JSON:
- Hook 26: pull-down starts at the 0.59 phase (about 1.99 s of the 3.367 s hook) instead of 1.0 s, followed by a bare-eyed cheeky pout and a final wide WHAT shock.
- Hook 27: the sunglasses stem stays between the lips for the whole clip; the opening and ending no longer describe removing it.
- Hook 54: the opening is a dropped open jaw in a silent WHAT shock, not a purse; the smile breaks only at the end.

Hooks 24 and 53 were left unchanged because their plans already match the footage. The Hook 54 preview test was updated to the new phases and still passes. No provider generation was run, so generated adherence remains NOT TESTED.

## Recommended next step

Review a fresh prompt preview for all five, then decide whether to run one paid generation check for adherence. No deployment until the user approves.
