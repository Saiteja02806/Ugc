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

const path = "/blog/tiktok-slideshow-maker";
const title = "TikTok Slideshow Maker: Build a Carousel People Swipe Through";
const description =
  "How to make a TikTok slideshow that holds attention: slide count, opening slide, one idea per slide, readable text and a review step, plus how the Vidmake carousel workflow fits.";
const datePublished = "2026-11-08";

const faqs = [
  {
    question: "What is a TikTok slideshow?",
    answer:
      "A TikTok photo post: a set of images viewers swipe through, usually with text on each slide. It behaves differently from a video because the viewer controls the pace.",
  },
  {
    question: "How many slides should a TikTok slideshow have?",
    answer:
      "There is no universal number. In our measured sample of 28 verified slideshows, two-slide posts had the highest median views, but the set was curated and not a controlled test. Start with the number of slides the message actually needs.",
  },
  {
    question: "Can I make a TikTok slideshow in Vidmake?",
    answer:
      "Vidmake's carousel workflow lets you create a complete slide sequence from business context, review it, and download the approved version. TikTok posting is a separate step; check the current export and publishing options for your account.",
  },
  {
    question: "What should the first slide say?",
    answer:
      "One line that makes the next swipe worth it. It should name the situation or the promise, not the brand. Write it last, after the rest of the deck makes sense.",
  },
  {
    question: "Do text-heavy slides perform worse?",
    answer:
      "Density is not the only factor, but readability is. If a slide cannot be read in a couple of seconds on a phone, the viewer swipes past the idea. Break the text into more slides rather than shrinking it.",
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

export default function TiktokSlideshowMakerPage() {
  return (
    <VideoMarketingPage
      eyebrow="TikTok slideshows"
      h1={title}
      lede="A slideshow is a sequence, not a poster. The viewer decides when to move on, so every slide has to earn the next swipe. Here is how to build one that does."
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          articleJsonLd({ path, headline: title, description, imagePath: `${path}/opengraph-image`, datePublished }),
          faqJsonLd(faqs),
        ],
      }}
    >
      <ArticleBody>
        <ArticleH2>Start with the swipe, not the design</ArticleH2>
        <p>
          A slideshow is read in the viewer&rsquo;s rhythm. They see slide one, decide in about a second whether slide
          two is worth it, and repeat. That means the content order matters more than any single slide.
        </p>
        <p>
          Write the sequence as a list of one-line beats before you design anything. If the list does not build, no
          amount of styling will fix it.
        </p>

        <ArticleH2>Choose the slide count deliberately</ArticleH2>
        <p>
          In our <ArticleLink href="/blog/tiktok-slideshow-view-data">measured sample of 28 verified TikTok
          slideshows</ArticleLink>, two-slide posts had the highest median views, but the set was curated and not a
          controlled test. The practical lesson is not &ldquo;use two slides&rdquo;; it is &ldquo;test the number your
          message needs instead of assuming longer is better.&rdquo;
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="text-foreground-strong">2–3 slides:</strong> one idea with a setup and a payoff.</li>
          <li><strong className="text-foreground-strong">4–6 slides:</strong> a short sequence with context, steps or an example.</li>
          <li><strong className="text-foreground-strong">7+ slides:</strong> a genuine explainer; each slide must add something new.</li>
        </ul>

        <ArticleH2>The five-part structure</ArticleH2>
        <ol className="list-decimal space-y-3 pl-5">
          <li><strong className="text-foreground-strong">Opening line:</strong> name the situation the viewer recognises.</li>
          <li><strong className="text-foreground-strong">Tension:</strong> what goes wrong, or what they are missing.</li>
          <li><strong className="text-foreground-strong">Sequence:</strong> the steps, the comparison or the story.</li>
          <li><strong className="text-foreground-strong">Proof:</strong> a real screenshot, example or result.</li>
          <li><strong className="text-foreground-strong">Close:</strong> the next step in one line.</li>
        </ol>
        <p>
          This is the same structure the <ArticleLink href="/guides/saas-carousel-feature-story">carousel feature-story
          guide</ArticleLink> uses. If the deck is about a problem, the
          <ArticleLink href="/guides/saas-problem-solution-slideshow">problem-solution guide</ArticleLink> has a variant.
        </p>

        <ArticleH2>Make every slide readable on a phone</ArticleH2>
        <ArticleH3>One idea per slide</ArticleH3>
        <p>
          Two short sentences beat one dense paragraph. If a slide needs a heading, a paragraph and a footnote, it is
          two slides. The <ArticleLink href="/guides/saas-slideshow-opening-slide">opening-slide guide</ArticleLink>
          covers the first frame specifically.
        </p>
        <ArticleH3>Test text size on a real phone</ArticleH3>
        <p>
          View the deck at normal phone size, not on your desktop canvas. Check contrast and safe areas: platform
          controls can cover the bottom of the slide. The
          <ArticleLink href="/guides/readable-video-text">readable text guide</ArticleLink> works for slides too.
        </p>
        <ArticleH3>Keep the visual system consistent</ArticleH3>
        <p>
          A consistent background, type treatment and spacing makes the sequence feel deliberate. A
          <ArticleLink href="/guides/saas-carousel-visual-brief">visual brief</ArticleLink> keeps a deck from drifting
          between slides.
        </p>

        <ArticleH2>Review before you publish</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Does slide one work without any other context?</li>
          <li>Does each slide make the next one necessary?</li>
          <li>Is the proof real — a genuine screenshot or a supplied example?</li>
          <li>Is every claim sourced to something the deck shows?</li>
          <li>Are names, messages and account details removed?</li>
          <li>Can the whole deck be read by someone who is scrolling quickly?</li>
        </ul>

        <ArticleH2>How the Vidmake carousel workflow fits</ArticleH2>
        <p>
          The <ArticleLink href="/instagram-carousel-maker">Vidmake carousel maker</ArticleLink> starts from your
          business context, builds a complete slide sequence, and lets you review the deck before downloading the
          approved version. TikTok photo posts and Instagram carousels are different destinations, so check the current
          format requirements before you export for each.
        </p>
        <p>
          If your message needs motion rather than swiping, the
          <ArticleLink href="/ai-ugc-video-generator">AI UGC video generator</ArticleLink> and the
          <ArticleLink href="/guides/saas-slideshow-story-vs-tutorial">story-versus-tutorial guide</ArticleLink> cover
          the video alternative. A free trial runs for seven days with 20 daily content pieces; see
          <ArticleLink href="/pricing">pricing</ArticleLink>.
        </p>

        <FaqList items={faqs} />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/instagram-carousel-maker", title: "Carousel maker", description: "Create and review a complete slide sequence." },
          { href: "/blog/tiktok-slideshow-view-data", title: "TikTok slideshow data", description: "28 verified posts and what their numbers show." },
          { href: "/guides/saas-carousel-feature-story", title: "Carousel feature story", description: "Structure a deck around one feature." },
          { href: "/guides/saas-slideshow-opening-slide", title: "Opening slide", description: "Make the first slide carry the message." },
          { href: "/guides/readable-video-text", title: "Readable text", description: "Check contrast, size and safe areas." },
          { href: "/guides/saas-slideshow-breakdowns", title: "Slideshow breakdowns", description: "Study pacing and structure examples." },
        ]}
      />
    </VideoMarketingPage>
  );
}
