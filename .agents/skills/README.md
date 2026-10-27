# UGCPilot — Codex Regression-Prevention Skill Pack

**Purpose:** Keep UGCPilot's established product behavior stable while improving Hook Video generation, influencer frame selection, faithful video recreation, and social post scheduling.

**This is an installable repository skill pack, not a patch to the application.** It contains no assumed UGCPilot source paths and has not been run against the real UGCPilot repository. It cannot determine the actual root causes without examining that repository, the existing `explore context.md`, and real video samples.

## Install safely

1. Unzip this archive outside the repository and inspect its contents.
2. **If an `AGENTS.md` already exists in your repository, merge these rules into it carefully. Do not overwrite existing team instructions.** Otherwise copy this pack's `AGENTS.md` to the repository root.
3. Copy the `.agents/skills/` directory into the repository's `.agents/skills/` directory; keep each folder's `SKILL.md` name as-is.
4. Copy `docs/ai-context/` into the repository, **merging rather than overwriting** if those files already exist, especially `clear.md` and the UI contract documents.
5. Copy `tools/` and `tests/examples/` if you want the optional CLI checks and examples. These do not modify app code.
6. Find your **existing** `explore context.md` (or its exact actual filename) and provide its path to Codex. This pack does NOT replace, rename, or fabricate that original file. If it is missing, Codex must flag it as a blocker before changing code.
7. On first use, explicitly direct Codex to import any missing historical incident summaries from the real `explore context.md` into `clear.md` without overwriting either file.
8. Start a new Codex session from the repository root. Ask: `List the instruction files and project context you loaded and run the UGCPilot preflight, without modifying code.`
9. Invoke skills explicitly using `$ugc-ui-clarity`, `$ugc-frame-analysis`, etc., when working on the corresponding features. `AGENTS.md` also instructs Codex when to read them.

## Skills included

| Skill | When to use | Enforcement focus |
|---|---|---|
| `ugc-context-memory` | EVERY task before code change, and whenever user reports a mistake | Read existing explore context; maintain `clear.md` as an auditable mistake ledger |
| `ugc-ui-clarity` | Any UX, UI, interaction or loading-state change | Reuse components, protect interaction intentions, eliminate duplicate controls |
| `ugc-immutable-contracts` | EVERY task before change and when scope could affect existing features | No-touch contracts, explicit approvals, smallest change, protected routes |
| `ugc-frame-analysis` | Analyzing a source video, identifying action, selecting moments | Timestamped frame/event review; evidence and uncertainty |
| `ugc-starting-frame` | Choosing first/middle frame or generating influencer initial image | Face clarity, scene fidelity, identity, temporal anchor |
| `ugc-video-prompt` | Writing or debugging image/video-generation prompts | Multi-stage prompt contracts, action timelines, handling a mid-video anchor |
| `ugc-scheduling` | Scheduling UI, timepicker, timezone, social publishing pipeline | 24h local time; persisted server-side jobs; idempotency |
| `ugc-regression-gate` | After ANY code change; before saying done | Screenshots, state matrix, regression tests, evidence-based status |

## Required per-task sequence

1. Read `AGENTS.md`, the real `explore context.md`, `docs/ai-context/clear.md`, and `docs/ai-context/nonnegotiables.md`.
2. Read the relevant skill(s) in full. Inspect current implementation and existing tests, before editing.
3. Write a short scope contract: requested behavior, existing behavior to preserve, affected files, and tests.
4. If visuals are involved, capture current UI and identify the **approved** baseline (not screenshots marked as broken).
5. Implement the minimum safe change. Do not redesign adjacent workflows.
6. Run automated tests and manual/browser checks appropriate to the change. Include browser-close/reopen tests for scheduling.
7. If the user identified a new error, append it to `clear.md` as an OPEN entry immediately; mark resolved only with proof.
8. Report exactly what was verified and what could not be verified.

## Quick use examples

- `Read AGENTS.md, explore context.md and clear.md. Use $ugc-ui-clarity and $ugc-immutable-contracts. Fix the duplicate Choose Photos tile without altering reference selection.`
- `Use $ugc-frame-analysis and $ugc-starting-frame to analyze this uploaded source video. Record keyframe timestamps and face visibility. No code changes.`
- `Use $ugc-video-prompt to write both the source-video motion specification and the correct prompt for a selected frame at 1.40 seconds. Do not claim the generated clip reproduces events before 1.40 seconds without a separate reconstruction plan.`
- `Use $ugc-scheduling and $ugc-regression-gate to inspect the 24-hour time picker and actual scheduled publication. Verify the job persists after the browser closes.`

## Optional tools

- `python tools/preflight.py --repo . --task "Fix Hook Video starting-frame UI"`: read-only context discovery, issues summary, git state, and routing hints. **Exit code 2 means a prerequisite is missing.**
- `python tools/check_skill_pack.py --root .`: lint the packaged skill manifests and required documentation.
- `python tools/video_frames.py /path/to/video.mp4 --out /tmp/ugc-video-review --every 0.25`: evidence extraction via ffmpeg; creates frame images, review sheets, and an empty observation template for human/model inspection.

Use `--every 0.033333` for near frame-by-frame sampling of 30 fps material when truly necessary, or `--native-fps` to extract all frames; long videos can generate large amounts of data. Always use the source video's actual fps for frame-level review.

## Source of truth and precedence

- Real behavior and source code + approved designs establish the current implementation.
- Explicit current user requirements override older preferences, subject to higher-priority constraints.
- `docs/ai-context/nonnegotiables.md` lists protected behaviors, but it can be updated when the user explicitly approves a change to the contract.
- `docs/ai-context/clear.md` records reported failures, not guaranteed root causes.
- `explore context.md` is an existing project history file that must be READ (its contents are unknown to this pack).

## What this pack cannot guarantee

Skill files are guidance, not a security boundary or automatic test runner. Reliably reducing regressions requires loading the instructions, enforcing checks in CI, and maintaining the actual approved visual baselines. Prompt fidelity is limited by the generation model and by whether it can start from or extend before a selected intermediate frame.
