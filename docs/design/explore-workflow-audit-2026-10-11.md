# Explore workflow design audit — 11 October 2026

This document records the pre-redesign audit. The subsequent implementation and local verification are recorded in [the implementation follow-up](./explore-workflow-implementation-2026-10-11.md). The screenshots and source references below describe the earlier snapshot.

## Verdict

The implementation is a meaningful partial change, but it does not yet deliver the intended redesign. The user's concern that it feels like a wider version of the old sidebar is supported by both current screenshots and the source. Header navigation, form width, compact reference controls and shared clip editing changed. The main form's reading order, small settings, utility-panel action treatment and several workflow shells remain substantially the same.

This is an audit of the current working tree. No application code was changed during this pass. Previous passing regression tests establish behavior and containment; they do not establish design quality or agreement with the reference.

## Scope and evidence

Primary user: someone making their first video. Goal: understand the workflow, create or select footage, edit it, and review a schedule with confidence.

The user's latest reference is [the supplied workflow mockup](C:/Users/chund/AppData/Local/Temp/codex-clipboard-10fdbfb6-c08b-4fae-97b3-0fd9d07cb2e7.png). It is a visual direction, not a literal specification: later decisions intentionally changed the reference tiles and removed voice from Hook.

Fresh screenshots were captured and opened during this audit from the in-app browser using the development route that renders the real components with local media. Accepted evidence is stored in [the audit screenshot folder](C:/Users/chund/OneDrive/Desktop/UGC/output/workflow-audit-2026-10-11). Browser zoom and viewport overrides varied during capture, so not every filename's size suffix establishes a measured CSS viewport. Numeric claims below use fresh DOM measurements; screenshots support visual findings. No physical laptop diagonal can establish its CSS viewport without resolution and scaling information.

Authenticated Explore entry redirected to sign-in. Production generation, credit behavior, account selection, final renders and posting were not exercised. Fixture-disabled buttons, zero credits, auto-selected sample references and empty fixture libraries are not treated as production defects. The production site still requires an authenticated acceptance pass after an authorized deployment. Phone + Demo is intentionally hidden and is source-only internal coverage.

## Flow review

| Step | Screen or task | Health | Evidence |
|---|---|---|---|
| 1 | Enter Explore and choose a workflow | Entry not verified visually; destinations checked in source | Sign-in prevented review of the authenticated landing page. Hook, Talking Head, Wall of text and Slideshows have catalog destinations. |
| 2 | Create Hook or Wall of text | Partial match; hierarchy remains too close to the old composer | Wider form, compact references and header tabs are present. Five settings and gallery cards still compete with the brief. |
| 3 | Preview/select examples and generation references | Working controls; discovery needs improvement | Selected thumbnails and small previews are present. Gallery Recreate is icon-only; supporting instructions are partly hidden. |
| 4 | Assemble Hook and optional demo | Unbalanced use of space | A large left pane can hold only two upload choices and a switch while the clip controls sit in the right pane. |
| 5 | Edit a Hook clip | More focused, but navigation cue is inconsistent | Shared trim/text tools exist. Opening the Hook editor selects Create, even when reached from Edit & demo. |
| 6 | Create/edit Talking Head + Demo | Functional improvement; visual consistency incomplete | Text and trim exist, but editing remains in separate scrolling cards and the sequence is stacked on laptops. |
| 7 | Review Schedule | Basic form understandable; action/review model inconsistent | Caption/date/time are present. A second prefilled review surface adds publishing details; Talking Head's first action is misleadingly named Schedule post. |
| 8 | Create Slideshows | Older shell retained | Narrow form and stage tabs remain inside the left card. The latest video presentation explicitly excludes this format. |

### Step 1 — Explore entry

![Explore entry requires sign-in](C:/Users/chund/OneDrive/Desktop/UGC/output/workflow-audit-2026-10-11/04-explore-entry-login-blocker.jpg)

The screenshot is a named access limit, not evidence of a broken Explore screen. Source inspection confirms the visible catalog's destinations in [workflows.ts](C:/Users/chund/OneDrive/Desktop/UGC/lib/explore/workflows.ts:12). The hidden Phone route intentionally returns `notFound()`.

### Steps 2–3 — Creation and references

![Hook creation at measured 1280 by 720](C:/Users/chund/OneDrive/Desktop/UGC/output/workflow-audit-2026-10-11/02-hook-create-1280.jpg)

