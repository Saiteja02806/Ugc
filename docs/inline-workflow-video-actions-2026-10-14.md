# Inline workflow video selection — 14 October 2026

The Hook workflow's empty opening card only offered **Go to Create**, and the empty demo card required the side-panel controls. Both cards now offer one source button directly in the preview area. The Demo side panel uses the same compact control.

`WorkflowClipSourceActions` opens a hover-capable Popover containing Upload video and Creative Assets; click, keyboard and tap also work. The opening menu includes Generate video to return to the existing generation controls. The trigger displays the selected source and the menu marks it with a check. Choosing Upload opens the native file chooser in the same click gesture, and each card delegates the selected file to its existing upload handler. Creative Assets opens the existing owned-video dialog without switching workflow tabs. Pending upload and preparation states disable the controls. Failed opening uploads show an inline error and preserve the existing demo; cancelling a chooser does not mutate the draft.

The demo's upload path continues to register footage in its existing Demo library. It can also explicitly select ready videos from Creative Assets. `useWorkflowSourceVideo` accepts an optional `assetLibrary` so a caller can choose a broader source library independently of its upload destination; existing callers retain their previous filtering by default. The requested Content Demo ID still restores through its dedicated ownership-checked endpoint. New selected assets restore through the generic owned media endpoint.

The trigger uses the application's existing icons and outline button styling, fits narrow cards, and remains accessible through keyboard labels. Opening selection does not remount the demo or erase its saved editing settings.

Verification covers both upload entry points, Creative Assets selection, cancelling the chooser, pending/error state, retained Demo tab and draft, and default source-library restrictions. The browser fixture uses the real local Next.js workflow and local video files, with account mutations and rendering blocked.

The focused suite passed 133 tests. Scoped ESLint and TypeScript checks passed. The real-page browser check passed for the single trigger, hover menu, mobile tap menu, both clip upload entry points, both Creative Assets selections, chooser cancellation, retained Demo tab, and no horizontal mobile overflow. It reported no page errors or account writes. Desktop and mobile screenshots were reviewed in `.tmp/inline-clip-browser/`.

These changes are local. Signed-in production acceptance must be performed at `https://www.getugcpilot.com` after deployment.
