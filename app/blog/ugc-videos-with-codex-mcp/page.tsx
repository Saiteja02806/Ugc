import type { Metadata } from "next";

import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import {
  ArticleBody,
  ArticleCode,
  ArticleCommand,
  ArticleExternalLink,
  ArticleH2,
  ArticleLink,
  ArticlePrompt,
  FaqList,
} from "@/components/marketing/seo-article";
import { articleJsonLd, publicOrigin } from "@/lib/marketing/brand-videos";
import { faqJsonLd } from "@/lib/marketing/mcp-public";

const path = "/blog/ugc-videos-with-codex-mcp";
const title = "How to Make UGC Videos with Codex Using an MCP Server";
const description = "Connect Codex to the UGC Pilot MCP server and generate UGC-style videos, voiceovers and edits from your terminal. Setup, prompts and review steps.";
const datePublished = "2026-10-25";

const faqs = [
  {
    question: "Can Codex generate videos by itself?",
    answer: "No. Codex needs an MCP server with video tools. Once UGC Pilot is connected, Codex can call generation, speech and editing tools and return the files.",
  },
  {
    question: "Do I put an API key in config.toml?",
    answer: "No. Add only the server URL. Sign-in uses OAuth, and tokens should stay out of the file.",
  },
  {
    question: "How many tools does the UGC Pilot MCP server have?",
    answer: "The public tool list has 78 tools. The MCP tools reference at /docs/mcp-tools shows each one with its scope.",
  },
  {
    question: "Does the MCP connection cost extra?",
    answer: "The connection is included with your account. Generating images, video and speech, and some finishing work, spends credits from your plan.",
  },
  {
    question: "Why can't Codex see the UGC Pilot tools?",
    answer: "Check that you finished codex mcp login, then start a new session so the tool list reloads.",
  },
  {
    question: "Does UGC Pilot post my videos?",
    answer: "No. You download the approved file and upload it wherever you want yourself.",
  },
  {
    question: "Where do I start if I've never made a UGC video?",
    answer: "Read how an AI UGC video generator works at /blog/ai-ugc-video-generator-how-it-works and the guide on how to create UGC videos with AI at /guides/how-to-create-ugc-videos-with-ai, then come back to connect Codex.",
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

export default function UgcVideosWithCodexMcpPage() {
  return (
    <VideoMarketingPage
      eyebrow="Codex MCP"
      h1={title}
      lede="Codex is built for working in code: reading a repo, running commands and editing files. It's also a good place to write marketing copy for the product you're building, because it can read your README, landing page and changelog. What it can't do on its own is make a video."
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
          The <strong className="font-semibold text-foreground-strong">Model Context Protocol (MCP)</strong> fixes that. When you connect Codex to the <ArticleLink href="/mcp">UGC Pilot MCP server</ArticleLink>, the same session that reads your codebase can write a hook, generate a UGC-style clip, add a voiceover and export an edit. This guide walks through the setup, a prompt flow that works, and how to review the output before you use it anywhere.
        </p>
        <p>
          If you use Claude instead, see the companion post, <ArticleLink href="/blog/ugc-ads-with-claude-mcp">How to make UGC ads with Claude using an MCP server</ArticleLink>.
        </p>

        <ArticleH2>Why make marketing videos from Codex?</ArticleH2>
        <p>Most founders who ship with Codex already have the best source material for a product video sitting in the repo: what the product does, who it&apos;s for, and what changed this week. Moving that context into a separate video tool means copy-pasting and re-explaining. With MCP, you skip that step:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Codex reads the README or a feature file and drafts a script from real product facts.</li>
          <li>It calls UGC Pilot tools to generate the video and audio.</li>
          <li>You review and approve every file before it leaves your machine.</li>
        </ul>
        <p>
          It&apos;s not a replacement for the browser editor. For a single quick clip, the <ArticleLink href="/ai-ugc-video-generator">AI UGC video generator</ArticleLink> in the web app is faster. Codex helps when you want the script to come straight from your code and docs, or when you want several variants in a row.
        </p>

        <ArticleH2>What you need</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            A UGC Pilot account. The seven-day free trial needs no credit card; paid plans start at $19 a month. See <ArticleLink href="/pricing">pricing</ArticleLink>.
          </li>
          <li>Codex CLI or the Codex IDE extension.</li>
          <li>
            The hosted server URL: <ArticleCode>https://mcp.getugcpilot.com/mcp</ArticleCode>
          </li>
        </ul>
        <p>The server uses Streamable HTTP and OAuth with PKCE. You approve access in a browser window, so no API key or bearer token goes into your config file or your chat.</p>

        <ArticleH2>Step 1: Add the server to Codex</ArticleH2>
        <p>The quickest route is the CLI:</p>
        <ArticleCommand>codex mcp add ugc-pilot --url https://mcp.getugcpilot.com/mcp</ArticleCommand>
        <p>
          Or add it to <ArticleCode>~/.codex/config.toml</ArticleCode> by hand:
        </p>
        <ArticleCommand>{`[mcp_servers.ugc-pilot]
url = "https://mcp.getugcpilot.com/mcp"`}</ArticleCommand>
        <p>Keep tokens out of this file. Sign-in happens through OAuth.</p>

        <ArticleH2>Step 2: Sign in</ArticleH2>
        <p>If Codex doesn&apos;t open the consent screen on its own, run:</p>
        <ArticleCommand>codex mcp login ugc-pilot --scopes account:read,brand:read,assets:read,assets:write,generation:write,jobs:read,creative:write,jobs:write</ArticleCommand>
        <p>
          Approve the scopes in your browser. Full details, including what each scope covers, are on the <ArticleLink href="/mcp/codex">Codex setup page</ArticleLink> and the <ArticleLink href="/connect-ai">connect AI page</ArticleLink>.
        </p>

        <ArticleH2>Step 3: Check the connection before you spend credits</ArticleH2>
        <p>Start a fresh Codex session and ask:</p>
        <ArticlePrompt>Use UGC Pilot to check my connection, plan, credits and available generation options. Don&apos;t generate anything yet.</ArticlePrompt>
        <p>
          Codex should call tools such as <ArticleCode>get_profile</ArticleCode>, <ArticleCode>get_entitlements</ArticleCode> and <ArticleCode>get_capabilities</ArticleCode> and summarise what your plan allows. If the tools don&apos;t show up, start a new session; an open session can keep the tool list it loaded at the start.
        </p>
        <p>
          The public server exposes 78 tools for account reads, images, video, speech, edit drafts and exports. Each one is listed with its permission scope in the <ArticleLink href="/docs/mcp-tools">MCP tools reference</ArticleLink>.
        </p>

        <ArticleH2>Step 4: Write the script from your repo</ArticleH2>
        <p>This is the part where Codex earns its place. Point it at real files:</p>
        <ArticlePrompt>Read README.md and the pricing page source. Write 5 UGC-style hooks under 10 words for solo SaaS founders, then a 15-second script for the strongest one. Only use claims the files support.</ArticlePrompt>
        <p>
          Because Codex is reading your actual product copy, it&apos;s less likely to drift into features you don&apos;t have. Still check every line. If you saved a brand profile in UGC Pilot, ask Codex to read it with <ArticleCode>get_saas_brand</ArticleCode> so the tone matches.
        </p>
        <p>
          Need a starting structure? The post on <ArticleLink href="/blog/ugc-ad-script-templates">UGC ad script templates</ArticleLink> has fill-in-the-blank formats, and the <ArticleLink href="/free-hook-lines">free hook lines</ArticleLink> page has openers to adapt.
        </p>

        <ArticleH2>Step 5: Generate the video</ArticleH2>
        <ArticlePrompt>Use UGC Pilot to generate a vertical UGC-style video for this script: a person talking to a phone camera at a desk. Tell me the credit cost before you start.</ArticlePrompt>
        <p>
          Codex calls <ArticleCode>generate_video</ArticleCode>, then polls <ArticleCode>get_job</ArticleCode> until the file is ready. If you have a product image or clip you&apos;re allowed to use, upload it first with <ArticleCode>create_upload</ArticleCode> and <ArticleCode>confirm_upload</ArticleCode>, then ask Codex to use it as a reference.
        </p>
        <p>
          <strong className="font-semibold text-foreground-strong">Showing your real UI?</strong> Don&apos;t ask a model to invent your app screens. Record the real product and register it as a demo clip with <ArticleCode>register_demo</ArticleCode>. The <ArticleLink href="/guides/product-demo-to-short-video">product demo to short video guide</ArticleLink> explains the workflow.
        </p>

        <ArticleH2>Step 6: Voiceover and edit</ArticleH2>
        <p>Through the same connection, Codex can:</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            List voices with <ArticleCode>list_audio_voices</ArticleCode> and generate speech with <ArticleCode>generate_audio</ArticleCode>.
          </li>
          <li>
            Attach the audio to the video with <ArticleCode>import_audio_for_video</ArticleCode>.
          </li>
          <li>
            Open an edit draft with <ArticleCode>list_edit_drafts</ArticleCode>, change it with <ArticleCode>update_edit_draft</ArticleCode>, and export it with <ArticleCode>export_edit_draft</ArticleCode>.
          </li>
          <li>
            Run finishing with <ArticleCode>finish_video</ArticleCode>.
          </li>
        </ol>
        <p>Ask for two or three hook variants and generate each one, so you have options to compare.</p>

        <ArticleH2>Step 7: Review like an editor, not a developer</ArticleH2>
        <p>Code has tests. Video needs eyes. Before you use any export:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-foreground-strong">Watch it on a phone</strong>, at real size. Check the captions using the <ArticleLink href="/guides/readable-video-text">readable video text guide</ArticleLink>.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Reject anything invented</strong>: fake screens, logos, reviews or results.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Follow platform rules</strong> on AI-generated or synthetic media, and label it where required.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Download and upload it yourself.</strong> UGC Pilot gives you the file; you decide where it goes.
          </li>
        </ul>

        <ArticleH2>A condensed prompt flow you can reuse</ArticleH2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>&quot;Check my UGC Pilot connection, plan and credits. Don&apos;t generate.&quot;</li>
          <li>&quot;Read README.md and write 5 hooks for [audience] about [one feature].&quot;</li>
          <li>&quot;Generate a 15-second vertical UGC-style video for hook #3. Show the credit cost first.&quot;</li>
          <li>&quot;Generate a casual voiceover and attach it.&quot;</li>
          <li>&quot;Export the edit and give me the download link.&quot;</li>
        </ol>
        <p>You can save this as a markdown file in your repo so the whole team runs the same flow.</p>

        <ArticleH2>See what the output looks like</ArticleH2>
        <p>Before you set anything up, it helps to see real clips. These are on UGC Pilot&apos;s own channels:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            YouTube: <ArticleExternalLink href="https://www.youtube.com/watch?v=9bIweHdRdVw">UGC Pilot walkthrough</ArticleExternalLink> and Shorts like <ArticleExternalLink href="https://www.youtube.com/shorts/2P1whMHDqi8">this one</ArticleExternalLink>, with more on the <ArticleExternalLink href="https://www.youtube.com/@Teja.Chundu">@Teja.Chundu channel</ArticleExternalLink>.
          </li>
          <li>
            TikTok: <ArticleExternalLink href="https://www.tiktok.com/@clara_iamm/video/7698738756915907862">example clip</ArticleExternalLink> on <ArticleExternalLink href="https://www.tiktok.com/@clara_iamm">@clara_iamm</ArticleExternalLink>.
          </li>
          <li>
            Instagram: reels on <ArticleExternalLink href="https://www.instagram.com/mira_handles">@mira_handles</ArticleExternalLink> and <ArticleExternalLink href="https://www.instagram.com/clara_iamm">@clara_iamm</ArticleExternalLink>.
          </li>
        </ul>
        <p>
          For build-in-public updates on the MCP server, follow <ArticleExternalLink href="https://x.com/Teja_chundu">@Teja_chundu on X</ArticleExternalLink>. For a curated set of outputs, see <ArticleLink href="/blog/ugc-video-generator-examples">UGC video generator examples</ArticleLink>.
        </p>

        <ArticleH2>Codex vs Claude for UGC videos</ArticleH2>
        <p>Both connect to the same server and the same tools. The difference is where you work:</p>
        <div className="overflow-x-auto rounded-[22px] border border-border">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm leading-6">
            <caption className="sr-only">Codex compared with Claude for UGC videos</caption>
            <thead className="bg-card-muted/60 text-foreground-strong">
              <tr>
                <th scope="col" className="p-4 font-semibold"> </th>
                <th scope="col" className="p-4 font-semibold">Codex</th>
                <th scope="col" className="p-4 font-semibold">Claude</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">Best for</th>
                <td className="p-4 align-top">Scripts drawn from your repo and docs</td>
                <td className="p-4 align-top">Conversational brainstorming and briefs</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">Setup</th>
                <td className="p-4 align-top">
                  <ArticleCode>codex mcp add</ArticleCode> or <ArticleCode>config.toml</ArticleCode>
                </td>
                <td className="p-4 align-top">
                  Custom connector or <ArticleCode>claude mcp add</ArticleCode>
                </td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">Sign-in</th>
                <td className="p-4 align-top">
                  OAuth via <ArticleCode>codex mcp login</ArticleCode>
                </td>
                <td className="p-4 align-top">OAuth in the browser</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Pick whichever you already use daily. See <ArticleLink href="/mcp/claude">/mcp/claude</ArticleLink> for the Claude route.
        </p>

        <FaqList
          items={[
            { question: faqs[0].question, answer: faqs[0].answer },
            { question: faqs[1].question, answer: faqs[1].answer },
            {
              question: faqs[2].question,
              answer: (
                <>
                  The public tool list has 78 tools. The <ArticleLink href="/docs/mcp-tools">MCP tools reference</ArticleLink> shows each one with its scope.
                </>
              ),
            },
            { question: faqs[3].question, answer: faqs[3].answer },
            {
              question: faqs[4].question,
              answer: (
                <>
                  Check that you finished <ArticleCode>codex mcp login</ArticleCode>, then start a new session so the tool list reloads.
                </>
              ),
            },
            { question: faqs[5].question, answer: faqs[5].answer },
            {
              question: faqs[6].question,
              answer: (
                <>
                  Read <ArticleLink href="/blog/ai-ugc-video-generator-how-it-works">how an AI UGC video generator works</ArticleLink> and the guide on <ArticleLink href="/guides/how-to-create-ugc-videos-with-ai">how to create UGC videos with AI</ArticleLink>, then come back to connect Codex.
                </>
              ),
            },
          ]}
        />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/blog/ugc-ads-with-claude-mcp", title: "UGC ads with Claude", description: "Connect the MCP server and make a UGC-style ad from a chat." },
          { href: "/blog/ugc-ad-script-templates", title: "UGC ad script templates", description: "Eight fill-in-the-blank formats with hooks, beats, and timings." },
          { href: "/blog/ai-ugc-video-generator-how-it-works", title: "How an AI UGC video generator works", description: "When a generated clip fits, and where you still need real footage." },
          { href: "/mcp/codex", title: "Connect Codex", description: "The config.toml route and OAuth login." },
          { href: "/docs/mcp-tools", title: "MCP tools reference", description: "Every public tool, with its description and permission scope." },
          { href: "/blog/ugc-video-generator-examples", title: "UGC video examples", description: "Finished output from UGC Pilot's own channel." },
        ]}
      />
    </VideoMarketingPage>
  );
}
