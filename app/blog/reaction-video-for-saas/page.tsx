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

const path = "/blog/reaction-video-for-saas";
const title = "Reaction Video for SaaS: Turn a First Look into a Hook";
const description =
  "How to use a reaction opening for a SaaS video: choose the emotion, keep it truthful, time the cut to the product, and avoid the fake-surprise trap. Includes hook timing and a review list.";
const datePublished = "2026-11-09";

const faqs = [
  {
    question: "What is a reaction video hook?",
    answer:
      "A short opening where a person reacts — surprised, amused, frustrated, relieved — to a situation the product addresses. It buys attention for the demonstration that follows.",
  },
  {
    question: "Do reaction hooks work for B2B SaaS?",
    answer:
      "They can, when the reaction matches a real moment in the buyer's day. A forced surprised face about a spreadsheet is less believable than a quiet, tired reaction to a repeated manual task.",
  },
  {
    question: "Can I generate the reaction instead of filming it?",
    answer:
      "Yes. A generated presenter can carry the reaction, but it must not pretend to be a real customer and the product proof must still be a real recording.",
  },
  {
    question: "How long should the reaction last?",
    answer:
      "Two to four seconds is usually enough before the product enters. If the reaction runs longer than the information it introduces, the viewer leaves before the payoff.",
  },
  {
    question: "Will a reaction hook fix a weak product demo?",
    answer:
      "No. A hook buys a few seconds of attention; the demonstration has to keep it. If the product footage is unreadable or the claim is vague, the reaction only delays the drop-off.",
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

export default function ReactionVideoForSaasPage() {
  return (
    <VideoMarketingPage
      eyebrow="Reaction hooks"
      h1={title}
      lede="A reaction is not a substitute for a story. It is a two-second promise that something worth watching is about to happen. Here is how to make that promise honest and pay it off."
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          articleJsonLd({ path, headline: title, description, imagePath: `${path}/opengraph-image`, datePublished }),
          faqJsonLd(faqs),
        ],
      }}
    >
      <ArticleBody>
        <ArticleH2>Pick the emotion the situation actually has</ArticleH2>
        <div className="overflow-x-auto rounded-[22px] border border-border">
          <table className="w-full min-w-[540px] border-collapse text-left text-sm leading-6">
            <caption className="sr-only">Reaction types and the SaaS situations that support them</caption>
            <thead className="bg-card-muted/60 text-foreground-strong">
              <tr>
                <th scope="col" className="p-4 font-semibold">Reaction</th>
                <th scope="col" className="p-4 font-semibold">Honest situation</th>
                <th scope="col" className="p-4 font-semibold">Avoid when</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Frustration</th><td className="p-4 align-top">A repeated manual task</td><td className="p-4 align-top">The product is not clearly faster</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Surprise</th><td className="p-4 align-top">A result that genuinely changes the workflow</td><td className="p-4 align-top">The feature is standard in the category</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Relief</th><td className="p-4 align-top">A task that used to take hours</td><td className="p-4 align-top">You cannot show the before and after</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Confusion</th><td className="p-4 align-top">A genuinely messy existing process</td><td className="p-4 align-top">It mocks the viewer</td></tr>
            </tbody>
          </table>
        </div>

        <ArticleH2>Build the four-beat hook</ArticleH2>
        <ol className="list-decimal space-y-3 pl-5">
          <li><strong className="text-foreground-strong">Situation (0–1s):</strong> the viewer recognises the context.</li>
          <li><strong className="text-foreground-strong">Reaction (1–3s):</strong> one clear emotion, no overacting.</li>
          <li><strong className="text-foreground-strong">Turn (3–5s):</strong> the product enters and the promise is specific.</li>
          <li><strong className="text-foreground-strong">Proof (5s+):</strong> the real screen recording pays it off.</li>
        </ol>
        <p>
          If the proof does not arrive by the fifth second, the hook has already spent its credit. The
          <ArticleLink href="/blog/problem-solution-video-ad-for-saas">problem-solution structure</ArticleLink> covers the
          full ad.
        </p>

        <ArticleH2>Make it believable</ArticleH2>
        <ArticleH3>Match the reaction to the stakes</ArticleH3>
        <p>
          Enterprise procurement is not a scream-at-the-camera problem. A quiet, tired reaction often fits B2B better
          than a loud one. Watch the clip muted: if the face still reads, the reaction works.
        </p>
        <ArticleH3>Keep the cut motivated</ArticleH3>
        <p>
          The product should appear because the reaction demands an answer, not because the timer ran out. A cut that
          feels arbitrary reads as an ad.
        </p>
        <ArticleH3>Do not fake customer reactions</ArticleH3>
        <p>
          A generated person can react to a scenario. They must not be presented as a customer reacting to your product.
          That distinction is the whole trust contract of UGC.
        </p>

        <ArticleH2>Generated versus recorded reactions</ArticleH2>
        <div className="overflow-x-auto rounded-[22px] border border-border">
          <table className="w-full min-w-[520px] border-collapse text-left text-sm leading-6">
            <caption className="sr-only">Generated and recorded reaction openings compared</caption>
            <thead className="bg-card-muted/60 text-foreground-strong">
              <tr>
                <th scope="col" className="p-4 font-semibold">Decision</th>
                <th scope="col" className="p-4 font-semibold">Generated</th>
                <th scope="col" className="p-4 font-semibold">Recorded</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Speed</th><td className="p-4 align-top">Fast variants</td><td className="p-4 align-top">Needs a person and a take</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Identity risk</th><td className="p-4 align-top">Must stay consistent and labelled</td><td className="p-4 align-top">Real person, real consent</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Trust signal</th><td className="p-4 align-top">Weaker for testimonials</td><td className="p-4 align-top">Stronger for lived experience</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Best use</th><td className="p-4 align-top">Scenario and hook testing</td><td className="p-4 align-top">Customer and founder stories</td></tr>
            </tbody>
          </table>
        </div>

        <ArticleH2>Review checklist</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Does the reaction match a real moment for this audience?</li>
          <li>Is the product visible and honest by the fifth second?</li>
          <li>Is the generated person clearly not a real customer?</li>
          <li>Does the proof show the claimed action and result?</li>
          <li>Would the hook still make sense muted?</li>
          <li>Is the result held long enough to read?</li>
        </ul>

        <ArticleH2>Where Vidmake fits</ArticleH2>
        <p>
          Vidmake&apos;s Hook video workflow is built around a short reaction opening followed by your product content.
          See the <ArticleLink href="/ai-ugc-video-generator">AI UGC video generator</ArticleLink> page and the
          <ArticleLink href="/guides/hook-video-with-real-app-demo">hook plus real app demo guide</ArticleLink>. The
          <ArticleLink href="/free-hook-lines">hook line library</ArticleLink> supplies openings by feeling.
        </p>

        <FaqList items={faqs} />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/guides/hook-video-with-real-app-demo", title: "Hook video with a real app demo", description: "Connect the reaction to product proof." },
          { href: "/guides/hook-demo-framing-pair", title: "Hook and demo framing", description: "Keep both shots visually consistent." },
          { href: "/blog/problem-solution-video-ad-for-saas", title: "Problem-solution ad", description: "The full 25-second structure." },
          { href: "/free-hook-lines", title: "Free hook lines", description: "Opening lines by feeling." },
          { href: "/ai-ugc-video-generator", title: "AI UGC video generator", description: "The Vidmake workflow." },
          { href: "/pricing", title: "Pricing and plans", description: "Current plan details." },
        ]}
      />
    </VideoMarketingPage>
  );
}
