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

const path = "/blog/founder-story-video-for-saas";
const title = "Founder Story Video for SaaS: Structure That Earns Trust";
const description =
  "How to make a founder story video for a SaaS product: the one-scene structure that works, what to say instead of a timeline, how to use AI when you will not appear on camera, and a review checklist.";
const datePublished = "2026-11-09";

const faqs = [
  {
    question: "What makes a founder story video work?",
    answer:
      "One concrete scene and one belief. Start at the frustration or the moment something broke, not the founding date. A viewer needs to recognise the problem before they care about the company history.",
  },
  {
    question: "How long should a founder story video be?",
    answer:
      "For social, 20–45 seconds is usually enough for one scene and one point. A longer cut belongs on a landing page or a sales follow-up, where the viewer has already chosen to learn more.",
  },
  {
    question: "Can I make a founder story video without appearing on camera?",
    answer:
      "Yes, but be honest about it. You can use a generated or voice-only presenter, text-led video, or product footage with narration. Do not present a generated person as you or as a real customer.",
  },
  {
    question: "Should the founder story include a product demo?",
    answer:
      "Only if the story needs proof at that point. A short story can end on the belief and a next step; if you claim a specific outcome, show the real product doing it.",
  },
  {
    question: "What should the call to action be?",
    answer:
      "One next step that matches the story: try the product, watch the demo, or read the longer version. Do not ask for a purchase immediately after a personal story.",
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

export default function FounderStoryVideoPage() {
  return (
    <VideoMarketingPage
      eyebrow="Founder story"
      h1={title}
      lede="Most founder story videos start too early and say too much. The version that earns trust starts at one frustrating moment, makes a single point, and gives the viewer a reason to keep going."
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          articleJsonLd({ path, headline: title, description, imagePath: `${path}/opengraph-image`, datePublished }),
          faqJsonLd(faqs),
        ],
      }}
    >
      <ArticleBody>
        <ArticleH2>Start at the moment, not the timeline</ArticleH2>
        <p>
          &ldquo;We founded the company in 2023&rdquo; is not a story. &ldquo;I lost the decision from a client call
          because it was buried in three tools&rdquo; is a story. The viewer recognises the situation before they know
          anything about you, which is exactly the order trust works in.
        </p>
        <ArticleH3>The three-part structure</ArticleH3>
        <ol className="list-decimal space-y-3 pl-5">
          <li><strong className="text-foreground-strong">The scene:</strong> one specific moment of friction, in plain language.</li>
          <li><strong className="text-foreground-strong">The belief:</strong> what you concluded should work differently.</li>
          <li><strong className="text-foreground-strong">The invitation:</strong> the next step, matched to the story.</li>
        </ol>
        <p>
          Everything else — team, funding, roadmap — can live on the About page. The video has one job.
        </p>

        <ArticleH2>A 30-second example script</ArticleH2>
        <p>This is an editorial illustration for a fictional project-notes product, not a customer story:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>0–4s:</strong> &ldquo;I finished a client call, closed the laptop, and immediately forgot the one thing I promised.&rdquo;</li>
          <li><strong>4–12s:</strong> &ldquo;The notes were somewhere. The next step was nowhere.&rdquo;</li>
          <li><strong>12–22s:</strong> &ldquo;So we built the smallest possible fix: one place for the decision and the next step, attached to the project.&rdquo;</li>
          <li><strong>22–28s:</strong> &ldquo;Here is what that looks like after a call.&rdquo; (real screen recording)</li>
          <li><strong>28–30s:</strong> &ldquo;Try it with a sample project.&rdquo;</li>
        </ul>
        <p>
          Note what the script does not do: no founding date, no funding announcement, no feature list. The
          <ArticleLink href="/blog/ugc-ad-script-templates">script template breakdown</ArticleLink> covers the broader
          format.
        </p>

        <ArticleH2>Recording it without overproducing</ArticleH2>
        <ArticleH3>If you appear on camera</ArticleH3>
        <p>
          Use a real room and direct address. Do not read the script word for word; learn the beats and say them.
          The <ArticleLink href="/blog/overcoming-founder-camera-anxiety">camera-anxiety guide</ArticleLink> covers the
          practical side. Keep the first line short enough to survive a re-take.
        </p>
        <ArticleH3>If you will not appear on camera</ArticleH3>
        <p>
          Three honest options: a voice-only narration over product footage, a text-led video that tells the scene, or a
          generated presenter that is clearly a presenter, not you. For the third option, keep the identity consistent
          and never imply it is the founder. The <ArticleLink href="/blog/ai-talking-head-video-generator">talking head
          checklist</ArticleLink> covers quality.
        </p>
        <ArticleH3>If you use a generated presenter</ArticleH3>
        <ul className="list-disc space-y-2 pl-5">
          <li>Do not say &ldquo;I founded this&rdquo; in the generated voice unless a real founder is speaking.</li>
          <li>Keep the same presenter across the series; identity drift breaks trust.</li>
          <li>Use real product footage for any claim about the product.</li>
        </ul>

        <ArticleH2>What to leave out</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Multiple scenes and a full biography.</li>
          <li>Unverified metrics or growth claims.</li>
          <li>Customer names without permission.</li>
          <li>Competitor attacks that are not sourced.</li>
          <li>A hard sales close.</li>
        </ul>

        <ArticleH2>Distribution: one recording, several formats</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="text-foreground-strong">30-second social cut</strong> for Reels, TikTok and Shorts.</li>
          <li><strong className="text-foreground-strong">Text-led version</strong> of the same scene for LinkedIn and carousels.</li>
          <li><strong className="text-foreground-strong">Longer page version</strong> with the demo where the story needs proof.</li>
        </ul>
        <p>
          The <ArticleLink href="/guides/talking-head-first-scene">first-scene guide</ArticleLink> and the
          <ArticleLink href="/guides/wall-text-pov-story">text-led POV story guide</ArticleLink> cover the two main
          adaptations.
        </p>

        <ArticleH2>Where Vidmake fits</ArticleH2>
        <p>
          Vidmake supports the formats around the story: <ArticleLink href="/ai-ugc-video-generator">AI UGC video</ArticleLink>,
          <ArticleLink href="/guides/talking-head-with-saas-demo">talking-head plus demo</ArticleLink>, text on screen and
          <ArticleLink href="/instagram-carousel-maker">carousels</ArticleLink>, with review before download. The
          <ArticleLink href="/pricing">pricing page</ArticleLink> lists the current paid plans.
        </p>

        <FaqList items={faqs} />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/blog/overcoming-founder-camera-anxiety", title: "Founder camera anxiety", description: "Make founder content without a studio." },
          { href: "/guides/talking-head-first-scene", title: "First scene", description: "Open with the moment, not the timeline." },
          { href: "/guides/wall-text-pov-story", title: "Text-led POV story", description: "Tell the same scene without a face." },
          { href: "/blog/ugc-ad-script-templates", title: "UGC ad script templates", description: "Structure the words." },
          { href: "/ai-ugc-video-generator", title: "AI UGC video generator", description: "The Vidmake workflow." },
          { href: "/pricing", title: "Pricing and plans", description: "Current plan details." },
        ]}
      />
    </VideoMarketingPage>
  );
}
