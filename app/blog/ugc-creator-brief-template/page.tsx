import type { Metadata } from "next";

import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import {
  ArticleBody,
  ArticleCommand,
  ArticleH2,
  ArticleH3,
  ArticleLink,
  FaqList,
} from "@/components/marketing/seo-article";
import { articleJsonLd, publicOrigin } from "@/lib/marketing/brand-videos";
import { faqJsonLd } from "@/lib/marketing/mcp-public";

const path = "/blog/ugc-creator-brief-template";
const title = "UGC Creator Brief Template: The 8 Fields That Prevent a Bad Video";
const description =
  "A copyable UGC creator brief template with the eight fields that decide whether a video is usable: audience, message, proof, format, hook, action, review rules and usage rights.";
const datePublished = "2026-11-07";

const faqs = [
  {
    question: "What should a UGC creator brief include?",
    answer:
      "At minimum: the audience, the single message, the proof the viewer must see, the format and length, the opening line, the intended next step, the review rules, and how the asset may be used. If any field is missing, the creator has to guess.",
  },
  {
    question: "How long should a UGC video brief be?",
    answer:
      "Short enough to read in two minutes. One page with concrete fields beats a long brand document. Put the exact message and the required proof at the top, then add examples and anything that must not appear.",
  },
  {
    question: "Do I need a brief for AI-generated UGC?",
    answer:
      "Yes. A prompt is a brief. The same fields still apply: audience, message, setting, action, duration, format and what must be visible. A focused brief is the difference between a controllable output and a random clip.",
  },
  {
    question: "Who should approve the finished video?",
    answer:
      "Someone who knows the product and the audience well enough to confirm every claim. Keep an approval step before publishing or downloading, and name the reviewer in the brief so the decision is not ambiguous.",
  },
  {
    question: "Can one brief cover several videos?",
    answer:
      "Use one brief per message, not per format. If you plan to test several openings for the same message, write the core brief once and change only the hook line and the expected action for each variation.",
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

const briefTemplate = `1. Audience
   Who this is for, and what they already know:

2. One message
   The single idea the viewer should understand:

3. Required proof
   What must be visible on screen to support the message:

4. Format and length
   Vertical video / text-led video / carousel; target seconds:

5. Opening line
   The first sentence or on-screen text:

6. Next step
   What the viewer should do (visit, sign up, watch the demo):

7. Review rules
   Who approves, what must be checked, what must not be claimed:

8. Usage
   Where the asset may be posted, and for how long:`;

export default function UgcCreatorBriefTemplatePage() {
  return (
    <VideoMarketingPage
      eyebrow="UGC brief template"
      h1={title}
      lede="Most bad UGC videos are not a filming problem. They are a missing-brief problem. Copy these eight fields, fill them in honestly, and the same brief works for a human creator or an AI video workflow."
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
          A creator opens your brief and has to make several decisions fast: who is watching, what the video should
          say, what should be on screen, how long it should be, and what happens at the end. When any of those is
          missing, the creator fills the gap with a guess. The result is technically a video and practically unusable.
        </p>
        <p>
          The fix is a one-page brief with eight fields. It is short enough to fill in ten minutes and specific enough
          that two different creators would produce recognisably similar work.
        </p>

        <ArticleH2>Copy the UGC creator brief template</ArticleH2>
        <ArticleCommand>{briefTemplate}</ArticleCommand>
        <p>
          Keep the wording plain. If a field needs a paragraph of explanation, the message is not clear yet. Rewrite
          the message first, then fill the rest. The <ArticleLink href="/guides/marketing-for-startups">marketing for
          startups guide</ArticleLink> covers choosing the message before choosing the channel.
        </p>

        <ArticleH2>Why each field earns its place</ArticleH2>

        <ArticleH3>1. Audience changes the opening</ArticleH3>
        <p>
          A founder who already knows the product needs a different first sentence than someone who has never heard of
          it. Write down what the viewer already knows. It prevents the classic mistake of explaining the category to
          an audience that only wanted the answer. For hook options, see the <ArticleLink href="/free-hook-lines">free
          hook lines library</ArticleLink>.
        </p>

        <ArticleH3>2. One message, not three</ArticleH3>
        <p>
          A short video that tries to explain the product, the pricing and the founder story at once usually
          communicates none of them. Pick the one idea the viewer should repeat to a colleague. Everything else belongs
          in a different asset. The <ArticleLink href="/blog/ugc-ad-script-templates">UGC ad script template
          breakdown</ArticleLink> shows how one message shapes a full script.
        </p>

        <ArticleH3>3. Required proof is the honesty field</ArticleH3>
        <p>
          This is where most briefs fail. &ldquo;Show the dashboard&rdquo; is a suggestion; &ldquo;hold on the next-step
          section long enough to read it&rdquo; is a requirement. Decide what the viewer must actually see. Then do not
          let the edit remove it. If the proof does not exist yet, the video is not ready to claim the outcome. Related:
          <ArticleLink href="/guides/product-demo-to-short-video"> turning a product demo into a short video</ArticleLink>.
        </p>

        <ArticleH3>4. Format and length are a decision, not a default</ArticleH3>
        <p>
          Vertical video suits movement and a spoken hook. A text-led video suits a point that needs reading time. A
          carousel suits a sequence of steps. Name the format and the target length so the creator does not guess.
          The <ArticleLink href="/instagram-carousel-maker">carousel workflow</ArticleLink> is the right test when the
          message needs more than one screen.
        </p>

        <ArticleH3>5. The opening line is the test</ArticleH3>
        <p>
          Write the first sentence exactly. If it sounds like an ad, rewrite it. A useful test: would a real person say
          this to a colleague? The <ArticleLink href="/blog/ugc-hooks">UGC hooks guide</ArticleLink> groups openings by
          intent so you can pick one that matches the message.
        </p>

        <ArticleH3>6. Name the next step</ArticleH3>
        <p>
          &ldquo;Learn more&rdquo; is not a next step. Decide what the viewer should do and make sure the video can
          actually support it. If the next step is a demo, the video should show the feature the demo covers.
        </p>

        <ArticleH3>7. Review rules prevent claims drift</ArticleH3>
        <p>
          Name the reviewer and list anything that must not appear: invented metrics, fake customer quotes, a feature
          that does not exist, a competitor claim you cannot source. Review is not a formality; it is where the brand
          keeps control. The <ArticleLink href="/guides/saas-social-creative-review">social creative review
          guide</ArticleLink> provides a reusable checklist.
        </p>

        <ArticleH3>8. Usage is part of the brief</ArticleH3>
        <p>
          Say where the asset may be posted and for how long. A clip made for an owned organic channel is not
          automatically cleared for paid media, and creator usage terms differ. Put the answer in writing before work
          starts.
        </p>

        <ArticleH2>A filled example, so the template is not theoretical</ArticleH2>
        <p>
          Here is one brief for a fictional project-notes app. Every detail is an editorial illustration, not a claim
          about a real product:
        </p>
        <ArticleCommand>{`1. Audience
   Freelance designers who already take client calls and forget the next step.

2. One message
   After a call, the decisions and next steps can live in one place.

3. Required proof
   Hold on a note that shows both "Decisions" and "Next step" on screen, readable on a phone.

4. Format and length
   Vertical video, 15-20 seconds, spoken hook plus a real screen recording.

5. Opening line
   "You took the call. Where did the next step go?"

6. Next step
   Watch the 20-second demo on the trial page.

7. Review rules
   No invented reminder feature; no claim that notes are shared automatically.
   Reviewer: founder. Must check the demo shows the exact screen named in the script.

8. Usage
   Organic Reels and TikTok for 30 days; paid usage needs a separate approval.`}</ArticleCommand>

        <ArticleH2>The difference between a vague and a usable brief</ArticleH2>
        <div className="overflow-x-auto rounded-[22px] border border-border">
          <table className="w-full min-w-[520px] border-collapse text-left text-sm leading-6">
            <caption className="sr-only">Vague brief fields compared with specific, testable fields</caption>
            <thead className="bg-card-muted/60 text-foreground-strong">
              <tr>
                <th scope="col" className="p-4 font-semibold">Field</th>
                <th scope="col" className="p-4 font-semibold">Too vague</th>
                <th scope="col" className="p-4 font-semibold">Usable</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">Audience</th>
                <td className="p-4 align-top">&quot;Designers&quot;</td>
                <td className="p-4 align-top">&quot;Freelance designers who take client calls&quot;</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">Proof</th>
                <td className="p-4 align-top">&quot;Show the app&quot;</td>
                <td className="p-4 align-top">&quot;Hold on the Next step section for two seconds&quot;</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">Opening</th>
                <td className="p-4 align-top">&quot;Make it catchy&quot;</td>
                <td className="p-4 align-top">&quot;You took the call. Where did the next step go?&quot;</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">Review</th>
                <td className="p-4 align-top">&quot;Check it looks good&quot;</td>
                <td className="p-4 align-top">&quot;Founder checks the named screen and every claim&quot;</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          The pattern is simple: replace adjectives with observable conditions. &quot;Catchy&quot; cannot be approved or
          rejected consistently. &quot;Hold on the Next step section for two seconds&quot; can.
        </p>

        <ArticleH2>Mapping the brief to a human creator or an AI workflow</ArticleH2>
        <div className="overflow-x-auto rounded-[22px] border border-border">
          <table className="w-full min-w-[520px] border-collapse text-left text-sm leading-6">
            <caption className="sr-only">How each brief field lands with a human creator versus an AI video workflow</caption>
            <thead className="bg-card-muted/60 text-foreground-strong">
              <tr>
                <th scope="col" className="p-4 font-semibold">Brief field</th>
                <th scope="col" className="p-4 font-semibold">Human creator</th>
                <th scope="col" className="p-4 font-semibold">AI workflow</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">Audience and message</th>
                <td className="p-4 align-top">Actor direction and script notes</td>
                <td className="p-4 align-top">Prompt context and scene direction</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">Required proof</th>
                <td className="p-4 align-top">Shot list and props</td>
                <td className="p-4 align-top">Reference media and a real recording to cut in</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">Format and length</th>
                <td className="p-4 align-top">Camera and runtime</td>
                <td className="p-4 align-top">Aspect ratio, duration and model settings</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="p-4 font-semibold text-foreground-strong">Review</th>
                <td className="p-4 align-top">Approval before usage</td>
                <td className="p-4 align-top">Inspect the generated result before download</td>
              </tr>
            </tbody>
          </table>
        </div>

        <ArticleH2>Using this brief with an AI video workflow</ArticleH2>
        <p>
          In Vidmake, the brief maps to the inputs the workflow already asks for: message, format, reference material and
          review. Write the brief first, then generate. A focused prompt produces a controllable result; a vague prompt
          produces a clip you cannot direct. Start with the <ArticleLink href="/ai-ugc-video-generator">AI UGC video
          generator</ArticleLink> workflow, or run it from an AI assistant through the
          <ArticleLink href="/mcp">MCP server</ArticleLink>.
        </p>

        <ArticleH2>A quick quality check before you approve</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Can a new viewer tell who this is for within three seconds?</li>
          <li>Is there exactly one message, stated in plain words?</li>
          <li>Is the required proof visible and readable on a phone?</li>
          <li>Does the opening line sound like a person, not a slogan?</li>
          <li>Is the next step real and reachable?</li>
          <li>Would the reviewer approve every claim without adding context?</li>
        </ul>

        <FaqList items={faqs} />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/blog/ugc-ad-script-templates", title: "UGC ad script templates", description: "Turn the brief into a full script." },
          { href: "/blog/ugc-hooks", title: "UGC hooks that stop the scroll", description: "Choose an opening that matches the message." },
          { href: "/guides/how-to-create-ugc-videos-with-ai", title: "Create UGC videos with AI", description: "Brief, generate, review and download." },
          { href: "/free-hook-lines", title: "Free hook line library", description: "Starting lines you can adapt for the opening field." },
          { href: "/guides/saas-social-creative-review", title: "Review social creative", description: "A practical approval checklist." },
          { href: "/ai-ugc-video-generator", title: "AI UGC video generator", description: "Run the brief through the product workflow." },
        ]}
      />
    </VideoMarketingPage>
  );
}
