# Talking Head UI audit — 5 November 2026

Verdict: the two main preparation sections work, but Script & Remix needs a focused presentation pass. This audit changes no application code and starts no AI/media generation or deployment.

Scope: current signed-in HTTPS localhost Talking Head constructor, existing saved Sawyer source/business Remix/prompt; desktop1440x1000 and mobile390x844. All screenshots below captured and opened in this audit, not reused from the previous implementation receipt. Native UI navigation, DOM bounds and scroll measurements supplement the screenshots. No approved visual design was supplied for the new prompt result.

## 1. Starting frame — clear section separation

The first section has source frame, your photos/settings and generated starting frame in three columns. Script fields stay out of this view. Source/photo role labels and generation action are present. This captured state has no selected person photos and no generated frame; its disabled generation action is expected. Actual running/approved image states were not created in this audit.

![Starting frame desktop](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/local-https/ui-audit-20261105-02-frame-desktop.png)

## 2. Script & Remix — usable, crowded after prompt generation

Original hook and full source transcript are separate collapsed disclosures. Your script is editable; review checkbox, business Remix and Generate prompt follow it. The two section tabs remain at the top. However repeated helper paragraphs, a large script field and two similarly styled outline actions dilute the next step. Generate prompt has no stronger visual hierarchy than Remix.

![Script and Remix desktop](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/local-https/ui-audit-20261105-01-script-desktop.png)

## 3. Generated prompt — discoverability and nested scrolling issue

The video prompt is stacked below the script editor rather than opening a dedicated result view. At desktop the scrollable panel is589px high with846px content. Copy begins at approximately pagey1035, outside the modal's initial visible content. The user scrolls down to reach it. The output textarea then scrolls separately inside that panel. At the bottom Copy is reachable, but the source script is out of view.

![Prompt result desktop after scrolling](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/local-https/ui-audit-20261105-05-prompt-desktop.png)

## 4. Mobile — no horizontal overflow, heavier vertical flow

At390px viewport the document width remains390px. Tabs fit and remain visible. Script controls and prompt stack vertically; content is921px within576px of scrollable height, requiring about346px panel scrolling to reach the bottom. Prompt text itself is1004px inside a184px textarea, creating nested vertical scrolling. Remix/Generate/Copy controls are32px high and Close28px: usable with a pointer, small for comfortable touch. This is a measured touch-size concern, not a blanket accessibility-compliance failure.

![Script and Remix mobile](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/local-https/ui-audit-20261105-03-script-mobile.png)

![Prompt result mobile after scrolling](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/local-https/ui-audit-20261105-04-prompt-mobile.png)

## Recommended next UI change

Keep Starting frame and Script & Remix as the two main sections. In the second section, show the script editor first; Generate prompt opens a dedicated prompt result view inside the same section, with Back to script and a persistent Copy action. Keep both states mounted/persisted and preserve all in-progress image/Remix owners. Use one clear primary action for the current view, retain secondary Remix, shorten repeated instructions and use larger mobile touch targets. This addresses the vertical stack without another modal or losing the user's work. Recommendation only; no redesign implemented in this audit.

Limits: screenshots/DOM checks do not certify keyboard focus trapping, full screen-reader behavior, exact contrast ratios or WCAG compliance. No paid image/video, active generation switching, approved-frame geometry, or production acceptance was tested here. The earlier functional verification receipt remains separate. No lint/type/test rerun was necessary for this documentation-only UI review.

Preflight: reused established localhost target/session and repository UI/protected context; read ugc-ui-clarity, Product Design audit/index/user-context/critical-overrides/framework/communication guidance and browser skill setup guidance. Read-only user-context preflight reports no saved Product Design context; current project/user references used. Existing authenticated browser retained; screenshots accepted only after local inspection. No app/model/provider/config changes.
