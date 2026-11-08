import type { Metadata } from "next";

import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import {
  ArticleBody,
  ArticleH2,
  ArticleH3,
  ArticleLink,
  FaqList,
} from "@/components/marketing/seo-article";
import { articleJsonLd, publicOrigin } from "@/lib/marketing/brand-videos";
import { faqJsonLd } from "@/lib/marketing/mcp-public";

const path = "/blog/ai-product-demo-video-generator";
const title = "AI Product Demo Video Generator: What It Can and Cannot Show";
const description =
  "How SaaS teams use an AI product demo video generator without faking the interface: the honest division between generated openings and real screen proof, plus a capture and review checklist.";
const datePublished = "2026-11-08";

const faqs = [
  {
    question: "Can an AI generate a product demo video?",
    answer:
      "It can generate an opening, a scenario or a presenter. It cannot be trusted to show your real interface doing a real action. For the demonstration itself, record the actual product.",
  },
  {
    question: "What should a product demo video show?",
    answer:
      "One task: the starting screen, the action, and the visible result. Keep the control you use and the result readable on a phone. Remove anything that does not help the viewer follow that task.",
  },
  {
    question: "How long should a SaaS demo video be?",
    answer:
      "As short as the task allows. A single action can be clear in 15–30 seconds; a multi-step workflow may need longer. Length is a comprehension decision, not a target to hit.",
  },
  {
    question: "Do I need a script for a demo video?",
    answer:
      "A short one. Pair every line of narration with a screen state the viewer can see. If a sentence has no visible evidence behind it, rewrite it or remove it. The SaaS demo script guide includes a worksheet.",
  },
  {
    question: "Can generated footage replace a screen recording?",
    answer:
      "No. Generated footage can invent buttons, labels and behaviour. It may introduce the problem, but the proof of the product should be a genuine recording you reviewed.",
  },
];

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: path },
  openGraph: {
    type: "article",
    url: new URL(path, publicOrigin).href,
    siteName: "Vidmake",
    title,
    description,
  },
  twitter: { card: "summary_large_image", title, description },
};

