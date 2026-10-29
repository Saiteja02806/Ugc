import type { Metadata } from "next";
import { articleJsonLd } from "@/lib/marketing/brand-videos";
import { faqJsonLd } from "@/lib/marketing/mcp-public";
import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import { ArticleBody, ArticleH2, ArticleH3, ArticleLink, ArticleCommand, FaqList } from "@/components/marketing/seo-article";

const path = "/guides/saas-demo-video-script";
const title = "SaaS Demo Video Script Template: Show One Useful Action";
const description = "Write a short SaaS demo with a copyable script worksheet, an illustrative 30-second example, a 15-second cut and a screen-by-screen proof checklist.";
export const metadata: Metadata = {
  title, description, alternates: { canonical: path },
  openGraph: { type: "article", title, description, url: path, siteName: "UGC Pilot" },
  twitter: { card: "summary", title, description },
};

const worksheet = `Viewer and situation:
Question this video answers:
One supported product action:
Starting screen / safe sample data:
Opening words:
Action words -> exact screen action:
Result words -> visible result:
Next step -> actual destination:
Claim or sensitive detail to check:
Rehearsal length / revision needed:`;

const beats = [
  { time: "0–4 seconds", words: "Looking for the notes from your last client call?", screen: "Show a sample project with several clearly labeled call notes. No real client details." },
  { time: "4–10 seconds", words: "Open the project and choose Call notes.", screen: "Record the project selection and the visible Call notes control. Keep each label readable." },
  { time: "10–20 seconds", words: "Select Monday’s call. The decisions and next steps are together here.", screen: "Open the sample note. Hold on the actual decisions and next-steps sections; do not invent a generated dashboard." },
  { time: "20–26 seconds", words: "Check the next step before your follow-up.", screen: "Keep the selected next step visible. Do not imply a reminder or automation unless the app actually provides it." },
  { time: "26–30 seconds", words: "Try this with a sample project.", screen: "Show the real sample-project destination, if available. Otherwise choose a next step the product genuinely offers." },
] as const;

const faqs = [
        { question: "Is this different from a UGC ad script?", answer: "Yes. A general UGC ad script organizes a persuasive message. This template binds a specific software task to actual screens and a visible result. You can use both, but the product recording remains the evidence." },
        { question: "Do I need a face or voiceover?", answer: "No. A clear screen sequence with readable labels can explain the task. If you use a voiceover, rehearse it against the actions and check the captions. Provide an accessible explanation of important visual information where needed." },
        { question: "Can I copy the example exactly?", answer: "Use the structure, but only retain words and actions that are true of your product. The fictional example is not a claim that your app or UGC Pilot supports those note-management features." },
      ];

