import type { Metadata } from "next";

import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import { ArticleBody, ArticleH2, ArticleH3, ArticleLink, FaqList } from "@/components/marketing/seo-article";
import { articleJsonLd, breadcrumbJsonLd, publicOrigin } from "@/lib/marketing/brand-videos";
import { faqJsonLd } from "@/lib/marketing/mcp-public";

const path = "/blog/hook-video-maker";
const title = "Hook Video Maker: From a Reference Opening to a Video You Approve";
const description =
  "How a hook video maker separates the reference scene from your product message: plan the opening, keep identity consistent, and review the clip before download.";
const datePublished = "2026-11-23";

const faqs = [
  {
    question: "What is a hook video?",
    answer:
      "A short video whose first seconds carry the reason to keep watching. In Vidmake, Hook video means you choose a hook reference and create your own video from it. The reference guides scene and motion. Your message and your proof stay yours.",
  },
  {
    question: "Does the reference video become my ad?",
    answer:
      "No. A reference is a structure and a visual plan. You still need original wording, a claim your product can support, and footage or assets you have the right to use.",
  },
  {
    question: "Can I keep the same person across hooks?",
    answer:
      "Yes, when you use an approved starting image and the identity photos that belong to that character. The generated image is the first frame. Extra photos are identity context, not a new scene.",
  },
  {
    question: "Does Vidmake post the hook for me?",
    answer:
      "You download the file you approve and share it from the channel you already manage. Scheduling to a connected account is a separate step inside the product, and a successful download is not the same as a published post.",
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

export default function HookVideoMakerPage() {
  return (
    <VideoMarketingPage
      eyebrow="Hook videos"
      h1={title}
      lede="A hook video maker is useful when it keeps two jobs apart: the reference decides how the shot moves, and you decide what the video is allowed to say about your product."
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          { ...articleJsonLd({ path, headline: title, description, imagePath: `${path}/opengraph-image`, datePublished }), "@type": "BlogPosting" },
          faqJsonLd(faqs),
          breadcrumbJsonLd([
            { name: "Vidmake", path: "/" },
            { name: "Blog", path: "/blog" },
            { name: "Hook video maker", path },
          ]),
        ],
      }}
    >
      <ArticleBody>
        <ArticleH2>Write the promise before you open a reference</ArticleH2>
        <p>
          One sentence: the situation, the feature, and the thing a viewer will see. Example for a fictional notes app: &quot;After a call, the next step is in the note.&quot; If the sentence needs a result you cannot show, rewrite it. The <ArticleLink href="/blog/tiktok-hook-generator">TikTok hook generator workflow</ArticleLink> is the line-writing step. This page is the video.
        </p>

        <ArticleH2>Use the reference for the shot, not the claim</ArticleH2>
        <ArticleH3>What the reference is for</ArticleH3>
        <p>
          Camera, pacing, where the person is in frame, and how the opening moves. In Explore, Hook video starts by choosing a hook reference and creating your own video.
        </p>
        <ArticleH3>What you replace</ArticleH3>
        <p>
          The words, the product, and any proof. A public clip is not permission to reuse someone&apos;s footage, voice, music, or likeness. The <ArticleLink href="/guides/reference-provenance-review">provenance guide</ArticleLink> is the checklist for that decision. The <ArticleLink href="/blog/ai-influencer-video-generator">AI influencer guide</ArticleLink> covers a reusable presenter when the person on screen is a character you prepared, not a copy of the reference creator.
        </p>

        <ArticleH2>Build the opening in this order</ArticleH2>
        <ol className="list-decimal space-y-3 pl-5">
          <li>Choose the reference for the scene.</li>
          <li>Set the words to your sentence, not the reference caption.</li>
          <li>If you use a character, keep the approved starting image as the first frame.</li>
          <li>Add a real screen only if the hook promises a product action. Generate the reaction; record the product.</li>
          <li>Watch the exported file once on a phone and write down what you think it claimed.</li>
        </ol>
        <p>
          The <ArticleLink href="/guides/hook-video-with-real-app-demo">hook plus demo guide</ArticleLink> is the version where the recording has to follow the opening without a jump in the story.
        </p>

        <ArticleH2>Review the file, not the prompt</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>The first sentence matches the rest of the clip.</li>
          <li>On-screen text matches what is said, if anything is said.</li>
          <li>The product UI is yours, and it is readable.</li>
          <li>No testimonial, rating, or outcome was added because it sounded like an ad.</li>
          <li>The character still matches the approved identity photos, if you used them.</li>
        </ul>
        <p>
          <ArticleLink href="/explore/hook-video">Open Hook video</ArticleLink> and make the opening from a reference you choose. You review it before download. Paid plans start at $29 a month; see <ArticleLink href="/pricing">pricing</ArticleLink>. For silent examples of the format, see <ArticleLink href="/hookvideos">hook videos</ArticleLink>.
        </p>

        <FaqList items={faqs} />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/explore/hook-video", title: "Hook video", description: "Choose a reference and create your own video." },
          { href: "/blog/tiktok-hook-generator", title: "TikTok hook generator", description: "Write three openings before you generate the clip." },
          { href: "/blog/ai-influencer-video-generator", title: "AI influencer video", description: "Keep one presenter consistent across hooks." },
          { href: "/blog/recreate-viral-tiktok-with-ai", title: "Recreate a structure", description: "Adapt pacing without copying the original video." },
          { href: "/guides/reference-provenance-review", title: "Reference permissions", description: "Record what you may reuse." },
          { href: "/blog/ai-ugc-video-generator-how-it-works", title: "How the generator works", description: "When a generated clip fits, and where you still need real footage." },
        ]}
      />
    </VideoMarketingPage>
  );
}
