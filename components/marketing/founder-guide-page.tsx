import { ArrowRight, ChevronRight, Clock3 } from "lucide-react";
import Link from "next/link";

import { GuideContentBrief } from "@/components/marketing/guide-content-brief";
import { LandingHeader } from "@/components/marketing/landing-header";

type GuideSection = {
  title: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
  presentation?: "brief" | "example";
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
  author?: string;
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
  sources?: readonly { label: string; href: string }[];
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
    title: "SaaS content marketing: turn customer questions into a week of useful posts",
    description:
      "Plan useful organic SaaS content from customer questions, with a filled brief, video and slide examples, a weekly plan, and practical ways to review results.",
    readingTime: "10 min read",
    author: "UGCPilot",
    audience: "For SaaS founders planning useful organic content",
    introduction:
      "SaaS content marketing means publishing explanations, examples, and resources that help the people your software serves. You do not need a new feature announcement every week. Start with a question those people ask, give a complete answer, and adapt it into formats that make the answer easier to use. This guide takes you from a question bank to three useful posts and a review process you can run with a document, spreadsheet, and your existing editor.",
    takeaways: [
      "Choose one audience question and define what someone should learn or do after reading.",
      "Adapt the answer into a demonstration, a text-led explanation, and a slide story when each adds value.",
      "Review clarity and useful responses alongside search visibility; a signup is not every post's purpose.",
    ],
    sections: [
      {
        title: "Where do useful SaaS content ideas come from?",
        paragraphs: [
          "Keep a question bank before filling a publishing calendar. After an onboarding session, support conversation, or product demonstration, record the question someone needed answered. Preserve their wording, the situation, and the source. Remove personal and account details before using those notes in a shared planning document.",
          "Group questions that ask for the same answer. 'What can I post without a launch?' and 'How do I find ideas between updates?' might belong to one topic. A short factual answer may fit an FAQ; a task with several decisions may need a guide. Search Console queries can add useful language when data is available, but they do not show every question in your market.",
          "When you have few customers, ask the intended audience about a task they struggled with recently and note the questions they ask in relevant communities. Treat these as research inputs to validate. Do not present an invented conversation as customer evidence.",
        ],
        bullets: [
          "Question bank fields: original question, audience, task, source, repeated variants, evidence needed, and answer status.",
          "Useful sources: support notes, onboarding questions, sales conversations, product-use observations, and available search queries.",
        ],
      },
      {
        title: "Which question should you answer first?",
        paragraphs: [
          "Choose a question relevant to the people you serve that you can answer with useful detail. Prefer a clear task over a broad label such as 'marketing tips.' Check whether you can show a method, example, or decision the reader could apply. A popular topic outside your experience is harder to make valuable.",
          "Write one outcome sentence: 'After this post, the reader can…' If the sentence names several unrelated skills, narrow the topic. Decide whether the piece should teach, demonstrate, compare, or help someone choose a next step. A complete answer can be worthwhile even when its next step is to try an exercise rather than sign up.",
        ],
        bullets: [
          "Audience fit: who asks this, and what are they trying to do?",
          "Evidence: what can you show or explain from actual experience?",
          "Scope: can one piece answer it well without sending the reader elsewhere for the essential step?",
          "Distinctness: does an existing guide already answer it? Improve that guide when appropriate.",
        ],
      },
      {
        title: "What belongs in a useful content brief?",
        presentation: "brief",
        paragraphs: [
          "Write the answer before choosing a format. Name the reader's situation, explain why the problem occurs, and describe the action that addresses it. Record which claims need evidence and where the method has limits. This gives every version the same factual foundation without forcing it to use the same wording.",
          "Copy the fields below into a document or spreadsheet. Fill them before drafting. The outcome and next action should be specific enough for another person to tell whether the post delivers them.",
        ],
        bullets: [
          "Reader and situation: [Who is this for, and what are they trying to do?]",
          "Question: [What do they need answered, in their words?]",
          "Useful outcome: [What can they understand or do after this?]",
          "Answer and method: [The direct answer, followed by the necessary steps.]",
          "Evidence and limits: [Demonstration, source, or example; what it cannot prove.]",
          "Format and next action: [Why this format helps, and a relevant action the reader can take.]",
        ],
      },
      {
        title: "A filled example: what can I post without a product update?",
        presentation: "example",
        paragraphs: [
          "This is an illustrative planning exercise, not a customer quotation or a measured result. Imagine a solo SaaS founder who has no launch announcement and keeps postponing their next post. The problem is that announcements are their only source of ideas. The answer is to teach a task or answer a recurring question that remains useful between releases.",
          "The reader's outcome is to choose one question and outline a useful answer. The method is to review a question bank, select an answerable task, write the direct answer, and show a relevant example. The evidence is a sample planning document labeled as illustrative. It proves how to plan the content; it does not prove future views, leads, or rankings.",
          "A filled brief could read: 'Reader: solo SaaS founder between releases. Question: what can I post when nothing new has shipped? Outcome: choose one useful topic today. Answer: teach a task someone is trying to finish. Method: collect a question, write its answer, and show an example. Limit: validate the topic with the intended audience. Next action: add one real question to your bank and draft its answer.'",
        ],
      },
      {
        title: "How can that answer become three useful posts?",
        paragraphs: [
          "Choose a format based on what it makes easier to understand. You do not have to produce all three. If the explanation works best as a written post, start there. Reuse the underlying answer while giving each asset a different teaching job.",
          "For a Hook video, open with a specific problem and follow it with a demonstration. Example: 'No product update this week? Answer a question your audience already asks.' Show an illustrative question bank, select one topic, and write a direct answer. If you use a product demo instead, the opening promise must match the task shown in the footage.",
          "For Wall of text, make the answer readable without a talking-head recording. Example on-screen copy: 'Nothing new to announce? Choose one question. Write the direct answer. Add a practical example. Give the reader one step to try.' Use relevant owned or generated background footage, divide the text into readable parts, and leave enough time to read each part. Check the result on a phone.",
          "For Slideshows, let the reader inspect the method at their own pace. An image sequence can explain each decision separately. Use the outline below, inspect the order, and correct any image or wording that obscures the point. A slideshow of images and an exported slideshow video are different outputs; choose the one your destination supports.",
        ],
        bullets: [
          "Slide 1 — Problem: 'Nothing new to announce this week?'",
          "Slide 2 — Reframe: 'Teach a task instead of waiting for a release.'",
          "Slide 3 — Source: 'Collect a question from a conversation, support note, or research.'",
          "Slide 4 — Method: 'Write the direct answer and show one practical example.'",
          "Slide 5 — Action: 'Choose one real question and draft its answer today.'",
        ],
      },
      {
        title: "What does a manageable publishing week look like?",
        paragraphs: [
          "Separate research, creation, review, publishing, and learning. Plan around the time you can actually give the work. The sequence below is one example, not a requirement to post daily or a claim that three posts will outperform one complete explanation.",
          "Keep the channel focused too. Choose a place where your intended audience already looks for this kind of help. A detailed comparison may need an article; a visual task may benefit from a demonstration. If you publish an article and adapt it for social, make each post useful on its own and link to the longer explanation where that helps.",
        ],
        bullets: [
          "Monday: choose the question, gather evidence, and fill the brief.",
          "Tuesday: write the full answer and prepare the first useful format.",
          "Wednesday: review and publish the explanation; collect follow-up questions.",
          "Thursday: adapt the answer into a demonstration or text-led post if it adds something.",
          "Friday: publish the reviewed asset and note where people needed more explanation.",
          "Next planning session: update the question bank and decide what to improve.",
        ],
      },
      {
        title: "What should you check before publishing?",
        paragraphs: [
          "Ask someone unfamiliar with the draft to state its main point and next step. If they cannot, revise the explanation before polishing the design. Check that the opening makes an honest promise, the example fulfills it, and essential instructions are included. Show limitations where they affect the reader's decision.",
          "Review visual content at phone size. Text should stay readable against the background, remain visible long enough, and avoid covering the important action. Check generated lettering and product details against the source. Use actual captures when describing a product workflow and label illustrative material clearly.",
          "AI can help organize notes or suggest wording, but verify the answer and any product claim yourself. Manual text overlays do not imply automatic speech captions, and a generated image does not prove a customer outcome. Use media you own or are permitted to use, confirm destination links, and publish only the version you reviewed.",
        ],
      },
      {
        title: "How do you measure whether the content helped?",
        paragraphs: [
          "Choose measures that match the job. For education, useful questions, responses that show understanding, or people reporting they completed the task can reveal whether the explanation worked. Saves and shares can support that picture, but they do not establish that someone understood or acted. A lack of replies does not by itself prove failure.",
          "For an SEO article, use Search Console to inspect relevant queries, impressions, clicks, and average position over comparable periods. For a social video, inspect the available watch and retention data for signs that the opening or pacing needs work. Keep Organic Search visits separate from Organic Social visits. Availability and definitions differ across reporting tools.",
          "If the article offers a relevant product next step, track guide-to-product visits and completed new-user signups when instrumentation exists. Keep button clicks distinct from signups. Record the baseline, change date, report filters, and missing data. Search effects take time; other releases, promotions, and audience changes can also affect results.",
        ],
        bullets: [
          "Review log: topic, URL or post, intended outcome, publish date, available metrics, useful responses, unanswered questions, and next change.",
          "Example decision: if readers keep asking how to choose a question, add a selection example before creating more formats.",
        ],
      },
      {
        title: "Which mistakes should you avoid?",
        paragraphs: [
          "A calendar full of topics is not yet a useful content system. An explanation can still fall short if it makes an unsupported promise, skips a necessary step, or repeats the same idea without adding context. Improve the answer that people need before expanding the publishing schedule.",
        ],
        bullets: [
          "Starting with a trending format before deciding what the audience needs answered.",
          "Turning every question into a sales pitch that withholds the useful method.",
          "Copying identical wording into a video, a text post, and slides without adapting the explanation.",
          "Inventing customer quotations, results, or product capabilities to fill an evidence gap.",
          "Treating a bigger page count, a fixed word count, or a skill score as proof of search success.",
        ],
      },
      {
        title: "How do you keep improving the next week's content?",
        paragraphs: [
          "Save the approved brief and assets with their source question and review notes. Add new questions as they arrive, group repeats, and correct older answers when product behavior or audience needs change. This makes the library a record of what you have learned rather than a folder of disconnected posts.",
          "Start the next cycle with one decision: improve a confusing answer, demonstrate a missing step, or address a distinct new question. The next useful action today is simple: find one real question, write what the reader should learn, and complete the brief above. A spreadsheet and your existing editor are enough to begin.",
        ],
      },
    ],
    checklistTitle: "Your next useful post: a practical checklist",
    checklist: [
      "Choose one real audience question and record its source without personal details.",
      "State what the reader should understand or be able to do after the post.",
      "Fill the brief, write a complete answer, and add an honest example.",
      "Choose the format that makes the answer easiest to use; check it on a phone.",
      "Review claims, visuals, and links before publishing the approved version.",
      "Save useful responses and missing explanations for the next revision.",
    ],
    faqs: [
      {
        question: "What is SaaS content marketing?",
        answer:
          "It is publishing useful explanations, demonstrations, comparisons, and resources for the people your software serves. Choose the format and next action according to what the reader needs to understand or do.",
      },
      {
        question: "How do I find SaaS content ideas?",
        answer:
          "Record questions from support, onboarding, sales conversations, product-use observations, and available search queries. Group similar questions and choose one you can answer with a useful method and evidence.",
      },
      {
        question: "What can I post when I have no product announcement?",
        answer:
          "Answer a recurring audience question, demonstrate a task, explain a common mistake, or help someone compare approaches. A useful lesson can stand on its own between product releases.",
      },
      {
        question: "Do I need to film myself to make useful SaaS videos?",
        answer:
          "No. A screen demonstration, relevant background footage with readable text, or an image sequence can explain an idea. Choose what makes the task clear, check the result on a phone, and use media you are permitted to use.",
      },
      {
        question: "How often should a small SaaS team publish?",
        answer:
          "Choose a cadence you can research, produce, and review reliably. Start with one complete answer and add supporting formats when they contribute something useful. Daily publishing is not a requirement of this method.",
      },
      {
        question: "Will better articles guarantee higher Google rankings?",
        answer:
          "No. Helpful content supports the reader's task, but rankings also depend on relevance, competition, technical access, and other signals. Use Search Console to observe changes over time and keep the comparison periods and reporting limits clear.",
      },
    ],
    productHref: "/ai-social-media-manager",
    productLabel: "Explore a workflow for creating and reviewing content",
    related: ["saas-marketing", "social-media-marketing-for-saas", "marketing-for-startups"],
    sources: [
      { label: "Google Search Central: creating helpful, reliable content", href: "https://developers.google.com/search/docs/fundamentals/creating-helpful-content" },
      { label: "Google Search Console: understanding search performance", href: "https://support.google.com/webmasters/answer/7576553?hl=en" },
      { label: "Google Analytics: recommended events, including sign_up", href: "https://support.google.com/analytics/answer/9267735?hl=en" },
    ],
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
          name: guide.author ?? "UGCPilot",
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
  const sections = guide.sections.map((section, index) => ({
    ...section,
    id: `guide-section-${index + 1}`,
  }));
  const linkClassName = "text-foreground-strong underline decoration-primary/70 underline-offset-4 hover:decoration-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";
  const headingClassName = "text-[23px] font-semibold leading-[1.35] tracking-[-0.025em] text-foreground-strong sm:text-[26px]";

  return (
    <main className="instagram-theme min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(guide) }}
      />
      <a href="#guide-content" className="sr-only z-50 rounded-md bg-card px-4 py-3 text-foreground-strong focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:outline-none focus:ring-2 focus:ring-focus">
        Skip to the guide
      </a>
      <LandingHeader initialHasSession={false} />

      <article id="guide-content" className="mx-auto max-w-[800px] px-5 pb-16 pt-28 sm:px-8 sm:pb-20 sm:pt-32">
        <header>
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <Link href="/guides" className="inline-flex min-h-11 items-center font-medium hover:text-foreground-strong focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">Guides</Link>
            <ChevronRight className="size-3.5" aria-hidden="true" />
            <span>{guide.keyword}</span>
          </nav>
          <p className="mt-5 text-sm font-medium text-muted">{guide.audience}</p>
          <h1 className="mt-3 text-[30px] font-semibold leading-[1.2] tracking-[-0.035em] text-foreground-strong sm:text-[36px]">{guide.title}</h1>
          <p className="mt-5 text-[17px] leading-7 text-muted">{guide.description}</p>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
            <span className="inline-flex items-center gap-2"><Clock3 className="size-4" aria-hidden="true" />{guide.readingTime}</span>
            {guide.author ? <span>By {guide.author}</span> : null}
          </div>
        </header>

        <details className="mt-8 border-y border-border">
          <summary className="cursor-pointer py-4 text-sm font-medium text-foreground-strong focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">On this page</summary>
          <nav aria-label="Guide contents" className="pb-5">
            <ul className="space-y-1 text-sm leading-6">
              {sections.map((section) => (
                <li key={section.id}><a href={`#${section.id}`} className={`inline-flex min-h-11 items-center ${linkClassName}`}>{section.title}</a></li>
              ))}
              <li><a href="#guide-checklist" className={`inline-flex min-h-11 items-center ${linkClassName}`}>{guide.checklistTitle}</a></li>
              <li><a href="#guide-faqs" className={`inline-flex min-h-11 items-center ${linkClassName}`}>Frequently asked questions</a></li>
              {guide.sources ? <li><a href="#guide-sources" className={`inline-flex min-h-11 items-center ${linkClassName}`}>Sources and further reading</a></li> : null}
            </ul>
          </nav>
        </details>

        <p className="mt-8 text-[17px] leading-[1.75] text-foreground">{guide.introduction}</p>

        <div className="mt-10 space-y-10 sm:space-y-12">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className={`scroll-mt-6 ${section.presentation === "example" ? "rounded-r-lg border-l-2 border-primary bg-card-muted p-5 sm:p-6" : ""}`}>
              <h2 className={headingClassName}>{section.title}</h2>
              <div className="mt-4 space-y-4 text-[17px] leading-[1.75] text-foreground">
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
              {section.bullets ? (
                section.presentation === "brief" ? (
                  <GuideContentBrief id={`${section.id}-brief`} fields={section.bullets} />
                ) : (
                  <ul className="mt-5 list-disc space-y-3 pl-5 text-[17px] leading-[1.75] text-foreground marker:text-muted">
                    {section.bullets.map((bullet) => <li key={bullet} className="pl-1">{bullet}</li>)}
                  </ul>
                )
              ) : null}
            </section>
          ))}

          <section className="border-t border-border pt-8">
            <h2 className={headingClassName}>Key takeaways</h2>
            <ul className="mt-4 list-disc space-y-3 pl-5 text-[17px] leading-[1.75] marker:text-muted">
              {guide.takeaways.map((takeaway) => <li key={takeaway} className="pl-1">{takeaway}</li>)}
            </ul>
          </section>

          <section id="guide-checklist" className="scroll-mt-6 border-t border-border pt-8">
            <h2 className={headingClassName}>{guide.checklistTitle}</h2>
            <ol className="mt-5 list-decimal space-y-4 pl-6 text-[17px] leading-[1.75] marker:font-medium marker:text-muted">
              {guide.checklist.map((item) => <li key={item} className="pl-2">{item}</li>)}
            </ol>
          </section>

          <section id="guide-faqs" className="scroll-mt-6 border-t border-border pt-8">
            <h2 className={headingClassName}>Frequently asked questions</h2>
            <div className="mt-4 divide-y divide-border">
              {guide.faqs.map((faq) => (
                <details key={faq.question} className="group">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-5 py-4 text-[17px] font-medium leading-7 text-foreground-strong focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus [&::-webkit-details-marker]:hidden">
                    {faq.question}<ChevronRight className="mt-1.5 size-4 shrink-0 group-open:rotate-90" aria-hidden="true" />
                  </summary>
                  <p className="pb-5 text-[17px] leading-[1.75] text-foreground">{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>

          {guide.sources ? (
            <section id="guide-sources" className="scroll-mt-6 border-t border-border pt-8">
              <h2 className={headingClassName}>Sources and further reading</h2>
              <ul className="mt-4 space-y-2 text-sm leading-6">
                {guide.sources.map((source) => (
                  <li key={source.href}><a href={source.href} className={`inline-flex min-h-11 items-center ${linkClassName}`}>{source.label}</a></li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <footer className="mt-12 border-t border-border pt-8">
          <h2 className={headingClassName}>Keep learning</h2>
          <ul className="mt-4 space-y-2">
            {relatedGuides.map((related) => (
              <li key={related.slug}>
                <Link href={`/guides/${related.slug}`} className={`inline-flex min-h-11 items-start gap-3 py-2 text-base leading-7 ${linkClassName}`}>
                  <span>{related.title}</span><ArrowRight className="mt-1.5 size-4 shrink-0" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm leading-6 text-muted">
            Ready to put this into practice?{" "}
            <Link href={guide.productHref} className={linkClassName}>{guide.productLabel}</Link>.
          </p>
          <Link href="/guides" className={`mt-5 inline-flex min-h-11 items-center text-sm ${linkClassName}`}>All founder guides</Link>
        </footer>
      </article>
    </main>
  );
}
