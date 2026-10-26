import type { Metadata } from "next";
import type { ReactNode } from "react";

import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import {
  ArticleBody,
  ArticleExternalLink,
  ArticleH2,
  ArticleLink,
  ArticlePrompt,
  FaqList,
} from "@/components/marketing/seo-article";
import { articleJsonLd, publicOrigin } from "@/lib/marketing/brand-videos";
import { faqJsonLd } from "@/lib/marketing/mcp-public";

const path = "/blog/ugc-ad-script-templates";
const title = "UGC Ad Script Templates: 8 Fill-in-the-Blank Formats That Work";
const description = "Eight UGC ad script templates with hooks, beats and timings you can copy, plus how to turn each one into an AI UGC video with UGC Pilot.";
const datePublished = "2026-10-25";

const faqs = [
  {
    question: "What is a UGC ad script?",
    answer: "A short script, usually 15 to 60 seconds, written to sound like a real person talking to a phone camera rather than a polished commercial.",
  },
  {
    question: "How long should a UGC ad script be?",
    answer: "For short-form vertical video, 40 to 70 spoken words is a practical range for 15 to 30 seconds. Shorter is usually easier to keep tight.",
  },
  {
    question: "Can I use these templates with AI-generated video?",
    answer: "Yes. Scene, POV, listicle, objection and demo templates fit AI UGC well. Avoid presenting AI footage as a real customer testimonial or as the real founder.",
  },
  {
    question: "Can Claude or Codex write the script and make the video?",
    answer: "Yes, with the UGC Pilot MCP server connected. They can write hooks, generate the video and voiceover, and export the edit for your review.",
  },
  {
    question: "Does UGC Pilot publish the ad for me?",
    answer: "No. You download the approved video and upload it to your ad account or channel yourself.",
  },
  {
    question: "Should I hire creators instead?",
    answer: "Sometimes. For physical products and real testimonials, human creators are often the better choice. See /blog/ugc-pilot-vs-hiring-ugc-creators.",
  },
] as const;

