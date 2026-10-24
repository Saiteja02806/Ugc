# Second clearer-frame test: Hook 29

User requested another reference after preferring the clearer-frame output of Hook 50.
Reviewed the complete 63-frame contact sheet and extracted full-size frames 0 and
40 from the hash-verified original video. Selected frame 40 at decoded timestamp
1.333333 seconds: hand lower, open mouth and widened eyes more visible. This is
better facial visibility, not a claim of sharper original footage.

Source: `explore-paired-hook-9309a041061ae5abc6970d52`.
SHA-256: `5274157ba66683e03c31de91fff5395fe7eabee7ea4780789e87f7275719d451`.

Two fresh Gemini 3 Pro / 2K / 9:16 requests completed once without retries.
One used the original opening and the other used frame 40. Exact shared v4 prompt
matches the previous Hook 50 test, without the optional opening-pose paragraph:
`a2d9f2cc0f7f78e60c33ebe7150b53a82fc9f84e00d03d0389f85bfaf4c81eee`.
Same three influencer photos, same labels and order. No new prompt experiment.

Both generated images visually retain selected-person features and remove all
creator captions. Original-opening result keeps a hand-over-mouth pose but changes
gaze and room details. Later-frame result shows wide eyes, but raises the hand over
the mouth again, faces the camera and changes the sleeveless source top into a
short-sleeve gray shirt. It does not reliably preserve the selected clearer pose.
Facial resemblance is a qualitative visual observation, not a biometric score.

All completed request and input/output hashes verified. One image per condition,
no fixed seed: this is preliminary evidence and cannot establish general benefit.
No video generation, runtime prompt change, automatic frame selection or deployment.

Preview: http://127.0.0.1:8200/comparison-clearer-hook29

Evidence directory: `outputs/recreate-ui-preview/prompt-test-clearer-hook29-2026-10-24/`.
Original provider outputs: `original-opening.jpg`, `clearer-frame.jpg`. Exact
prompts and role labels are saved in the corresponding input JSON files; provider
operation IDs and usage are in the receipts. All nine preview routes return HTTP
200. Comparison PNG retains full images and the influencer references.
