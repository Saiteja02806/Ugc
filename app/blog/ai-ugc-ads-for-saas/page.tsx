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

const path = "/blog/ai-ugc-ads-for-saas";
const title = "AI UGC Ads for SaaS: A Practical Testing Plan";
const description =
  "How SaaS teams should use AI UGC ads without wasting spend: which creative to generate, what must stay real, how to structure a test, and the metrics that tell you whether the angle worked.";
const datePublished = "2026-11-10";

const faqs = [
  {
    question: "Do AI UGC ads work for SaaS?",
    answer:
      "They can, when the ad explains a real product task and shows genuine footage. AI is most useful for the opening and format variants; the demonstration still needs to be real.",
  },
  {
    question: "How much should a SaaS team spend on a first test?",
    answer:
      "Enough to produce two angles and compare them fairly, not enough to prove the winner in a week. Keep the product footage identical and change one variable at a time.",
  },
  {
    question: "Should I use AI presenters in paid ads?",
    answer:
      "It depends on the platform rules and the claim. AI presenters can explain a concept; they must not be presented as real customers, and any product claim must be demonstrated.",
  },
  {
    question: "What metrics matter for AI UGC ads?",
    answer:
      "Watch completion and click-through before conversion. A cheap view that does not reach the product demonstration is not evidence the angle works.",
  },
  {
    question: "Can I reuse organic videos as ads?",
    answer:
      "Often yes, if the usage rights and the claim still hold. Strip out organic-only context, check caption accuracy, and make sure the destination matches the promise.",
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

export default function AiUgcAdsForSaasPage() {
  return (
    <VideoMarketingPage
      eyebrow="AI UGC ads"
      h1={title}
      lede="The expensive mistake with AI UGC ads is not the avatar quality. It is testing ten variants that all say the same thing. This plan keeps one variable moving at a time."
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          articleJsonLd({ path, headline: title, description, imagePath: `${path}/opengraph-image`, datePublished }),
          faqJsonLd(faqs),
        ],
      }}
    >
      <ArticleBody>
        <ArticleH2>What AI should and should not do in the ad</ArticleH2>
        <div className="overflow-x-auto rounded-[22px] border border-border">
          <table className="w-full min-w-[540px] border-collapse text-left text-sm leading-6">
            <caption className="sr-only">Which parts of a SaaS UGC ad can be generated</caption>
            <thead className="bg-card-muted/60 text-foreground-strong">
              <tr>
                <th scope="col" className="p-4 font-semibold">Element</th>
                <th scope="col" className="p-4 font-semibold">AI</th>
                <th scope="col" className="p-4 font-semibold">Real</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Opening / reaction</th><td className="p-4 align-top">Yes</td><td className="p-4 align-top">Optional</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Presenter explanation</th><td className="p-4 align-top">Yes, labelled where required</td><td className="p-4 align-top">Optional</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Product interface</th><td className="p-4 align-top"><strong>No</strong></td><td className="p-4 align-top">Required</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Customer testimonial</th><td className="p-4 align-top"><strong>No</strong></td><td className="p-4 align-top">Required</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Captions / CTA</th><td className="p-4 align-top">Rendered overlays</td><td className="p-4 align-top">Either</td></tr>
            </tbody>
          </table>
        </div>

        <ArticleH2>Build the test around one angle</ArticleH2>
        <ArticleH3>Name the angle, not the format</ArticleH3>
        <p>
          An angle is a belief about the buyer: &ldquo;they lose decisions after calls&rdquo; or &ldquo;they rebuild the
          same report every week.&rdquo; A format is how you express it. Test angles first; formats second.
        </p>
        <ArticleH3>Keep the demonstration fixed</ArticleH3>
        <p>
          Record one real product task and reuse it across variants. If the demonstration changes between tests, you
          cannot tell whether the angle or the footage moved the result.
        </p>
        <ArticleH3>Change one variable per variant</ArticleH3>
        <ul className="list-disc space-y-2 pl-5">
          <li>Same opening, different problem statement.</li>
          <li>Same problem, different first frame.</li>
          <li>Same edit, different call to action.</li>
        </ul>

        <ArticleH2>A four-variant starter plan</ArticleH2>
        <ol className="list-decimal space-y-3 pl-5">
          <li><strong className="text-foreground-strong">Angle A, hook 1:</strong> pain-first opening.</li>
          <li><strong className="text-foreground-strong">Angle A, hook 2:</strong> result-first opening.</li>
          <li><strong className="text-foreground-strong">Angle B, hook 1:</strong> pain-first opening.</li>
          <li><strong className="text-foreground-strong">Angle B, hook 2:</strong> result-first opening.</li>
        </ol>
        <p>
          Four variants let you separate the angle from the hook without drowning in creative. The
          <ArticleLink href="/blog/problem-solution-video-ad-for-saas">problem-solution structure</ArticleLink> gives each
          variant a consistent skeleton.
        </p>

        <ArticleH2>Where AI saves the most time</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Producing several openings from the same brief.</li>
          <li>Adapting one message to vertical, square and text-led formats.</li>
          <li>Replacing a weak first frame without reshooting the demo.</li>
        </ul>
        <p>
          Where it saves the least: trying to avoid the product recording. That is the part the viewer came for.
        </p>

        <ArticleH2>Metrics in the order they matter</ArticleH2>
        <ol className="list-decimal space-y-3 pl-5">
          <li><strong className="text-foreground-strong">Three-second hold:</strong> did the opening earn attention?</li>
          <li><strong className="text-foreground-strong">Completion:</strong> did they reach the demonstration?</li>
          <li><strong className="text-foreground-strong">Click / sign-up intent:</strong> did the promise match the destination?</li>
          <li><strong className="text-foreground-strong">Cost per qualified action:</strong> the only number that decides scale.</li>
        </ol>

        <ArticleH2>Compliance and trust</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Do not present generated people as customers.</li>
          <li>Label AI where the platform or law requires it.</li>
          <li>Keep claims to what the footage shows.</li>
          <li>Check the ad rules for your market and category.</li>
        </ul>

        <ArticleH2>Where Vidmake fits</ArticleH2>
        <p>
          Vidmake produces the opening and the format around a real demonstration:
          <ArticleLink href="/ai-ugc-video-generator">AI UGC video</ArticleLink>,
          <ArticleLink href="/guides/talking-head-with-saas-demo">talking-head plus demo</ArticleLink>, text on screen and
          <ArticleLink href="/instagram-carousel-maker">carousels</ArticleLink>, reviewed before download. See
          <ArticleLink href="/pricing">pricing</ArticleLink> for the paid plans.
        </p>

        <FaqList items={faqs} />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/blog/problem-solution-video-ad-for-saas", title: "Problem-solution ad structure", description: "A 25-second skeleton for each variant." },
          { href: "/blog/ugc-ads-without-creators", title: "UGC ads without creators", description: "Three production routes." },
          { href: "/blog/ugc-creator-brief-template", title: "UGC creator brief template", description: "Keep every variant on one brief." },
          { href: "/blog/ai-ugc-video-generator-free-trial", title: "Pre-purchase checklist", description: "Test the generator against a real brief." },
          { href: "/blog/ai-ugc-for-tiktok-ads", title: "AI UGC for TikTok ads", description: "The platform-specific variant of this testing plan." },
          { href: "/blog/how-to-make-ugc-ads-for-saas", title: "How to make UGC ads for SaaS", description: "The end-to-end production tutorial." },
          { href: "/ai-ugc-video-generator", title: "AI UGC video generator", description: "The Vidmake workflow." },
          { href: "/pricing", title: "Pricing and plans", description: "Current plan details." },
        ]}
      />
    </VideoMarketingPage>
  );
}
