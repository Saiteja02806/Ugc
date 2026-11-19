import type { Metadata } from "next";

import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import {
  ArticleBody,
  ArticleH2,
  ArticleLink,
  FaqList,
} from "@/components/marketing/seo-article";
import { articleJsonLd, publicOrigin } from "@/lib/marketing/brand-videos";
import { faqJsonLd } from "@/lib/marketing/mcp-public";

const path = "/blog/instagram-reels-ideas-for-saas";
const title = "20 Instagram Reels Ideas for SaaS Teams (With Hooks)";
const description =
  "Twenty Reels ideas for SaaS founders, grouped by intent, each with an opening line and the smallest way to produce it — demo, text-led, carousel or founder clip.";
const datePublished = "2026-11-10";

const faqs = [
  {
    question: "What should a SaaS company post on Instagram Reels?",
    answer:
      "Start with the questions buyers already ask: one task demonstration, one problem story and one proof post. Reels work best when the message is specific and the product proof is real.",
  },
  {
    question: "How long should a SaaS Reel be?",
    answer:
      "As short as the message allows. A single task can be clear in 15–30 seconds. If the Reel needs more, it may be a carousel or a longer page video instead.",
  },
  {
    question: "Do Reels need a person on camera?",
    answer:
      "No. Screen recordings, text-led videos and carousels all work. A person helps with founder stories and testimonials, but the product proof should be real footage either way.",
  },
  {
    question: "Can I reuse the same Reel on TikTok and Shorts?",
    answer:
      "Usually, with adjustments: check safe areas, caption placement and any platform-specific disclosure. The message and the demonstration can stay identical.",
  },
  {
    question: "How often should a SaaS team post Reels?",
    answer:
      "Choose a pace you can maintain with reviewed work. A consistent weekly routine built from real customer questions beats a burst of low-effort posts.",
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
    title: "Problem Reels",
    items: [
      ["The forgotten next step", "\"You finished the call. Where did the next step go?\""],
      ["The three-tab tax", "\"This used to take three tabs. Watch.\""],
      ["The stale demo", "\"Your demo video is from two releases ago.\""],
      ["The onboarding drop-off", "\"Here is the first five minutes a new user needs.\""],
      ["The manual report", "\"I rebuilt the same report every Monday.\""],
    ],
  },
  {
    title: "Proof Reels",
    items: [
      ["Single-task demo", "\"One screen. One click. One result.\""],
      ["Before and after", "\"Same task, two ways.\""],
      ["Real customer clip", "\"A user explains the part that surprised them.\""],
      ["Founder walkthrough", "\"Why this feature exists.\""],
      ["Launch-day proof", "\"Shipped today. Here it is working.\""],
    ],
  },
  {
    title: "Text-led Reels",
    items: [
      ["The receipt", "\"What we changed after 50 support tickets.\""],
      ["The comparison", "\"Two ways to solve this. One is honest.\""],
      ["The myth", "\"AI cannot show your product. It can show the problem.\""],
      ["The checklist", "\"Five checks before you publish a demo.\""],
      ["The lesson", "\"The demo that got pulled, and why.\""],
    ],
  },
  {
    title: "Carousel-adjacent Reels",
    items: [
      ["The sequence", "\"Three slides, one idea, no wasted step.\""],
      ["The teardown", "\"A good hook, broken down.\""],
      ["The workflow map", "\"Where the data actually goes.\""],
      ["The template", "\"Copy this brief.\""],
      ["The example", "\"The same message in two formats.\""],
    ],
  },
];