function ScriptTable({ caption, headers, rows }: { caption: string; headers: readonly string[]; rows: readonly (readonly ReactNode[])[] }) {
  return (
    <div className="overflow-x-auto rounded-[22px] border border-border">
      <table className="w-full min-w-[520px] border-collapse text-left text-sm leading-6">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-card-muted/60 text-foreground-strong">
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col" className="p-4 font-semibold">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row[0])} className="border-t border-border">
              {row.map((cell, index) => (
                index === 0
                  ? <th key={`${row[0]}-${index}`} scope="row" className="p-4 font-semibold text-foreground-strong">{cell}</th>
                  : <td key={`${row[0]}-${index}`} className="p-4 align-top">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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

export default function UgcAdScriptTemplatesPage() {
  return (
    <VideoMarketingPage
      eyebrow="Script templates"
      h1={title}
      lede="Most UGC-style videos fail before anyone presses record. The script is vague, the hook is slow, or the video tries to say five things at once. A template fixes that by forcing one audience, one message and a clear order of beats."
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
          Below are eight <strong className="font-semibold text-foreground-strong">UGC ad script templates</strong> you can copy. Each has a hook, the beats in order, a rough timing for a 15 to 30 second vertical video, and a filled-in example for a made-up SaaS product. At the end, you&apos;ll see how to turn any of them into a video with <ArticleLink href="/ai-ugc-video-generator">UGC Pilot&apos;s AI UGC video generator</ArticleLink> or from a chat with Claude or Codex.
        </p>
        <p>The examples are illustrations, not real customer stories. When you fill them in, use only claims you can prove.</p>

        <ArticleH2>Before you pick a template</ArticleH2>
        <p>Write two lines first:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-foreground-strong">Audience:</strong> who exactly is watching? (&quot;Solo founders who hate editing video.&quot;)
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">One message:</strong> what should they believe after 20 seconds? (&quot;You can make a product video without filming.&quot;)
          </li>
        </ul>
        <p>
          If you can&apos;t write those two lines, no template will save the script. UGC Pilot&apos;s guide on <ArticleLink href="/guides/how-to-create-ugc-videos-with-ai">how to create UGC videos with AI</ArticleLink> covers this step in more detail.
        </p>

        <ArticleH2>1. Problem → Agitate → Fix</ArticleH2>
        <p>
          <strong className="font-semibold text-foreground-strong">Best for:</strong> products that remove an obvious pain.
        </p>
        <ScriptTable
          caption="Problem, agitate, fix script beats"
          headers={["Beat", "Time", "Line"]}
          rows={[
            ["Hook", "0–3s", "\"If you still [painful task], stop scrolling.\""],
            ["Agitate", "3–8s", "\"It takes [real cost: time, effort] and [consequence].\""],
            ["Fix", "8–20s", "\"I use [product] to [what it does], and [visible result].\""],
            ["CTA", "20–25s", "\"Try it free at [site].\""],
          ]}
        />
        <p>
          <em>Example:</em> &quot;If you still edit product videos by hand, stop scrolling. It eats your whole Sunday. I paste my site into a tool and get a draft video to review instead.&quot;
        </p>

        <ArticleH2>2. &quot;Things I wish I knew&quot;</ArticleH2>
        <p>
          <strong className="font-semibold text-foreground-strong">Best for:</strong> founders, educators, anyone with real experience.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Hook (0–3s): &quot;[Number] things I wish I knew before [milestone].&quot;</li>
          <li>Point 1, 2, 3 (3–20s): one sentence each, the last one naturally involves your product.</li>
          <li>CTA (20–25s): &quot;Follow for more&quot; or &quot;Link in bio.&quot;</li>
        </ul>
        <p>
          Keep each point to one line on screen. Check text size with the <ArticleLink href="/guides/readable-video-text">readable video text guide</ArticleLink>.
        </p>

        <ArticleH2>3. Before / After</ArticleH2>
        <p>
          <strong className="font-semibold text-foreground-strong">Best for:</strong> anything with a visible transformation.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Hook: &quot;This was my [thing] before.&quot; (show it)</li>
          <li>Turn: &quot;Then I tried [product].&quot;</li>
          <li>After: show the result. Don&apos;t fake it; if you can&apos;t show a real result, use a different template.</li>
          <li>CTA.</li>
        </ul>
        <p>
          For software, record the real screens and use them as a demo clip rather than letting a model invent UI. See <ArticleLink href="/guides/product-demo-to-short-video">product demo to short video</ArticleLink>.
        </p>

        <ArticleH2>4. &quot;POV&quot; scene</ArticleH2>
        <p>
          <strong className="font-semibold text-foreground-strong">Best for:</strong> relatable, lightweight brand awareness.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>On-screen text: &quot;POV: you [relatable situation].&quot;</li>
          <li>Creator reacts, then reveals the product as the way out.</li>
          <li>Short CTA or none.</li>
        </ul>
        <p>This works well as AI UGC because it&apos;s a scene, not a testimonial. Nobody is claiming they personally used the product for six months.</p>

        <ArticleH2>5. Objection buster</ArticleH2>
        <p>
          <strong className="font-semibold text-foreground-strong">Best for:</strong> retargeting people who already know you.
        </p>
        <ScriptTable
          caption="Objection buster script beats"
          headers={["Beat", "Line"]}
          rows={[
            ["Hook", "\"'[Common objection]?' Fair. Here's the truth.\""],
            ["Answer", "One honest sentence that addresses it."],
            ["Proof", "Something checkable: a demo, a price, a feature on screen."],
            ["CTA", "\"See for yourself, it's free to try.\""],
          ]}
        />
        <p>
          <em>Example:</em> &quot;&apos;AI videos look fake?&apos; Fair. That&apos;s why you review every draft and only download the ones you&apos;d actually post.&quot;
        </p>

        <ArticleH2>6. Listicle / &quot;3 tools I use&quot;</ArticleH2>
        <p>
          <strong className="font-semibold text-foreground-strong">Best for:</strong> tutorials and roundups.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Hook: &quot;3 tools I use to [outcome] without [pain].&quot;</li>
          <li>Tool 1, Tool 2, Tool 3 (your product in the list, honestly described).</li>
          <li>CTA.</li>
        </ul>
        <p>Being fair to the other tools makes the whole video more credible.</p>

        <ArticleH2>7. Founder story</ArticleH2>
        <p>
          <strong className="font-semibold text-foreground-strong">Best for:</strong> early-stage products; personal accounts.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Hook: &quot;I built [product] because [real frustration].&quot;</li>
          <li>What it does in one line.</li>
          <li>Who it&apos;s for.</li>
          <li>CTA.</li>
        </ul>
        <p>This one should be true. If you&apos;re using AI footage, don&apos;t present an AI character as the real founder. Use your own face, a voiceover over product screens, or a scene-style template instead.</p>

        <ArticleH2>8. Question hook + quick demo</ArticleH2>
        <p>
          <strong className="font-semibold text-foreground-strong">Best for:</strong> feature launches.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Hook: &quot;Did you know you can [surprising capability]?&quot;</li>
          <li>Demo (5–15s): show it happening.</li>
          <li>CTA.</li>
        </ul>
        <p>
          <em>Example:</em> &quot;Did you know Claude can make a video now? Here&apos;s a UGC-style ad generated from one chat.&quot; The <ArticleLink href="/blog/ugc-ads-with-claude-mcp">Claude MCP guide</ArticleLink> shows how that demo is made.
        </p>

        <ArticleH2>Hooks: where most scripts win or lose</ArticleH2>
        <p>
          The first three seconds decide whether anyone hears the rest. Write five hooks per script and keep the best. Good hooks are short (under 10 words), specific and about the viewer, not you. UGC Pilot&apos;s <ArticleLink href="/free-hook-lines">free hook lines</ArticleLink> page has a list to adapt, and the <ArticleLink href="/blog/ugc-video-generator-examples">UGC video generator examples</ArticleLink> post shows hooks in finished videos. <ArticleLink href="/blog/ugc-hooks">UGC hooks that stop the scroll</ArticleLink> groups 20 real lines by type.
        </p>

        <ArticleH2>Turning a template into an AI UGC video</ArticleH2>
        <p>Once the script is ready, you have two routes.</p>
        <p>
          <strong className="font-semibold text-foreground-strong">In the browser.</strong> Open AI Studio in UGC Pilot, paste the script as your brief, choose the model, vertical format and length, and generate. Add a voiceover, adjust text, then export. Review every draft and download only the version you approve.
        </p>
        <p>
          <strong className="font-semibold text-foreground-strong">From an AI assistant.</strong> Connect Claude or Codex to the <ArticleLink href="/mcp">UGC Pilot MCP server</ArticleLink> and ask it to fill a template and make the video in one go:
        </p>
        <ArticlePrompt>Use the &quot;Objection buster&quot; template for solo SaaS founders. Write 3 hook options, pick the strongest, then use UGC Pilot to generate a 20-second vertical UGC-style video and a casual voiceover. Show me the credit cost first.</ArticlePrompt>
        <p>
          Setup guides: <ArticleLink href="/mcp/claude">Claude</ArticleLink> and <ArticleLink href="/mcp/codex">Codex</ArticleLink>. Our post on <ArticleLink href="/blog/ugc-videos-with-codex-mcp">making UGC videos with Codex</ArticleLink> walks through it step by step.
        </p>

        <ArticleH2>Real examples to study</ArticleH2>
        <p>Watch how these UGC Pilot videos structure their first seconds:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <ArticleExternalLink href="https://www.youtube.com/shorts/2P1whMHDqi8">YouTube Short</ArticleExternalLink> and the longer <ArticleExternalLink href="https://www.youtube.com/watch?v=9bIweHdRdVw">walkthrough</ArticleExternalLink> on <ArticleExternalLink href="https://www.youtube.com/@Teja.Chundu">@Teja.Chundu</ArticleExternalLink>
          </li>
          <li>
            <ArticleExternalLink href="https://www.tiktok.com/@clara_iamm/video/7699988037559700758">TikTok example</ArticleExternalLink> from <ArticleExternalLink href="https://www.tiktok.com/@clara_iamm">@clara_iamm</ArticleExternalLink>
          </li>
          <li>
            Instagram reels like <ArticleExternalLink href="https://www.instagram.com/reel/DePXM_Pg_Lv/">this one</ArticleExternalLink> on <ArticleExternalLink href="https://www.instagram.com/mira_handles">@mira_handles</ArticleExternalLink>, plus <ArticleExternalLink href="https://www.instagram.com/clara_iamm">@clara_iamm on Instagram</ArticleExternalLink>
          </li>
        </ul>
        <p>
          Script ideas and experiments also get shared on <ArticleExternalLink href="https://x.com/Teja_chundu">X by @Teja_chundu</ArticleExternalLink>.
        </p>

        <ArticleH2>A simple testing routine</ArticleH2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Pick two templates that suit your product.</li>
          <li>Write three hooks for each.</li>
          <li>Generate a video for each hook (six drafts).</li>
          <li>Review, cut the weak ones, and run the rest yourself.</li>
          <li>Keep notes on which template and hook did best in your own data, and write the next batch from the winner.</li>
        </ol>
        <p>
          Credits are spent per generation, so check the <ArticleLink href="/pricing">pricing page</ArticleLink> for what your plan includes before you make many variants.
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
                  Sometimes. For physical products and real testimonials, human creators are often the better choice. See <ArticleLink href="/blog/ugc-pilot-vs-hiring-ugc-creators">UGC Pilot vs hiring UGC creators</ArticleLink>.
                </>
              ),
            },
          ]}
        />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/blog/ugc-hooks", title: "UGC hooks that stop the scroll", description: "20 real hook lines by type, and how to turn one into a video." },
          { href: "/blog/ai-ugc-for-tiktok-ads", title: "AI UGC for TikTok ads", description: "Briefs, hooks, captions, disclosure, and how to test variants." },
          { href: "/blog/how-to-choose-a-ugc-video-maker", title: "How to choose a UGC video maker", description: "A 10-point checklist for output, editing, voice, pricing, and limits." },
          { href: "/blog/ugc-ads-with-claude-mcp", title: "UGC ads with Claude", description: "Connect the MCP server and make a UGC-style ad from a chat." },
          { href: "/blog/ugc-videos-with-codex-mcp", title: "UGC videos with Codex", description: "Connect the MCP server and make a UGC-style video from the terminal." },
          { href: "/free-hook-lines", title: "Free hook lines", description: "Openers you can adapt before you write the rest of the script." },
          { href: "/guides/how-to-create-ugc-videos-with-ai", title: "Create a UGC video", description: "The brief, review, and download steps." },
        ]}
      />
    </VideoMarketingPage>
  );
}
