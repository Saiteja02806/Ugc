import type { Metadata } from "next";

import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import {
  ArticleBody,
  ArticleCode,
  ArticleCommand,
  ArticleH2,
  ArticleLink,
  ArticlePrompt,
  FaqList,
} from "@/components/marketing/seo-article";
import { articleJsonLd, publicOrigin } from "@/lib/marketing/brand-videos";
import { faqJsonLd } from "@/lib/marketing/mcp-public";

const path = "/blog/ugc-ads-with-claude-mcp";
const title = "How to Make UGC Ads with Claude Using an MCP Server";
const description = "Connect Claude to the UGC Pilot MCP server and create UGC-style ad videos, voiceovers and edits from a chat. Setup, prompts and review tips.";

const faqs = [
  {
    question: "Can Claude make videos on its own?",
    answer: "Not natively. With an MCP server like UGC Pilot connected, Claude can call video, image, speech and editing tools and return the finished files.",
  },
  {
    question: "Do I need an API key to connect Claude to UGC Pilot?",
    answer: "No. The server uses OAuth sign-in. You approve access in your browser, and you shouldn't paste keys or tokens into the chat.",
  },
  {
    question: "Does connecting the MCP server cost extra?",
    answer: "Connecting is included with your UGC Pilot account. Image, video, speech and some finishing work spend credits on your plan.",
  },
  {
    question: "Will UGC Pilot publish my ads?",
    answer: "No. You download the approved file and upload it to your ad account or channels yourself.",
  },
  {
    question: "Does this work with Claude Code or Codex?",
    answer: "Yes. Claude Code can add the HTTP server with one command, and Codex connects through ~/.codex/config.toml with an OAuth login. See /mcp/codex.",
  },
  {
    question: "Why don't I see the UGC Pilot tools in my chat?",
    answer: "Make sure the connector is enabled in that conversation. If you connected it mid-chat, start a new conversation so Claude loads the tool list.",
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

export default function UgcAdsWithClaudeMcpPage() {
  return (
    <VideoMarketingPage
      eyebrow="Claude MCP"
      h1={title}
      lede={
        <>
          Claude is good at writing ad scripts, hooks and briefs. On its own, though, it can&apos;t make the video. The <strong className="font-semibold text-foreground-strong">Model Context Protocol (MCP)</strong> closes that gap: it lets Claude call outside tools, so the same conversation that writes your hook can also generate the clip, add a voiceover and export an edit.
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
          This guide shows how to make UGC-style ads with Claude using the <ArticleLink href="/mcp">UGC Pilot MCP server</ArticleLink>. It covers setup, a working prompt flow, and how to review the output before you use it in an ad.
        </p>

        <ArticleH2>What you need</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>A UGC Pilot account. The seven-day free trial needs no credit card; paid plans start at $19 a month.</li>
          <li>Claude on the web or desktop (or Claude Code).</li>
          <li>
            The hosted server URL: <ArticleCode>https://mcp.getugcpilot.com/mcp</ArticleCode>
          </li>
        </ul>
        <p>The server uses Streamable HTTP and signs in with OAuth (PKCE). You approve access in your browser, so you never paste an API key or token into the chat. Generation uses your account&apos;s plan and credits.</p>

        <ArticleH2>Step 1: Add UGC Pilot as a custom connector in Claude</ArticleH2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            In Claude, open <strong className="font-semibold text-foreground-strong">Customize → Connectors → Add custom connector</strong>.
          </li>
          <li>
            Name it <strong className="font-semibold text-foreground-strong">UGC Pilot</strong> and paste <ArticleCode>https://mcp.getugcpilot.com/mcp</ArticleCode>.
          </li>
          <li>Finish the OAuth sign-in and approve the requested scopes.</li>
          <li>Enable the connector in the conversation before you send a prompt.</li>
        </ol>
        <p>In organizations that require it, an administrator adds the custom connector first. Each person still signs in with their own UGC Pilot account.</p>
        <p>
          <strong className="font-semibold text-foreground-strong">Using Claude Code instead?</strong> Add the server with one command:
        </p>
        <ArticleCommand>claude mcp add --transport http ugc-pilot https://mcp.getugcpilot.com/mcp</ArticleCommand>
        <p>
          Full details are on the <ArticleLink href="/mcp/claude">Claude setup page</ArticleLink>. If your team uses Codex, the <ArticleLink href="/mcp/codex">Codex setup page</ArticleLink> covers the <ArticleCode>~/.codex/config.toml</ArticleCode> route.
        </p>

        <ArticleH2>Step 2: Run a connection check before generating</ArticleH2>
        <p>Before you spend credits, ask Claude to confirm everything is wired up:</p>
        <ArticlePrompt>Use UGC Pilot to check my connection, plan, credits, and available generation options. Do not generate anything yet.</ArticlePrompt>
        <p>
          Claude will call tools such as <ArticleCode>get_profile</ArticleCode>, <ArticleCode>get_entitlements</ArticleCode> and <ArticleCode>get_capabilities</ArticleCode>, then tell you what your plan allows. If a tool is missing, start a new conversation, since an open chat can keep the tool list it saw at the start.
        </p>

        <ArticleH2>Step 3: Write the ad brief with Claude</ArticleH2>
        <p>This is where Claude shines. Give it the product, the audience and the one message. Ask for options:</p>
        <ArticlePrompt>I sell a tool that turns a website into short marketing videos. The audience is solo SaaS founders who don&apos;t want to be on camera. Write 5 UGC-style hooks under 10 words, then a 15-second script for the strongest one. Don&apos;t claim results we can&apos;t prove.</ArticlePrompt>
        <p>
          Pick a hook. Keep the claim honest: no invented numbers, customers or outcomes. UGC Pilot can also pull your saved brand profile with <ArticleCode>get_saas_brand</ArticleCode>, so Claude can keep the tone consistent with your brand.
        </p>
        <p>
          Need hook formats to start from? Ask Claude to browse UGC Pilot&apos;s reference catalogue (<ArticleCode>list_references</ArticleCode>) for hook, wall-of-text and slideshow formats, then remix the text for your product with <ArticleCode>remix_reference_text</ArticleCode>.
        </p>

        <ArticleH2>Step 4: Generate the video</ArticleH2>
        <p>Now ask Claude to make it:</p>
        <ArticlePrompt>Use UGC Pilot to generate a vertical UGC-style video for this script. Show a person talking to a phone camera in a home office. Tell me the credit cost before you start.</ArticlePrompt>
        <p>
          Claude calls <ArticleCode>generate_video</ArticleCode>, then checks progress with <ArticleCode>get_job</ArticleCode> until the file is ready. If you have a product photo or clip you&apos;re allowed to use, upload it first (<ArticleCode>create_upload</ArticleCode>, then <ArticleCode>confirm_upload</ArticleCode>) and ask Claude to use it as a reference.
        </p>
        <p>
          <strong className="font-semibold text-foreground-strong">Showing real product screens?</strong> Register a real screen recording as a demo clip (<ArticleCode>register_demo</ArticleCode>) instead of asking the model to invent UI. The <ArticleLink href="/guides/product-demo-to-short-video">product demo to short video guide</ArticleLink> explains why.
        </p>

        <ArticleH2>Step 5: Add a voiceover and finish the edit</ArticleH2>
        <p>UGC ads usually need a voice. Through the same connector, Claude can:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            List available voices (<ArticleCode>list_audio_voices</ArticleCode>) and generate speech from your script (<ArticleCode>generate_audio</ArticleCode>).
          </li>
          <li>
            Attach that audio to the video (<ArticleCode>import_audio_for_video</ArticleCode>).
          </li>
          <li>
            Open and change an edit draft (<ArticleCode>list_edit_drafts</ArticleCode>, <ArticleCode>update_edit_draft</ArticleCode>), then export it (<ArticleCode>export_edit_draft</ArticleCode>).
          </li>
          <li>
            Run finishing on a video (<ArticleCode>finish_video</ArticleCode>).
          </li>
        </ul>
        <p>
          Every tool, with its description and permission scope, is listed in the <ArticleLink href="/docs/mcp-tools">MCP tools reference</ArticleLink>.
        </p>

        <ArticleH2>Step 6: Review before you run it as an ad</ArticleH2>
        <p>Treat the export as a draft. Before you put money behind it:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-foreground-strong">Watch it on a phone.</strong> Check that text is readable at small sizes (see <ArticleLink href="/guides/readable-video-text">readable video text</ArticleLink>).
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Reject invented details.</strong> Fake product screens, logos, reviews or results don&apos;t belong in an ad.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Check platform rules.</strong> Follow each ad platform&apos;s policy on AI-generated or synthetic media, and label it where required.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Make variants.</strong> Ask Claude for two or three alternate hooks and generate each one so you can test them.
          </li>
        </ul>
        <p>Then download the approved file and upload it to your ad account or channel yourself. UGC Pilot doesn&apos;t post or run ads for you.</p>

        <ArticleH2>A full example prompt flow</ArticleH2>
        <p>Here&apos;s a condensed version you can paste and adapt:</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>&quot;Check my UGC Pilot connection, plan and credits. Don&apos;t generate yet.&quot;</li>
          <li>&quot;Read my brand profile and write 5 hooks for [audience] about [one message].&quot;</li>
          <li>&quot;Generate a 15-second vertical UGC-style video for hook #2. Tell me the credit cost first.&quot;</li>
          <li>&quot;Generate a voiceover in a friendly, casual voice and attach it to the video.&quot;</li>
          <li>&quot;Export the edit and give me the download.&quot;</li>
        </ol>
        <p>
          For more on the general workflow, see <ArticleLink href="/guides/how-to-create-ugc-videos-with-ai">How to create UGC videos with AI</ArticleLink>. For finished output from UGC Pilot&apos;s own channel, see <ArticleLink href="/blog/ugc-video-generator-examples">UGC video generator examples</ArticleLink>.
        </p>

        <ArticleH2>Why use Claude instead of a web editor?</ArticleH2>
        <p>
          Both work. The <ArticleLink href="/ai-ugc-video-generator">AI UGC video generator</ArticleLink> in the browser is faster for a single clip. Claude plus MCP helps when you want to:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Write, generate and revise in one conversation.</li>
          <li>Produce several hook variants in a row without clicking through screens.</li>
          <li>Keep brief, script and output together for your team to review.</li>
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
                  Yes. Claude Code can add the HTTP server with one command, and Codex connects through <ArticleCode>~/.codex/config.toml</ArticleCode> with an OAuth login. See <ArticleLink href="/mcp/codex">/mcp/codex</ArticleLink>.
                </>
              ),
            },
            { question: faqs[5].question, answer: faqs[5].answer },
          ]}
        />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/blog/ai-ugc-video-generator-how-it-works", title: "How an AI UGC video generator works", description: "When a generated clip fits, and where you still need real footage." },
          { href: "/blog/ugc-pilot-vs-hiring-ugc-creators", title: "UGC Pilot vs hiring creators", description: "Cost, speed, and quality, including where a human creator still wins." },
          { href: "/mcp/claude", title: "Connect Claude", description: "Custom connector steps, OAuth, and the hosted server URL." },
          { href: "/mcp/codex", title: "Connect Codex", description: "The config.toml route and OAuth login." },
          { href: "/guides/how-to-create-ugc-videos-with-ai", title: "Create a UGC video", description: "The brief, review, and download steps." },
          { href: "/blog/ugc-video-generator-examples", title: "UGC video examples", description: "Finished output from UGC Pilot's own channel." },
          { href: "/blog/ugc-videos-with-codex-mcp", title: "UGC videos with Codex", description: "Connect the MCP server and make a UGC-style video from the terminal." },
          { href: "/blog/ugc-ad-script-templates", title: "UGC ad script templates", description: "Eight fill-in-the-blank formats with hooks, beats, and timings." },
          { href: "/blog/ai-ugc-for-tiktok-ads", title: "AI UGC for TikTok ads", description: "Briefs, hooks, captions, disclosure, and how to test variants." },
          { href: "/blog/how-to-choose-a-ugc-video-maker", title: "How to choose a UGC video maker", description: "A 10-point checklist for output, editing, voice, pricing, and limits." },
        ]}
      />
    </VideoMarketingPage>
  );
}
