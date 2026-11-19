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

const path = "/blog/saas-video-ideas";
const title = "25 SaaS Video Ideas Founders Can Actually Produce";
const description =
  "Twenty-five practical SaaS video ideas grouped by intent — problem, proof, product, founder and launch — each with a one-line execution note and the guide to make it.";
const datePublished = "2026-11-09";

const faqs = [
  {
    question: "How many videos should a SaaS founder make first?",
    answer:
      "Start with three: one problem video from a real customer question, one product demonstration, and one proof video. Publish them, then decide what to repeat from your own numbers.",
  },
  {
    question: "Do SaaS videos need a person on camera?",
    answer:
      "No. Screen recordings, text-led videos and carousels all work. A person helps with trust for founder stories and testimonials, but the product proof should be real footage either way.",
  },
  {
    question: "What is the easiest SaaS video to start with?",
    answer:
      "A single-task product demo recorded from a real screen. It requires no acting, no studio and no editing beyond a trim and captions.",
  },
  {
    question: "Should short videos and long videos cover the same thing?",
    answer:
      "Often yes, in different depths. A 30-second social cut can introduce the task; a longer page or sales video can explain the full workflow. Keep the claims identical.",
  },
  {
    question: "How do I know which idea is working?",
    answer:
      "Measure on your own account: completion, saves, replies and sign-up clicks where available. Views alone rarely tell you whether the message landed.",
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

const groups = [
  {
    title: "Problem videos",
    items: [
      ["The exact customer complaint", "Read the support ticket out loud, then show the screen where it happens."],
      ["The manual workaround", "Record the spreadsheet or three-tab process the product replaces."],
      ["The forgotten next step", "Name the moment after a call when detail disappears."],
      ["The tool-switching tax", "Count the tabs; show the same task in one place."],
      ["The onboarding drop-off", "Show the first five minutes a new user actually needs."],
    ],
  },
  {
    title: "Proof videos",
    items: [
      ["Single-task demonstration", "One start screen, one action, one visible result."],
      ["Before and after", "Show the manual version and the product version with the same task."],
      ["Real customer clip", "Use a genuine clip with permission; do not reword their claim."],
      ["Founder walkthrough", "A plain recording, one feature, one reason it exists."],
      ["Launch-day video", "Show the shipped feature working, not a promise."],
    ],
  },
  {
    title: "Product videos",
    items: [
      ["Feature announcement", "One feature, one viewer question, one next step."],
      ["Workflow tutorial", "A complete path from first click to result."],
      ["Integration demo", "Show the connection happening, then the benefit."],
      ["Mobile app first run", "Record the real device screen and keep controls readable."],
      ["Settings walkthrough", "Explain the one setting that changes the experience."],
    ],
  },
  {
    title: "Founder videos",
    items: [
      ["One frustrating moment", "Start at the scene, not the founding date."],
      ["A mistake and the fix", "A concrete lesson beats a highlight reel."],
      ["Why this feature exists", "Tie a product decision to a customer request."],
      ["A day in the life", "Show the tool inside a real routine, not a staged office."],
      ["Build-in-public update", "Show the change, label it honestly, keep it short."],
    ],
  },
  {
    title: "Format-led videos",
    items: [
      ["Hook plus demo", "A two-second reaction, then the real product action."],
      ["Text on screen POV", "Tell the situation in text; no face required."],
      ["Carousel breakdown", "One idea per slide, a sequence that builds."],
      ["Comparison", "Two approaches to the same task, with evidence."],
      ["Myth versus reality", "State the myth, then show the real workflow."],
    ],
  },
];

export default function SaasVideoIdeasPage() {
  return (
    <VideoMarketingPage
      eyebrow="SaaS video ideas"
      h1={title}
      lede="Most SaaS video idea lists are vague prompts. These twenty-five are grouped by what the video is for, with the smallest honest way to produce each one."
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          articleJsonLd({ path, headline: title, description, imagePath: `${path}/opengraph-image`, datePublished }),
          faqJsonLd(faqs),
        ],
      }}
    >
      <ArticleBody>
        <p>
          The list is deliberately repetitive in structure: a problem, a task, a result. That is the shape that works
          when a viewer is deciding in two seconds whether to keep watching.
        </p>

        {groups.map((group, groupIndex) => (
          <div key={group.title}>
            <ArticleH2>{`${groupIndex + 1}. ${group.title}`}</ArticleH2>
            <div className="overflow-x-auto rounded-[22px] border border-border">
              <table className="w-full min-w-[560px] border-collapse text-left text-sm leading-6">
                <caption className="sr-only">{`${group.title} with a production note for each`}</caption>
                <thead className="bg-card-muted/60 text-foreground-strong">
                  <tr>
                    <th scope="col" className="p-4 font-semibold">Idea</th>
                    <th scope="col" className="p-4 font-semibold">How to produce it</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map(([idea, note]) => (
                    <tr key={idea} className="border-t border-border">
                      <th scope="row" className="p-4 font-semibold text-foreground-strong">{idea}</th>
                      <td className="p-4 align-top">{note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        <ArticleH2>How to choose the first three</ArticleH2>
        <ol className="list-decimal space-y-3 pl-5">
          <li><strong className="text-foreground-strong">One problem video</strong> from a real support ticket: <ArticleLink href="/guides/customer-question-to-demo-video">customer question to demo</ArticleLink>.</li>
          <li><strong className="text-foreground-strong">One product demo</strong> of a single task: <ArticleLink href="/guides/product-demo-to-short-video">product demo to short video</ArticleLink>.</li>
          <li><strong className="text-foreground-strong">One proof video</strong> with a real clip or a founder walkthrough: <ArticleLink href="/guides/screen-recording-for-app-demo">recording guide</ArticleLink>.</li>
        </ol>

        <ArticleH2>Production notes that apply to every idea</ArticleH2>
        <ArticleH3>Keep one message</ArticleH3>
        <p>
          If the video needs a second message, it is a second video. The
          <ArticleLink href="/blog/ugc-creator-brief-template">brief template</ArticleLink> keeps the scope honest.
        </p>
        <ArticleH3>Use real product footage</ArticleH3>
        <p>
          Generated footage can set up a problem; it cannot prove the interface. See the
          <ArticleLink href="/blog/ai-product-demo-video-generator">product demo generator article</ArticleLink>.
        </p>
        <ArticleH3>Review before publishing</ArticleH3>
        <p>
          Check claims, privacy and readability on a phone. The
          <ArticleLink href="/guides/saas-social-creative-review">social creative review guide</ArticleLink> has a
          reusable checklist.
        </p>

        <ArticleH2>Where Vidmake fits</ArticleH2>
        <p>
          Vidmake supports several of these formats directly: <ArticleLink href="/ai-ugc-video-generator">AI UGC video</ArticleLink>,
          <ArticleLink href="/guides/talking-head-with-saas-demo">talking-head plus demo</ArticleLink>,
          <ArticleLink href="/guides/wall-of-text-video-for-saas">text on screen</ArticleLink> and
          <ArticleLink href="/instagram-carousel-maker">carousels</ArticleLink>, with review before download. The
          <ArticleLink href="/pricing">pricing page</ArticleLink> lists the current paid plans.
        </p>

        <FaqList items={faqs} />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/blog/ugc-creator-brief-template", title: "UGC creator brief template", description: "Give every idea the same fair brief." },
          { href: "/guides/customer-question-to-demo-video", title: "Customer question to demo", description: "Start from a real ticket." },
          { href: "/guides/product-demo-to-short-video", title: "Product demo to short video", description: "Turn a recording into a complete edit." },
          { href: "/guides/saas-social-creative-review", title: "Review social creative", description: "Approve claims and readability." },
          { href: "/blog/ugc-ads-without-creators", title: "UGC ads without creators", description: "Three production routes." },
          { href: "/ai-ugc-video-generator", title: "AI UGC video generator", description: "The Vidmake workflow." },
        ]}
      />
    </VideoMarketingPage>
  );
}
