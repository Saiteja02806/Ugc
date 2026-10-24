import type { Metadata } from "next";

import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import { ArticleBody, ArticleCode, ArticleH2, ArticleH3, ArticleLink, FaqList } from "@/components/marketing/seo-article";
import { articleJsonLd, publicOrigin } from "@/lib/marketing/brand-videos";
import { faqJsonLd } from "@/lib/marketing/mcp-public";

const path = "/blog/ai-ugc-video-generator-how-it-works";
const title = "AI UGC Video Generator: How It Works and When to Use One";
const description = "How an AI UGC video generator turns a short brief into creator-style video, when it beats filming, and where you still need real footage.";

const faqs = [
  {
    question: "What is an AI UGC video generator?",
    answer: "It's a tool that turns a written brief, plus optional reference media, into short creator-style video. You review and edit the draft, then download the version you approve.",
  },
  {
    question: "Can I use an AI UGC video generator without being on camera?",
    answer: "Yes. That's one of the main reasons to use one. UGC Pilot also lets you build a reusable AI character so a series keeps the same on-screen presenter.",
  },
  {
    question: "Does UGC Pilot post videos to social media for me?",
    answer: "No. You download the finished file and share it from the channels you already manage.",
  },
  {
    question: "Can I generate UGC videos from Claude or Codex?",
    answer: "Yes. Connect the hosted UGC Pilot MCP server to Claude or Codex, sign in through OAuth, and ask the assistant to generate. It uses your account's plan and credits.",
  },
  {
    question: "Should AI-generated UGC replace real customer testimonials?",
    answer: "No. Use AI for hooks and concept videos. Real customer statements and real product demos should come from real people and real recordings.",
  },
  {
    question: "Is there a free way to try it?",
    answer: "Yes. The seven-day trial needs no credit card and includes two one-time AI Studio credits.",
  },
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

export default function AiUgcVideoGeneratorHowItWorksPage() {
  return (
    <VideoMarketingPage
      eyebrow="AI UGC video generator"
      h1={title}
      lede="User-generated content (UGC) is the style of short video that looks like a real person talking to a phone camera. It feels like a friend recommending something, not a polished ad. For founders and small marketing teams, this style tends to fit social feeds better than a studio spot. The problem is that producing it means finding creators, writing briefs, waiting for footage and doing revisions."
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          articleJsonLd({ path, headline: title, description, imagePath: `${path}/opengraph-image` }),
          faqJsonLd(faqs),
        ],
      }}
    >
      <ArticleBody>
        <p>
          An <strong className="font-semibold text-foreground-strong">AI UGC video generator</strong> shortens that loop. You describe the audience and the message, and the tool produces creator-style footage you can review, edit and download. This article explains how the process works, when it makes sense, and where it doesn&apos;t, using <ArticleLink href="/ai-ugc-video-generator">UGC Pilot&apos;s AI UGC video generator</ArticleLink> as the working example.
        </p>

        <ArticleH2>What an AI UGC video generator actually does</ArticleH2>
        <p>At its simplest, an AI UGC video generator takes three inputs:</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li><strong className="font-semibold text-foreground-strong">A brief.</strong> Who the video is for and the one thing they should understand.</li>
          <li><strong className="font-semibold text-foreground-strong">Optional reference media.</strong> An image or video that sets the visual context, such as a product photo or a short screen recording you&apos;re allowed to use.</li>
          <li><strong className="font-semibold text-foreground-strong">Generation settings.</strong> The model, format and length you choose.</li>
        </ol>
        <p>It then returns a short video in a native, creator-style format. In UGC Pilot that happens in <strong className="font-semibold text-foreground-strong">AI Studio</strong>, where you create custom images and videos with the models and settings you pick. Paid plans include monthly credits for this, and the free trial includes two one-time AI Studio credits so you can test it before paying.</p>
        <p>The result isn&apos;t the end of the process. A good workflow treats the generated file as a draft. You watch it, reject anything that&apos;s wrong, edit text and framing, and download only the version you approve.</p>

        <ArticleH2>How the workflow runs, step by step</ArticleH2>
        <p>
          UGC Pilot&apos;s own guide, <ArticleLink href="/guides/how-to-create-ugc-videos-with-ai">How to create UGC videos with AI</ArticleLink>, breaks it into five steps. Here&apos;s the short version.
        </p>
        <ArticleH3>1. Name one audience and one message</ArticleH3>
        <p>Write who the video is for and the single point they should take away. Leave out product claims you can&apos;t show. A brief like &quot;Solo SaaS founders who hate editing video: you can get a short demo-style clip without filming&quot; works better than a list of five features.</p>
        <ArticleH3>2. Open the generator</ArticleH3>
        <p>
          Use AI Studio from the <ArticleLink href="/ai-ugc-video-generator">AI UGC video generator page</ArticleLink>. If you work inside an AI assistant, you can instead connect <ArticleLink href="/mcp/claude">Claude</ArticleLink> or <ArticleLink href="/mcp/codex">Codex</ArticleLink> to the UGC Pilot MCP server and ask it to generate for you (more on that below).
        </p>
        <ArticleH3>3. Add a reference only when you have one</ArticleH3>
        <p>A compatible image or video reference can steer the look. Skip it if you don&apos;t have media you&apos;re allowed to use. Never feed in someone else&apos;s footage or a competitor&apos;s branding.</p>
        <ArticleH3>4. Generate, then review</ArticleH3>
        <p>
          Watch the whole file. Reject footage that invents a product screen, a logo or a customer outcome. If you need to prove a feature, a real screen recording has to carry that proof. UGC Pilot&apos;s <ArticleLink href="/guides/product-demo-to-short-video">product demo to short video guide</ArticleLink> covers that case.
        </p>
        <ArticleH3>5. Edit and download the version you approve</ArticleH3>
        <p>
          UGC Pilot includes video editing and export, so you can adjust the draft before downloading it. Check the text on a phone screen (the <ArticleLink href="/guides/readable-video-text">readable video text guide</ArticleLink> helps here), then share the file from the channels you already manage.
        </p>

        <ArticleH2>Beyond a single clip: speech, edits and references</ArticleH2>
        <p>A useful AI UGC video tool does more than generate one clip. In UGC Pilot the same account also handles:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="font-semibold text-foreground-strong">Speech and audio.</strong> Generate a voiceover and attach it to a video.</li>
          <li><strong className="font-semibold text-foreground-strong">Edit drafts and exports.</strong> Open a draft, change it, then export a finished version.</li>
          <li><strong className="font-semibold text-foreground-strong">Reference and remix.</strong> Browse hook, wall-of-text and slideshow reference formats and remix the text for your own brand.</li>
          <li><strong className="font-semibold text-foreground-strong">Library.</strong> Keep finished carousels, slideshows and videos in one place.</li>
          <li><strong className="font-semibold text-foreground-strong">AI characters.</strong> Build a reusable on-screen creator for your brand so a series looks consistent.</li>
        </ul>
        <p>
          You can see real output from UGC Pilot&apos;s own brand series in <ArticleLink href="/blog/ugc-video-generator-examples">UGC video generator examples</ArticleLink> and the <ArticleLink href="/case-studies/ai-ugc-video-generator-saas-founders">founder video case study</ArticleLink>.
        </p>

        <ArticleH2>Using an AI UGC video generator from Claude or Codex</ArticleH2>
        <p>
          UGC Pilot runs a hosted MCP (Model Context Protocol) server at <ArticleCode>https://mcp.getugcpilot.com/mcp</ArticleCode>. MCP lets an AI assistant call outside tools on your behalf. Once it&apos;s connected, you can ask Claude or Codex something like &quot;make a 15-second UGC-style clip for this landing page&quot; and the assistant calls UGC Pilot&apos;s tools to do it.
        </p>
        <p>
          The server signs in through OAuth, so you approve access in your browser and never paste an API key into a chat. Generation uses your own UGC Pilot plan and credits. The full list of tools, with names, descriptions and permission scopes, is on the <ArticleLink href="/docs/mcp-tools">MCP tools reference</ArticleLink>. Setup guides:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li><ArticleLink href="/mcp">UGC Pilot MCP server overview</ArticleLink></li>
          <li><ArticleLink href="/mcp/claude">Connect Claude</ArticleLink> with a custom connector</li>
          <li><ArticleLink href="/mcp/codex">Connect Codex</ArticleLink> through <ArticleCode>~/.codex/config.toml</ArticleCode></li>
        </ul>

        <ArticleH2>When an AI UGC video generator is the right choice</ArticleH2>
        <p>AI generation fits best when:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="font-semibold text-foreground-strong">You need volume and variety.</strong> Testing several hooks or angles for one product is faster when each variant is a prompt, not a new shoot.</li>
          <li><strong className="font-semibold text-foreground-strong">You&apos;re a small team or solo founder.</strong> If nobody on the team wants to be on camera, an AI character can carry a consistent series.</li>
          <li><strong className="font-semibold text-foreground-strong">Speed matters more than perfection.</strong> You can go from a brief to a reviewable draft in one sitting.</li>
          <li><strong className="font-semibold text-foreground-strong">You&apos;re explaining a concept, not proving a feature.</strong> Hooks, problem statements and &quot;why this matters&quot; videos suit generated footage.</li>
        </ul>

        <ArticleH2>When you still need real footage or real creators</ArticleH2>
        <p>Be honest about the limits:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="font-semibold text-foreground-strong">Feature proof.</strong> If a viewer needs to see your actual product working, use a real screen recording. Generated footage shouldn&apos;t invent UI.</li>
          <li><strong className="font-semibold text-foreground-strong">Testimonials.</strong> A real customer&apos;s words belong to a real customer. Don&apos;t generate fake reviews or outcomes.</li>
          <li><strong className="font-semibold text-foreground-strong">Physical products in hand.</strong> A creator using your product on camera can show texture, scale and use in a way generated footage may not match.</li>
          <li><strong className="font-semibold text-foreground-strong">Platform and ad rules.</strong> Check each platform&apos;s policy on AI-generated content and label it where required.</li>
        </ul>
        <p>
          Many teams mix both: AI for hooks and concept videos, real recordings for demos and proof. Our comparison, <ArticleLink href="/blog/ugc-pilot-vs-hiring-ugc-creators">UGC Pilot vs hiring UGC creators</ArticleLink>, goes deeper on that trade-off.
        </p>

        <ArticleH2>What it costs to try</ArticleH2>
        <p>
          UGC Pilot has a seven-day free trial with no credit card required. It includes daily content concepts and two one-time AI Studio credits. Paid plans start at $19 a month (Starter, 200 credits a month) and $49 a month (Growth, 600 credits a month), with yearly billing at $190 and $490. See the <ArticleLink href="/pricing">pricing page</ArticleLink> for current details.
        </p>

        <FaqList
          items={[
            { question: faqs[0].question, answer: faqs[0].answer },
            { question: faqs[1].question, answer: faqs[1].answer },
            { question: faqs[2].question, answer: faqs[2].answer },
            {
              question: faqs[3].question,
              answer: (
                <>
                  Yes. Connect the hosted UGC Pilot MCP server to <ArticleLink href="/mcp/claude">Claude</ArticleLink> or <ArticleLink href="/mcp/codex">Codex</ArticleLink>, sign in through OAuth, and ask the assistant to generate. It uses your account&apos;s plan and credits.
                </>
              ),
            },
            { question: faqs[4].question, answer: faqs[4].answer },
            { question: faqs[5].question, answer: faqs[5].answer },
          ]}
        />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/blog/ugc-ads-with-claude-mcp", title: "UGC ads with Claude", description: "Connect the MCP server and make a UGC-style ad from a chat." },
          { href: "/blog/ugc-pilot-vs-hiring-ugc-creators", title: "UGC Pilot vs hiring creators", description: "Cost, speed, and quality, including where a human creator still wins." },
          { href: "/guides/how-to-create-ugc-videos-with-ai", title: "Create a UGC video", description: "The five-step brief, review, and download guide." },
          { href: "/ai-ugc-video-generator", title: "AI UGC video generator", description: "Make a short video from a prompt and optional reference media." },
          { href: "/blog/ugc-video-generator-examples", title: "UGC video examples", description: "Real output from UGC Pilot's own brand series." },
          { href: "/mcp", title: "MCP server", description: "Generate from Claude or Codex with OAuth." },
        ]}
      />
    </VideoMarketingPage>
  );
}
