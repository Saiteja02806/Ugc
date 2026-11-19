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

const path = "/blog/problem-solution-video-ad-for-saas";
const title = "Problem-Solution Video Ad for SaaS: A 25-Second Structure";
const description =
  "A practical problem-solution ad template for SaaS: name the pain in one line, show the turn, prove it with real product footage, and close with one next step. Includes a script and review checklist.";
const datePublished = "2026-11-09";

const faqs = [
  {
    question: "What is a problem-solution video ad?",
    answer:
      "A short ad that states a specific problem the viewer recognises, shows the product changing that situation, and ends with one next step. It works because it matches how buyers already describe the issue.",
  },
  {
    question: "How long should the problem section be?",
    answer:
      "One or two sentences. The problem earns attention; it should not become the whole ad. If the viewer cannot state the problem in their own words after the first line, it is too abstract.",
  },
  {
    question: "Should the solution be AI-generated or real?",
    answer:
      "The product solution should be real footage. Generate the problem scene or the presenter if it helps, but show the actual product performing the action you claim.",
  },
  {
    question: "Can I use one problem-solution ad for every channel?",
    answer:
      "The structure travels, but the length and the first frame do not. A feed video needs the problem in the first two seconds; a landing-page version can spend more time on context.",
  },
  {
    question: "How do I test the angle without wasting budget?",
    answer:
      "Keep the product footage the same and change one variable at a time: the problem line or the opening frame. If you change both, you will not know what caused the difference.",
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

export default function ProblemSolutionVideoAdPage() {
  return (
    <VideoMarketingPage
      eyebrow="Problem-solution ads"
      h1={title}
      lede="A problem-solution ad is not a feature list with a complaint in front of it. It is one situation, one turn, and one visible result. This is the 25-second structure we would use for a SaaS product."
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          articleJsonLd({ path, headline: title, description, imagePath: `${path}/opengraph-image`, datePublished }),
          faqJsonLd(faqs),
        ],
      }}
    >
      <ArticleBody>
        <ArticleH2>The structure at a glance</ArticleH2>
        <div className="overflow-x-auto rounded-[22px] border border-border">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm leading-6">
            <caption className="sr-only">A 25-second problem-solution ad structure for SaaS</caption>
            <thead className="bg-card-muted/60 text-foreground-strong">
              <tr>
                <th scope="col" className="p-4 font-semibold">Beat</th>
                <th scope="col" className="p-4 font-semibold">Time</th>
                <th scope="col" className="p-4 font-semibold">What the viewer sees</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Problem</th><td className="p-4 align-top">0–3s</td><td className="p-4 align-top">A recognisable situation, said plainly</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Turn</th><td className="p-4 align-top">3–7s</td><td className="p-4 align-top">The product enters; the promise is specific</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Proof</th><td className="p-4 align-top">7–20s</td><td className="p-4 align-top">Real screen recording of the task and the result</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Close</th><td className="p-4 align-top">20–25s</td><td className="p-4 align-top">One next step the viewer can take</td></tr>
            </tbody>
          </table>
        </div>

        <ArticleH2>Write the problem like a customer</ArticleH2>
        <ArticleH3>Use their words</ArticleH3>
        <p>
          Collect the exact phrasing from support tickets, sales calls and reviews. &ldquo;I cannot find the decision
          from last week&rsquo;s call&rdquo; is stronger than &ldquo;knowledge management is fragmented.&rdquo; The
          <ArticleLink href="/guides/customer-question-to-demo-video">customer-question guide</ArticleLink> shows how to
          turn one ticket into the opening.
        </p>
        <ArticleH3>Do not explain the category</ArticleH3>
        <p>
          Viewers do not need to understand your market segment before they understand their own afternoon. Name the
          moment, not the industry.
        </p>

        <ArticleH2>The turn has to be specific</ArticleH2>
        <p>
          &ldquo;Work smarter&rdquo; is not a turn. &ldquo;The decision and the next step sit on the project page&rdquo;
          is a turn, because the next shot can show it. If the promise cannot be filmed, rewrite it.
        </p>

        <ArticleH2>Proof is where most ads lose</ArticleH2>
        <ArticleH3>Use real footage</ArticleH3>
        <p>
          Record the actual task. Keep the starting screen, the control used and the result readable on a phone. The
          <ArticleLink href="/guides/screen-recording-for-app-demo">recording guide</ArticleLink> covers capture and
          privacy.
        </p>
        <ArticleH3>Hold on the result</ArticleH3>
        <p>
          The viewer needs a moment to see what changed. A cut that leaves the outcome on screen for half a second
          undoes the proof. The <ArticleLink href="/guides/product-demo-to-short-video">editing guide</ArticleLink> covers
          the hold and the handoff.
        </p>
        <ArticleH3>Do not fake the interface</ArticleH3>
        <p>
          Generated footage can invent buttons and labels. The
          <ArticleLink href="/blog/ai-product-demo-video-generator">product demo generator article</ArticleLink> explains
          the boundary.
        </p>

        <ArticleH2>An illustrative 25-second script</ArticleH2>
        <p>Fictional product, for structure only:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>0–3s:</strong> &ldquo;You finished the call. Where did the next step go?&rdquo;</li>
          <li><strong>3–7s:</strong> &ldquo;Open the project and choose Call notes.&rdquo;</li>
          <li><strong>7–16s:</strong> &ldquo;Select the call. The decisions and next steps are on the same page.&rdquo; (recording holds on the result)</li>
          <li><strong>16–21s:</strong> &ldquo;No separate doc, no searching chat history.&rdquo;</li>
          <li><strong>21–25s:</strong> &ldquo;Try it with a sample project.&rdquo;</li>
        </ul>
        <p>
          Use the <ArticleLink href="/guides/saas-demo-video-script">SaaS demo script worksheet</ArticleLink> to keep each
          line paired with a visible screen state.
        </p>

        <ArticleH2>Review checklist</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Is the problem stated in the viewer&rsquo;s words within three seconds?</li>
          <li>Can the promise be seen in the footage?</li>
          <li>Is the result held long enough to inspect?</li>
          <li>Are sensitive details removed?</li>
          <li>Do captions match the audio?</li>
          <li>Is there exactly one next step?</li>
        </ul>

        <ArticleH2>Where Vidmake fits</ArticleH2>
        <p>
          Vidmake can generate the opening and host the format around a real demonstration:
          <ArticleLink href="/ai-ugc-video-generator">AI UGC video</ArticleLink>,
          <ArticleLink href="/guides/wall-of-text-video-for-saas">text on screen</ArticleLink> and
          <ArticleLink href="/guides/talking-head-with-saas-demo">talking-head plus demo</ArticleLink>, reviewed before
          download. See <ArticleLink href="/pricing">pricing</ArticleLink> for the current paid plans.
        </p>

        <FaqList items={faqs} />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/blog/ugc-ads-without-creators", title: "UGC ads without creators", description: "Three production routes and their trade-offs." },
          { href: "/guides/customer-question-to-demo-video", title: "Customer question to demo", description: "Turn a ticket into the opening." },
          { href: "/guides/saas-demo-video-script", title: "SaaS demo script template", description: "Pair words with screen evidence." },
          { href: "/blog/ai-product-demo-video-generator", title: "AI product demo generator", description: "Where generated footage stops." },
          { href: "/ai-ugc-video-generator", title: "AI UGC video generator", description: "The Vidmake workflow." },
          { href: "/pricing", title: "Pricing and plans", description: "Current plan details." },
        ]}
      />
    </VideoMarketingPage>
  );
}