export default function SaasDemoVideoScriptPage() {
  return <VideoMarketingPage eyebrow="SaaS demo script" h1="Write a SaaS demo script the screen can prove." lede="Choose one viewer question, one real software action and one next step. Write the words beside the exact screens you will record, then rehearse before editing." jsonLd={{ "@context": "https://schema.org", "@graph": [articleJsonLd({ path, headline: "Write a SaaS demo script the screen can prove.", description, imagePath: "/guides/opengraph-image" }), { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Guides", item: "https://getugcpilot.com/guides" }, { "@type": "ListItem", position: 2, name: title, item: `https://getugcpilot.com${path}` }] }, faqJsonLd(faqs)] }}>
    <ArticleBody>
      <p>A short SaaS demo script should help someone follow a task, not list everything your product does. Start with a question such as “Where do I find the decisions from a client call?” Then show the answer. If a sentence has no visible action or supported fact behind it, rewrite it before you record.</p>
      <p>This worksheet is for a short social demonstration. It is not a sales-call script or a customer testimonial. The example and timings below are original editorial illustrations, not measured engagement results or UGC Pilot generation settings.</p>
      <ArticleH2>Copy the script worksheet</ArticleH2>
      <p>Paste this into your notes. Fill in the product action first, then write the opening. This prevents a dramatic hook from promising a result the demonstration cannot show.</p>
      <ArticleCommand>{worksheet}</ArticleCommand>
      <p>Use the screen labels that actually appear in your app. “Choose Call notes” is easier to follow than “unlock your team’s knowledge.” Leave pricing, account creation and unrelated features out of the sequence unless they are necessary to answer this viewer’s question.</p>
      <ArticleH2>A 30-second example: find a client-call decision</ArticleH2>
      <p>Imagine a fictional project-notes app that stores call notes under each project. These are assumed capabilities for this example, not claims about UGC Pilot or a customer. Replace both the words and screen actions with your verified workflow.</p>
      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full min-w-[580px] border-collapse text-left text-sm leading-6">
          <caption className="p-4 text-left font-semibold text-foreground-strong">Illustrative rehearsal plan: words paired with screen evidence</caption>
          <thead className="bg-card-muted text-foreground-strong"><tr><th scope="col" className="p-4">Approximate time</th><th scope="col" className="p-4">Words</th><th scope="col" className="p-4">What the recording must show</th></tr></thead>
          <tbody>{beats.map(beat => <tr key={beat.time} className="border-t border-border"><th scope="row" className="p-4 align-top font-medium">{beat.time}</th><td className="p-4 align-top">{beat.words}</td><td className="p-4 align-top">{beat.screen}</td></tr>)}</tbody>
        </table>
      </div>
      <p>Read it aloud while performing the clicks. If a screen loads slowly, record the wait honestly and decide whether an indicated edit is appropriate. Do not speed up a process and present the edited duration as proof of how fast the product works. If the words or actions do not fit, shorten the message or allow more time.</p>
      <ArticleH2>Make a shorter cut by removing a beat</ArticleH2>
      <p>For an illustrative 15-second version, keep the same task and show less context. Try: “Need the decisions from your last call? Open the project, choose Call notes, and select the call. The next steps are here. Try a sample project.”</p>
      <p>Remove the extra discussion of preparing a follow-up. Keep the project selection, the note selection and the result. Rehearse the actual recording; if the viewer cannot read the controls at that pace, the shorter version is not ready. A duration target is an editing choice, not evidence that it is the best length.</p>
      <ArticleH2>Check every line against the product</ArticleH2>
      <ArticleH3>Can the viewer see the claimed outcome?</ArticleH3>
      <p>“Here are the decisions” can be supported by the displayed note. “Never lose a decision again” cannot be demonstrated by one clip. “This saves ten hours a week” needs separate credible measurement. Replace unsupported promises with the observable action.</p>
      <ArticleH3>Does the next step match the audience?</ArticleH3>
      <p>A person who has never used the app may need an explanation or sample workspace. An existing user may need to open a specific feature. Pick one destination and verify it works for that audience. Do not promise a free account, trial or credit amount without checking your current offer.</p>
      <ArticleH3>Does it work without the narrator?</ArticleH3>
      <p>Watch the recording muted. Add concise labels where an essential action would otherwise be unclear. When speech is present, review captions against the actual audio. The <ArticleLink href="/guides/readable-video-text">readable video text guide</ArticleLink> covers contrast, placement and reading time.</p>
      <ArticleH2>Use AI for an opening, not for product evidence</ArticleH2>
      <p>If you want a creator-style introduction, choose words that lead directly into the task. The <ArticleLink href="/free-hook-lines">Reaction Hook Library</ArticleLink> offers starting lines to adapt. A direct question is often enough; a surprised face is optional.</p>
      <p>Generated performance is not a genuine customer endorsement. Use your real screen recording to demonstrate the software, and add exact words in an editor. <ArticleLink href="/ai-ugc-video-generator">UGC Pilot’s video workflow</ArticleLink> can help with creative footage; check the current supported features before requesting generation or an export. The finished demo still needs your review.</p>
      <ArticleH2>Before recording</ArticleH2>
      <ul className="list-disc space-y-2 pl-5"><li>Write the single question the video answers.</li><li>Confirm each named feature and control exists.</li><li>Prepare safe sample data and the result you will show.</li><li>Pair every script line with an observable screen state.</li><li>Rehearse words and actions together, allowing time to read.</li><li>Check that the closing link or action is available to the intended viewer.</li></ul>
      <p>Next, <ArticleLink href="/guides/screen-recording-for-app-demo">record readable source footage</ArticleLink>. Once that is ready, follow the <ArticleLink href="/guides/product-demo-to-short-video">product-demo editing guide</ArticleLink> to assemble the opening, demonstration and review.</p>
      <FaqList items={faqs} />
    </ArticleBody>
    <VideoRelatedLinks links={[{ href: "/guides/screen-recording-for-app-demo", title: "Record the proof", description: "Prepare and capture readable app footage." }, { href: "/guides/product-demo-to-short-video", title: "Build the finished demo", description: "Edit one recording into a short social sequence." }, { href: "/blog/ugc-ad-script-templates", title: "Explore other script formats", description: "Choose a broader UGC message structure when a demonstration is not the whole story." }]} />
  </VideoMarketingPage>;
}
