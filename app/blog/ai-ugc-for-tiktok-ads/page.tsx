import type { Metadata } from "next";

import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import {
  ArticleBody,
  ArticleExternalLink,
  ArticleH2,
  ArticleLink,
  FaqList,
} from "@/components/marketing/seo-article";
import { articleJsonLd, publicOrigin } from "@/lib/marketing/brand-videos";
import { faqJsonLd } from "@/lib/marketing/mcp-public";

const path = "/blog/ai-ugc-for-tiktok-ads";
const title = "AI UGC for TikTok Ads: A Practical Guide for Small Teams";
const description = "How to make AI UGC videos for TikTok ads: briefs, hooks, vertical format, captions, AI disclosure and testing variants, with real examples.";
const datePublished = "2026-10-25";

const faqs = [
  {
    question: "Can I use AI UGC videos in TikTok ads?",
    answer: "Generally yes, as long as you follow TikTok's current ad and AI-generated content policies, label synthetic media where required, and don't make false claims.",
  },
  {
    question: "What format should AI UGC for TikTok be?",
    answer: "Vertical 9:16, short, with a spoken hook in the first seconds and large captions kept clear of the app's interface.",
  },
  {
    question: "Do AI UGC videos look real enough for TikTok?",
    answer: "Quality varies by model and prompt. Review every draft, regenerate weak ones, and only use videos you'd be comfortable posting as your brand.",
  },
  {
    question: "Can AI UGC replace TikTok creators?",
    answer: "Not for everything. Real testimonials and product-in-hand content are better from real people. AI UGC is useful for hook tests, explainers and app demos.",
  },
  {
    question: "Does UGC Pilot upload ads to TikTok for me?",
    answer: "No. You download the approved file and upload it to TikTok Ads Manager yourself.",
  },
  {
    question: "How much does it cost to make AI UGC with UGC Pilot?",
    answer: "There's a seven-day free trial with no card, then plans at $19 or $49 a month with monthly credits. See /pricing.",
  },
] as const;

const variantRows = [
  ["A vs B", "Hook line"],
  ["C vs D", "Character and setting"],
  ["E vs F", "Script format (POV vs objection)"],
] as const;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: path },
  openGraph: {
    type: "article",
    url: new URL(path, publicOrigin).href,
    siteName: "UGC Pilot",
    title,
    description,
  },
  twitter: { card: "summary_large_image", title, description },
};