![Hook creation at measured 1920 by 1080](C:/Users/chund/OneDrive/Desktop/UGC/output/workflow-audit-2026-10-11/14-hook-create-desktop.jpg)

![Wall of text creation](C:/Users/chund/OneDrive/Desktop/UGC/output/workflow-audit-2026-10-11/09-wall-create-1366.jpg)

At a measured 1280 × 720 CSS viewport, the expanded navigation reserves 196px; the form is approximately 561px and the gallery 467px. Each example article is about 209px wide and 395px tall, giving two complete examples and the start of the next row. The model name is visibly truncated. At measured 1920 × 1080, the form is about 910px and the gallery 758px; three examples fit per row, while a large blank area separates form settings from the bottom action.

The reference has no app sidebar, larger task typography, a readable brief, explicit Recreate buttons, and an estimate beside its action. Merely retaining its form/gallery ratio cannot reproduce its space allocation in the real app shell.

### Steps 4–5 — Hook assembly and clip editing

![Hook and demo assembly](C:/Users/chund/OneDrive/Desktop/UGC/output/workflow-audit-2026-10-11/05-hook-edit-demo-1366.jpg)

![Focused Hook clip editor](C:/Users/chund/OneDrive/Desktop/UGC/output/workflow-audit-2026-10-11/06-hook-clip-editor-1366.jpg)

Assembly reserves a large card for a small amount of input. The focused editor is a real improvement, but its active Create tab contradicts the editing task. This follows `openClipEditor()` selecting `create` for the opening clip in [format-workspace.tsx](C:/Users/chund/OneDrive/Desktop/UGC/components/explore/format-workspace.tsx:229).

### Step 6 — Talking Head creation and editing

![Talking Head creation](C:/Users/chund/OneDrive/Desktop/UGC/output/workflow-audit-2026-10-11/01-talking-head-create-1366.jpg)

![Talking Head sequence](C:/Users/chund/OneDrive/Desktop/UGC/output/workflow-audit-2026-10-11/10-talking-head-sequence-laptop.jpg)

![Talking Head shared clip editor](C:/Users/chund/OneDrive/Desktop/UGC/output/workflow-audit-2026-10-11/11-talking-head-editor-laptop.jpg)

Blank Create initially uses a centered form and does not reserve an empty right panel. Once a source/result appears, or Edit/Schedule is selected, it becomes a two-panel layout. The same clip editor is connected, but its presentation differs from Hook: tools on the left, preview on the right, separate scrolling, and an outer Edit & add demo heading above the clip-specific editing title. The sequence still calls this clip Hook and stacks the demo underneath it.

### Step 7 — Schedule

![Talking Head scheduling form](C:/Users/chund/OneDrive/Desktop/UGC/output/workflow-audit-2026-10-11/12-talking-head-schedule.jpg)

The first form clearly offers platforms, caption, date and time. Hook calls the next action Review schedule; Talking Head calls it Schedule post, although a new request first opens a review. Both pass the existing caption, targets and time to that review, so the fields are prefilled rather than lost. Confirmation and hosted posting were not exercised in this audit.

### Step 8 — Slideshows

![Slideshow creation on a laptop-sized surface](C:/Users/chund/OneDrive/Desktop/UGC/output/workflow-audit-2026-10-11/16-slideshow-create-laptop.jpg)

The older narrow creation form is still present, including stage tabs inside the card and a scrollable area containing slide selection and instructions. This is inconsistent coverage across Explore, rather than evidence that a promised Slideshow redesign was completed incorrectly. Its populated Edit/Schedule screens were not captured in this pass.

## What matches the agreed decisions

- Video workflow stages share the existing title/header row; the extra stepper band is gone.
- Hook/Wall's left form is wider and the right gallery retains References, Your videos, filters and playback.
- Compact bounded image/video tiles sit above the prompt. Selected references use a small thumbnail deck and a plus action; hover preview size is constrained. These later refinements intentionally differ from the large cards in the reference.
- Hook intentionally has no voice input. Talking Head retains the Seedance voice-reference path.
- Talking Head's opening and demo now have shared custom text, timing, trim and sound functionality, with independent drafts.
- Existing controllers retain uploads, saved assets, reference compatibility, access/credit checks, final-output ownership, unsaved-edit guards and explicit scheduling confirmation.

Reusing those controllers is appropriate. Reusing the old presentation without changing reading order is the incomplete part.

## Prioritized findings

