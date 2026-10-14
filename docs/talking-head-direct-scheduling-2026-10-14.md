# Talking Head + Demo: direct scheduling and rejected-time recovery

The Schedule tab uses the original simple layout shown in the October 13 screenshot: Instagram, TikTok and YouTube platform tiles, connected account choices, post caption, date, time and the account timezone. The existing form and styles remain in place. Its Schedule post button submits directly, without replacing the form with ScheduleEditor or opening Confirm your schedule. Back to Edit preserves the unsent draft. Both finished videos and background preparation use this simple form; entering the tab and restoring a browser request never submit a schedule.

On the explicit click, the client validates current account permissions and scheduling limits. TikTok and YouTube use the user's saved publishing defaults, including visibility and AI disclosure. TikTok checks those defaults against the connected account's available publishing capabilities; an invalid saved choice produces an inline error instead of silently changing visibility. The short music acknowledgement appears only when TikTok is selected. Hook, Wall of Text and Slideshow also submit from their existing simple forms.

## Blocking error

The reported message, "Review the video from the rejected request before confirming its new time," was a client guard tying a time-rejected request to the previous render's media ID. Preparing the video again gives it a new media ID. This guard then blocked submission even when the current video and selected time were valid.

An explicit HTTP 409 schedule_time_too_soon rejection now permits a new submission for the current output. The client first checks whether another tab has already accepted the old request. For the same output, corrected timing keeps its request key. A different output gets a new key. Uncertain saves still replay the exact durable input, and accepted schedules are preserved. Requests remain stored before POST and protected by the workflow's browser lock. Changing the output during recovery checks blocks stale submissions.

The server's minimum lead time still applies. Expired or too-soon times must be moved into the future. Removing the second screen preserves provider settings, account ownership checks and TikTok's required publishing choices.

## Sidebar correction and release scope

The Demo sidebar retains the previous Upload/Replace demo and Creative Assets cards. The compact source selector is limited to preview cards, as requested. The release also includes the pending native-aspect video preview and stable rendering-progress fixes, and the local receipt for the already released Analytics work. This follow-up is website-only. It needs no database migration or worker rollout; MCP and SEO changes remain outside this release.

Validation covers the direct form, corrected rejected time with a newly prepared output, cross-tab acceptance, interrupted saves, exact provider settings, source selection and Demo sidebar behavior. Production verification is performed on www.getugcpilot.com before reporting this follow-up live. No customer post is scheduled as part of verification.

The combined focused suite passed 272 tests. Web TypeScript and scoped ESLint passed. The earlier portrait-player fixture passed 36 shape/viewport/playback checks against the exact preview changes included here.
