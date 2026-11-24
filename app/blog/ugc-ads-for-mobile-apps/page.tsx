import type { Metadata } from "next";

import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import { ArticleBody, ArticleH2, ArticleH3, ArticleLink, FaqList } from "@/components/marketing/seo-article";
import { articleJsonLd, breadcrumbJsonLd, publicOrigin } from "@/lib/marketing/brand-videos";
import { faqJsonLd } from "@/lib/marketing/mcp-public";

const path = "/blog/ugc-ads-for-mobile-apps";
const title = "UGC Ads for Mobile Apps: One Feature, Real Proof, Short Variants";
const description =
  "How to make UGC ads for a mobile app: pick one feature, pair a creator-style opening with a real screen recording, and review claims before you run the ad.";
const datePublished = "2026-11-23";

const faqs = [
  {
    question: "What is a UGC ad for a mobile app?",
    answer:
      "A short ad that looks like a person talking about one job the app does, followed by proof from the actual product. The opening can be generated. The screen the viewer is asked to trust should be a real recording.",
  },
  {
    question: "Can an AI UGC ad replace an App Store preview?",
    answer:
      "No. A store preview has its own content and technical rules. Treat the social ad and the store preview as two deliverables. The social ad can send a qualified person to the store; it does not stand in for the preview.",
  },
  {
    question: "How many features should one app ad cover?",
    answer:
      "One. If the ad needs a second feature to make sense, it is two ads. A viewer who cannot name the feature after one watch did not get a usable ad.",
  },
  {
    question: "Do I have to disclose that the presenter is AI?",
    answer:
      "Check the current rules for the ad platform and the country you advertise in. Where a label is required, add it. A generated presenter must not be presented as a customer.",
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

export default function UgcAdsForMobileAppsPage() {
  return (
    <VideoMarketingPage
      eyebrow="Mobile app ads"
      h1={title}
      lede="An app ad has one job: make a specific task feel familiar, then show the screen that does it. The creator-style opening gets the stop. The recording earns the install tap."
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          { ...articleJsonLd({ path, headline: title, description, imagePath: `${path}/opengraph-image`, datePublished }), "@type": "BlogPosting" },
          faqJsonLd(faqs),
          breadcrumbJsonLd([
            { name: "Vidmake", path: "/" },
            { name: "Blog", path: "/blog" },
            { name: "UGC ads for mobile apps", path },
          ]),
        ],
      }}
    >
      <ArticleBody>
        <ArticleH2>Start from the task, not the brand line</ArticleH2>
        <p>
          Write the ad around a task a person already recognizes: saving a receipt, finding yesterday&apos;s note, splitting a bill, checking a habit. The app name can wait until the screen appears. A line that only says the product is &quot;the best app for X&quot; gives the viewer nothing to picture.
        </p>
        <p>
          Keep the task to something the build actually does. If the brief came from a website summary or an AI suggestion, open the app and confirm the control, the label, and the result before you write the line.
        </p>

        <ArticleH2>Split the ad into two kinds of footage</ArticleH2>
        <ArticleH3>The opening can be creator-style</ArticleH3>
        <p>
          The first seconds can be a person, a reaction, or on-screen text that names the situation. That is the part an <ArticleLink href="/blog/ai-ugc-video-generator-how-it-works">AI UGC video generator</ArticleLink> is for. It does not have to be you on camera.
        </p>
        <ArticleH3>The proof has to be the product</ArticleH3>
        <p>
          Cut to a recording of the real screen: the starting state, the action, and the visible result. Do not ask a generator to invent buttons, notifications, or a success state. The <ArticleLink href="/blog/ai-video-generator-for-mobile-apps">mobile app video guide</ArticleLink> separates a store preview from a social video; the same split applies inside one ad.
        </p>

        <ArticleH2>A structure you can shoot this week</ArticleH2>
        <ol className="list-decimal space-y-3 pl-5">
          <li><strong className="text-foreground-strong">0–3 seconds:</strong> the situation, in the viewer&apos;s words.</li>
          <li><strong className="text-foreground-strong">Next:</strong> one sentence that names what the app does about that situation.</li>
          <li><strong className="text-foreground-strong">Middle:</strong> the real screen, held long enough to read the control that matters.</li>
          <li><strong className="text-foreground-strong">End:</strong> the result on that screen, then a plain next step. No invented discount or deadline.</li>
        </ol>
        <p>
          The <ArticleLink href="/guides/hook-video-with-real-app-demo">hook plus real demo guide</ArticleLink> has a worked timing plan. Use it when the opening and the recording need to feel like one video.
        </p>

        <ArticleH2>Make variants by changing one thing</ArticleH2>
        <p>
          A useful set is three or four ads that share the same feature and the same screen, and differ in the opening. Change the situation, the first line, or the presenter. Do not change the feature, the claim, and the screen in the same variant or you will not know what the response was about.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Same feature, different opening line.</li>
          <li>Same line, different presenter.</li>
          <li>Same opening, a tighter or wider crop of the same recording.</li>
        </ul>
        <p>
          The <ArticleLink href="/blog/ugc-ad-script-templates">UGC ad script templates</ArticleLink> are fill-in structures if you want a second shape after the first one is reviewable.
        </p>

        <ArticleH2>Review before the ad account sees it</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>The spoken or written claim matches the screen that follows.</li>
          <li>No customer quote, star rating, or download count you did not source.</li>
          <li>Names, messages, and account details are removed from the recording.</li>
          <li>The important control is readable on a phone, not only on your desktop preview.</li>
          <li>AI disclosure is present where the platform requires it.</li>
        </ul>
        <p>
          Paid plans start at $29 a month. Current trial and plan details are on the <ArticleLink href="/pricing">pricing page</ArticleLink>.
        </p>
        <p>
          <ArticleLink href="/explore/hook-video">Open Hook video</ArticleLink> to make the opening, then attach the recording of your own screen. You review the result before you download it.
        </p>

        <FaqList items={faqs} />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/explore/hook-video", title: "Hook video", description: "Make the opening, then review it before download." },
          { href: "/blog/ai-video-generator-for-mobile-apps", title: "AI video for mobile apps", description: "Store preview versus social video." },
          { href: "/blog/app-marketing-videos-for-saas", title: "App marketing videos for SaaS", description: "Choose hook, text, slideshow, or demo." },
          { href: "/guides/hook-video-with-real-app-demo", title: "Hook plus a real demo", description: "Time the opening and the screen recording as one video." },
          { href: "/blog/tiktok-slideshow-maker-for-apps", title: "Slideshows for apps", description: "When a swipe deck explains the feature better than a cut." },
          { href: "/blog/ugc-ad-script-templates", title: "Ad script templates", description: "Eight structures with hooks, beats, and timings." },
        ]}
      />
    </VideoMarketingPage>
  );
}
