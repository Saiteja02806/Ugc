import type { Metadata } from "next";

import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import {
  ArticleBody,
  ArticleH2,
  ArticleH3,
  ArticleLink,
  FaqList,
} from "@/components/marketing/seo-article";
import { articleJsonLd, publicOrigin } from "@/lib/marketing/brand-videos";
import { faqJsonLd } from "@/lib/marketing/mcp-public";

const path = "/blog/ai-influencer-video-generator";
const title = "AI Influencer Video Generator: Reusable Identity Without the Drift";
const description =
  "How to use an AI influencer video generator for a consistent presenter: identity references, role separation, scene limits, disclosure and a review checklist for SaaS teams.";
const datePublished = "2026-11-10";

const faqs = [
  {
    question: "What is an AI influencer video generator?",
    answer:
      "A tool that creates a consistent on-screen persona and produces video with it. For a product team, the useful part is a recognisable presenter across a series without filming every clip.",
  },
  {
    question: "Will the face stay the same between videos?",
    answer:
      "Only if you keep the same identity references and the same role assignment. Changing the reference photo, the outfit source or the provider can change the face. Save the approved identity and reuse it exactly.",
  },
  {
    question: "Should I disclose that the presenter is AI?",
    answer:
      "Follow the platform rules and the law in your market. Never present a generated person as a real customer or a real founder. Disclosure is safer than a claim you cannot defend.",
  },
  {
    question: "Can an AI influencer replace a founder on camera?",
    answer:
      "It can deliver a script, but it cannot supply lived experience. Use it for scenarios and explanations; keep founder statements in the founder's own voice.",
  },
  {
    question: "What breaks identity consistency most often?",
    answer:
      "Mixing reference sets, changing the outfit or hairstyle source between runs, and switching models mid-campaign. Pick one approved reference set per series and change it only deliberately.",
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

export default function AiInfluencerVideoGeneratorPage() {
  return (
    <VideoMarketingPage
      eyebrow="AI influencer videos"
      h1={title}
      lede="A reusable AI presenter is only valuable if the same person shows up every time. Identity is a reference problem, not a prompt problem. Here is how to keep it stable and honest."
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          articleJsonLd({ path, headline: title, description, imagePath: `${path}/opengraph-image`, datePublished }),
          faqJsonLd(faqs),
        ],
      }}
    >
      <ArticleBody>
        <ArticleH2>Separate the three roles</ArticleH2>
        <div className="overflow-x-auto rounded-[22px] border border-border">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm leading-6">
            <caption className="sr-only">The three inputs that decide an AI influencer video</caption>
            <thead className="bg-card-muted/60 text-foreground-strong">
              <tr>
                <th scope="col" className="p-4 font-semibold">Role</th>
                <th scope="col" className="p-4 font-semibold">Supplies</th>
                <th scope="col" className="p-4 font-semibold">Must not</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Identity</th><td className="p-4 align-top">Face, hair, skin, build</td><td className="p-4 align-top">Supply the room, lighting or camera angle</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Scene</th><td className="p-4 align-top">Background, light, camera, pose</td><td className="p-4 align-top">Come from a different identity photo</td></tr>
              <tr className="border-t border-border"><th scope="row" className="p-4 font-semibold text-foreground-strong">Script</th><td className="p-4 align-top">Words and delivery</td><td className="p-4 align-top">Imply lived customer experience</td></tr>
            </tbody>
          </table>
        </div>

        <ArticleH2>Keep the identity consistent</ArticleH2>
        <ArticleH3>Approve one reference set</ArticleH3>
        <p>
          Choose the photos that define the presenter and save them. Reuse the same set for every video in the series;
          a new reference photo is a new person.
        </p>
        <ArticleH3>Keep the role assignment stable</ArticleH3>
        <p>
          If the source scene supplies the background and outfit, keep it that way for the series. If you switch the
          outfit to a photo reference, expect a visual change and review it before approving.
        </p>
        <ArticleH3>Do not switch providers mid-campaign</ArticleH3>
        <p>
          Different models interpret the same reference differently. A provider switch is a re-cast, not an update.
        </p>

        <ArticleH2>What AI influencers are good for</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Recurring hooks with a recognisable presenter.</li>
          <li>Scenario openings that lead into a real product demo.</li>
          <li>Explaining a concept without filming a person.</li>
          <li>Format variants of the same approved script.</li>
        </ul>

        <ArticleH2>What they are not good for</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Customer testimonials.</li>
          <li>Founder statements in the founder&rsquo;s voice.</li>
          <li>Product proof — the interface must be real.</li>
          <li>Regulated claims that require a qualified person.</li>
        </ul>

        <ArticleH2>Review checklist</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Same face, hair and build as the approved reference.</li>
          <li>Lighting matches the scene, not the identity photo.</li>
          <li>Lip-sync clear on product names and numbers.</li>
          <li>Captions match the audio and do not cover the face.</li>
          <li>The product appears as a real recording where claimed.</li>
          <li>Disclosure present where the platform or law requires it.</li>
        </ul>

        <ArticleH2>Where Vidmake fits</ArticleH2>
        <p>
          Vidmake supports a reusable identity with the approved starting image and ordered identity photos, keeping the
          generated image as the actual first frame. See the
          <ArticleLink href="/ai-ugc-video-generator">AI UGC video generator</ArticleLink> page and the
          <ArticleLink href="/guides/talking-head-first-scene">first-scene guide</ArticleLink>. Use that identity in
          <ArticleLink href="/explore/hook-video">Hook video</ArticleLink>. The
          <ArticleLink href="/blog/hook-video-maker">hook video maker guide</ArticleLink> covers the reference and the review. The
          <ArticleLink href="/pricing">pricing page</ArticleLink> lists the paid plans.
        </p>

        <FaqList items={faqs} />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/blog/ai-talking-head-video-generator", title: "AI talking head checklist", description: "Quality checks before publishing." },
          { href: "/guides/talking-head-first-scene", title: "First scene", description: "Open with the moment, not the timeline." },
          { href: "/blog/founder-story-video-for-saas", title: "Founder story video", description: "When the founder should stay on camera." },
          { href: "/ai-ugc-video-generator", title: "AI UGC video generator", description: "The Vidmake workflow." },
          { href: "/explore/hook-video", title: "Hook video", description: "Use the prepared identity in an opening you review." },
          { href: "/blog/hook-video-maker", title: "Hook video maker", description: "Keep the reference scene and your message apart." },
          { href: "/pricing", title: "Pricing and plans", description: "Current plan details." },
          { href: "/blog/saas-video-ideas", title: "25 SaaS video ideas", description: "Ideas you can actually produce." },
        ]}
      />
    </VideoMarketingPage>
  );
}
