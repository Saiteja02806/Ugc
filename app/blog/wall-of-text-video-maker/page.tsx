import type { Metadata } from "next";

import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import { ArticleBody, ArticleH2, ArticleLink, FaqList } from "@/components/marketing/seo-article";
import { articleJsonLd, breadcrumbJsonLd, publicOrigin } from "@/lib/marketing/brand-videos";
import { faqJsonLd } from "@/lib/marketing/mcp-public";

const path = "/blog/wall-of-text-video-maker";
const title = "Wall-of-Text Video Maker: Text on Screen That People Can Finish";
const description =
  "How to use a wall-of-text video maker: write one situation, keep the words readable, add them as editable text, and review the Text on screen export.";
const datePublished = "2026-11-23";

const faqs = [
  {
    question: "What is a wall-of-text video?",
    answer:
      "A video where a short written story, observation, or list does the explaining, over footage that stays quiet enough to read. In Vidmake the workflow is called Text on screen. The address stays /explore/wall-of-text.",
  },
  {
    question: "Is it the same as captions?",
    answer:
      "No. Captions transcribe speech. Text on screen is the message. If you remove the words, the video should not still make the point.",
  },
  {
    question: "Should the words be baked into the generated picture?",
    answer:
      "No. Generate or choose the background, then add the words as editable text. Generated letters are hard to correct and often unreadable.",
  },
  {
    question: "How long should the text be?",
    answer:
      "Short enough that someone can read it once, out loud, in the duration you chose. If they cannot finish, cut lines or give the clip more time. Do not shrink the type until it fits.",
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

export default function WallOfTextVideoMakerPage() {
  return (
    <VideoMarketingPage
      eyebrow="Text on screen"
      h1={title}
      lede="People search for a wall-of-text video maker when they want the words to carry the video. The useful version is one situation, readable type, and a background that does not fight the paragraph."
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          { ...articleJsonLd({ path, headline: title, description, imagePath: `${path}/opengraph-image`, datePublished }), "@type": "BlogPosting" },
          faqJsonLd(faqs),
          breadcrumbJsonLd([
            { name: "Vidmake", path: "/" },
            { name: "Blog", path: "/blog" },
            { name: "Wall-of-text video maker", path },
          ]),
        ],
      }}
    >
      <ArticleBody>
        <ArticleH2>Write the situation before you pick footage</ArticleH2>
        <p>
          A text-on-screen video is a paragraph with a scene, not a list of slogans. Start with a moment the viewer knows. For a fictional notes product: the call is over, the follow-up is tomorrow, and the next step is somewhere in the notes. Then one sentence of product behavior you can verify, then the action. The <ArticleLink href="/guides/wall-of-text-video-for-saas">Text on screen guide for SaaS</ArticleLink> walks that example in full. This page is the tool decision around it.
        </p>
        <p>
          First person (&quot;I tried this&quot;, &quot;this saved me hours&quot;) is a claim about a real experience. Use it only when that is true. A casual tone does not require a made-up story.
        </p>

        <ArticleH2>Keep the background in service of the words</ArticleH2>
        <p>
          Choose owned or permitted footage with a calm area for the type. A generated background is illustration. It is not evidence that a customer uses the product. Busy gestures and competing signs make the paragraph harder to finish. If the message needs several product screens, switch to a <ArticleLink href="/blog/hook-video-maker">hook plus a recording</ArticleLink> or a <ArticleLink href="/blog/tiktok-slideshow-maker-for-apps">slideshow</ArticleLink>.
        </p>
        <p>
          The <ArticleLink href="/guides/readable-video-text">readable text guide</ArticleLink> covers size, contrast, and the areas platform controls cover. The <ArticleLink href="/guides/wall-text-paragraph-vs-list">paragraph versus list guide</ArticleLink> is the choice when you are unsure which shape the words should take.
        </p>

        <ArticleH2>Add the words as text, then rehearse</ArticleH2>
        <ol className="list-decimal space-y-3 pl-5">
          <li>Open Text on screen and choose or create the background.</li>
          <li>Put the paragraph in the text editor, with the line breaks you mean.</li>
          <li>Read it once at the duration you selected. If you rush, cut a line or lengthen the clip. Do not squeeze the type.</li>
          <li>Check that a remix, if you use one, still states only the product facts you verified.</li>
          <li>Export and watch on a phone. Ask someone else what the product does. Their sentence should match yours.</li>
        </ol>

        <ArticleH2>Make it in Text on screen</ArticleH2>
        <p>
          <ArticleLink href="/explore/wall-of-text">Open Text on screen</ArticleLink> to create the background and add your message. You review the video before you download it. Paid plans start at $29 a month; see <ArticleLink href="/pricing">pricing</ArticleLink>. A source reference can help you plan the pace. It does not give you the right to reuse another creator&apos;s footage or wording. See <ArticleLink href="/blog/recreate-viral-tiktok-with-ai">how to recreate a structure</ArticleLink> without copying the file.
        </p>

        <FaqList items={faqs} />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/explore/wall-of-text", title: "Text on screen", description: "Create the background and add your message." },
          { href: "/guides/wall-of-text-video-for-saas", title: "Text on screen for SaaS", description: "A worked overlay from business context." },
          { href: "/guides/readable-video-text", title: "Readable text", description: "Size, contrast, and safe areas." },
          { href: "/guides/wall-text-paragraph-vs-list", title: "Paragraph or list", description: "Choose the shape of the words." },
          { href: "/blog/tiktok-slideshow-maker-for-apps", title: "Slideshows for apps", description: "When the viewer should pause on a screen." },
          { href: "/blog/app-marketing-videos-for-saas", title: "Which format first", description: "Hook, text, slideshow, or demo." },
        ]}
      />
    </VideoMarketingPage>
  );
}
