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

const path = "/blog/ugc-hooks";
const title = "UGC Hooks That Stop the Scroll: 20 Real Examples by Type";
const description = "20 copy-ready UGC hooks grouped by type (surprise, curiosity, frustration, POV, confession, demo) with why each works. Get all 110 free hook lines.";
const datePublished = "2026-10-25";

const faqs = [
  {
    question: "What is a UGC hook?",
    answer: "A UGC hook is the opening line or first shot of a user-generated-content style video. It's usually spoken to the camera or shown as a caption, and it's meant to stop the viewer from scrolling past.",
  },
  {
    question: "What are good TikTok hooks?",
    answer: "Good TikTok hooks are short and sound natural. Examples include surprise lines (\"wait... WHAT?? 😭\"), curiosity lines (\"why is nobody talking about this?\") and POV captions (\"POV: you just discovered something amazing\"). The best one depends on what your video shows next.",
  },
  {
    question: "How long should a hook be?",
    answer: "Short enough to read or hear in a moment. Most lines in our library are under ten words.",
  },
  {
    question: "Where can I find more video hook ideas?",
    answer: "Our free Reaction Hook Library at https://getugcpilot.com/free-hook-lines has 110 hook lines in 11 collections. You can copy any line or download the PDF without signing up.",
  },
  {
    question: "Can I use these hooks in paid ads?",
    answer: "Yes. They're free to copy and adapt. Change the wording to fit your product and voice, and follow each platform's ad and AI disclosure rules.",
  },
  {
    question: "Can AI make hook videos?",
    answer: "Yes. UGC Pilot generates AI UGC videos, including reaction-style hook clips, which you can create with the Hook video tool at https://getugcpilot.com/hookvideos.",
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

export default function UgcHooksPage() {
  return (
    <VideoMarketingPage
      eyebrow="Hook examples"
      h1={title}
      lede="On TikTok, Reels and Shorts, the first line of a video decides whether anyone sees the second. That first line is the hook. In UGC-style ads, where a person talks straight to the camera, the hook is usually something they say out loud or a short caption on screen, and it has one job: make the viewer stay a little longer."
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
          This guide covers 20 UGC hooks taken word for word from our free <ArticleLink href="/free-hook-lines">Reaction Hook Library</ArticleLink>, a set of 110 short, casual openings in 11 collections. For each type, we explain why it works and when to use it. To turn a hook into a video, try the <ArticleLink href="/hookvideos">Hook video tool</ArticleLink>, where UGC Pilot recreates a hook as a video.
        </p>

        <ArticleH2>What makes a good UGC hook?</ArticleH2>
        <p>A good hook sounds like a real person, not an ad. Most of the lines in the library are lowercase, short, and a little messy on purpose. That&apos;s how people actually caption their own videos.</p>
        <p>Strong hooks tend to do at least one of these things:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-foreground-strong">Open a loop.</strong> The viewer wants to know what comes next.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Name a feeling.</strong> Surprise, frustration or relief, something the viewer recognizes.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Lead straight into the product.</strong> The hook sets up the reveal, and the next shot pays it off.
          </li>
        </ul>
        <p>A hook only works if the video delivers on it. If you say &quot;watch how simple this actually is,&quot; the next few seconds need to show something simple.</p>

        <ArticleH2>1. Shock and surprise hooks</ArticleH2>
        <p>Use these when the result itself is surprising: a before-and-after, an unexpected output, a fast transformation.</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>&quot;wait... WHAT?? 😭&quot;</li>
          <li>&quot;there&apos;s actually no way...&quot;</li>
          <li>&quot;i&apos;m sorry, WHAT IS THIS?&quot;</li>
          <li>&quot;why am i only finding this now??&quot;</li>
        </ul>
        <p>
          <strong className="font-semibold text-foreground-strong">Why they work:</strong> a reaction comes before the explanation. The viewer sees someone surprised and wants to find out why. These are a natural fit for reaction-style clips, where a face reacts first and the product appears right after.
        </p>

        <ArticleH2>2. Curiosity and discovery hooks</ArticleH2>
        <p>These hint that the speaker found something without saying what it is yet.</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>&quot;why is nobody talking about this?&quot;</li>
          <li>&quot;you need to see what i found&quot;</li>
          <li>&quot;how did i not know this existed?&quot;</li>
        </ul>
        <p>
          <strong className="font-semibold text-foreground-strong">Why they work:</strong> they open a loop. &quot;Why is nobody talking about this?&quot; makes the viewer feel they might be missing out, and the only way to close the loop is to keep watching.
        </p>

        <ArticleH2>3. Relatable frustration hooks</ArticleH2>
        <p>Start with a problem your audience already has.</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>&quot;not me wasting hours on this 😭&quot;</li>
          <li>&quot;i&apos;ve been doing this wrong...&quot;</li>
          <li>&quot;please tell me i&apos;m not alone&quot;</li>
        </ul>
        <p>
          <strong className="font-semibold text-foreground-strong">Why they work:</strong> people stop for things they recognize from their own lives. Once the viewer thinks &quot;same,&quot; your product can show up as the fix. These pair well with the problem-solution scripts in our <ArticleLink href="/blog/ugc-ad-script-templates">UGC ad script templates</ArticleLink>.
        </p>

        <ArticleH2>4. POV and meme hooks</ArticleH2>
        <p>These are on-screen captions more than spoken lines, the native language of TikTok and Reels.</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>&quot;POV: you just discovered something amazing&quot;</li>
          <li>&quot;me realizing there was an easier way 💀&quot;</li>
          <li>&quot;me pretending i knew this already&quot;</li>
        </ul>
        <p>
          <strong className="font-semibold text-foreground-strong">Why they work:</strong> the POV format puts the viewer inside the moment, and it looks like a regular post rather than an ad. Keep the visual simple so the caption does the work.
        </p>

        <ArticleH2>5. Honest confession hooks</ArticleH2>
        <p>Open with an admission instead of a pitch.</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>&quot;i was completely wrong about this&quot;</li>
          <li>&quot;i didn&apos;t think i&apos;d like this&quot;</li>
        </ul>
        <p>
          <strong className="font-semibold text-foreground-strong">Why they work:</strong> an admission feels more human than a sales claim. A skeptic who changed their mind is more convincing than someone who loved the product from the start, so these work well for review-style UGC.
        </p>

        <ArticleH2>6. Pattern interrupt hooks</ArticleH2>
        <p>Challenge the viewer before making your point.</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>&quot;okay, unpopular opinion...&quot;</li>
          <li>&quot;stop doing it the hard way&quot;</li>
        </ul>
        <p>
          <strong className="font-semibold text-foreground-strong">Why they work:</strong> they break the rhythm of a feed full of agreement. A small challenge gets attention, and &quot;stop doing it the hard way&quot; leads straight into a shortcut your product offers.
        </p>

        <ArticleH2>7. Friend-to-friend hooks</ArticleH2>
        <p>These sound like a message from a friend.</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>&quot;okay bestie, look at this&quot;</li>
          <li>&quot;i&apos;m putting you all onto this&quot;</li>
        </ul>
        <p>
          <strong className="font-semibold text-foreground-strong">Why they work:</strong> they set up a recommendation rather than an advertisement. That&apos;s the whole point of UGC: it feels like a tip from a person, not a brand.
        </p>

        <ArticleH2>8. App demo and reveal hooks</ArticleH2>
        <p>Use these when the screen recording is the star.</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>&quot;let me show you something real quick&quot;</li>
          <li>&quot;watch how simple this actually is&quot;</li>
        </ul>
        <p>
          <strong className="font-semibold text-foreground-strong">Why they work:</strong> they promise a fast payoff and then hand over to the demo. They&apos;re especially useful for app and SaaS founders: hook, then a 10-second screen recording of the result.
        </p>
        <p>
          That&apos;s 20 hooks from 8 of the 11 collections. The full library also has discovery and shortcut hooks, personal story openers (&quot;so something happened today...&quot;) and 10 bonus lines. <ArticleLink href="/free-hook-lines">Copy any of the 110 hooks or download the free PDF</ArticleLink>. No signup needed.
        </p>

        <ArticleH2>How to turn a hook line into a video</ArticleH2>
        <p>A hook line becomes a hook video when you pair it with a face, a reaction or a first shot. Here&apos;s a simple workflow:</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-foreground-strong">Pick the feeling first.</strong> Is your result surprising, a relief, or a fix for a frustration? Choose the collection that matches.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Make the line your own.</strong> Change a word or two so it fits your product and voice.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Match the visual to the hook.</strong> A surprise hook needs a surprised reaction; a demo hook needs the screen on camera quickly.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Deliver within seconds.</strong> Show whatever the hook promised right away.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Make variants.</strong> Try the same video with three or four different hooks and keep the one that performs best in your own results.
          </li>
        </ol>
        <p>
          UGC Pilot can help with steps 3 to 5. You can generate AI UGC videos with consistent characters and test hook variants from Claude or Codex through our MCP server. See <ArticleLink href="/blog/ai-ugc-video-generator-how-it-works">how it works</ArticleLink>, or follow the guides for <ArticleLink href="/blog/ugc-ads-with-claude-mcp">Claude</ArticleLink> and <ArticleLink href="/blog/ugc-videos-with-codex-mcp">Codex</ArticleLink>. For platform tips on vertical format, captions and AI disclosure, read <ArticleLink href="/blog/ai-ugc-for-tiktok-ads">AI UGC for TikTok ads</ArticleLink>.
        </p>

        <ArticleH2>See these hooks in real videos</ArticleH2>
        <p>Reading hooks helps, but watching them helps more. These accounts post AI UGC made with UGC Pilot:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Instagram: <ArticleExternalLink href="https://www.instagram.com/mira_handles/">@mira_handles</ArticleExternalLink>, <ArticleExternalLink href="https://www.instagram.com/juliarose.daily/">@juliarose.daily</ArticleExternalLink> and <ArticleExternalLink href="https://www.instagram.com/clara_iamm/">@clara_iamm</ArticleExternalLink>
          </li>
          <li>
            TikTok: <ArticleExternalLink href="https://www.tiktok.com/@clara_iamm">@clara_iamm</ArticleExternalLink>
          </li>
          <li>
            YouTube: <ArticleExternalLink href="https://www.youtube.com/@Teja.Chundu">@Teja.Chundu</ArticleExternalLink>
          </li>
        </ul>
        <p>
          Watch the first second of each one and notice how the opening line and the first shot work together. You can also turn any of these lines into a clip with the <ArticleLink href="/hookvideos">Hook video tool</ArticleLink>, and follow the founder on <ArticleExternalLink href="https://x.com/Teja_chundu">X (@Teja_chundu)</ArticleExternalLink> for new examples.
        </p>

        <ArticleH2>Common hook mistakes</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-foreground-strong">Clickbait with no payoff.</strong> If the video doesn&apos;t deliver what the hook promised, viewers leave and don&apos;t trust the next one.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Starting with your logo or product name.</strong> Start with the viewer&apos;s feeling or problem, and save the brand for after the hook.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Overly polished lines.</strong> &quot;Introducing the revolutionary...&quot; reads as an ad. &quot;okay, watch what happens when i do this&quot; reads as a person.
          </li>
          <li>
            <strong className="font-semibold text-foreground-strong">Using one hook forever.</strong> Hooks wear out. Keep a list and rotate.
          </li>
        </ul>
        <p>
          If you&apos;re still choosing a tool to make the videos, our <ArticleLink href="/blog/how-to-choose-a-ugc-video-maker">UGC video maker checklist</ArticleLink> covers what to look for.
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
                  Our free <ArticleLink href="/free-hook-lines">Reaction Hook Library</ArticleLink> has 110 hook lines in 11 collections. You can copy any line or download the PDF without signing up.
                </>
              ),
            },
            { question: faqs[4].question, answer: faqs[4].answer },
            {
              question: faqs[5].question,
              answer: (
                <>
                  Yes. UGC Pilot generates AI UGC videos, including reaction-style hook clips, which you can create with the <ArticleLink href="/hookvideos">Hook video tool</ArticleLink>.
                </>
              ),
            },
          ]}
        />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/hookvideos", title: "Hook videos", description: "Preview silent AI hook clips and see how an opening looks on camera." },
          { href: "/free-hook-lines", title: "Free hook lines", description: "110 short openings you can copy or download as a PDF." },
          { href: "/blog/ugc-ad-script-templates", title: "UGC ad script templates", description: "Eight fill-in-the-blank formats with hooks, beats, and timings." },
          { href: "/blog/ai-ugc-for-tiktok-ads", title: "AI UGC for TikTok ads", description: "Briefs, hooks, captions, disclosure, and how to test variants." },
          { href: "/blog/ai-ugc-video-generator-how-it-works", title: "How an AI UGC video generator works", description: "When a generated clip fits, and where you still need real footage." },
          { href: "/blog/how-to-choose-a-ugc-video-maker", title: "How to choose a UGC video maker", description: "A 10-point checklist for output, editing, voice, pricing, and limits." },
        ]}
      />
    </VideoMarketingPage>
  );
}