| Priority | Finding and user consequence | Correction |
|---|---|---|
| High | **The old composer still defines creation.** The code explicitly uses `workflowDesign="classic"`; it shows references, generic Your instructions, five always-visible settings and a full-width footer. A beginner still has to interpret the same utility form. | Give workflows a deliberate presentation: source choice, compact references, task-specific brief, readable settings, estimate/action. Preserve all current handlers. |
| High | **Navigation and gallery compete with the task.** The full sidebar consumes 196px. Gallery stays two columns until its own width reaches 650px, so larger laptop windows can make the same two thumbnails taller. | Add an explicit workspace-focus navigation option, respecting saved sidebar preferences. Bound example-card size; use three columns when minimum readable card width permits. |
| High | **Important beginner guidance is invisible.** Normal prompt help is `sr-only`, and the classic branch omits `contextBanner`, including supplied selected-reference audio context. Sighted users cannot see what to describe or what selection changes. | Show a short task-specific instruction and relevant selected-reference context. Keep errors and compatibility explanations visible. |
| High | **Editor functionality is shared, but its shell is not.** Hook uses a focused workspace; Talking Head uses two scrolling cards and stacked sequence previews. | Use one editor shell across video workflows, with a compact clip sequence and one selected clip being edited. |
| Medium | **Source choices expose implementation terms.** Generate / Upload / Creative Assets are peers, unlike the agreed Generate new video / Use existing video choice. | Keep upload and saved assets distinct underneath Use existing video, preserving mode state and validation. |
| Medium | **Settings are small even where the form is wider.** Five equal columns truncate the model on a laptop. Disabled quality is still a prominent editable-looking field. | Keep model fully readable because it determines reference support. Summarize output settings and expand relevant choices without hiding constraints. |
| Medium | **Recreate is difficult to discover visually.** It has an accessible name and tooltip, but appears as a rotate icon instead of the reference's labelled action. | Put an explicit Recreate action on every example card. Keep preview and selection separate. |
| Medium | **Space is allocated poorly across stages.** Creation has small dense controls followed by unused space; assembly dedicates a tall left panel to few optional inputs. | Size task sections for their content; keep the primary action close to the work while visible on short screens. |
| Medium | **Labels and save steps vary.** Talking Head still displays Hook terminology. Save edits, Apply edits and Schedule mean different things across workflows; Hook clip editing highlights Create. | Separate clip save, final-video preparation and posting review consistently. Make the active stage describe the actual task. |
| Medium | **Scheduling uses two editable surfaces.** The review is correctly prefilled and adds platform details, but repeats core scheduling fields. Talking Head's initial action sounds like immediate posting. | Present one clear draft and a concise review with relevant publishing options. Use Review schedule / Resume schedule / Check saved schedule as appropriate; preserve final confirmation. |
| Medium | **Slideshows retains the old shell.** A user moving between formats encounters different stage placement and form widths. | Plan a separate presentation pass respecting its one-slide generation, selection and editing requirements. |

Key source references:

- Classic composer and hidden helper: [ai-studio-composer.tsx](C:/Users/chund/OneDrive/Desktop/UGC/components/generation/ai-studio-composer.tsx:124).
- Explicit classic presentation: [video-generation-workspace.tsx](C:/Users/chund/OneDrive/Desktop/UGC/components/video/video-generation-workspace.tsx:1332).
- Gallery and settings breakpoints: [workflow-video-layout.module.css](C:/Users/chund/OneDrive/Desktop/UGC/components/explore/workflow-video-layout.module.css:9).
- Selected-reference context supplied by the workflow: [format-workspace.tsx](C:/Users/chund/OneDrive/Desktop/UGC/components/explore/format-workspace.tsx:339).
- Gallery icon action: [recreate-workspace.tsx](C:/Users/chund/OneDrive/Desktop/UGC/components/explore/recreate-workspace.tsx:182).
- Talking Head stacked sequence and scrolling: [workflow-section-layout.module.css](C:/Users/chund/OneDrive/Desktop/UGC/components/explore/workflow-section-layout.module.css:39).
- Different editing shells: [hook-workflow-preview.tsx](C:/Users/chund/OneDrive/Desktop/UGC/components/explore/hook-workflow-preview.tsx:119) and [format-workspace.module.css](C:/Users/chund/OneDrive/Desktop/UGC/components/explore/format-workspace.module.css:208).
- Slideshow exclusion from video presentation: [format-workspace.tsx](C:/Users/chund/OneDrive/Desktop/UGC/components/explore/format-workspace.tsx:356).

