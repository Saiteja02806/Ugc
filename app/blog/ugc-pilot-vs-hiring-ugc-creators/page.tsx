import type { Metadata } from "next";

import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import { ArticleBody, ArticleCode, ArticleH2, ArticleH3, ArticleLink, FaqList } from "@/components/marketing/seo-article";
import { articleJsonLd, publicOrigin } from "@/lib/marketing/brand-videos";
import { faqJsonLd } from "@/lib/marketing/mcp-public";

const path = "/blog/ugc-pilot-vs-hiring-ugc-creators";
const title = "UGC Pilot vs Hiring UGC Creators: Cost, Speed and Quality";
const description = "A fair look at AI UGC video vs hiring creators: real costs, turnaround, quality trade-offs and when to use each, or both.";

const faqs = [
  {
    question: "Is UGC Pilot a full replacement for UGC creators?",
    answer: "Not for every case. It's a strong alternative for hooks, concept videos and fast testing. Real testimonials and hands-on physical product videos still need real people.",
  },
  {
    question: "How much does UGC Pilot cost compared with a creator?",
    answer: "UGC Pilot has a seven-day free trial, then plans at $19 or $49 a month with monthly credits. Creator rates vary widely by creator and usage rights, so get quotes for your own brief.",
  },
  {
    question: "Can I use AI UGC videos in paid ads?",
    answer: "Often yes, but check each ad platform's policy on AI-generated content and label it where required. Never present generated footage as a real customer's review.",
  },
  {
    question: "Does UGC Pilot publish or schedule videos?",
    answer: "No. You download the approved file and upload it to your channels or ad account yourself.",
  },
  {
    question: "Can I make AI UGC videos from Claude or Codex?",
    answer: "Yes. Connect the UGC Pilot MCP server through Claude or Codex and ask the assistant to generate.",
  },
] as const;

