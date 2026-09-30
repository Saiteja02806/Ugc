import { ArrowRight, Check, ChevronRight, Clock3, Lightbulb } from "lucide-react";
import Link from "next/link";

import { LandingAuthCta } from "@/components/marketing/landing-auth-actions";
import { LandingHeader } from "@/components/marketing/landing-header";

type GuideSection = {
  title: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
};

type GuideFaq = {
  question: string;
  answer: string;
};

export type FounderGuide = {
  slug: string;
  keyword: string;
  title: string;
  description: string;
  readingTime: string;
  audience: string;
  introduction: string;
  takeaways: readonly string[];
  sections: readonly GuideSection[];
  checklistTitle: string;
  checklist: readonly string[];
  faqs: readonly GuideFaq[];
  productHref: string;
  productLabel: string;
  related: readonly string[];
};

export const founderGuideOpenGraphImage = {
  url: "/guides/opengraph-image",
  width: 1200,
  height: 630,
  alt: "UGCPilot founder marketing guides",
};

export const founderGuides = {
  "saas-marketing": {
    slug: "saas-marketing",
    keyword: "SaaS marketing",
    title: "SaaS marketing: build a repeatable system for earning attention",
    description:
      "A practical SaaS marketing guide for founders who need to explain their product, reach the right audience, and turn useful content into a weekly growth rhythm.",
    readingTime: "8 min read",
    audience: "For SaaS founders and small product teams",
    introduction:
      "SaaS marketing works when a founder can repeatedly connect a customer problem to a clear product outcome. Start with one useful message, adapt it into the formats people actually consume, and keep a review step before publishing. The goal is a system that makes the next week of marketing easier than the last.",
    takeaways: [
      "Choose one customer problem before deciding on a content format or channel.",
      "Make the product outcome specific enough that a new visitor can repeat it back.",
      "Turn one message into several content formats instead of inventing every post from scratch.",
    ],
    sections: [
      {
        title: "Start with a problem your buyers already recognize",
        paragraphs: [
          "The strongest SaaS marketing starts before the feature list. Name a recurring frustration, delay, risk, or missed opportunity that your buyer recognizes in their own work. A message about the problem gives a product demo, carousel, social post, and launch email the same strategic center.",
          "Use customer calls, onboarding questions, sales objections, support tickets, and competitor alternatives to find this language. Keep the phrasing close to how customers speak. Founders often use internal product language, while prospects search for the work they are trying to finish.",
        ],
        bullets: [
          "What takes too long today?",
          "What result is hard to achieve with the current process?",
          "What does the buyer need to understand before they can value the product?",
        ],
      },
      {
        title: "Write a message your team can use across every format",
        paragraphs: [
          "Create a short message brief: who the message is for, the problem, the desired outcome, the proof, and the next action. This is more useful than a broad content calendar because it gives the team a reliable starting point for each post.",
          "For example, a scheduling product does not need to lead with every feature. It can focus on the outcome: a team sees what is ready to publish, who needs to approve it, and where it is going next. That one statement can become an explainer, a customer story, or a product walkthrough.",
        ],
      },
      {
        title: "Match the message to the format",
        paragraphs: [
          "A SaaS founder does not need every social format. Use a carousel when a concept needs steps, a short video when the opening needs movement, and a text-led video when a sharp point needs to be easy to read. Reusing the same message in appropriate formats improves consistency without making the feed repetitive.",
          "Make each asset complete on its own. A viewer should understand the point without having seen an earlier post or knowing the product already. That discipline also produces clearer landing-page copy and sales material.",
        ],
      },
      {
        title: "Build a weekly feedback loop",
        paragraphs: [
          "Set a pace that survives a busy product week. Pick one message, create two or three formats, review the finished assets, publish them, and record what earned meaningful replies, saves, clicks, demos, or signups. The next brief should use those observations.",
          "This turns SaaS marketing into a learning loop. The team develops a library of approved messages, learns which angles explain the product quickly, and avoids restarting from an empty document every Monday.",
        ],
      },
    ],
    checklistTitle: "A weekly SaaS marketing checklist",
    checklist: [
      "Choose one customer problem or product outcome.",
      "Write a brief with audience, proof, and one next action.",
      "Create a carousel, short video, or text-led video from that brief.",
      "Review the complete post before account selection and timing.",
      "Record the response and use it to shape next week’s message.",
    ],
    faqs: [
      {
        question: "What is the best marketing channel for a SaaS startup?",
        answer:
          "Use the channel where your buyers already look for ideas, peers, and solutions. Start with one channel you can support consistently, then use the same message in other formats after you have evidence it is useful.",
      },
      {
        question: "How often should a SaaS founder publish content?",
        answer:
          "Choose a pace your team can maintain. A small, reviewed weekly system is more valuable than a large publishing burst that stops after a few weeks.",
      },
      {
        question: "What should SaaS marketing content explain?",
        answer:
          "Explain the customer problem, the change the product makes possible, the process behind that change, and proof that the approach works for the audience you serve.",
      },
    ],
    productHref: "/ai-social-media-manager",
    productLabel: "See the founder content workflow",
    related: [
      "saas-content-marketing",
      "marketing-for-startups",
      "how-to-market-a-website",
    ],
  },
  "saas-content-marketing": {
    slug: "saas-content-marketing",
    keyword: "SaaS content marketing",
    title: "SaaS content marketing: turn product knowledge into a content pipeline",
    description:
      "Learn how SaaS founders can turn product knowledge, customer questions, and launch insights into useful social content that supports growth every week.",
    readingTime: "9 min read",
    audience: "For SaaS founders who need a practical content engine",
    introduction:
      "SaaS content marketing becomes manageable when it begins with the knowledge your team already has. Product decisions, customer questions, demonstrations, and launch notes contain useful material. A content pipeline helps you shape that material into clear, reviewable posts instead of waiting for a vague new idea.",
    takeaways: [
      "Build content from customer questions and product evidence, rather than generic trends.",
      "Give each piece one job: attract attention, explain a concept, show proof, or support a decision.",
      "Keep a small library of approved angles so the team can compound its work.",
    ],
    sections: [
      {
        title: "Create a source list before you create a calendar",
        paragraphs: [
          "A calendar says when to publish. A source list says what the company knows that is worth sharing. Start with onboarding calls, sales conversations, feature launches, support questions, workflow mistakes, and before-and-after examples. These are the raw materials for useful SaaS content.",
          "Group the source list into themes such as customer education, product method, common objections, and outcomes. Each theme should connect to a question a potential user is likely to ask before trying the product.",
        ],
      },
      {
        title: "Use content jobs to avoid repeating yourself",
        paragraphs: [
          "Give each post a single job. Awareness content names a problem. Education content teaches a concept. Proof content demonstrates a result or workflow. Decision content helps a buyer compare approaches and take a next step. A balanced pipeline uses all four without forcing every post to sell.",
          "This helps founders see where a message belongs. A new product capability might become an awareness hook, an educational carousel, a short walkthrough, and a proof point in a later post.",
        ],
        bullets: [
          "Awareness: make the hidden problem easy to recognize.",
          "Education: explain the method or decision clearly.",
          "Proof: show the workflow, result, or customer evidence.",
          "Decision: help the buyer choose a next action.",
        ],
      },
      {
        title: "Turn one useful idea into several assets",
        paragraphs: [
          "Pick one point that your audience needs to understand. Write the complete explanation first, then adapt it. A carousel can make the sequence scannable, a short video can make the opening immediate, and a text-led video can give the statement visual weight. The shared brief keeps every format coherent.",
          "Do not duplicate the same post verbatim. Let each format contribute something: steps in a carousel, a visual example in video, or a concise argument in a text-led asset.",
        ],
      },
      {
        title: "Create a content library that improves over time",
        paragraphs: [
          "Save approved assets with their source idea, audience, product area, and result. Over time, the team can identify which themes lead to good conversations and which explanations reduce confusion. This library is the compounding asset in SaaS content marketing.",
          "Use review as a quality control step. Founders and product leads can correct claims, add specificity, and protect the voice of the business before a post is published.",
        ],
      },
    ],
    checklistTitle: "A SaaS content pipeline checklist",
    checklist: [
      "Collect customer questions, product changes, and proof in one source list.",
      "Select one content job for the next post.",
      "Write a brief that explains the audience, point, proof, and action.",
      "Create two formats from the same brief where it adds value.",
      "Save the approved work and record the response it receives.",
    ],
    faqs: [
      {
        question: "What content works best for SaaS companies?",
        answer:
          "Content that helps a potential customer understand a problem, evaluate a method, or see the outcome of a workflow tends to be most useful. The right format depends on how much explanation the idea needs.",
      },
      {
        question: "How do I find SaaS content ideas?",
        answer:
          "Use customer calls, onboarding questions, sales objections, support conversations, product changes, and common workflow mistakes as your idea sources.",
      },
      {
        question: "Can a small SaaS team do content marketing?",
        answer:
          "Yes. Start with one message each week, adapt it into a few focused formats, and preserve a review step. A small system is easier to maintain and learn from.",
      },
    ],
    productHref: "/instagram-carousel-maker",
    productLabel: "Create a product explainer carousel",
    related: ["saas-marketing", "marketing-for-startups", "mobile-app-marketing"],
  },
  "mobile-app-marketing": {
    slug: "mobile-app-marketing",
    keyword: "Mobile app marketing",
    title: "Mobile app marketing: create attention before and after launch",
    description:
      "A practical mobile app marketing guide for founders who need to explain their app, build launch attention, and keep creating useful content after release.",
    readingTime: "8 min read",
    audience: "For mobile-app founders preparing for launch or growth",
    introduction:
      "Mobile app marketing is easier when it makes the app’s value visible before someone opens an app store listing. Show the moment a user recognizes the problem, the action they take in the app, and the outcome they get. This gives a founder a message system that works before launch and continues after the first release.",
    takeaways: [
      "Lead with the user’s moment of need, rather than a screen-by-screen feature tour.",
      "Create a launch sequence that builds familiarity before asking for a download.",
      "Keep post-launch content connected to user questions and outcomes.",
    ],
    sections: [
      {
        title: "Define the app’s useful moment",
        paragraphs: [
          "Every app has a moment when its value becomes clear: a task is finished faster, a decision becomes easier, an error disappears, or a habit becomes possible. Put that moment at the center of the marketing message. It is more memorable than listing every screen or technical capability.",
          "Describe the user before and after the app. This creates a clear visual brief for screenshots, short videos, carousels, and store-listing copy.",
        ],
      },
      {
        title: "Build a launch sequence instead of one announcement",
        paragraphs: [
          "A launch needs several points of contact. Start with the problem, reveal the approach, demonstrate the key workflow, share early feedback, and then invite people to try the app. Each piece gives people a different reason to pay attention without requiring one announcement to do all the work.",
          "Prepare the core assets before launch: a short hook video, a carousel that explains the workflow, and a small set of text-led posts that make the benefit easy to repeat.",
        ],
        bullets: [
          "Problem: the frustrating moment the app removes.",
          "Method: the new approach the app makes possible.",
          "Demo: the smallest workflow that proves the value.",
          "Invitation: the clear next step for an interested user.",
        ],
      },
      {
        title: "Use social content to make the app easier to understand",
        paragraphs: [
          "A good app post can teach the category, show a use case, or help someone imagine the result. Carousels work well for sequences and comparisons. Short videos work well for a visible action or reaction. Text-led videos work well for a sharp insight that users will recognize immediately.",
          "Keep the visual direction consistent with the product. A user should feel the same promise in the content, app-store listing, onboarding, and product itself.",
        ],
      },
      {
        title: "Continue the story after launch",
        paragraphs: [
          "The launch is the start of the marketing loop. Use early user questions, reviews, feature requests, and usage patterns to decide what to explain next. This makes the content more concrete and gives the founder an ongoing source of ideas.",
          "A weekly review of what users asked, saved, clicked, or shared keeps the app’s public message close to actual market feedback.",
        ],
      },
    ],
    checklistTitle: "A mobile app marketing checklist",
    checklist: [
      "Describe the user’s before-and-after moment in one sentence.",
      "Plan a pre-launch, launch, and post-launch message sequence.",
      "Prepare a demo, an explainer carousel, and concise launch posts.",
      "Review claims and store-link details before publishing.",
      "Use early feedback to choose the next content topic.",
    ],
    faqs: [
      {
        question: "When should I start marketing a mobile app?",
        answer:
          "Start when you can clearly describe the user problem and the outcome the app creates. You can build familiarity with the problem and the method before the public launch date.",
      },
      {
        question: "What content should I create for an app launch?",
        answer:
          "Create content that names the problem, demonstrates the key workflow, explains the outcome, and gives interested users a clear next step to try the app.",
      },
      {
        question: "Do I need a large audience to market an app?",
        answer:
          "No. A clear message for the right users is more useful than broad content that does not explain why the app matters. Consistent, helpful posts give the audience time to understand the product.",
      },
    ],
    productHref: "/ai-ugc-video-generator",
    productLabel: "Create a launch video in AI Studio",
    related: ["marketing-for-startups", "how-to-market-a-website", "saas-marketing"],
  },
  "marketing-for-startups": {
    slug: "marketing-for-startups",
    keyword: "Marketing for startups",
    title: "Marketing for startups: choose the message before the channel",
    description:
      "A startup marketing guide for founders who need to explain a new product clearly, focus limited resources, and build a sustainable content routine.",
    readingTime: "8 min read",
    audience: "For website, SaaS, and mobile-app founders with lean teams",
    introduction:
      "Marketing for startups is a prioritization problem. A small team cannot pursue every channel, audience, and message at once. The first job is to decide which customer problem matters now, explain the outcome clearly, and build a small publishing rhythm that helps the market understand the product over time.",
    takeaways: [
      "Pick one audience and one immediate problem before investing in more channels.",
      "Make early marketing useful enough to earn attention before it asks for a signup.",
      "Use a weekly message system so marketing survives product and customer work.",
    ],
    sections: [
      {
        title: "Choose a narrow starting point",
        paragraphs: [
          "Early startup marketing becomes scattered when the product tries to speak to every possible customer. Choose the audience segment most likely to understand the problem, act on the outcome, and give useful feedback. Then write the message around the job they are already trying to do.",
          "A narrow starting point does not limit the company forever. It gives the founder a way to learn which words, examples, and proof points create real interest before expanding the message.",
        ],
      },
      {
        title: "Use a simple founder message brief",
        paragraphs: [
          "Before creating content, answer five questions: Who is this for? What problem do they face? What changes with the product? What proves the claim? What should the reader do next? This brief keeps website copy, demos, social posts, and sales conversations aligned.",
          "The proof can be a workflow, a data point, an early customer quote, a before-and-after comparison, or a product demonstration. Specific proof makes a young company more credible than broad promises.",
        ],
      },
      {
        title: "Build content around the buyer’s learning journey",
        paragraphs: [
          "New buyers first need to recognize the problem, then understand the approach, then see why the product is credible. Plan content for each stage. A founder can use a short point of view to create awareness, a carousel to teach the process, and a product walkthrough to support a decision.",
          "This approach creates a connected system. Every post supports the next question a potential user will ask instead of competing for attention in isolation.",
        ],
      },
      {
        title: "Make the routine small enough to keep",
        paragraphs: [
          "Pick one core idea every week and turn it into a few formats. Give one person ownership of the brief and another person, often the founder or product lead, ownership of review. This is enough structure to protect quality without creating a marketing bureaucracy.",
          "Review the response each week. Replies, saved posts, demos, customer questions, and conversion behavior point to the topics worth developing further.",
        ],
      },
    ],
    checklistTitle: "A startup marketing checklist",
    checklist: [
      "Choose one priority audience for the next marketing cycle.",
      "Document the problem, outcome, proof, and next action.",
      "Create content for awareness, education, and decision support.",
      "Assign a reviewer for product claims and tone.",
      "Use audience response to refine next week’s brief.",
    ],
    faqs: [
      {
        question: "What marketing should a startup do first?",
        answer:
          "Start by making the customer problem and product outcome easy to understand. Then choose one channel and a small content rhythm that the team can sustain while it learns from the response.",
      },
      {
        question: "How can a startup market with a small team?",
        answer:
          "Use one shared message brief, create a few formats from each idea, and keep a lightweight review process. This reduces reinvention and keeps the public message accurate.",
      },
      {
        question: "What makes startup marketing credible?",
        answer:
          "Specificity. Show the audience, problem, workflow, proof, and outcome instead of relying on broad claims about being better or faster.",
      },
    ],
    productHref: "/social-media-marketing-for-startups",
    productLabel: "Build a founder social routine",
    related: ["saas-marketing", "mobile-app-marketing", "how-to-market-a-website"],
  },
  "how-to-market-a-website": {
    slug: "how-to-market-a-website",
    keyword: "How to market a website",
    title: "How to market a website: help the right people discover what you built",
    description:
      "Learn how website founders can clarify their value, create useful content, and build a simple marketing loop that brings the right visitors back to their product.",
    readingTime: "8 min read",
    audience: "For founders whose website is the product, storefront, or main acquisition path",
    introduction:
      "A website is ready to market when a visitor can quickly understand who it helps, what changes for them, and why they should take the next step. Marketing then extends that clarity beyond the site through useful content, demonstrations, and repeatable distribution. The objective is qualified attention from people the product can genuinely help.",
    takeaways: [
      "Make the website’s audience, problem, and outcome clear before driving more traffic.",
      "Use useful content to answer the questions visitors ask before they convert.",
      "Connect every content theme to a relevant page or action on the site.",
    ],
    sections: [
      {
        title: "Make the website ready for attention",
        paragraphs: [
          "Before publishing more content, check the first screen of the website. A new visitor should be able to identify the audience, the problem, the outcome, and the next step without decoding product jargon. The clearer this is, the more value the rest of the marketing work can create.",
          "Use the same wording in social content and on the site. A visitor who clicks from a post should arrive at a page that continues the same promise, not a different or more abstract message.",
        ],
      },
      {
        title: "Turn buyer questions into content themes",
        paragraphs: [
          "List the questions a visitor asks before they take action: What is this? Who is it for? How does it work? What result can I expect? How is it different from the current approach? Each question can become a content theme with several useful examples.",
          "A website founder can turn a single question into a short explanation, a carousel of steps, a product demonstration, and a supporting page on the site. This creates a clear path from discovery to deeper evaluation.",
        ],
      },
      {
        title: "Choose distribution channels by audience behavior",
        paragraphs: [
          "Use the places where your audience already learns and compares options. For many founders, that includes search, social posts, communities, newsletters, partner ecosystems, and direct conversations. Begin with the channel where you can be most useful and consistent.",
          "Do not measure a channel only by reach. Look for qualified clicks, conversations, email signups, demos, and the questions that reveal whether visitors understand the product.",
        ],
      },
      {
        title: "Run a simple weekly promotion loop",
        paragraphs: [
          "Every week, select one page or product outcome that deserves more attention. Create content that makes the idea easy to discover, link to the relevant page, review the asset, publish it, and note what visitors do next. Repeating this loop creates a practical marketing habit around the website.",
          "The material compounds. Helpful posts can be refreshed into guides, guides can support search discovery, and customer questions can improve both the content and the site itself.",
        ],
      },
    ],
    checklistTitle: "A website marketing checklist",
    checklist: [
      "Check that the homepage clearly states audience, problem, outcome, and action.",
      "List the questions a visitor asks before converting.",
      "Create one useful content piece that answers a priority question.",
      "Link the content to the page that continues the same promise.",
      "Track qualified visits, conversations, and conversions from the topic.",
    ],
    faqs: [
      {
        question: "How do I market a new website?",
        answer:
          "First make the website’s value clear, then create useful content around the questions the right visitors have. Share that content where the audience already learns and connect it to the relevant site page.",
      },
      {
        question: "What should I promote on my website?",
        answer:
          "Promote the product outcome, the customer problem you solve, the workflow behind the result, and proof that helps a visitor decide whether the product fits their situation.",
      },
      {
        question: "Can social media help market a website?",
        answer:
          "Yes. Social content can introduce useful ideas, demonstrate the product, and direct interested people to the page where they can learn more or take the next step.",
      },
    ],
    productHref: "/instagram-carousel-maker",
    productLabel: "Turn a website insight into a carousel",
    related: ["marketing-for-startups", "saas-content-marketing", "mobile-app-marketing"],
  },
  "social-media-marketing-for-saas": {
    slug: "social-media-marketing-for-saas",
    keyword: "Social media marketing for SaaS",
    title: "Social media marketing for SaaS: explain the product before you ask for a demo",
    description:
      "A social media marketing guide for SaaS founders who want to turn product knowledge into useful posts, clearer buyer education, and steady demand creation.",
    readingTime: "8 min read",
    audience: "For SaaS founders building a social content practice",
    introduction:
      "Social media marketing for SaaS works when it helps a buyer understand something useful before it asks them to buy. A post can name a costly workflow problem, show a better method, or demonstrate the outcome the product creates. The founder’s job is to make those ideas clear enough that a new audience can recognize why the product deserves attention.",
    takeaways: [
      "Use social content to teach the category and the customer problem, not to repeat feature announcements.",
      "Give every post one clear job: create recognition, explain a method, demonstrate proof, or invite a next step.",
      "Keep a review step so public claims stay accurate as the product changes.",
    ],
    sections: [
      {
        title: "Choose the buyer question behind each post",
        paragraphs: [
          "The most useful SaaS social posts answer a real buyer question. That might come from a sales call, onboarding session, support conversation, or a founder’s own explanation of why the product exists. Starting here produces clearer content than starting with a blank calendar.",
          "Write the question in the buyer’s words, then decide what would make the answer genuinely useful. A good post leaves the reader with a clearer way to identify a problem, assess a process, or imagine an outcome.",
        ],
        bullets: [
          "Why does the current workflow create friction?",
          "What does a better process look like in practice?",
          "What evidence would help the buyer trust the change?",
        ],
      },
      {
        title: "Use a content mix that supports understanding",
        paragraphs: [
          "Not every post has to promote the product directly. Mix problem recognition, practical education, product demonstrations, and customer proof. This lets people meet the company at different stages of awareness while keeping the content connected to the same market problem.",
          "For example, publish a point of view about a broken process, a carousel that explains a better sequence, and a short video that demonstrates the product’s role in that sequence. The formats work together because the underlying message is consistent.",
        ],
      },
      {
        title: "Make product content easy to follow",
        paragraphs: [
          "Feature-heavy content often fails because it assumes too much context. Start with the job the user is trying to complete, show the important action, and state the outcome. Keep the product screen or workflow visible only when it helps the audience understand the point.",
          "Use a carousel to reveal a process step by step. Use short video when the action or before-and-after moment is the proof. Use text-led video when a concise claim deserves more attention than a screen recording.",
        ],
      },
      {
        title: "Build a reviewable publishing rhythm",
        paragraphs: [
          "A small SaaS team needs a rhythm that protects accuracy. Plan one core message, prepare the related assets, review product claims and visual context, then schedule the approved work. This keeps the final publishing decision with the people who know the product and audience best.",
          "After publishing, save the message and note which topics earned qualified responses. Use the strongest questions and conversations to choose the next brief instead of starting the following week from zero.",
        ],
      },
    ],
    checklistTitle: "A SaaS social media checklist",
    checklist: [
      "Collect one buyer question from calls, onboarding, or support.",
      "Choose whether the post should create recognition, teach, prove, or invite a next step.",
      "Select the format that makes the point easiest to understand.",
      "Review product claims, visual context, caption, account, and timing.",
      "Record the questions and qualified responses the post creates.",
    ],
    faqs: [
      {
        question: "What should a SaaS company post on social media?",
        answer:
          "Post useful explanations of the buyer problem, the method behind a better workflow, product demonstrations that show an outcome, and credible proof from the market or customers.",
      },
      {
        question: "Which social platform is best for SaaS marketing?",
        answer:
          "Use the platform where the people you serve already exchange ideas, learn about their work, and compare approaches. Start with one channel you can support consistently, then expand when the message proves useful.",
      },
      {
        question: "How can founders make SaaS social content faster?",
        answer:
          "Use a shared brief built from product context and customer questions. One clear message can support several formats, while a review step keeps the finished work accurate and on-brand.",
      },
    ],
    productHref: "/ai-social-media-manager",
    productLabel: "Create and review SaaS social content",
    related: ["saas-marketing", "saas-content-marketing", "marketing-for-startups"],
  },
} satisfies Record<string, FounderGuide>;

