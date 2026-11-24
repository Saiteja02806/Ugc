import type { Metadata } from "next";

import { ArticleBody, ArticleH2, ArticleLink, FaqList } from "@/components/marketing/seo-article";
import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/marketing/brand-videos";
import { faqJsonLd } from "@/lib/marketing/mcp-public";

const path = "/blog/schedule-tiktok-instagram-posts-for-an-app";
const title = "Schedule TikTok and Instagram Posts for an App";
const description = "A review-then-schedule routine for TikTok and Instagram app posts. No best posting time, and a queued post is a server record, not a button click.";
const datePublished = "2026-11-24";
const faqs = [
  { question: "What time should an app post?", answer: "This page does not name a best hour. Post when you can still watch the result, then keep the times that match the audience you actually have." },
  { question: "Does scheduling create growth?", answer: "No. Scheduling only places an approved file on a connected account. Growth is a result you measure later, and this article does not predict it." },
  { question: "When is a post actually scheduled?", answer: "When the product shows it queued for that account. A click that never creates a schedule record has not scheduled anything." },
];

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: path },
  openGraph: { title, description, url: path, type: "article" },
  twitter: { card: "summary_large_image", title, description },
};

export default function ScheduleAppPostsPage() {
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
          { name: "Schedule app posts", path },
        ]),
        ],
      }}
      eyebrow="Publishing"
      h1="Scheduling TikTok and Instagram posts for an app"
      lede="TikTok and Instagram are useful places to show one app feature. A schedule is a list of files you have already approved, assigned to accounts you have connected. It is not a growth plan by itself."
    >
      <ArticleBody>
        <ArticleH2>Approve the file first</ArticleH2>
        <p>Watch the video at full size on a phone. Check the screen, the words, and the destination link. A slideshow and a hook video of the same feature can both be on the list. A file you have not watched does not go on the list. Repurposed openings from <ArticleLink href="/blog/repurpose-ugc-video-into-hooks">one reviewed video</ArticleLink> are separate files, and each one needs that watch.</p>
        <ArticleH2>Then queue it</ArticleH2>
        <p>In Vidmake, scheduling happens after the video exists, on the accounts connected in your workspace. Which networks are available depends on the connections on that account, so confirm TikTok or Instagram there instead of assuming every format posts to both. Pick the date and time you mean. The post is scheduled when it shows up as a queued item. Leaving the page after a click is not the same thing.</p>
        <ArticleH2>A week you can actually review</ArticleH2>
        <p>Choose a number of posts you can watch before they go out. Three reviewed videos beat a full calendar of files nobody opened. Keep the feature the same for the week if you are still learning which opening is clear. Change the hook, not the product claim. The <ArticleLink href="/blog/hook-formulas-for-app-tiktoks">hook formulas</ArticleLink> are the openings. The <ArticleLink href="/blog/tiktok-slideshows-for-app-installs">slideshow guide</ArticleLink> is the version that ends on a store or site link.</p>
        <p>Make the next file in <ArticleLink href="/explore/hook-video">Hook video</ArticleLink> or <ArticleLink href="/explore/slideshows">Slideshows</ArticleLink>, review it, and only then schedule it.</p>
        <FaqList items={faqs} />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/blog/repurpose-ugc-video-into-hooks", title: "Repurpose one video", description: "Several openings from one approved demo." },
          { href: "/blog/tiktok-slideshows-for-app-installs", title: "Slideshows and installs", description: "A last slide that matches a real link." },
          { href: "/blog/faceless-tiktok-content-for-apps", title: "Faceless app videos", description: "Formats that do not need you on camera." },
          { href: "/explore/hook-video", title: "Hook video", description: "Make a clip you can schedule after review." },
          { href: "/explore/slideshows", title: "Slideshows", description: "Make a deck you can schedule after review." },
        ]}
      />
    </VideoMarketingPage>
  );
}
