import type { FounderGuide } from "@/components/marketing/founder-guide-page";

// Distinguish recorded product evidence from illustrative copy and customer outcomes.
export const practicalGuides = {
  "product-demo-to-short-video": {
    slug: "product-demo-to-short-video",
    keyword: "Product demo to short video",
    title: "How to turn a product demo into a short social video",
    description: "Turn a SaaS or app screen recording into a short social demo. Follow a real UGC Pilot video excerpt, a copyable brief, an edit plan and a publishing checklist.",
    readingTime: "8 min read",
    author: "UGC Pilot",
    audience: "For SaaS and mobile-app founders with an existing screen recording",
    introduction: "A product demo and a short social video do different jobs. A full demo can introduce several features; a short video needs to make one useful action understandable. Start with a real recording of that action. Add a relevant opening, keep the evidence visible and remove the steps that do not help a new viewer follow the result. You can use this method in your existing video editor.",
    takeaways: [
      "Choose one audience question and one real product action before editing.",
      "Use real screen footage as evidence; generated reaction footage is optional context.",
      "Review text, speech, pacing and the final export on a phone before publishing.",
    ],
    sections: [
      {
        title: "Choose a demonstration that answers one question",
        paragraphs: [
          "Write the viewer's question first. 'How do I add my app recording after an opening clip?' is more specific than 'What does our content tool do?' Choose the smallest action that answers it. A video about adding a demo does not also need to show onboarding, billing and every publishing destination.",
          "Decide what the viewer should understand at the end, then list the evidence you need to show. If the product does not support the action, choose another example rather than directing an imagined interface. A small, accurate demonstration is stronger than a sweeping promise you cannot show.",
        ],
        bullets: ["Audience: who needs this action?", "Question: what are they trying to do?", "Action: which actual product step answers it?", "Evidence: what changes on screen?", "Next step: what can the viewer try after watching?"],
      },
      {
        title: "Copy a brief before you edit",
        presentation: "brief",
        paragraphs: ["Use this filled brief for the UGC Pilot example below, then replace the audience, task and evidence with your own app. The suggested opening is draft copy; it is not spoken or rendered into the example clip."],
        bullets: [
          "Audience: a SaaS or app founder who already has a product recording.",
          "Question: how can I put my demo after an opening clip?",
          "Message: select an opening, attach your own demo and review the pair.",
          "Evidence: the actual application screens in the existing UGC Pilot walkthrough.",
          "Suggested opening: Already recorded your app? Put that demo after your opening.",
          "Next step: review the opening and demo together before choosing a schedule.",
        ],
      },
      {
        title: "Record clean footage before adding an opening",
        paragraphs: [
          "Use a demonstration account with sample data. Remove names, emails, billing details and notifications from the recording. Set the window size so the important control and result remain visible in your intended crop. Move the pointer deliberately and pause long enough to show what changed.",
          "Record a little extra time before and after the action, then trim it in the editor. Do not speed up the meaningful step until a first-time viewer cannot follow it. If an interface label is unreadable after a vertical crop, reframe or make a focused second recording instead of shrinking the whole desktop into the frame.",
        ],
      },
      {
        title: "Give the opening a job, then show the proof",
        resource: {
          label: "Need a starting line? Browse The Reaction Hook Library: 110 free hooks to adapt to your demo.",
          href: "/free-hook-lines",
        },
        paragraphs: [
          "The opening should make the viewer's question clear. A direct line such as 'Add your app demo after an opening clip' can be enough. A face or reaction shot is optional; it should introduce the same idea that the demonstration explains. Avoid an unrelated surprise or a claim about time saved without evidence.",
          "If you use generated opening footage, treat it as illustrative performance, not footage of a real customer. Put the genuine product recording in the demonstration. Add exact words in an editor rather than relying on a video model to render accurate text or a faithful interface.",
        ],
      },
      {
        title: "Real example: shorten a UGC Pilot walkthrough to one task",
        presentation: "example",
        paragraphs: [
          "The original UGC Pilot showcase recording is about 2 minutes 18 seconds long. The silent 10-second excerpt below keeps only seconds 18–28: an opening is selected, the Add a product demo panel appears, and the recording moves into review. The useful task is attaching an existing demo, rather than introducing the entire application.",
          "This excerpt reuses our existing public walkthrough, shortened locally for this guide. It shows an earlier interface; current creation workflows live in Explore and controls may differ. It demonstrates the editing method, rather than current production acceptance or customer performance.",
        ],
        bullets: [
          "Keep: the selected opening, the demo attachment panel and the transition into review.",
          "Leave out: account setup, the rest of the feed and later calendar screens, because they answer other questions.",
          "Still to check: whether a new viewer can follow the attachment step. If the panel passes too quickly, hold that screen longer or record that action again.",
          "A shorter file is a concrete editing result. It does not establish better watch time, installs or signups.",
        ],
        media: {
          src: "/marketing/guides/add-product-demo-excerpt.mp4",
          poster: "/marketing/guides/add-product-demo-poster.jpg",
          label: "Historical UGC Pilot recording: attach a demo after an opening",
          description: "Silent video description: a selected portrait opening appears in the older Trending interface. The Add a product demo panel offers an upload or an existing demo, then the recording moves to the review screen. This excerpt illustrates the task; controls and labels have since changed.",
          sourceHref: "/marketing/showcase-part2/application-demo.mp4",
        },
      },
      {
        title: "Add captions and check the finished cut",
        paragraphs: [
          "Captions represent spoken audio; a headline overlay carries an additional written message. Check both independently. Correct automatic transcription, avoid covering the useful control with captions and keep any essential visual information available through narration or an accessible text explanation.",
          "Watch the export once without sound and once with sound on a phone. Check that the opening matches the demonstration, the pointer can be followed, each line can be read before it disappears and the next step is truthful. Test the platform preview too: buttons and description panels can overlap your video.",
        ],
      },
      {
        title: "Where UGC Pilot fits",
        paragraphs: [
          "In Explore, choose Hook video or Talking Head + Demo for an opening-plus-demo workflow. Bring an existing owned opening where supported, or request new footage with the displayed credit estimate. Add your real product recording in the Demo step, review the words, trim and framing, then inspect the complete finished file before you download it. Review the actual options available in your account.",
          "You do not need an AI actor if your screen recording already explains the task. A slideshow may work better when the reader needs to examine separate steps; a text-led clip may suit a short written explanation. Custom generated footage uses AI credits separately from daily slideshow concepts in Trending.",
          "The connected AI client and the website have different coverage. The generation tool makes footage; supported finishing tools can compose owned opening/demo clips and exact overlays when enabled. Discover the current capabilities first. Do not assume that connecting a client also enables every website editor feature or social publishing. This guide also works with a conventional video editor.",
        ],
      },
      {
        title: "Review what viewers understood",
        paragraphs: [
          "Ask a person unfamiliar with the product what action they saw and what they would do next. If their answer differs from your goal, simplify the opening or give the evidence more time. Change one meaningful element before comparing another version.",
          "When a published platform provides watch-time or click data, record the audience, dates and version alongside it. A single view count does not establish that the video caused signups. Use feedback to decide what needs a clearer explanation in the next demonstration.",
        ],
      },
    ],
    checklistTitle: "Before you publish the demo video",
    checklist: ["Show one real action with sample data and no private information.", "Make the opening and demonstration answer the same question.", "Keep important controls and the result readable in the final crop.", "Correct captions and add exact overlay words in the editor.", "Check the exported video with and without sound on a phone.", "Verify the destination, consent to use the footage and the intended next action."],
    faqs: [
      {question: "Do I need a creator or reaction shot?", answer: "No. A direct question over a clear product recording can introduce the task. Add a creator only when the performance helps explain the same message."},
      {question: "How long should a product demo video be?", answer: "Use enough time for the viewer to understand one action and its result. The worked example is a starting edit, not a universal target or a promise of better engagement."},
      {question: "Can AI generate the product interface for the demo?", answer: "Use a real recording or genuine supplied product visuals. Generated footage may invent controls, wording or behavior and should not be presented as proof of a feature."},
      {question: "Does the UGC Pilot plugin produce the whole edited demo?", answer: "Generation makes footage. Where enabled, separate finishing tools can combine your owned opening and demo with supported exact overlays and edits. Check the connected client's capabilities. Social scheduling and all website editor features should not be assumed to be available through the plugin."},
      {question: "Can I use a screen recording I already have?", answer: "Yes. Use an owned recording that shows the real task clearly. Check file requirements, crop and readability in your chosen workflow. Generating a new opening is optional, and is separate from adding the demo."},
      {question: "Does shortening a demo guarantee more app installs?", answer: "No. A shorter edit can make one task easier to inspect, but installs and signups need actual measurement. Compare relevant visits and completed actions as well as views, with the audience and dates recorded."},
    ],
    productHref: "/ai-ugc-video-generator",
    productLabel: "Explore the short-video workflow",
    related: ["readable-video-text", "saas-content-marketing", "mobile-app-marketing"],
    sources: [{label: "W3C: plan accessible audio and video content",href: "https://www.w3.org/WAI/media/av/av-content/"},{label: "W3C: review captions and subtitles",href: "https://www.w3.org/WAI/media/av/captions/"}],
  },
  "readable-video-text": {
    slug: "readable-video-text",
    keyword: "Readable on-screen video text",
    title: "How to make on-screen video text readable on a phone",
    description: "Review video overlay wording, contrast, placement and reading time on a phone, with a practical before-and-after example and a reusable checklist.",
    readingTime: "6 min read",
    author: "UGC Pilot",
    audience: "For creators making text-led videos, demos and short explanations",
    introduction: "A message can look clear in a desktop editor and become difficult to read in a phone feed. Text has to compete with moving footage, platform controls and a limited reading window. Start by deciding what the words contribute, then review the actual export at the size and pace your audience will see. This method works with manual overlays in your existing editor.",
    takeaways: ["Give each text block one job and enough time to be understood.", "Check contrast over the whole moving scene, not just a convenient frame.", "Keep authorial wording separate from visual wrapping, and review captions separately."],
    sections: [
      {title: "Decide whether the words are a headline, explanation or caption",paragraphs: ["A headline gives the viewer a reason to watch. A paragraph or list may be the main explanation. Captions represent speech and relevant sounds. Decide which job your text does before changing its size; overlapping these jobs can give the viewer several competing things to read.", "If the same important message is only visible on screen, provide a way to understand it without sight, such as clear narration or an accessible text description alongside the video. A silent text-led clip is not automatically accessible to someone who cannot read its frames."]},
      {title: "Fit the message to the reading window",paragraphs: ["Watch once at normal speed without pausing. If you have to rush the last sentence, reduce the draft to its main idea, split it into successive blocks or allow more time. When exact approved wording must be retained, change the layout or edit duration rather than silently dropping words.", "There is no single font size or word count that works for every language, device and background. A dense wall-of-text clip can intentionally invite pause or replay, but do not call it fully readable in one pass without testing. Long copy deserves a different edit from a short hook."]},
      {title: "Use contrast that survives movement",paragraphs: ["Check the brightest and darkest moments behind the text. A white sentence that works over a dark shirt may disappear when a window passes behind it. Use an appropriate solid backing, shadow or outline, move the block to a calmer area, or choose different footage.", "Font family and weight also affect legibility. Prefer a clear face and avoid tiny, tightly spaced decorative letters. W3C accessibility guidance recommends evaluating font size and contrast together; preview the result rather than treating an outline as proof that every frame is readable."]},
      {title: "Leave room for the product and the platform",paragraphs: ["Text should not cover the product action or result the viewer needs to see. For a tutorial, keep important controls clear. For an expressive background shot, subject overlap may be intentional, but the message still needs enough contrast.", "Preview the video in the intended destination to check its interface controls, description panel and cropping. There is no universal safe rectangle shared by every platform and post type. Keep the text anchored to the screen unless the edit deliberately calls for tracking; an ordinary handheld shot should not make the paragraph drift out of frame."]},
      {title: "Worked example: simplify a crowded tutorial overlay",presentation: "example",paragraphs: ["This is an illustrative copy-and-layout comparison, not a measured engagement experiment or a product screenshot. Imagine a tutor-app demo showing lesson notes grouped by student.", "The crowded draft reads: 'Our app helps you keep every student's lesson notes together so you can review what happened last time before preparing the next lesson.' Over a fast-moving three-second clip, that asks the viewer to read a full explanation while watching the action.", "For a headline draft, use: 'Keep each student's lesson notes together.' Then let the recording show the group. Add 'Review the group before your next lesson' as a later block only if the viewer has time to read it. If the long wording is already approved and must remain exact, use a longer, calmer edit rather than this rewrite."],bullets: ["Copy: choose one message per block, or preserve the approved full string when required.", "Background: pause on the group of notes instead of moving through unrelated screens.", "Placement: keep the grouping control and result visible; avoid the destination's controls.", "Timing: ask someone to watch once at normal speed and explain the action afterward."]},
      {title: "Keep captions and exact overlays under editorial control",paragraphs: ["Review automatic captions against the actual audio, including names and technical words. A headline does not replace speech captions, and captions do not automatically explain essential visual information. Keep both readable without covering each other.", "For generated footage, add approved overlay text separately in an editor. Preserve punctuation, emoji and authorial line breaks in the stored copy; visual wrapping can arrange that copy without rewriting it. UGC Pilot's Wall of text and editing workflows can support text-led work where available. In a connected AI client, creative skills draft words and direction; separate finishing tools can render supported exact overlays when enabled. Check the current capabilities before requesting a finished file."]},
      {title: "Check the final export and record the decision",paragraphs: ["Preview the exported file on a phone, not just the editor canvas. Test without sound, with sound and inside the destination's preview. Look at the busiest background frame, confirm the first and last words remain visible and check whether compression softened the letters.", "Record what you changed and why: shorter draft, stronger backing, different position or more reading time. If you compare versions after publishing, use the same relevant metric and note differences in audience and timing. Better readability is a concrete editorial result; a conversion lift needs actual evidence."]},
    ],
    checklistTitle: "A phone-preview checklist",
    checklist: ["Identify the job of each block: headline, explanation or caption.", "Read the message at normal speed without pausing.", "Check contrast across the moving background.", "Keep the useful product action and platform controls clear.", "Preserve approved exact words when changing layout or duration.", "Correct speech captions and provide essential visual information accessibly.", "Preview the exported file on a phone and in the intended destination."],
    faqs: [
      {question: "What font size should I use for video text?",answer: "Choose a size that is readable in the exported video on the intended phone and platform. Frame size, font, wording, contrast and reading time matter together; there is no universal minimum that guarantees readability."},
      {question: "Are wall-of-text overlays the same as subtitles?",answer: "No. A wall overlay carries a written message; subtitles or captions represent speech and relevant audio. A clip may need both, with a layout that lets viewers follow them."},
      {question: "Can I shorten already-approved text automatically?",answer: "Preserve it if the user requires exact wording. Adjust duration, placement or visual wrapping instead. A rewrite is a separate editorial choice, as in the clearly labeled example here."},
      {question: "Can a video generator render exact words reliably?",answer: "Do not rely on generated lettering for an approved overlay. Generate clean footage and add the exact words in an editor, then check the export."},
    ],
    productHref: "/ai-ugc-video-generator",
    productLabel: "See how short-video footage fits the workflow",
    related: ["product-demo-to-short-video", "saas-content-marketing", "social-media-marketing-for-saas"],
    sources: [{label: "W3C: make overlay text readable",href: "https://www.w3.org/WAI/media/av/av-content/"},{label: "W3C: captions and subtitles",href: "https://www.w3.org/WAI/media/av/captions/"}],
  },
} satisfies Record<string, FounderGuide>;
