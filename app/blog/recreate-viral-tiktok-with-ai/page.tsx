import type { Metadata } from "next";

import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import { ArticleBody, ArticleH2, ArticleLink, FaqList } from "@/components/marketing/seo-article";
import { articleJsonLd, breadcrumbJsonLd, publicOrigin } from "@/lib/marketing/brand-videos";
import { faqJsonLd } from "@/lib/marketing/mcp-public";

const path = "/blog/recreate-viral-tiktok-with-ai";
const title = "Recreate a Viral TikTok with AI Without Copying Someone Else's Video";
const description =
  "How to recreate a viral TikTok structure with AI: record the source, keep your own words and footage, check permission, and build the new video in Vidmake.";
const datePublished = "2026-11-23";

const faqs = [
  {
    question: "Does recreating a viral TikTok mean copying it?",
    answer:
      "No. A useful recreation keeps a structure you can describe in your own words, such as a reaction followed by a product action, and replaces the footage, the script, the music, and the claims. A public link is not permission to reuse the file.",
  },
  {
    question: "What should I write down from the reference?",
    answer:
      "The order of beats, the emotion, and how long each beat lasts. Also write the source URL, the date you viewed it, and which elements you will not reuse. Do not paste the creator's full script into your video.",
  },
  {
    question: "Will the new video get the same views?",
    answer:
      "No. Another creator's distribution is not evidence about your video. Treat view counts on the reference as a description of that post, not a target you can claim.",
  },
  {
    question: "Where does Recreate start in Vidmake?",
    answer:
      "In Explore, Recreate on a reference opens the matching workflow. A hook reference continues in Hook video, a text reference in Text on screen, and a slideshow reference in Slideshows. Bring your own words and your own product proof.",
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

export default function RecreateViralTikTokPage() {
  return (
    <VideoMarketingPage
      eyebrow="Reference videos"
      h1={title}
      lede="The useful part of a viral video is usually a structure: a reaction, a reveal, a list, a before and after. The file, the voice, the caption, and the creator's results are not yours to take."
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          { ...articleJsonLd({ path, headline: title, description, imagePath: `${path}/opengraph-image`, datePublished }), "@type": "BlogPosting" },
          faqJsonLd(faqs),
          breadcrumbJsonLd([
            { name: "Vidmake", path: "/" },
            { name: "Blog", path: "/blog" },
            { name: "Recreate a viral TikTok with AI", path },
          ]),
        ],
      }}
    >
      <ArticleBody>
        <ArticleH2>Separate the structure from the assets</ArticleH2>
        <p>
          Watch the reference once and write four labels: opening, context, proof, ending. Next to each label, note whether you are describing a pattern (&quot;surprised face, then a screen&quot;) or an asset (their footage, their sentence, their sound, their face). Patterns can inform your plan. Assets need permission, or you make them yourself.
        </p>
        <p>
          The <ArticleLink href="/guides/adapt-reference-video-to-saas">adaptation guide</ArticleLink> and the <ArticleLink href="/guides/reference-provenance-review">provenance guide</ArticleLink> are the working checklists. This page is the decision in front of them. Neither guide is legal advice. When a license is unclear, leave the element out or ask someone qualified.
        </p>

        <ArticleH2>Rebuild the beats with your own facts</ArticleH2>
        <ol className="list-decimal space-y-3 pl-5">
          <li>Write the viewer&apos;s task in one line.</li>
          <li>Write the feature you can show. If the reference claims an automation your app does not have, drop that beat.</li>
          <li>Write a new sentence. Do not search-and-replace the product name in their caption.</li>
          <li>Record your screen or use footage you own. A generated background is illustration, not proof that a customer used the app.</li>
        </ol>
        <p>
          A fictional notes app can adapt &quot;reaction, then the note&quot; into &quot;the next step is in the call note&quot; only if that section exists. The reference&apos;s claim about sending follow-ups automatically does not transfer.
        </p>

        <ArticleH2>Use the workflow that matches the reference</ArticleH2>
        <p>
          In Explore, Recreate is tied to the reference you picked. A hook reference continues in <ArticleLink href="/explore/hook-video">Hook video</ArticleLink>. A text-led reference continues in <ArticleLink href="/explore/wall-of-text">Text on screen</ArticleLink>. A slideshow reference continues in <ArticleLink href="/explore/slideshows">Slideshows</ArticleLink>. The <ArticleLink href="/explore/recreate">Recreate route</ArticleLink> is that handoff. It does not grant rights to the source, and it does not copy another account&apos;s performance.
        </p>
        <p>
          The <ArticleLink href="/blog/hook-video-maker">hook video maker guide</ArticleLink> is the production pass once you know the opening is a hook. The <ArticleLink href="/guides/reference-structure-vs-claim">structure versus claim guide</ArticleLink> is the pass that keeps a clever shape from smuggling in someone else&apos;s promise.
        </p>

        <ArticleH2>Check the export against the record</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Every third-party element in the file has a source and a permission that covers this use, or it is gone.</li>
          <li>The words are yours.</li>
          <li>The product behavior matches your app, not the reference.</li>
          <li>You are not promising the reference&apos;s views, follows, or sales.</li>
        </ul>
        <p>
          Paid plans start at $29 a month. See <ArticleLink href="/pricing">pricing</ArticleLink> for the current trial and plans. Start from a reference you are allowed to study, then <ArticleLink href="/explore/hook-video">make your own hook video</ArticleLink>.
        </p>

        <FaqList items={faqs} />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/explore/recreate", title: "Recreate", description: "Continue from a reference into the matching workflow." },
          { href: "/explore/hook-video", title: "Hook video", description: "Make your own opening from a hook reference." },
          { href: "/guides/adapt-reference-video-to-saas", title: "Adapt a reference", description: "Original wording and supported product facts." },
          { href: "/guides/reference-provenance-review", title: "Provenance review", description: "Record the source and what you will not reuse." },
          { href: "/blog/hook-video-maker", title: "Hook video maker", description: "The production pass after the structure is yours." },
          { href: "/explore/slideshows", title: "Slideshows", description: "Recreate a slideshow one image at a time." },
        ]}
      />
    </VideoMarketingPage>
  );
}
