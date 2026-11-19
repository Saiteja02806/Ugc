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

const path = "/blog/ugc-ads-without-creators";
const title = "UGC Ads Without Creators: What Works, What Backfires";
const description =
  "Three honest routes to UGC-style ads without hiring creators: AI hooks, real product recordings and customer content. Where each one works, where it fails, and how to keep the ad believable.";
const datePublished = "2026-11-09";

const faqs = [
  {
    question: "Can you make UGC ads without hiring creators?",
    answer:
      "Yes, for specific jobs. AI can produce an opening, a presenter or a scenario; a real product recording supplies the proof; existing customer content supplies authenticity. The mistake is pretending a generated person is a real customer.",
  },
  {
    question: "Do AI UGC ads perform as well as real creator ads?",
    answer:
      "It depends on the job. AI is strong for hook testing, format variants and product explainers. Real creators remain stronger for testimonials, founder stories and anything that depends on lived experience. Do not treat one as a universal replacement for the other.",
  },
  {
    question: "Is it legal to use AI presenters in ads?",
    answer:
      "Rules vary by platform and region, and AI-generated presenters must not be presented as real customers. Check the current advertising rules for your market and label AI where required. This article is not legal advice.",
  },
  {
    question: "What should a UGC-style ad show for a SaaS product?",
    answer:
      "One real task: the starting screen, the action and the visible result. An AI or creator opening can name the problem, but the product proof should be a genuine recording of the software doing what the ad claims.",
  },
  {
    question: "How many variants should I test?",
    answer:
      "Enough to separate the angle from the hook. A practical start is two problems, each with two openings, then compare on your own analytics. More variants without a clear variable only produce noise.",
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

export default function UgcAdsWithoutCreatorsPage() {
  return (
    <VideoMarketingPage
      eyebrow="UGC production routes"
      h1={title}
      lede="You can run UGC-style ads without hiring a creator. You cannot run them without the thing that makes UGC work: the sense that a real person used the product. Here is how to keep that while cutting the production cost."
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          articleJsonLd({ path, headline: title, description, imagePath: `${path}/opengraph-image`, datePublished }),
          faqJsonLd(faqs),
        ],
      }}
    >
      <ArticleBody>
        <ArticleH2>Why UGC works in the first place</ArticleH2>
        <p>
          UGC earns attention because it signals peer experience: someone like the viewer used the thing and is
          reporting back. The format is casual, but the trust comes from the implication of real use. Remove the person
          and you have to replace that signal deliberately, not hope the aesthetic carries it.
        </p>

        <ArticleH2>The three routes</ArticleH2>
        <div className="overflow-x-auto rounded-[22px] border border-border">
          <table className="w-full min-w-[620px] border-collapse text-left text-sm leading-6">
            <caption className="sr-only">Three UGC production routes compared by cost, speed and credibility</caption>
            <thead className="bg-card-muted/60 text-foreground-strong">
              <tr>
                <th scope="col" className="p-4 font-semibold">Route</th>
                <th scope="col" className="p-4 font-semibold">Works for</th>
                <th scope="col" className="p-4 font-semibold">Fails when</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">AI opening + real demo</th><td className="p-4 align-top">Hooks, problem setup, explainers</td><td className="p-4 align-top">The demo is faked or the claims drift</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Customer content</th><td className="p-4 align-top">Testimonials, real usage clips</td><td className="p-4 align-top">You stretch one clip across contexts it does not support</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">DIY recording</th><td className="p-4 align-top">Founder expertise, walkthroughs</td><td className="p-4 align-top">It is overproduced and stops feeling native</td></tr>
            </tbody>
          </table>
        </div>

        <ArticleH2>Route one: AI opening, real demonstration</ArticleH2>
        <p>
          This is the most practical route for SaaS. Generate the first three to six seconds: a person reacting to the
          problem or asking the question the viewer has. Then cut to a genuine recording of the product solving it.
        </p>
        <ArticleH3>What to generate</ArticleH3>
        <ul className="list-disc space-y-2 pl-5">
          <li>A reaction or a direct-to-camera opening that names the situation.</li>
          <li>A presenter explaining a concept that does not depend on product UI.</li>
          <li>A scenario that sets up the demonstration.</li>
        </ul>
        <ArticleH3>What never to generate</ArticleH3>
        <ul className="list-disc space-y-2 pl-5">
          <li>Product interfaces, dashboards or feature proof.</li>
          <li>Customer testimonials or star ratings.</li>
          <li>Numbers, awards or outcomes you cannot source.</li>
        </ul>
        <p>
          The <ArticleLink href="/guides/product-demo-to-short-video">product demo guide</ArticleLink> covers the handoff,
          and the <ArticleLink href="/blog/ai-product-demo-video-generator">product demo generator article</ArticleLink>
          explains where the line sits.
        </p>

        <ArticleH2>Route two: customer content, used honestly</ArticleH2>
        <p>
          Existing customer clips are the most credible raw material you have. The trap is stretching them: a clip
          recorded for one context used as proof of something else. Keep the source visible, quote the customer
          accurately, and do not edit a sentence into a claim they did not make.
        </p>
        <p>
          If the customer only gave you text, a text-led video can carry the quote without inventing a face. The
          <ArticleLink href="/guides/wall-of-text-video-for-saas">text-on-screen guide</ArticleLink> covers the format.
        </p>

        <ArticleH2>Route three: DIY recording</ArticleH2>
        <p>
          A founder or team member recording a walkthrough is still UGC-adjacent if it stays plain: real screen, real
          voice, one task. Overproduction removes the signal. The
          <ArticleLink href="/guides/screen-recording-for-app-demo">recording guide</ArticleLink> covers capture; the
          <ArticleLink href="/blog/overcoming-founder-camera-anxiety">camera-anxiety article</ArticleLink> covers the
          personal side.
        </p>

        <ArticleH2>A believable AI-assisted ad in five steps</ArticleH2>
        <ol className="list-decimal space-y-3 pl-5">
          <li><strong className="text-foreground-strong">Pick one real question</strong> from support or sales calls.</li>
          <li><strong className="text-foreground-strong">Write the opening</strong> in plain speech; see the <ArticleLink href="/free-hook-lines">hook library</ArticleLink>.</li>
          <li><strong className="text-foreground-strong">Generate only the opening</strong> and keep it short.</li>
          <li><strong className="text-foreground-strong">Record the real task</strong> and hold on the result.</li>
          <li><strong className="text-foreground-strong">Review every claim</strong> against the footage before publishing.</li>
        </ol>

        <ArticleH2>The trust rules</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Never present a generated person as a real customer.</li>
          <li>Never show an invented interface as your product.</li>
          <li>Label AI where the platform or law requires it.</li>
          <li>Do not imply results you did not measure.</li>
          <li>Keep the source of every claim, screenshot and quote.</li>
        </ul>

        <ArticleH2>Where Vidmake fits</ArticleH2>
        <p>
          Vidmake handles the AI opening and the format around it: hook video, talking-head plus demo, text-led video,
          slideshows and carousels, with review before download. Start from the
          <ArticleLink href="/ai-ugc-video-generator">AI UGC video generator</ArticleLink> page. Paid plans start at $29 a month
          with monthly AI credits; see <ArticleLink href="/pricing">pricing</ArticleLink>.
        </p>

        <FaqList items={faqs} />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/guides/product-demo-to-short-video", title: "Product demo to short video", description: "Combine a generated opening with real proof." },
          { href: "/blog/ugc-creator-brief-template", title: "UGC creator brief template", description: "Write the brief before production." },
          { href: "/blog/ai-ugc-video-generator-free-trial", title: "Pre-purchase checklist", description: "Test a generator against a real brief." },
          { href: "/blog/how-to-make-ugc-ads-for-saas", title: "How to make UGC ads for SaaS", description: "A broader how-to for product teams." },
          { href: "/free-hook-lines", title: "Free hook lines", description: "Opening lines you can adapt." },
          { href: "/ai-ugc-video-generator", title: "AI UGC video generator", description: "The Vidmake workflow." },
        ]}
      />
    </VideoMarketingPage>
  );
}