export function getFounderGuide(slug: string): FounderGuide {
  const guide = founderGuides[slug as keyof typeof founderGuides];

  if (!guide) {
    throw new Error(`Unknown founder guide: ${slug}`);
  }

  return guide;
}

function toJsonLd(guide: FounderGuide) {
  const url = `https://getugcpilot.com/guides/${guide.slug}`;

  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: guide.title,
        description: guide.description,
        mainEntityOfPage: url,
        author: {
          "@type": "Organization",
          name: "UGCPilot",
        },
        publisher: {
          "@type": "Organization",
          name: "UGCPilot",
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Guides",
            item: "https://getugcpilot.com/guides",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: guide.keyword,
            item: url,
          },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: guide.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      },
    ],
  }).replace(/</g, "\\u003c");
}

export function FounderGuidePage({ guide }: { guide: FounderGuide }) {
  const relatedGuides = guide.related.map(getFounderGuide);

  return (
    <main className="instagram-theme min-h-screen overflow-x-hidden bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(guide) }}
      />
      <LandingHeader initialHasSession={false} />

      <section className="relative overflow-hidden border-b border-border px-4 pb-16 pt-28 sm:px-6 sm:pb-22 sm:pt-36 lg:px-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_62%_52%_at_48%_0%,rgba(255,107,69,0.15),transparent_76%)]" />
        <div className="mx-auto max-w-[900px]">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <Link href="/guides" className="font-medium hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">Guides</Link>
            <ChevronRight className="size-4" aria-hidden="true" />
            <span>{guide.keyword}</span>
          </nav>
          <p className="mt-8 inline-flex rounded-full border border-primary/35 bg-primary/[0.08] px-3 py-1.5 text-xs font-semibold text-primary">{guide.audience}</p>
          <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-[0.98] tracking-[-0.05em] text-foreground-strong sm:text-5xl lg:text-6xl">{guide.title}</h1>
          <p className="mt-6 max-w-3xl text-base leading-7 text-muted sm:text-lg sm:leading-8">{guide.description}</p>
          <div className="mt-7 flex items-center gap-2 text-sm font-medium text-muted">
            <Clock3 className="size-4 text-primary" aria-hidden="true" />
            {guide.readingTime}
          </div>
        </div>
      </section>

      <article className="px-4 py-16 sm:px-6 sm:py-22 lg:px-8">
        <div className="mx-auto grid max-w-[1200px] gap-12 lg:grid-cols-[minmax(0,1fr)_310px] lg:gap-18">
          <div className="max-w-3xl">
            <p className="text-lg leading-8 text-foreground-strong sm:text-xl">{guide.introduction}</p>
            <div className="mt-12 space-y-12">
              {guide.sections.map((section, index) => (
                <section key={section.title}>
                  <p className="font-mono text-xs font-bold text-primary">{String(index + 1).padStart(2, "0")}</p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-foreground-strong sm:text-3xl">{section.title}</h2>
                  <div className="mt-5 space-y-4 text-base leading-7 text-muted">
                    {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  </div>
                  {section.bullets ? (
                    <ul className="mt-6 space-y-3 rounded-[20px] border border-border bg-card p-5 text-sm leading-6 text-muted shadow-card">
                      {section.bullets.map((bullet) => (
                        <li key={bullet} className="flex gap-3"><Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />{bullet}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>
          </div>

          <aside className="h-fit lg:sticky lg:top-24">
            <div className="rounded-[24px] border border-primary/30 bg-[linear-gradient(145deg,rgba(255,107,69,0.15),rgba(255,107,69,0.04))] p-6 shadow-floating">
              <Lightbulb className="size-5 text-primary" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-semibold text-foreground-strong">Key takeaways</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-muted">
                {guide.takeaways.map((takeaway) => <li key={takeaway} className="flex gap-3"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />{takeaway}</li>)}
              </ul>
            </div>
            <Link href={guide.productHref} className="group mt-4 flex rounded-[22px] border border-border bg-card p-5 shadow-card transition-[transform,border-color] hover:-translate-y-0.5 hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
              <span>
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Put the system to work</span>
                <span className="mt-2 block text-sm font-semibold leading-6 text-foreground-strong">{guide.productLabel}</span>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">Explore UGCPilot <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span>
              </span>
            </Link>
          </aside>
        </div>
      </article>

      <section className="border-y border-border bg-card-muted/45 px-4 py-16 sm:px-6 sm:py-22 lg:px-8">
        <div className="mx-auto max-w-[900px]">
          <p className="text-sm font-semibold text-primary">Put it into practice</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground-strong sm:text-4xl">{guide.checklistTitle}</h2>
          <ol className="mt-8 grid gap-3 sm:grid-cols-2">
            {guide.checklist.map((item, index) => (
              <li key={item} className="flex gap-4 rounded-[18px] border border-border bg-card p-5 shadow-card">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/[0.1] text-xs font-bold text-primary">{index + 1}</span>
                <span className="text-sm leading-6 text-muted">{item}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-22 lg:px-8">
        <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
          <div>
            <p className="text-sm font-semibold text-primary">Questions, answered</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.04em] text-foreground-strong sm:text-4xl">The details founders ask first.</h2>
          </div>
          <div className="divide-y divide-border rounded-[22px] border border-border bg-card px-5 shadow-card sm:px-7">
            {guide.faqs.map((faq) => (
              <details key={faq.question} className="group py-5">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-5 text-base font-semibold text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus [&::-webkit-details-marker]:hidden">
                  {faq.question}<span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary transition-transform duration-200 group-open:scale-150 motion-reduce:transition-none" aria-hidden="true" />
                </summary>
                <p className="mt-3 pr-6 text-sm leading-6 text-muted">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-card-muted/45 px-4 py-16 sm:px-6 sm:py-22 lg:px-8">
        <div className="mx-auto max-w-[1200px]">
          <p className="text-sm font-semibold text-primary">Keep learning</p>
          <div className="mt-3 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-foreground-strong sm:text-4xl">Continue building a marketing system that fits your product.</h2>
            <Link href="/guides" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">All founder guides <ArrowRight className="size-4" aria-hidden="true" /></Link>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {relatedGuides.map((related) => (
              <Link key={related.slug} href={`/guides/${related.slug}`} className="group rounded-[22px] border border-border bg-card p-6 shadow-card transition-[transform,border-color] hover:-translate-y-0.5 hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{related.keyword}</p>
                <h3 className="mt-3 text-lg font-semibold leading-6 text-foreground-strong">{related.title}</h3>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">Read guide <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-18 pt-16 sm:px-6 sm:pb-24 sm:pt-22 lg:px-8">
        <div className="mx-auto max-w-[1200px] rounded-[28px] border border-primary/30 bg-[linear-gradient(130deg,rgba(255,107,69,0.18),rgba(255,107,69,0.05)_58%,rgba(255,255,255,0.02))] px-6 py-10 shadow-floating sm:px-10 sm:py-14 lg:px-14">
          <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-foreground-strong sm:text-4xl">Turn the next useful idea into content your team can review.</h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted">Add your product context, choose the right format for the message, and keep the final publishing decision with your team.</p>
          <div className="mt-8"><LandingAuthCta className="group inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background" initialHasSession={false} /></div>
        </div>
      </section>
    </main>
  );
}
