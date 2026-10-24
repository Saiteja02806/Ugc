# Targeted Hook correction: keep the human role

Follow-up: the user authorized twelve paid OpenAI tests. All completed; #2, #7 and #8 exactly match the intended corrections below. See [all twelve results](hook-remix-role-v7-paid-review-2026-10-23.md). The active app is unchanged and nothing was deployed.

The user accepts the direction of the other v6 examples and identifies **#2, #7 and #8** as the issues. Preserve that scope; do not redesign the whole prompt again.

V6 explicitly said that a product could take a person's place in a playful setup. That permission encouraged the unwanted dating/marrying-a-SaaS outputs. The v7 candidate replaces only that sentence with a role-preservation rule: a person stays a person; change the profession/descriptor to a relevant human role. Keep the relationship, viewpoint and tone.

| Case | Source | Intended illustrative correction |
| --- | --- | --- |
| #2 | pov: you’re dating an IT guy | pov: you’re dating a marketing guy |
| #7 | POV you married the IT guy | POV you married the marketing guy |
| #8 | POV you married the IT guy | POV you married the marketing guy |

These were assistant-drafted corrections reflecting the user's stated preference, and were subsequently matched by the paid v7 provider test. Candidate: [hook-remix-role-prompt.ts](../lib/explore/hook-remix-role-prompt.ts). The frozen v6 prompt/results are untouched. All other v6 instructions remain identical. The later paid test did not change the active app prompt or deploy anything.
