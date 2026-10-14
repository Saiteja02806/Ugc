# Approved 5% workflow sidebar increase

The owner reviewed local 5% and 10% comparisons and selected 5% on 14 October.
Desktop control sidebars now use `clamp(378px, 26.25cqw, 462px)` instead of
`clamp(360px, 25cqw, 440px)` in Talking Head + Demo, Phone Video, Hook video,
Wall of text and Slideshows. Create, overview Edit/Demo, and Schedule share the
policy, including empty Create panels. The base format-shell fallback is 378px.

Recreate has a separate draggable panel. Its CSS and accessible TypeScript
default both grow from 320–420px / 32% to 336–441px / 33.6%. User resize choices
and the 320px minimum gallery space keep their existing bounds. The hidden
Phone route retains its implementation; this release does not expose it.

The reviewed schedule fixes are included: inline confirmation descriptions
occupy a separate header row, and Refresh accounts has a stable 148px width,
12px text, no wrapping, and a concise loading label. Touch targets retain their
44px minimum. Mobile stacking and the expanded clip-edit workspace keep their
existing behavior. No generation, rendering, scheduling or publishing API
contract changes are part of this release.

Validation: 65 focused workflow/schedule/resize tests pass, TypeScript and scoped
ESLint pass, and the existing schedule browser regression passes its fixed-media,
platform preference, ordinary two-clip and mobile checks. The selected local
comparison covered 1840px and 1280px desktop widths plus 390px mobile, without
horizontal overflow. Production deployment and browser measurements are recorded
separately in the local release receipt after deployment.

Concurrent SEO, clip-source actions, schedule-time recovery, Carousel migration,
and generated QA artifacts remain outside this approved UI release. Their exact
paths are preserved in the release exclusion manifest.