const comparisonRows = [
  ["Cost model", "Per video or per package, set by each creator; usage rights may cost extra", "Subscription with credits: free trial, then $19 or $49 a month"],
  ["Turnaround", "Depends on finding a creator, shipping product, filming and revisions", "A draft in one sitting, once your brief is ready"],
  ["Authenticity", "A real person with a real experience", "Generated footage; can't stand in for a real customer"],
  ["Physical products", "Strong: can show the product in hand", "Weaker: real use is hard to fake honestly"],
  ["Variants for testing", "Each new take means more creator time", "Each variant is a new prompt and credits"],
  ["Control", "Shared with the creator", "You write the brief and approve every file"],
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

export default function UgcPilotVsHiringCreatorsPage() {
  return (
    <VideoMarketingPage
      eyebrow="Comparison"
      h1={title}
      lede={
        <>
          If you need UGC-style videos for your product, you have two broad options. You can hire human UGC creators, or you can use an AI tool such as <ArticleLink href="/ai-ugc-video-generator">UGC Pilot</ArticleLink> to generate creator-style video yourself.
        </>
      }
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
          Neither is always better. This guide compares them on cost, speed, quality and control, and it&apos;s honest about where human creators still win. We won&apos;t quote prices for creators or marketplaces, because rates vary a lot by creator, niche and usage rights. Get real quotes for your own case.
        </p>

        <ArticleH2>Quick summary</ArticleH2>
        <div className="overflow-x-auto rounded-[22px] border border-border">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm leading-6">
            <caption className="sr-only">Hiring UGC creators compared with UGC Pilot</caption>
            <thead className="bg-card-muted/60 text-foreground-strong">
              <tr>
                <th scope="col" className="p-4 font-semibold"> </th>
                <th scope="col" className="p-4 font-semibold">Hiring UGC creators</th>
                <th scope="col" className="p-4 font-semibold">UGC Pilot (AI)</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map(([label, hiring, pilot]) => (
                <tr key={label} className="border-t border-border">
                  <th scope="row" className="p-4 font-semibold text-foreground-strong">{label}</th>
                  <td className="p-4 align-top">{hiring}</td>
                  <td className="p-4 align-top">{pilot}</td>
                </tr>
              ))}
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">Works from AI assistants</th>
                <td className="p-4 align-top">No</td>
                <td className="p-4 align-top">
                  Yes, through the <ArticleLink href="/mcp">MCP server</ArticleLink> for Claude and Codex
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <ArticleH2>Cost</ArticleH2>
        <ArticleH3>Hiring creators</ArticleH3>
        <p>
          Creators set their own rates. Prices usually depend on video length, the number of hooks or variants, raw footage, revisions, and especially <strong className="font-semibold text-foreground-strong">usage rights</strong>: whether you can run the video as a paid ad, and for how long. You may also pay for product shipping and for a platform or agency fee if you find creators through one. Since this varies so much, ask several creators for quotes with the same brief.
        </p>
        <ArticleH3>UGC Pilot</ArticleH3>
        <p>UGC Pilot&apos;s pricing comes from its public plans:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="font-semibold text-foreground-strong">Free trial:</strong> seven days, no credit card, daily content concepts and two one-time AI Studio credits.</li>
          <li><strong className="font-semibold text-foreground-strong">Starter:</strong> $19 a month or $190 a year, with 200 credits a month.</li>
          <li><strong className="font-semibold text-foreground-strong">Growth:</strong> $49 a month or $490 a year, with 600 credits a month and more daily concepts.</li>
        </ul>
        <p>
          Credits are spent on AI Studio images and video, AI characters, speech and some finishing work. Video editing and export are included. The <ArticleLink href="/mcp">MCP connection</ArticleLink> itself is included with the account. Check the <ArticleLink href="/pricing">pricing page</ArticleLink> for current details.
        </p>
        <p>
          <strong className="font-semibold text-foreground-strong">The fair takeaway:</strong> AI is cheaper when you need many variants or a steady flow of concept videos. A single, high-stakes video featuring a real person may still be worth paying a creator for.
        </p>

        <ArticleH2>Speed</ArticleH2>
        <p>Hiring creators involves steps you can&apos;t skip. You find and vet creators, agree on a brief and rights, possibly ship product, wait for filming, then go through revisions. Good creators can be quick, but you&apos;re working to someone else&apos;s calendar.</p>
        <p>
          With UGC Pilot, the bottleneck is your brief. You write the audience and message, generate in <ArticleLink href="/ai-ugc-video-generator">AI Studio</ArticleLink> or from <ArticleLink href="/mcp/claude">Claude</ArticleLink> or <ArticleLink href="/mcp/codex">Codex</ArticleLink>, review the result, edit and download. If a hook doesn&apos;t land, you write a new one and generate again.
        </p>
        <p>
          Speed matters most when you&apos;re <strong className="font-semibold text-foreground-strong">testing</strong>. Comparing five hooks is a much bigger ask from a creator than from a prompt.
        </p>

        <ArticleH2>Quality</ArticleH2>
        <p>This is where you need to be careful.</p>
        <ArticleH3>Where human creators win</ArticleH3>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="font-semibold text-foreground-strong">Real experience.</strong> A creator who has actually used your product can speak to it credibly. AI can&apos;t have an experience.</li>
          <li><strong className="font-semibold text-foreground-strong">Testimonials.</strong> Customer statements must come from real customers. Never generate fake reviews or results.</li>
          <li><strong className="font-semibold text-foreground-strong">Physical products.</strong> Texture, size and real use in someone&apos;s hands are hard to show honestly with generated footage.</li>
          <li><strong className="font-semibold text-foreground-strong">Personality and audience.</strong> Some creators bring their own following and style that viewers trust.</li>
        </ul>
        <ArticleH3>Where AI does well</ArticleH3>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="font-semibold text-foreground-strong">Hooks and concept videos.</strong> Problem statements, &quot;here&apos;s why this matters&quot; and simple explainers suit generated creator-style footage.</li>
          <li><strong className="font-semibold text-foreground-strong">Consistency.</strong> UGC Pilot lets you build a reusable AI character, so a series keeps the same presenter.</li>
          <li><strong className="font-semibold text-foreground-strong">Formats.</strong> UGC Pilot&apos;s reference catalogue includes hook, wall-of-text and slideshow formats you can remix for your brand.</li>
          <li><strong className="font-semibold text-foreground-strong">Polish on your terms.</strong> You can add speech, edit drafts and export finished versions yourself.</li>
        </ul>
        <ArticleH3>Quality rules for AI UGC</ArticleH3>
        <p>
          Treat every generated file as a draft. Reject footage that invents product screens, logos or customer outcomes. When you need to prove a feature, use a real screen recording (<ArticleLink href="/guides/product-demo-to-short-video">see this guide</ArticleLink>). Check text on a phone (<ArticleLink href="/guides/readable-video-text">readable video text</ArticleLink>). Follow platform rules for AI-generated content.
        </p>
        <p>
          To judge quality yourself, look at real output from UGC Pilot&apos;s brand series in <ArticleLink href="/blog/ugc-video-generator-examples">UGC video generator examples</ArticleLink> and the <ArticleLink href="/case-studies/ai-ugc-video-generator-saas-founders">founder case study</ArticleLink>.
        </p>

        <ArticleH2>Control and workflow</ArticleH2>
        <p>With creators, you share creative control. That can be a strength, since good creators know what works on their platforms, but it means briefs, feedback rounds and contracts.</p>
        <p>
          With UGC Pilot, you control the brief and approve every file before download. If you already work in an AI assistant, the hosted MCP server at <ArticleCode>https://mcp.getugcpilot.com/mcp</ArticleCode> lets Claude or Codex write the script, generate the video, add a voiceover and export the edit in one conversation. Sign-in uses OAuth, and the <ArticleLink href="/docs/mcp-tools">MCP tools reference</ArticleLink> lists every tool. For a walkthrough, see <ArticleLink href="/blog/ugc-ads-with-claude-mcp">How to make UGC ads with Claude</ArticleLink>.
        </p>
        <p>One thing to be clear about: UGC Pilot doesn&apos;t post for you. You download the finished file and share it from the channels or ad accounts you already manage, just as you would with a file a creator sends you.</p>

        <ArticleH2>When to choose each</ArticleH2>
        <p><strong className="font-semibold text-foreground-strong">Choose UGC Pilot when:</strong></p>
        <ul className="list-disc space-y-2 pl-5">
          <li>You&apos;re a solo founder or small team without a budget for many creators.</li>
          <li>You need lots of hook or angle variants to test.</li>
          <li>Your product is software, and real screen recordings can carry the feature proof.</li>
          <li>Nobody on the team wants to be on camera.</li>
        </ul>
        <p><strong className="font-semibold text-foreground-strong">Hire creators when:</strong></p>
        <ul className="list-disc space-y-2 pl-5">
          <li>You need a real person&apos;s genuine experience or testimonial.</li>
          <li>You sell a physical product that has to be shown in use.</li>
          <li>You want a creator&apos;s own audience and credibility.</li>
        </ul>
        <p><strong className="font-semibold text-foreground-strong">Use both when:</strong></p>
        <ul className="list-disc space-y-2 pl-5">
          <li>You want to test many hooks cheaply with AI, then brief a creator on the winning angle.</li>
          <li>You pair AI concept videos with creator-filmed proof.</li>
        </ul>

        <FaqList
          items={[
            { question: faqs[0].question, answer: faqs[0].answer },
            { question: faqs[1].question, answer: faqs[1].answer },
            { question: faqs[2].question, answer: faqs[2].answer },
            { question: faqs[3].question, answer: faqs[3].answer },
            {
              question: faqs[4].question,
              answer: (
                <>
                  Yes. Connect the UGC Pilot MCP server through <ArticleLink href="/mcp/claude">Claude</ArticleLink> or <ArticleLink href="/mcp/codex">Codex</ArticleLink> and ask the assistant to generate.
                </>
              ),
            },
          ]}
        />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/blog/ai-ugc-video-generator-how-it-works", title: "How an AI UGC video generator works", description: "When a generated clip fits, and where you still need real footage." },
          { href: "/blog/ugc-ads-with-claude-mcp", title: "UGC ads with Claude", description: "Connect the MCP server and make a UGC-style ad from a chat." },
          { href: "/ai-ugc-video-generator", title: "AI UGC video generator", description: "Generate creator-style video from a brief." },
          { href: "/blog/ugc-video-generator-examples", title: "UGC video examples", description: "Real output from UGC Pilot's brand series." },
          { href: "/pricing", title: "Pricing", description: "Current trial and paid plan details." },
          { href: "/mcp", title: "MCP server", description: "Use Claude or Codex with your UGC Pilot account." },
        ]}
      />
    </VideoMarketingPage>
  );
}
