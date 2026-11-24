import type { Metadata } from "next";

import { ArticleBody, ArticleH2, ArticleLink, FaqList } from "@/components/marketing/seo-article";
import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/marketing/brand-videos";
import { faqJsonLd } from "@/lib/marketing/mcp-public";

const path = "/blog/repurpose-ugc-video-into-hooks";
const title = "Repurpose One UGC Video into More Hooks";
const description = "Turn one reviewed app video into several hooks by changing the opening line and keeping the same proof. No extra claims, and no promise of extra reach.";
const datePublished = "2026-11-24";
const faqs = [
  { question: "Does more hooks mean more views?", answer: "Not by itself. Extra openings give you more than one way to start the same proof. Reach is something you measure after you post, not something the edit creates." },
  { question: "What has to stay the same?", answer: "The feature, the screen, and any result you state. If a new opening claims a different outcome, it needs its own proof." },
  { question: "Should every version be a new full video?", answer: "Only if the shot changes. If the demo is already right, change the first line or the on-screen text and review that version." },
];

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: path },
  openGraph: { title, description, url: path, type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

export default function RepurposeHooksPage() {
  return (
    <VideoMarketingPage
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          { ...articleJsonLd({ path, headline: title, description, imagePath: `${path}/opengraph-image`, datePublished }), "@type": "BlogPosting" },
          faqJsonLd(faqs),
          breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: "Repurpose a UGC video", path },
        ]),
        ],
      }}
      eyebrow="Editing"
      h1="How to repurpose one UGC video into many hooks"
      lede="Start from a video you have already watched and would post. The demo stays. The first sentence changes. You get several openings for one piece of proof, which is a different job from filming a new feature."
    >
      <ArticleBody>
        <ArticleH2>Keep a locked middle</ArticleH2>
        <p>Mark the part of the video that shows the feature. That span does not get a new claim. Write the new hook so it can be said, and then cut into that span without a jump in the story. If the new line needs a different screen, it is a new video, not a repurpose.</p>
        <ArticleH2>Four openings for the same demo</ArticleH2>
        <p>Use the shapes in <ArticleLink href="/blog/hook-formulas-for-app-tiktoks">hook formulas</ArticleLink>: a situation, a contrast, a question, and a silent line of text over the first frames. Draft the words in the <ArticleLink href="/tools/hook-generator">hook line generator</ArticleLink>. Throw out any line that mentions a result the locked middle does not show.</p>
        <p>Put the text version on screen with <ArticleLink href="/blog/wall-of-text-video-maker">text on screen</ArticleLink> when you do not want a spoken open. The pictures underneath stay the reviewed demo.</p>
        <ArticleH2>Review each version</ArticleH2>
        <p>Watch each opening once with the sound on and once with it off. The silent version has to make sense too, because many people will see it that way. Then schedule only the versions you approved. The <ArticleLink href="/blog/schedule-tiktok-instagram-posts-for-an-app">scheduling guide</ArticleLink> covers the queue. It does not say that posting more often creates growth.</p>
        <FaqList items={faqs} />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/blog/hook-formulas-for-app-tiktoks", title: "Hook formulas", description: "The four shapes these openings use." },
          { href: "/tools/hook-generator", title: "Hook line generator", description: "Write the new first line from the same task." },
          { href: "/blog/hook-video-maker", title: "Hook video maker", description: "Make the original clip you will reuse." },
          { href: "/blog/schedule-tiktok-instagram-posts-for-an-app", title: "Schedule the posts", description: "Queue the versions you kept." },
          { href: "/explore/hook-video", title: "Hook video", description: "Review a new opening before you post it." },
        ]}
      />
    </VideoMarketingPage>
  );
}
