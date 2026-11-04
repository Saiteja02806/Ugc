# External research: character identity preservation — 4 November 2026

Research-only review of official documentation, published papers and open application source. No new generation, dependency, application edit, build or deployment. This is an implementation recommendation, not a finalized architecture migration.

## Verdict

The current scene-generation followed by reference-guided identity editing is a legitimate approach. Calling a second generative request an identity lock does not establish reliable facial preservation. A dedicated face swapper/identity embedding is an alternative, not a mandatory ingredient of every valid workflow. The earlier local review's absence-of-enforcement finding stands, but lack of a dedicated swapper must not be represented as proof that using Gemini is incorrect.

No reviewed source establishes that the exact combination of two generative passes, the current generic prompt, a 35% hair crop and LAB grain delivers 95% identity similarity or 100% text/object/lighting/video preservation. Product documentation describes supported workflows and vendor claims; it does not independently benchmark our inputs or reveal every closed-source internal component.

## What the primary sources disclose

1. **Google / Gemini:** supports reference-guided image editing and conversationally scoped edits (“semantic masking”), with guidance to describe identity-critical details and refine iteratively. These workflows do not require an external face-swap model. Its model card nevertheless lists imperfect input/output character consistency. Our text+images request is therefore valid, but not a guarantee. Sources: [generation guide](https://ai.google.dev/gemini-api/docs/image-generation), [model card](https://storage.googleapis.com/deepmind-media/Model-Cards/Gemini-3-Pro-Image-Model-Card.pdf).

2. **Runway Gen-4 References:** documents reusable character/scene references, individually iterated changes, and neutral/evenly lit identity photos. It explicitly recommends covering an existing scene subject's face to reduce confusion with the intended subject. This directly motivates a controlled scene-face-isolation experiment, but its recommendation for Runway is not proof of an equivalent effect in Gemini. Source: [official guide](https://help.runwayml.com/hc/en-us/articles/40042718905875-Creating-with-Gen-4-Image-References).

3. **Higgsfield Soul ID:** documents a trained reusable identity from 20–80 same-person photos rather than a new single-reference identity on each generation. Its help page acknowledges residual drift and does not promise pixel-identical faces. The proprietary identity-training architecture is not established by this page. Source: [Soul ID help](https://higgsfield.ai/creator-hub/help-center/ai-models/how-do-i-create-and-use-a-soul-id-character).

4. **Scenario:** advises trying clean reference images first; custom Character Model training is its escalation when references are insufficient or repeated production needs consistency. It recommends consistent defining features with varied poses/angles, rather than assembling unrelated people's traits into an identity. Source: [character-model guide](https://help.scenario.com/articles/4280773511-train-a-consistent-character-model).

5. **FaceFusion:** open source makes this a verifiable implementation comparison. Its face swapper aligns a target face using landmarks, runs a swap model using source identity information, builds masks and composites the face region back. This is more spatially constrained than requesting a whole new image. It does not prove superior results on our exaggerated Extreme character without testing. Sources: [swapper implementation](https://github.com/facefusion/facefusion/blob/master/facefusion/processors/modules/face_swapper/core.py), [mask documentation](https://docs.facefusion.io/usage/cli-arguments/face-masker).

6. **InstantID, PuLID and PhotoMaker:** published identity-personalization approaches provide explicit identity conditioning rather than only prose. InstantID combines an ID embedding and spatial/landmark conditioning; PuLID trains identity/alignment objectives; PhotoMaker combines reference identity embeddings. These are candidate architectural families, not drop-in parameters supported by our current Gemini request. Sources: [InstantID method](https://instantid.github.io/), [PuLID paper](https://arxiv.org/abs/2404.16022), [PhotoMaker method](https://photo-maker.github.io/).

7. **Midjourney:** its version-specific Omni Reference documentation exposes reference influence and warns that fine details can differ. This reinforces that reference generation and exact reproduction have different acceptance criteria. Source: [Omni Reference](https://docs.midjourney.com/hc/en-us/articles/36285124473997-Omni-Reference).

## Implications for our implementation

### Keep the architecture provisionally; correct and test its inputs

- Remove competing facial identity from hairstyle/outfit/accessory references using validated preparation that retains the selected object. Our actual Long Waves counterexample already disproves a universal top-35% crop. Preparation must not silently return a full portrait on failure.
- Test suppression of the existing face in the frozen scene. A blacked-out scene face is visual conditioning, not a hard API mask; verify that it does not cause replacement artifacts, unwanted pose changes or regenerate the box. Preserve hand/prop occlusion and the scene outside the edit.
- Narrow the identity-repair comparison. Compare the same bad scene with the same main identity under original versus isolated reference preparation. Then test simultaneous hair/accessory/eye/skin changes separately; do not erase user selections to improve an apparent identity score.
- Where available, use approved clean views of the same identity. Our current single surprised/exaggerated source is a harder input than a neutral portrait (inference from the reference guidance, not a proven cause). Never invent extra identity photos and treat unreviewed generations as ground truth.
- Keep new prompt/preparation semantics versioned and frozen. The old-v2 fingerprint recovery finding is a local implementation defect unaffected by which model family we ultimately choose.

### Require evidence before calling it reliable

Create a small fixed corpus: ordinary faces and Extreme, full/half body, hair-keep/short/long, none/selected accessories, explicit eye/skin overrides, and different scene faces. Separate preservation from requested modification. Compare the resulting face against the primary reference and verify scene, selected traits, unwanted accessories and artifacts. Start with recorded visual acceptance; an automated similarity checker must be calibrated, especially on exaggerated faces. A model's generic benchmark score or one attractive output is not our acceptance rate.

The already completed four-call negative-term comparison did not restore identity, so merely removing those terms is not an evidence-backed fix. The new crop-based live sample also had the distinctive face already in stage1, so it does not establish correction of a known wrong face. External advice supports testing reference interference; it does not retroactively prove that interference caused every local failure.

### Escalate only if the repaired reference-edit route still misses the target

For a small number of references and strict likeness, benchmark a suitably licensed localized face-swap or identity-conditioned route on exactly the same corpus. For a reusable influencer generated repeatedly across many scenes, compare a trained identity route once a clean same-person dataset exists. Choose using actual identity adherence, editability, scene preservation, latency and cost; neither route automatically preserves every head shape or accessory.

Model and checkpoint rights matter for a commercial service: InstantID's official repository distinguishes its permissive code license from research-only released checkpoints and dependent face models. This is a concrete selection constraint, not a reason to assume any named open implementation can be shipped unchanged. [Official disclaimer](https://github.com/instantX-research/InstantID#disclaimer).

## What remains unknown

- Proprietary internal pipelines of Runway, Higgsfield and Scenario beyond their documented workflows.
- Which single factor caused each Gemini mismatch.
- Whether masking the scene face, validated trait isolation, a new provider, or trained identity will win on our corpus; no such comparative live benchmark was run in this research task.
- Any universal 95%/100% similarity guarantee, fixed stage2 cost or downstream video-identity guarantee.

Reviewed alongside local sources: worker/src/lib/character-image-pipeline.ts, lib/characters/studio-selection.ts, docs/character-stage2-corrections-review-2026-11-04.md, docs/character-stage2-prompt-test-results-2026-11-04.md. No implementation approval, production acceptance or deployment claim is implied.