export default function AiProductDemoVideoGeneratorPage() {
  return (
    <VideoMarketingPage
      eyebrow="AI product demos"
      h1={title}
      lede="An AI generator is good at the part before the proof: the opening, the scenario, the explanation. The proof itself still has to be your real product. This page shows where to draw the line and how to review the result."
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          articleJsonLd({ path, headline: title, description, imagePath: `${path}/opengraph-image`, datePublished }),
          faqJsonLd(faqs),
        ],
      }}
    >
      <ArticleBody>
        <ArticleH2>The honest division of labour</ArticleH2>
        <div className="overflow-x-auto rounded-[22px] border border-border">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm leading-6">
            <caption className="sr-only">Which parts of a product demo can be generated and which must be recorded</caption>
            <thead className="bg-card-muted/60 text-foreground-strong">
              <tr>
                <th scope="col" className="p-4 font-semibold">Part of the video</th>
                <th scope="col" className="p-4 font-semibold">Generated</th>
                <th scope="col" className="p-4 font-semibold">Recorded</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Opening / hook</th><td className="p-4 align-top">Yes — scenario, reaction, presenter</td><td className="p-4 align-top">Also possible</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Problem context</th><td className="p-4 align-top">Yes, if it stays generic</td><td className="p-4 align-top">Optional</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Product interface</th><td className="p-4 align-top"><strong>No</strong> — can invent screens</td><td className="p-4 align-top">Required</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">The action</th><td className="p-4 align-top"><strong>No</strong></td><td className="p-4 align-top">Required</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">The result</th><td className="p-4 align-top"><strong>No</strong></td><td className="p-4 align-top">Required</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Caption and CTA</th><td className="p-4 align-top">Rendered text overlays</td><td className="p-4 align-top">Recorded or overlaid</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          The moment a viewer needs to believe the product does something, the footage must be real. A generated
          dashboard can look convincing and still be a liability.
        </p>

        <ArticleH2>Build the demo around one task</ArticleH2>
        <ArticleH3>Choose the viewer question</ArticleH3>
        <p>
          Start from a question a real person asked: &ldquo;Where do I find the next step from a client call?&rdquo; The
          answer becomes the task. If you cannot name the question, the video has no job yet. The
          <ArticleLink href="/guides/customer-question-to-demo-video">customer-question guide</ArticleLink> turns a
          support thread into a sequence.
        </p>
        <ArticleH3>Script the words beside the screens</ArticleH3>
        <p>
          Write each line next to the screen state that proves it. Use the
          <ArticleLink href="/guides/saas-demo-video-script">SaaS demo script worksheet</ArticleLink>; it includes a
          30-second example and a 15-second cut.
        </p>
        <ArticleH3>Capture readable proof</ArticleH3>
        <p>
          Record the starting screen, the action and the result. Keep the control and the outcome legible at phone size.
          If a wide interface loses a required control, plan a close-up instead of cropping it away. The
          <ArticleLink href="/guides/screen-recording-for-app-demo">app recording guide</ArticleLink> covers framing and
          privacy.
        </p>

        <ArticleH2>Use AI for the opening — then hand off</ArticleH2>
        <p>
          A generated creator or text-led opening can make the problem feel immediate. Then cut to the recording. Keep
          the handoff clean: the opening names the task, the recording performs it, and the ending shows the result and
          the next step.
        </p>
        <p>
          Vidmake supports this combination through its <ArticleLink href="/ai-ugc-video-generator">AI UGC video
          generator</ArticleLink> and the <ArticleLink href="/guides/talking-head-with-saas-demo">talking-head plus
          demo</ArticleLink> workflow, with a review step before download. The
          <ArticleLink href="/guides/product-demo-to-short-video">product demo editing guide</ArticleLink> covers the
          assembly.
        </p>

        <ArticleH2>Review rubric before publishing</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Does the first three seconds name the situation the viewer recognises?</li>
          <li>Is the starting screen understandable without prior knowledge?</li>
          <li>Is the exact control used visible and readable?</li>
          <li>Does the result stay on screen long enough to inspect?</li>
          <li>Is any generated footage clearly not presented as product proof?</li>
          <li>Are sensitive records, names and notifications removed?</li>
          <li>Do captions match the audio and the words on screen?</li>
          <li>Does the next step work for the intended viewer?</li>
        </ul>

        <ArticleH2>Common failure modes</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="text-foreground-strong">Generating the UI:</strong> invented screens and labels.</li>
          <li><strong className="text-foreground-strong">Speeding up the result:</strong> implying the product is faster than it is.</li>
          <li><strong className="text-foreground-strong">No hold on the outcome:</strong> the viewer never sees what changed.</li>
          <li><strong className="text-foreground-strong">Unreadable crop:</strong> the button that matters disappears outside the frame.</li>
          <li><strong className="text-foreground-strong">Leaked data:</strong> a real customer name or email left in the recording.</li>
        </ul>

        <FaqList items={faqs} />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/guides/saas-demo-video-script", title: "SaaS demo script template", description: "Write the words beside the screens." },
          { href: "/guides/screen-recording-for-app-demo", title: "Record an app demo", description: "Capture readable proof for vertical video." },
          { href: "/guides/product-demo-to-short-video", title: "Product demo to short video", description: "Assemble the opening and demonstration." },
          { href: "/guides/customer-question-to-demo-video", title: "Customer question to demo", description: "Turn a real question into one task." },
          { href: "/ai-ugc-video-generator", title: "AI UGC video generator", description: "Create the opening in Vidmake." },
          { href: "/blog/ai-video-generator-for-mobile-apps", title: "AI video for mobile apps", description: "Store preview versus social video." },
        ]}
      />
    </VideoMarketingPage>
  );
}