export default function InstagramReelsIdeasPage() {
  return (
    <VideoMarketingPage
      eyebrow="Instagram Reels ideas"
      h1={title}
      lede="A Reel does not need to be clever. It needs one specific thing the viewer recognises, and a payoff they can see. These twenty ideas are grouped by what the Reel is for."
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
          Each idea below includes an opening line. The line is a starting point, not a script; rewrite it in the
          customer&rsquo;s words before filming. See the
          <ArticleLink href="/free-hook-lines">free hook library</ArticleLink> for more options.
        </p>

        {groups.map((group, groupIndex) => (
          <div key={group.title}>
            <ArticleH2>{`${groupIndex + 1}. ${group.title}`}</ArticleH2>
            <div className="overflow-x-auto rounded-[22px] border border-border">
              <table className="w-full min-w-[520px] border-collapse text-left text-sm leading-6">
                <caption className="sr-only">{`${group.title} with an opening line for each`}</caption>
                <thead className="bg-card-muted/60 text-foreground-strong">
                  <tr>
                    <th scope="col" className="p-4 font-semibold">Idea</th>
                    <th scope="col" className="p-4 font-semibold">Opening line</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map(([idea, line]) => (
                    <tr key={idea} className="border-t border-border">
                      <th scope="row" className="p-4 font-semibold text-foreground-strong">{idea}</th>
                      <td className="p-4 align-top">{line}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        <ArticleH2>How to produce each type</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="text-foreground-strong">Problem Reels:</strong> record the frustration or the screen where it happens, then the fix.</li>
          <li><strong className="text-foreground-strong">Proof Reels:</strong> one real product action; hold on the result. <ArticleLink href="/guides/product-demo-to-short-video">Editing guide</ArticleLink>.</li>
          <li><strong className="text-foreground-strong">Text-led Reels:</strong> the point over footage, no face required. <ArticleLink href="/guides/wall-of-text-video-for-saas">Text-on-screen guide</ArticleLink>.</li>
          <li><strong className="text-foreground-strong">Carousel-adjacent:</strong> build the slides first, then animate them if needed. <ArticleLink href="/instagram-carousel-maker">Carousel maker</ArticleLink>.</li>
        </ul>

        <ArticleH2>The five rules for every Reel</ArticleH2>
        <ol className="list-decimal space-y-3 pl-5">
          <li><strong className="text-foreground-strong">One idea.</strong> If it needs two, it is two Reels.</li>
          <li><strong className="text-foreground-strong">Readable on a phone.</strong> Test captions and UI at normal size.</li>
          <li><strong className="text-foreground-strong">Real proof.</strong> Never invent an interface or a customer.</li>
          <li><strong className="text-foreground-strong">One next step.</strong> Make the destination match the promise.</li>
          <li><strong className="text-foreground-strong">Review before publishing.</strong> <ArticleLink href="/guides/saas-social-creative-review">Review guide</ArticleLink>.</li>
        </ol>

        <ArticleH2>Where Vidmake fits</ArticleH2>
        <p>
          Vidmake supports the formats behind these ideas:
          <ArticleLink href="/ai-ugc-video-generator">AI UGC video</ArticleLink>,
          <ArticleLink href="/guides/talking-head-with-saas-demo">talking-head plus demo</ArticleLink>, text on screen and
          <ArticleLink href="/instagram-carousel-maker">carousels</ArticleLink>, with review before download. See
          <ArticleLink href="/pricing">pricing</ArticleLink> for the paid plans.
        </p>

        <FaqList items={faqs} />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/blog/saas-video-ideas", title: "25 SaaS video ideas", description: "Broader list with production notes." },
          { href: "/free-hook-lines", title: "Free hook lines", description: "Opening lines by feeling." },
          { href: "/guides/wall-of-text-video-for-saas", title: "Text on screen", description: "Make the point readable without a face." },
          { href: "/instagram-carousel-maker", title: "Carousel maker", description: "Create and review a complete slide sequence." },
          { href: "/guides/saas-social-creative-review", title: "Review social creative", description: "Approve claims and readability." },
          { href: "/ai-ugc-video-generator", title: "AI UGC video generator", description: "The Vidmake workflow." },
        ]}
      />
    </VideoMarketingPage>
  );
}
