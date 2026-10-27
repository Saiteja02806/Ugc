# Schedule contract — exact local time, durable execution, no duplicates

## Time semantics

- User sees and edits date and time in the chosen timezone (default product context may be `Asia/Kolkata`; `Asia/Calcutta` is an IANA alias). Show human-readable timezone near the picker.
- Use a real 24-hour picker/selector consistent with existing UI. Support `00:00`–`23:59`; disallow invalid/missing and past local times.
- Internally pass a **local date**, a **local clock time**, and **IANA timezone** as separate validated inputs, and convert to one UTC instant exactly once using a timezone-aware library or reliable platform API. Do not parse unqualified `YYYY-MM-DDTHH:mm` as if it were always UTC.
- Example: `2026-10-25 21:30 Asia/Kolkata` = `2026-10-25T16:00:00Z`. This is an example to test, not an instruction to schedule that actual date.
- Persist both the canonical scheduled UTC instant and timezone/local fields needed for correct UI round-trip. Enforce daylight-saving ambiguity policy for other zones (nonexistent/repeated local times).

## Backend contract (adapt to actual architecture; never assume existing table names)

1. Validate selected connected account IDs, publication permission/token status, media ready state, caption and target-specific restrictions.
2. In one consistent operation (transaction when available) create schedule and account-specific targets in a durable store. Avoid 'schedule saved, zero targets' state.
3. Register durable job/queue/scheduler execution independent of an open browser. Confirm delivery or implement a reliable polling/outbox dispatcher.
4. Worker uses atomic per-target claim with lease/expiry and a unique idempotency key; recheck state before publishing. Timeouts and duplicate queue deliveries must not result in duplicate platform posts.
5. Record `scheduled`, `queued`, `publishing`, `published`, `failed`, and retry/exhaustion states (map to actual project's statuses). Respect provider rate limits and partial failures.
6. The frontend reports **Scheduled** only after backend persisted schedule and targets and accepted job registration; report worker/publication separately. Do not report **Published** until provider accepts and evidence is stored.
7. Retries must be bounded, observable and safe. Recover stalled claims. Design compensation when schedule creation and queue registration happen in different services.
8. Authorization: users can only access own connected accounts/targets; service credentials never reach the client.

## Verification evidence

- Saved schedule ID, all intended target IDs, provider/account IDs, time zone and persisted UTC instant.
- Server scheduler job/queue event or accepted outbox item.
- Worker log correlated by schedule/target ID; published platform result ID or explicit failure.
- Browser closed during window and post still processed.
- Duplicate-delivery test verifies at-most-once external publication as far as provider/idempotency semantics allow. If provider lacks idempotency, document residual uncertainty and use defensive coordination/reconciliation.

## UI acceptance

`09:30` remains `09:30`, and `21:30` remains `21:30` in the same local timezone after save/reload. The picker retains the established interaction and is keyboard/mobile accessible. The Schedule Post button is disabled when required inputs are absent; that initial disabled state is NOT itself a bug.


## Explicit automatic posting - 2026-10-26

User-authorized Post now is an alternative to manual date/time entry. It means queue at the earliest supported time using the existing server-owned useDefaultScheduleTime path and configured publishing lead (repository default5 minutes), plus media preparation. This does not mean provider publication is instantaneous. Manual-time rules above continue to apply to Schedule for later and existing schedule edits.

Keep manual date/time/timezone when toggling modes. Selection alone never submits. Final explicit action still requires owner, ready media or durable preparation, selected accounts and valid publishing settings. Preserve a submitted automatic request and its idempotency key across retries; retries recover the first accepted slot rather than recalculating a duplicate post. Do not report Published without provider evidence. No new schema/lead-policy exception is authorized by this UI feature.


### UI clarification - 2026-10-26
User explicitly rejects a separate now/later mode-selection section. Keep a single default Post now action that resolves automatic time on click. Existing manual24-hour fields may select an exact schedule without another mode-choice section. Remove duplicated mode buttons and automatic-clock explanation from the default review. Earlier text about toggling modes describes state preservation, not permission to reintroduce the rejected selectors.


### Device-default display approval - 2026-10-26
The user's explicit latest instruction supersedes earlier mandatory24-hour presentation: interactive time selection follows the browser/device locale's default hour cycle.12-hour locales show AM/PM;24-hour locales show00-23. No new format switch or posting mode sections. Persist canonical HH:mm and selected IANA timezone unchanged; convert once as before. A web page can use browser language/Intl preferences but cannot read an OS-only clock override that the browser does not expose.

Post now retains the existing5-minute rendering lead from confirmation and durable backend scheduling/recovery. Time format is presentation only; it must not change the scheduled instant, deadline, provider settings or render/queue logic.

### Five-minute shortcut confirmation semantics - 2026-10-27
Explicit user request supersedes earlier shortcut-click timing only for5mins. Preserve relative intent until final submission; use the existing server-owned configured minimum lead path (default5minutes) and whole-minute rounding. Other quick presets remain absolute at their selection; manual date or time changes clear five-minute intent and preserve exact wall-clock/timezone semantics. No new controls or button-label changes. Unsent Explore drafts retain intent on reload, but saved scheduling requests/receipts remain immutable across retry and retain their first accepted slot. No new API/schema/provider/queue policy. UGC-SCH-010; docs/five-minute-submit-fix-2026-10-27.md.
