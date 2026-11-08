import type { Metadata } from "next";

import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import {
  ArticleBody,
  ArticleCommand,
  ArticleH2,
  ArticleH3,
  ArticleLink,
  FaqList,
} from "@/components/marketing/seo-article";
import { articleJsonLd, publicOrigin } from "@/lib/marketing/brand-videos";
import { faqJsonLd } from "@/lib/marketing/mcp-public";

const path = "/blog/ai-ugc-video-generator-free-trial";
const title = "AI UGC Video Generator Free Trial: What to Test Before You Pay";
const description =
  "How to use a free trial of an AI UGC video generator without wasting it: a five-test checklist for prompts, reference media, review, export and cost, plus what Vidmake's seven-day trial includes.";
const datePublished = "2026-11-07";

const faqs = [
  {
    question: "What does Vidmake's free trial include?",
    answer:
      "The trial runs for seven days from onboarding and includes 20 daily content pieces, with no credit card required. Paid plans start at $29 a month (Starter, 200 AI credits a month), $49 (Growth, 600 credits) and $99 (Startup, 1,200 credits).",
  },
  {
    question: "Can I generate a full video during the trial?",
    answer:
      "The trial is designed so you can try the content workflow, including generation and review. Each generation uses the credits required by its model, so check the current plan and credit details before you start a large batch.",
  },
  {
    question: "What should I test first in a free trial?",
    answer:
      "Test the input that matters most to your product: one clear prompt, one genuine reference if your workflow supports it, and one finished asset you actually review before downloading. A narrow test tells you more than ten random generations.",
  },
  {
    question: "Do I need a credit card to start?",
    answer:
      "No card is required for the seven-day trial. Paid plans are a separate, self-serve step you can review on the pricing page before deciding.",
  },
  {
    question: "Is a free trial enough to judge video quality?",
    answer:
      "Only if you test against a real brief. Use a message from your own product, label what you expect to see on screen, and judge the output against that list. A generic prompt produces a generic result and tells you little.",
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

const trialWorksheet = `My product or offer:
One viewer question the video should answer:
The message that must be understandable:
What the viewer should see on screen:
Reference media I want to try (if any):
Output length and format:
What "reviewed and approved" means for this test:
Cost of this test in credits:`;

export default function AiUgcFreeTrialPage() {
  return (
    <VideoMarketingPage
      eyebrow="Free trial checklist"
      h1={title}
      lede="A free trial is only useful if you test a real brief instead of random prompts. Here is the five-part checklist we would run in any AI UGC video generator trial, and exactly what the Vidmake trial includes."
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
          Most people finish a free trial with a folder of unrelated clips and no answer to the only question that
          matters: <strong className="font-semibold text-foreground-strong">can this tool produce an asset I would
          actually publish?</strong> The fix is to treat the trial like a small production test with a pass/fail list,
          not like a demo reel.
        </p>
        <p>
          Vidmake&apos;s trial gives you seven days and 20 daily content pieces with no credit card. That is enough to
          run the checklist below properly. Start with one message, not ten.
        </p>

        <ArticleH2>Copy the trial worksheet first</ArticleH2>
        <p>
          Write the test down before you generate anything. If you cannot fill this in, the prompt is not ready:
        </p>
        <ArticleCommand>{trialWorksheet}</ArticleCommand>

        <ArticleH2>The five tests that matter</ArticleH2>

        <ArticleH3>1. Does a focused prompt change the output?</ArticleH3>
        <p>
          Run the same idea twice: once as a vague request, once naming the audience, the message, the setting and the
          action. Compare the two results. A tool is only controllable if the second prompt visibly changes what you
          get. Related reading: <ArticleLink href="/guides/how-to-create-ugc-videos-with-ai">how to create UGC videos
          with AI</ArticleLink>.
        </p>

        <ArticleH3>2. Can you use a real reference?</ArticleH3>
        <p>
          If you have a reference image or video that matches the shot you want, try it. The test is whether the output
          keeps the direction you supplied instead of drifting into a generic scene. Be honest about what generative
          video can and cannot copy: it can suggest a direction, but it cannot prove a software feature exists.
        </p>

        <ArticleH3>3. Is the result reviewable before you download?</ArticleH3>
        <p>
          A serious workflow has a review step. Check whether you can inspect the finished clip, compare versions and
          keep the one you approve. A trial that only shows a preview loop is not testing your real workflow. See the
          <ArticleLink href="/guides/saas-social-creative-review"> social creative review guide</ArticleLink> for a
          review checklist you can reuse.
        </p>

        <ArticleH3>4. Can the output match your format?</ArticleH3>
        <p>
          Try the format you actually publish: a short hook for a feed, a text-led clip, or a vertical demo. If your
          message needs steps, a carousel may be the better test — the <ArticleLink
          href="/instagram-carousel-maker">Instagram carousel maker</ArticleLink> page covers that workflow.
        </p>

        <ArticleH3>5. Do you understand the cost per test?</ArticleH3>
        <p>
          Before you batch anything, price one test. Every generation uses the credits required by its model, and plan
          limits differ: Starter includes 200 AI credits a month, Growth 600 and Startup 1,200. Read the
          <ArticleLink href="/pricing">pricing page</ArticleLink> for the current numbers, then write down the cost of
          one test so a batch never surprises you.
        </p>

        <ArticleH2>What one test actually costs</ArticleH2>
        <p>
          Price a single test before you batch anything. Credits are charged per second of generated video, and the
          rate depends on the model: 2 credits per second for Google Omni and WAN 3.0, 1 for Kling 3.0, 2 for
          Kling 4.0, and 3 per second for models without a specific rate. Images cost 1 credit each.
        </p>
        <div className="overflow-x-auto rounded-[22px] border border-border">
          <table className="w-full min-w-[520px] border-collapse text-left text-sm leading-6">
            <caption className="sr-only">Approximate monthly output by plan for a six-second video at two credits per second</caption>
            <thead className="bg-card-muted/60 text-foreground-strong">
              <tr>
                <th scope="col" className="p-4 font-semibold">Plan</th>
                <th scope="col" className="p-4 font-semibold">Monthly credits</th>
                <th scope="col" className="p-4 font-semibold">6-second videos at 12 credits each</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">Starter ($29/mo)</th>
                <td className="p-4 align-top">200</td>
                <td className="p-4 align-top">About 16 before images, retries or other models</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">Growth ($49/mo)</th>
                <td className="p-4 align-top">600</td>
                <td className="p-4 align-top">About 50 before images, retries or other models</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">Startup ($99/mo)</th>
                <td className="p-4 align-top">1,200</td>
                <td className="p-4 align-top">About 100 before images, retries or other models</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Two things follow from that table. First, a trial should measure how many attempts a usable clip takes, not
          just whether one clip looks good. Second, choose the model before you plan a batch; the same six seconds can
          cost 6, 12 or 18 credits. Always confirm the current rates on the
          <ArticleLink href="/pricing">pricing page</ArticleLink>, because model pricing can change.
        </p>

        <ArticleH2>A pass/fail scorecard for the whole trial</ArticleH2>
        <div className="overflow-x-auto rounded-[22px] border border-border">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm leading-6">
            <caption className="sr-only">Trial questions, the test to run and the evidence that passes</caption>
            <thead className="bg-card-muted/60 text-foreground-strong">
              <tr>
                <th scope="col" className="p-4 font-semibold">Question</th>
                <th scope="col" className="p-4 font-semibold">Test to run</th>
                <th scope="col" className="p-4 font-semibold">Passes when</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">Is the prompt controllable?</th>
                <td className="p-4 align-top">Same idea, vague vs specific prompt</td>
                <td className="p-4 align-top">The specific prompt visibly changes setting, action and framing</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">Does reference media help?</th>
                <td className="p-4 align-top">One generation with and without the reference</td>
                <td className="p-4 align-top">The reference moves the output toward the intended shot</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">Can I review before export?</th>
                <td className="p-4 align-top">Produce one asset end to end</td>
                <td className="p-4 align-top">You compare versions and keep only the approved file</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">Does it fit my format?</th>
                <td className="p-4 align-top">Run the format you publish most</td>
                <td className="p-4 align-top">Text is readable and the result is usable without re-editing</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">Is the cost predictable?</th>
                <td className="p-4 align-top">Count credits for one finished test</td>
                <td className="p-4 align-top">You can estimate a month of work from real attempts</td>
              </tr>
            </tbody>
          </table>
        </div>

        <ArticleH2>Red flags that should end a trial early</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>No way to inspect the output before it is counted as finished.</li>
          <li>The prompt is ignored in ways you cannot correct with a clearer brief.</li>
          <li>Generated footage invents product screens or claims you never supplied.</li>
          <li>Credit cost is unclear until after a batch runs.</li>
          <li>The tool cannot produce the format you actually publish.</li>
        </ul>

        <ArticleH2>What Vidmake&apos;s trial includes — and what it does not promise</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Seven days from onboarding, no credit card required, with 20 daily content pieces.</li>
          <li>Access to the content workflow: Explore formats, AI Studio generation, review and download.</li>
          <li>Paid plans afterwards at $29 (Starter), $49 (Growth) and $99 (Startup) a month, monthly credits, no long-term contract.</li>
          <li>No promise that generative footage can replace a real product demonstration or a real customer testimonial.</li>
        </ul>
        <p>
          The last point is the one most trials get wrong. Generated footage can make a hook more watchable, but a
          viewer who needs proof of a feature should see a real screen recording. Read
          <ArticleLink href="/guides/product-demo-to-short-video">how to turn a product demo into a short video</ArticleLink>
          before you plan a demo, and keep the demonstration honest.
        </p>

        <ArticleH2>A realistic trial plan for seven days</ArticleH2>
        <ol className="list-decimal space-y-3 pl-5">
          <li><strong className="text-foreground-strong">Day 1:</strong> fill the worksheet, write one focused prompt, generate one result, review it.</li>
          <li><strong className="text-foreground-strong">Day 2:</strong> run the same brief with a reference, compare direction.</li>
          <li><strong className="text-foreground-strong">Day 3:</strong> test the format you publish most (hook, text-led, or carousel).</li>
          <li><strong className="text-foreground-strong">Day 4:</strong> use one message across two formats and note which explains it better.</li>
          <li><strong className="text-foreground-strong">Day 5:</strong> produce one asset end to end, including review and export.</li>
          <li><strong className="text-foreground-strong">Day 6:</strong> calculate the credits used and compare with a paid plan limit.</li>
          <li><strong className="text-foreground-strong">Day 7:</strong> decide from evidence: keep, adjust the brief, or stop.</li>
        </ol>
        <p>
          If you use an AI assistant, the same test can run through the <ArticleLink href="/mcp">Vidmake MCP
          server</ArticleLink>, which exposes 105 public tools for account, generation and library tasks. The
          <ArticleLink href="/docs/mcp-tools">MCP tools reference</ArticleLink> lists each tool and its scope.
        </p>

        <FaqList items={faqs} />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/pricing", title: "Pricing and trial details", description: "Current trial, credit and plan numbers in one place." },
          { href: "/ai-ugc-video-generator", title: "AI UGC video generator", description: "The product workflow this checklist tests." },
          { href: "/guides/how-to-create-ugc-videos-with-ai", title: "Create UGC videos with AI", description: "Brief, generate, review and download with one example." },
          { href: "/blog/ugc-ad-script-templates", title: "UGC ad script templates", description: "Write the message before you test the tool." },
          { href: "/guides/saas-social-creative-review", title: "Review social creative", description: "A checklist for approving a finished asset." },
          { href: "/docs/mcp-tools", title: "MCP tools reference", description: "Every public tool, scope and setup note." },
        ]}
      />
    </VideoMarketingPage>
  );
}