export default function AiUgcForTikTokAdsPage() {
  return (
    <VideoMarketingPage
      eyebrow="TikTok ads"
      h1={title}
      lede="TikTok rewards videos that look like they belong on TikTok. Polished studio ads often feel out of place in the feed, while a person talking straight to a phone camera feels native. That's why UGC-style creative is so common in TikTok advertising."
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          articleJsonLd({ path, headline: title, description, imagePath: `${path}/opengraph-image`, datePublished }),
          faqJsonLd(faqs),
        ],
      }}
    >
      <ArticleBody>
        <p>The catch is production. Finding creators, shipping product, waiting for footage and asking for revisions takes time, and testing several hooks multiplies the work. <strong className="font-semibold text-foreground-strong">AI UGC</strong> gives small teams another option: generate creator-style drafts from a brief, review them, and keep only the ones that are honest and good.</p>
        <p>
          This guide covers how to make AI UGC for TikTok ads, step by step, using <ArticleLink href="/ai-ugc-video-generator">UGC Pilot</ArticleLink> as the example tool. It also covers where AI UGC is the wrong choice.
        </p>

        <ArticleH2>What makes a TikTok ad feel native</ArticleH2>
        <p>You don&apos;t need data to see the pattern; scroll your own For You page for ten minutes. Ads that blend in tend to share a few traits:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-foreground-strong">Vertical, full-screen framing</strong> (9:16).
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">A face or a hand in the first second</strong>, not a logo.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">A spoken hook</strong> that names the viewer&apos;s situation.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Burned-in captions</strong>, because many people watch with the sound low.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">One idea</strong>, not a feature list.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Casual lighting and setting</strong>: a desk, a kitchen, a car.
          </li>
        </ul>
        <p>An AI UGC tool should produce exactly this kind of footage. If the output looks like a TV commercial, change the prompt.</p>

        <ArticleH2>Step 1: Write a TikTok-specific brief</ArticleH2>
        <p>A brief for TikTok is short. Write:</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-foreground-strong">Viewer:</strong> &quot;Etsy sellers who hate making product videos.&quot;
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Situation:</strong> what they&apos;re doing when they see your ad.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">One message:</strong> &quot;You can get a product video draft without filming.&quot;
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Proof you can show:</strong> a real product shot, a real screen recording, or a price.
          </li>
        </ol>
        <p>Leave out claims you can&apos;t back up. TikTok ads, like all ads, should not promise results you haven&apos;t measured.</p>

        <ArticleH2>Step 2: Pick a script format</ArticleH2>
        <p>
          Strong formats for TikTok include POV scenes, &quot;things I wish I knew&quot;, objection busters and question-plus-demo. All eight formats, with timings and filled examples, are in <ArticleLink href="/blog/ugc-ad-script-templates">UGC ad script templates</ArticleLink>.
        </p>
        <p>
          Write at least five hooks per script. The hook is the part you&apos;ll test most. The <ArticleLink href="/free-hook-lines">free hook lines</ArticleLink> page is a quick starting list. <ArticleLink href="/blog/ugc-hooks">UGC hooks that stop the scroll</ArticleLink> groups 20 of them by type and explains why each one works.
        </p>

        <ArticleH2>Step 3: Generate the video</ArticleH2>
        <p>In UGC Pilot&apos;s AI Studio:</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Paste the script as your brief and describe the scene: &quot;A woman in her 20s talks to her phone camera in a bright kitchen, casual, handheld feel.&quot;</li>
          <li>Choose a vertical format and a short length.</li>
          <li>Add a reference image or clip if you have one you&apos;re allowed to use, such as your product photo.</li>
          <li>Generate, watch, and regenerate anything that looks wrong.</li>
        </ol>
        <p>
          Prefer working from a chat? Connect Claude or Codex to the <ArticleLink href="/mcp">UGC Pilot MCP server</ArticleLink> and ask for the video in plain language. The <ArticleLink href="/blog/ugc-ads-with-claude-mcp">Claude guide</ArticleLink> and the <ArticleLink href="/blog/ugc-videos-with-codex-mcp">Codex guide</ArticleLink> show the full flow, including how to see the credit cost before generating.
        </p>

        <ArticleH2>Step 4: Voice, captions and edit</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-foreground-strong">Voiceover:</strong> generate speech from the script and attach it to the video. Pick a voice that matches the character on screen.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Captions:</strong> keep them large, high-contrast and away from the bottom area where TikTok&apos;s interface sits. The <ArticleLink href="/guides/readable-video-text">readable video text guide</ArticleLink> covers sizing.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Pacing:</strong> cut dead air. On TikTok, a pause in the first two seconds usually loses people.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">End card:</strong> a short spoken or on-screen CTA is enough.
          </li>
        </ul>
        <p>
          Video editing and export are included in UGC Pilot&apos;s plans; generation spends credits. Details are on the <ArticleLink href="/pricing">pricing page</ArticleLink>.
        </p>

        <ArticleH2>Step 5: Disclose AI content and follow ad policies</ArticleH2>
        <p>TikTok has rules for AI-generated content, and they can change. Before you run an AI UGC ad:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Read TikTok&apos;s current advertising and AI-generated content policies.</li>
          <li>Label synthetic media where the platform requires it.</li>
          <li>Never present an AI character as a real customer giving a testimonial.</li>
          <li>Don&apos;t use real people&apos;s likeness, voices, logos or brands without permission.</li>
        </ul>
        <p>Honest AI creative is safer for your account and better for trust.</p>

        <ArticleH2>Step 6: Test variants, then iterate</ArticleH2>
        <p>AI UGC shines here. Instead of one expensive video, you can make several drafts that differ in one thing at a time:</p>
        <div className="overflow-x-auto rounded-[22px] border border-border">
          <table className="w-full min-w-[420px] border-collapse text-left text-sm leading-6">
            <caption className="sr-only">Variant tests for TikTok ads</caption>
            <thead className="bg-card-muted/60 text-foreground-strong">
              <tr>
                <th scope="col" className="p-4 font-semibold">Variant</th>
                <th scope="col" className="p-4 font-semibold">What changes</th>
              </tr>
            </thead>
            <tbody>
              {variantRows.map(([variant, change]) => (
                <tr key={variant} className="border-t border-border">
                  <th scope="row" className="p-4 font-semibold text-foreground-strong">{variant}</th>
                  <td className="p-4 align-top">{change}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>Upload the approved files to TikTok Ads Manager yourself and let your own results tell you what works. Change one variable per round so you know what caused the difference.</p>

        <ArticleH2>When AI UGC is the wrong choice for TikTok</ArticleH2>
        <p>Be honest with yourself about these cases:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-foreground-strong">Physical products that must be used on camera.</strong> A real person unboxing, applying or wearing the product is hard to fake honestly. Hire a creator.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Testimonials.</strong> A testimonial must come from a real customer.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Highly regulated categories.</strong> Health, finance and similar areas have strict claim rules; get advice first.
          </li>
        </ul>
        <p>
          Many teams mix both: human creators for testimonials and product-in-hand shots, AI UGC for hook tests, explainers and app demos. See <ArticleLink href="/blog/ugc-pilot-vs-hiring-ugc-creators">UGC Pilot vs hiring UGC creators</ArticleLink> for a fair comparison.
        </p>

        <ArticleH2>Real AI UGC examples on TikTok and beyond</ArticleH2>
        <p>These are videos made with UGC Pilot, posted on its own accounts:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            TikTok: <ArticleExternalLink href="https://www.tiktok.com/@clara_iamm/video/7698738756915907862">example 1</ArticleExternalLink>, <ArticleExternalLink href="https://www.tiktok.com/@clara_iamm/video/7699988037559700758">example 2</ArticleExternalLink>, <ArticleExternalLink href="https://www.tiktok.com/@clara_iamm/video/7699923510092631318">example 3</ArticleExternalLink> and <ArticleExternalLink href="https://www.tiktok.com/@clara_iamm/video/7699105939034574102">example 4</ArticleExternalLink> on <ArticleExternalLink href="https://www.tiktok.com/@clara_iamm">@clara_iamm</ArticleExternalLink>, plus <ArticleExternalLink href="https://www.tiktok.com/@clara_iami/video/7698234106957548814">this clip</ArticleExternalLink> on @clara_iami.
          </li>
          <li>
            Instagram Reels: <ArticleExternalLink href="https://www.instagram.com/clara_iamm">@clara_iamm</ArticleExternalLink> and <ArticleExternalLink href="https://www.instagram.com/mira_handles">@mira_handles</ArticleExternalLink>, for example <ArticleExternalLink href="https://www.instagram.com/reel/De1snSfiDeK/">reel 1</ArticleExternalLink> and <ArticleExternalLink href="https://www.instagram.com/reel/DeueoA-FcIT/">reel 2</ArticleExternalLink>.
          </li>
          <li>
            YouTube Shorts: <ArticleExternalLink href="https://www.youtube.com/shorts/2P1whMHDqi8">this Short</ArticleExternalLink> on <ArticleExternalLink href="https://www.youtube.com/@Teja.Chundu">@Teja.Chundu</ArticleExternalLink>.
          </li>
        </ul>
        <p>
          The founder shares what&apos;s being built on <ArticleExternalLink href="https://x.com/Teja_chundu">X (@Teja_chundu)</ArticleExternalLink>. More curated outputs are in <ArticleLink href="/blog/ugc-video-generator-examples">UGC video generator examples</ArticleLink>.
        </p>

        <ArticleH2>A one-week workflow for a small team</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-foreground-strong">Day 1:</strong> write the brief and pick two script formats.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Day 2:</strong> write ten hooks; keep the best six.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Day 3:</strong> generate six drafts; reject anything off-brand or dishonest.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Day 4:</strong> add voice, captions and edits; export.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Day 5:</strong> upload to TikTok Ads Manager yourself and launch a small test.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Following week:</strong> keep the winning hook and test new characters or formats around it.
          </li>
        </ul>
        <p>
          New to AI UGC? Start with <ArticleLink href="/blog/ai-ugc-video-generator-how-it-works">how an AI UGC video generator works</ArticleLink>.
        </p>

        <FaqList
          items={[
            { question: faqs[0].question, answer: faqs[0].answer },
            { question: faqs[1].question, answer: faqs[1].answer },
            { question: faqs[2].question, answer: faqs[2].answer },
            { question: faqs[3].question, answer: faqs[3].answer },
            { question: faqs[4].question, answer: faqs[4].answer },
            {
              question: faqs[5].question,
              answer: (
                <>
                  There&apos;s a seven-day free trial with no card, then plans at $19 or $49 a month with monthly credits. See <ArticleLink href="/pricing">pricing</ArticleLink>.
                </>
              ),
            },
          ]}
        />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/blog/ugc-hooks", title: "UGC hooks that stop the scroll", description: "20 real hook lines by type, and how to turn one into a video." },
          { href: "/blog/ugc-ad-script-templates", title: "UGC ad script templates", description: "Eight fill-in-the-blank formats with hooks, beats, and timings." },
          { href: "/blog/ai-ugc-video-generator-how-it-works", title: "How an AI UGC video generator works", description: "When a generated clip fits, and where you still need real footage." },
          { href: "/blog/ugc-pilot-vs-hiring-ugc-creators", title: "UGC Pilot vs hiring creators", description: "Cost, speed, and quality, including where a human creator still wins." },
          { href: "/blog/ugc-video-generator-examples", title: "UGC video examples", description: "Finished output from UGC Pilot's own channel." },
          { href: "/ai-ugc-video-generator", title: "AI UGC video generator", description: "Make a short video from a prompt and optional reference media." },
          { href: "/pricing", title: "Pricing", description: "Current trial and paid plan details." },
        ]}
      />
    </VideoMarketingPage>
  );
}