## Accessibility and interaction risks

1. **Arrow-key focus can initiate final preparation.** `activateOnFocus` on the stage tabs activates Schedule when keyboard navigation reaches it. This increments `prepareRequest`; the clip editor can start finishing when it has valid authenticated media and changes/demo requiring a render. Invalid/local-preview/missing-source/pending states are guarded, and unchanged ready MP4 footage can be reused without rendering. This is a confirmed source path, not a live provider test. It does not prove AI generation credits are charged or a post is created. Use manual tab activation or a separate explicit Prepare final video action. Sources: [workflow-section-navigation.tsx](C:/Users/chund/OneDrive/Desktop/UGC/components/explore/workflow-section-navigation.tsx:16), [format-workspace.tsx](C:/Users/chund/OneDrive/Desktop/UGC/components/explore/format-workspace.tsx:237), [format-video-editor.tsx](C:/Users/chund/OneDrive/Desktop/UGC/components/explore/format-video-editor.tsx:128).
2. **Visual guidance must supplement accessible descriptions.** Screen-reader-only helper text does not help a sighted beginner; icon-only actions need a visible label for recognition.
3. **Small fields and separate scroll regions need keyboard/zoom validation.** Screenshots show truncated labels and partially visible lower tools. They do not establish full keyboard reachability, screen-reader behavior, contrast compliance or 200% zoom resilience.
4. **Hover must remain optional.** The reference preview component supplies focus and click access; retain those alternatives and Escape dismissal in the next presentation pass.

## Interface guidelines spot check

The focused source check used the current [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md). This is not a full accessibility certification.

- [workflow-reference-preview.tsx](C:/Users/chund/OneDrive/Desktop/UGC/components/explore/workflow-reference-preview.tsx:20): labelled button and keyboard-focus access present; image dimensions declared.
- [workflow-reference-preview.module.css](C:/Users/chund/OneDrive/Desktop/UGC/components/explore/workflow-reference-preview.module.css:13): visible focus outline and reduced-motion handling present.
- [recreate-workspace.tsx](C:/Users/chund/OneDrive/Desktop/UGC/components/explore/recreate-workspace.tsx:186): icon action has an accessible label; the finding is visual discoverability, not a missing accessible name.
- [workflow-section-navigation.tsx](C:/Users/chund/OneDrive/Desktop/UGC/components/explore/workflow-section-navigation.tsx:16): automatic activation couples keyboard focus to Schedule preparation; make preparation explicit.

## Recommended correction pass

Keep the existing behavior and rebuild the presentation around the user's task. Start with Hook as the reference implementation, then apply the same shell to Wall of text and Talking Head with their actual capability differences. Slideshows needs its own task-specific treatment.

| Element | Reason to keep it | How it should be presented |
|---|---|---|
| Explore/back and workflow stages | Users need location and a way to return or move stages | One compact header, with an explicit workspace-focus control if needed. |
| Generate or existing source | This changes the task the user is doing | Two clear choices; upload and saved assets within the existing-source path. |
| Generation references | Users can guide appearance, motion or delivery | Compact bounded tiles above the brief, preserving compatible slots and limits. |
| Brief | This is the main required input | The strongest form section, with a workflow-specific question and one useful visible hint. |
| Model and output settings | They affect capability, duration and cost | A readable active model plus a compact settings summary; advanced options expandable. |
| Credits/access and generation action | Users need to understand cost and readiness before starting | A compact action row with actual calculated values and all relevant errors retained. |
| Example gallery | It teaches the format and starts recreation | Bounded thumbnails, labelled Recreate, clear selected state and filtering. |
| Clip sequence and editor | Users need to know which footage they are changing | Small sequence cards and one consistent focused editor with preview. |
| Schedule draft and review | Users need to know exactly what will be posted and when | Existing draft values, final saved asset and a clear confirmation step. |

Acceptance should be based on actual CSS viewports such as 1280 × 720, 1366 × 768, 1536 × 864 and 1920 × 1080, including browser/OS scaling. Require readable model names, no horizontal page overflow, obvious required input and next action, bounded gallery cards, consistent stage cues, accessible preview alternatives and no work started merely by moving focus. Separately validate authenticated generation and scheduling on the production domain after deployment.

The next change should alter the form's decision hierarchy and unify the editor shell. Another column-width adjustment will not resolve the issues documented here.
