# Plan: extend hook templates to Carousel Structure 2

Status: implemented and locally validated on 2026-09-23. No production migration, deployment, flag change, or regeneration has been performed. The release and live acceptance gates below remain required.

Local verification: the focused hook suite passed 30 tests (worker, application reader and full-migration-chain PostgreSQL simulation); the existing Carousel grammar suite passed 78 application contracts and 45 worker/render tests. Application and worker TypeScript checks, targeted ESLint and diff checks passed. The local renderer simulation passed for both structures; Structure 2's contact sheet was visually inspected. Model calls in the planner tests were mocked: live copy quality and deployed coverage are not claimed by these checks.

## Requested outcome and boundaries

New Structure 2 carousels should use the same optional hook-template system as Structure 1, including carousels that reach Structure 2 after Structure 1 planning fails.

Keep old completed carousels and daily-feed inventory behavior unchanged. Do not regenerate historical content or replace existing feed assignments. Do not change Structure 1 validation to avoid its fallback; supporting that fallback is part of this change.

Preserve both structures' current 96px centered single-hook rendering. For Structure 2, preserve the six-slide story sequence, product placement, first-person body voice, 14–30-word body contract, image sourcing and no-CTA rules. Hook templates affect Slide 1's writing guidance, not the story format.

## Confirmed integration gaps

1. `worker/src/lib/carousel-hook-templates.ts` defines a twenty-pattern catalog whose compatibility currently depends on Structure 1 formats and hook families.
2. `lib/carousel/structure-2-selector.ts` has no template assignment fields.
3. `lib/carousel/db.ts` normalizes Structure 2 template IDs to null, rejects non-null IDs while reading experiment assignments, and resolves generation overlays only for Structure 1.
4. The takeover SQL clears Structure 1 template attribution when switching to Structure 2. That clearing is appropriate for obsolete Structure 1 selections, but no replacement selection follows it.
5. `worker/src/lib/carousel-structure-2-generate.ts` neither passes templates into the planner nor retains them when saving a result; it explicitly writes nulls.
6. The Structure 2 initial, full-repair and targeted-repair prompts have no template input.

Both direct Structure 2 jobs and Structure 1 takeover converge on `generateCarouselStructure2Batch`. Use that boundary to resolve and persist Structure 2 hooks once, before any model call.

## 1. Shared catalog, separate compatibility rules

- Keep one canonical set of twenty pattern IDs, source patterns, versions and claim-handling rules. Do not fork a second copy of the catalog or reinterpret Structure 2 story IDs as Structure 1 educational formats.
- Add a Structure 2 compatibility adapter covering all eight story formats: `wrong_belief`, `perfect_plan_breaks`, `stopped_behavior`, `terrible_at`, `result_without_sacrifice`, `identity_transformation`, `new_rule`, and `wrong_villain`.
- Each format must have at least one generally applicable compatible pattern. Prefer closely matched patterns; retain business-context restrictions on marketing/copywriting-specific patterns.
- Do not force every catalog pattern onto every format. Exclude list/formula promises where the story cannot deliver them. Unsupported time, metric or personal-result claims must be removed or adapted rather than fabricated.
- Keep Structure 1 selection and compatibility behavior unchanged. Structure 2 does not need artificial Structure 1 hook-family values; those fields can remain null.
- Use deterministic selection keyed by batch identity, slot and resolved story format. Prefer different eligible patterns across the batch and avoid recently used patterns when alternatives exist.

## 2. Resolve after the final structure is known

Recommended sequence:

1. Resolve the final story structure and story-format assignments using the existing normal/fallback paths.
2. At the shared Structure 2 worker entry, load the batch's persisted rollout mode and any already resolved hook assignments.
3. If unresolved, select Structure 2-compatible templates and atomically persist the decisions before calling the model.
4. Reload the authoritative decisions and pass them to the planner.
5. Retries and concurrent delivery reuse the stored decisions, including an explicit no-template decision.

Do not merely stop the takeover SQL from clearing fields: the old Structure 1 template may be incompatible with the new Structure 2 story. Clear obsolete selections, then resolve the correct Structure 2 selections. Keep the takeover's locking, five-row integrity checks, rotation accounting and no-output guard intact.

## 3. Durable state and database compatibility

