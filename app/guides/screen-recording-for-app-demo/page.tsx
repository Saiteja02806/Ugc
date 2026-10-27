import type { Metadata } from "next";
import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import { ArticleBody, ArticleH2, ArticleH3, ArticleLink, ArticleExternalLink, ArticleCommand, FaqList } from "@/components/marketing/seo-article";

const path = "/guides/screen-recording-for-app-demo";
const title = "How to Record an App Demo for Vertical Video";
const description = "Capture readable SaaS or mobile-app footage for Reels, TikTok and Shorts. Use a preparation worksheet, framing test and record-review checklist before editing.";
export const metadata: Metadata = { title, description, alternates: { canonical: path }, openGraph: { type: "article", title, description, url: path, siteName: "UGC Pilot" }, twitter: { card: "summary", title, description } };

export default function ScreenRecordingForAppDemoPage() {
  return <VideoMarketingPage eyebrow="Record your app demo" h1="Record app footage people can actually follow." lede="Capture one task with readable controls and a visible result. Test the framing before recording the full sequence, especially when a wide SaaS interface needs to fit a vertical social video." jsonLd={{ "@context": "https://schema.org", "@type": "TechArticle", headline: title, description, mainEntityOfPage: `https://getugcpilot.com${path}`, author: { "@type": "Organization", name: "UGC Pilot" } }}>
    <ArticleBody>
      <p>For an app demo, the recording is the proof. The viewer should be able to tell where the task starts, which action you take and what changes. A clean capture of one useful feature is a better starting point than a long tour you hope to rescue in the edit.</p>
      <p>This guide prepares source footage for a social video. It does not promise a particular export specification, store approval or better engagement. Store preview videos have separate requirements; check the destination before making one file serve every channel.</p>
      <ArticleH2>Decide what must remain readable</ArticleH2>
      <p>Choose the question first. For example: “How do I find the next step from a client call?” The essential visual evidence might be the project name, the Call notes control, the selected note and its next-step section. Other navigation does not need equal attention.</p>
      <p>Write the steps using the <ArticleLink href="/guides/saas-demo-video-script">SaaS demo script worksheet</ArticleLink>. Keep a list of the labels and results that must be legible on a phone. This gives you a concrete pass/fail test for the recording.</p>
      <ArticleH2>Choose the capture route</ArticleH2>
      <ArticleH3>If you are demonstrating a mobile app</ArticleH3>
      <p>Record the app on the device and in the orientation needed to understand the task. On iPhone, Apple documents screen recording through Control Center and saving the result to Photos. Some apps restrict recording. Follow the current <ArticleExternalLink href="https://support.apple.com/en-us/102653">Apple screen-recording instructions</ArticleExternalLink> for your device.</p>
      <p>On Android, Google documents recording through Quick Settings; availability and controls depend on the device and version. Use the <ArticleExternalLink href="https://support.google.com/android/answer/9075928?hl=en">Android screen-recording guide</ArticleExternalLink> rather than assuming every phone has the same controls. Check whether the microphone or device audio is enabled before capture.</p>
      <ArticleH3>If you are demonstrating a desktop SaaS app</ArticleH3>
      <p>Record a clean app window or a carefully chosen region. Resize the window only if the app genuinely supports that layout. If a smaller viewport hides a required control, keep the authentic wide view and plan close-ups rather than presenting a broken or invented mobile interface.</p>
      <p>For vertical output, choose between showing the whole screen, cropping to the working region or using a wide overview followed by close-ups. There is no one crop that preserves every desktop workflow. Record a short test and view it inside your intended edit before completing the session.</p>
      <ArticleH2>Run a framing test before the full take</ArticleH2>
      <ol className="list-decimal space-y-3 pl-5"><li>Capture the starting screen, the important control and the resulting state.</li><li>Place the test clip in the vertical canvas you expect to use. Keep the product’s proportions intact.</li><li>View the export at normal phone size. Read the control name without zooming the player.</li><li>If it is too small, isolate the relevant region or record an additional close-up. Do not stretch the UI to fill the canvas.</li><li>Check the destination’s preview so its controls do not cover your essential action or labels.</li></ol>
      <p>A blank margin can be acceptable when it preserves legible context. Enlarging the entire capture is not automatically better: the button you need may move outside the crop. For a path across several panels, use a readable overview followed by separate focused shots, with clear continuity between them.</p>
      <ArticleH2>Prepare a safe demonstration state</ArticleH2>
      <p>Use a demo account or realistic sample records. Close unrelated tabs, hide notifications and inspect names, messages, addresses, billing details, browser suggestions and account menus. Preview the recording for accidental exposure; an editor’s blur does not protect a detail in an unblurred transition frame.</p>
      <p>Keep the real sequence. If the result is preloaded for a second shot, make the cut clear and do not claim the elapsed time represents live processing. Do not show a sample integration as connected or a draft as published when it is not.</p>
      <ArticleH2>Record a short sequence with deliberate holds</ArticleH2>
      <p>Try this original rehearsal sequence for the fictional notes app: begin on a sample project, pause so its name can be read, open Call notes, choose one call, then hold on the next-step section. Record enough still time around each action to make an accurate edit. The exact durations depend on the controls and reading load.</p>
      <p>Move the pointer directly and pause before a consequential click. On a phone, avoid covering the important result with unrelated gestures. If the action fails or the wrong record opens, reset the starting state and record another take. Keep the result that actually answers the viewer’s question, not just the smoothest motion.</p>
      <ArticleH2>Copy a capture worksheet</ArticleH2>
      <ArticleCommand>{`Viewer question:
Device / app version / orientation:
Safe demonstration account and sample record:
Starting screen:
Control and label that must be readable:
Action to capture:
Result to hold on:
Whole-screen or close-up plan:
Audio choice:
Sensitive details checked:
Phone-size test result:
Retake needed and why:`}</ArticleCommand>
      <ArticleH2>Review the recording before adding effects</ArticleH2>
      <ul className="list-disc space-y-2 pl-5"><li><strong className="text-foreground-strong">Starting point:</strong> can a new viewer understand which project or screen is open?</li><li><strong className="text-foreground-strong">Action:</strong> are the required control and the actual click or tap visible?</li><li><strong className="text-foreground-strong">Result:</strong> does the ending show the promised outcome long enough to inspect?</li><li><strong className="text-foreground-strong">Privacy:</strong> is every visible record, notification and menu safe to share?</li><li><strong className="text-foreground-strong">Audio:</strong> is any recorded speech intentional and clear, and is unwanted audio absent?</li><li><strong className="text-foreground-strong">Framing:</strong> do the important labels survive the intended vertical crop and phone-size export?</li></ul>
      <p>If any answer is no, fix the capture while the demo account is ready. A new recording may be simpler and more accurate than trying to hide the problem with animated overlays.</p>
      <ArticleH2>Turn the source clip into a short video</ArticleH2>
      <p>Keep an original copy of the recording. Then trim the sequence, add an opening that matches the task and check the final export. Follow the <ArticleLink href="/guides/product-demo-to-short-video">product-demo editing guide</ArticleLink> for that stage. The <ArticleLink href="/guides/readable-video-text">text readability guide</ArticleLink> helps when labels, narration captions and product UI compete for space.</p>
      <p>UGC Pilot can fit into the creative and editing workflow where its current capabilities support your media. This page does not claim it records your screen or repairs an unreadable capture automatically. Generated footage may introduce a question; a genuine recording should demonstrate the software.</p>
      <FaqList items={[
        { question: "Should I record vertically or crop later?", answer: "For a portrait mobile app, test a portrait capture first. For a wide desktop interface, test an overview plus readable close-ups. Choose the method that preserves the necessary controls and result; do not crop away the proof just to fill the canvas." },
        { question: "Can I use the same file as an App Store preview?", answer: <>Do not assume that. App Store previews have their own content and technical requirements. Check <ArticleExternalLink href="https://developer.apple.com/app-store/app-previews/">Apple’s app-preview guidance</ArticleExternalLink> and current specifications before preparing a separate store asset.</> },
        { question: "Do I need to record narration at the same time?", answer: "No. You can capture the interface first and rehearse narration against it later. If you record speech, review the actual audio and captions; do not assume the recording tool captured the microphone you intended." },
      ]} />
    </ArticleBody>
    <VideoRelatedLinks links={[{ href: "/guides/saas-demo-video-script", title: "Write the words first", description: "Tie a short SaaS script to observable screen actions." }, { href: "/guides/product-demo-to-short-video", title: "Edit the captured sequence", description: "Combine a relevant opening with a genuine demonstration." }, { href: "/guides/mobile-app-marketing", title: "Plan the app-marketing context", description: "Choose where this demonstration belongs in your launch routine." }]} />
  </VideoMarketingPage>;
}