- Reuse existing `hook_template_id` and `hook_template_version` fields on generation and experiment-assignment rows for effective template attribution.
- Add a batch-level `hook_template_mode_snapshot` with `enabled`, `shadow`, or `off` semantics. Default missing/legacy values to off. The worker must not infer mode from null template IDs or depend on independently configured web/worker flags.
- Add a Structure 2 resolution marker, such as `structure_2_hook_templates_resolved_at`, so null can mean a completed off/shadow/no-match decision rather than trigger selection on every retry.
- Add a service-role-only, idempotent resolution operation that locks the batch, checks the final Structure 2 format/slot mapping and owner/profile consistency, writes matching assignment/generation pairs in one transaction, and records resolution. On replay, return the existing decision without rewriting it.
- Validate candidate IDs/version/compatibility in the shared application resolver; retain database pair integrity and reject stale batch/format mismatches at persistence. Do not let clients choose these internal assignments.
- Update generation mapping, assignment parsing, normalization, types and history retrieval to support valid Structure 2 template attribution without relaxing required story-format validation.
- Missing, unknown, mismatched or stale optional templates should resolve to native Structure 2 hook guidance with an explicit reason, not make an otherwise valid story unavailable.
- Add a new migration; do not edit already-applied migration history. Update the old column comments that claim Structure 2 always has null template fields.

## 4. Planner, repair and output attribution

- Extend Structure 2 planner assignments with backend-owned template ID/version and resolve those into effective Slide 1 guidance.
- Supply the same effective guidance to initial generation, full-plan repair and targeted Slide 1 repair. A repair must not accidentally discard or reselect the template.
- Keep templates as adaptable patterns, not exact required wording. The output remains `storyText`; the model must not choose its own template ID.
- Continue enforcing one complete 5–11-word hook and measured fit in the existing 96px/three-line cover. Templates do not relax these bounds or add a subtitle.
- Add explicit checks for unresolved placeholders and unsupported precise claims introduced by a pattern. Keep subjective stylistic similarity advisory; do not add a blanket ban on all questions or new brittle phrase-based publishing gates.
- If normal bounded repairs leave only Slide 1 render-fit failures, allow one narrowly scoped native-hook repair, matching Structure 1's safety policy. Preserve Slides 2–6 and strategy exactly, fully revalidate, and record the template abandonment reason. Do not use this fallback to bypass grounding, claim or body-slide failures.
- Stop unconditional null writes on successful Structure 2 output. Persist the actual applied ID/version, or null with a recorded reason when the template was legitimately abandoned. Keep requested/resolved selection diagnostics separate from effective attribution.
- Bump the Structure 2 selector/planner identifiers when behavior changes. No renderer change is required.

## 5. Tests and acceptance criteria

Add focused tests for:

- All eight Structure 2 formats have safe eligible patterns; context restrictions and claim handling remain effective.
- A five-item batch rotates eligible patterns without changing story-format rotation. Selection is deterministic.
- Direct Structure 2 and forced Structure 1-to-2 fallback both resolve templates when enabled.
- The fallback selects against the new story format rather than carrying a Structure 1-incompatible pattern.
- Off, shadow, enabled, missing-mode and legacy-null behavior; shadow never sends the selected pattern to the model.
- Persistence round trips, including the application reader that currently rejects non-null Structure 2 IDs.
- Retry, duplicate delivery and interruption after takeover but before hook resolution; stored decisions are not rerolled or partly persisted.
- Initial, full-repair and targeted-cover-repair prompts preserve the selected pattern.
- Native cover overflow fallback leaves Slides 2–6 byte-for-byte unchanged and clears effective attribution with a reason.
- Unresolved placeholders and unsupported claims still fail validation.
- Existing Structure 1 tests, render contracts and old-inventory delivery remain unchanged.

Run application contracts, worker build/tests and local render simulations. Then perform separately authorized bounded live canaries for both direct Structure 2 and forced fallback, using the reported account's saved business context plus contrasting contexts. Inspect actual copy quality as well as metadata: non-null template IDs alone do not prove the model followed the new guidance.

Production acceptance must inspect newly generated outputs on `https://www.getugcpilot.com`, with the exact generation IDs and persisted template/version/mode/fallback diagnostics. Do not judge success by an old feed card that the user has explicitly allowed to remain.

## 6. Release and observability

- Add backward-compatible schema first; deploy readers and worker support before enabling Structure 2 assignment. Coordinate the web and worker release so an older worker cannot clear new attribution.
- Keep the existing `CAROUSEL_HOOK_TEMPLATES_MODE` meanings and explicitly verify the deployed value. Snapshot it when creating new batches; do not introduce account-specific allowlists.
- Canary in shadow, inspect selection coverage, then enable for new batches after live verification. Existing persisted assignments remain stable across retries and configuration changes.
- Record requested/resolved structure, story format, mode, selected/applied template and native-fallback reason. Track template coverage and abandonment by structure to expose this failure mode in future audits.
- For rollback, set new batch selection to off. Do not silently rewrite already snapshotted batches; emergency cancellation or regeneration would require a separate explicit operational decision.
- Update `CAROUSEL_CONTEXT.md` when implementing the decision, superseding its Structure 1-only restriction and documenting mode snapshots, Structure 2 assignment timing, fallback and history behavior.

## Definition of done

New enabled batches use the hook-template system whether they start as Structure 2 or arrive through Structure 1 fallback. Every no-template result has an intentional, observable reason. Both structures keep their established slide sequences and rendering, and old-carousel delivery is untouched.
