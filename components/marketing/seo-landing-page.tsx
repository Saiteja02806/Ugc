import {
  ArrowRight,
  Check,
  CircleCheckBig,
  FileText,
  ImageIcon,
  Play,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { LandingAuthCta } from "@/components/marketing/landing-auth-actions";
import { LandingHeader } from "@/components/marketing/landing-header";

type Feature = {
  title: string;
  description: string;
  icon: LucideIcon;
};

type Step = {
  eyebrow: string;
  title: string;
  description: string;
};

type Faq = {
  question: string;
  answer: string;
};

export type SeoLandingPageContent = {
  canonicalPath: string;
  eyebrow: string;
  title: string;
  description: string;
  proof: string;
  workflowLabel: string;
  workflow: readonly Step[];
  features: readonly Feature[];
  featuresTitle: string;
  featuresDescription: string;
  faqs: readonly Faq[];
  relatedPages: readonly {
    title: string;
    description: string;
    href: string;
  }[];
  ctaTitle: string;
  ctaDescription: string;
};

export const seoPageContent = {
  carousel: {
    canonicalPath: "/instagram-carousel-maker",
    eyebrow: "Instagram carousel maker",
    title: "Turn your business story into an Instagram carousel.",
    description:
      "Start with your website and offer, choose a creative direction, then review a complete carousel before you schedule it for Instagram.",
    proof: "Business context → creative direction → human approval",
    workflowLabel: "A carousel is a complete post, not a loose set of slide ideas.",
    workflow: [
      {
        eyebrow: "Business context",
        title: "Give the work a real starting point",
        description:
          "Add your website and business details so the angle begins with your actual offer and audience.",
      },
      {
        eyebrow: "Creative direction",
        title: "Choose the story worth telling",
        description:
          "Review a carousel angle and its slide structure before it becomes a post for your library.",
      },
      {
        eyebrow: "Approval and publishing",
        title: "Keep the final call with your team",
        description:
          "Approve the finished carousel, add an optional caption, and schedule it to a connected Instagram account.",
      },
    ],
    featuresTitle: "A clearer route from an idea to an Instagram post.",
    featuresDescription:
      "The carousel workflow keeps the message, slides, review, and publishing decision in one place.",
    features: [
      {
        title: "Start from your offer",
        description:
          "Use business context to ground each carousel in what you actually sell and who it is for.",
        icon: FileText,
      },
      {
        title: "Review the whole sequence",
        description:
          "Evaluate the finished carousel as one coherent post before it reaches a publishing decision.",
        icon: ImageIcon,
      },
      {
        title: "Publish with intent",
        description:
          "Choose the connected Instagram account, optional caption, and timing only after approval.",
        icon: CircleCheckBig,
      },
    ],
    faqs: [
      {
        question: "What does an Instagram carousel maker do?",
        answer:
          "It helps you turn one business idea into a sequence of slides that works together as a single Instagram post.",
      },
      {
        question: "Can I review a carousel before it is scheduled?",
        answer:
          "Yes. UGCPilot keeps the carousel in review so you can approve the creative before selecting an Instagram account and publish time.",
      },
      {
        question: "Do I need to write a caption before scheduling?",
        answer:
          "No. Captions are optional, and a blank caption stays blank when you schedule the carousel.",
      },
    ],
    relatedPages: [
      {
        title: "AI UGC video generator",
        description: "Create short-form video alongside your carousel workflow.",
        href: "/ai-ugc-video-generator",
      },
      {
        title: "SaaS content marketing guide",
        description: "Turn product knowledge into a weekly content pipeline.",
        href: "/guides/saas-content-marketing",
      },
    ],
    ctaTitle: "Start your next carousel from the business behind it.",
    ctaDescription:
      "Set up your business context, review a complete carousel, and decide what gets published.",
  },
  video: {
    canonicalPath: "/ai-ugc-video-generator",
    eyebrow: "AI UGC video generator",
    title: "Create short-form videos with a direction your team can stand behind.",
    description:
      "Use AI Studio to make a video from a clear prompt and reference media, then keep the finished asset in your content workflow.",
    proof: "Prompt and reference media → generated video → content workflow",
    workflowLabel: "Use the reference and the brief to shape the video before it is generated.",
    workflow: [
      {
        eyebrow: "Set direction",
        title: "Describe the video you need",
        description:
          "Start with a focused prompt that names the message, setting, and content direction you want to explore.",
      },
      {
        eyebrow: "Add a reference",
        title: "Bring the right visual context",
        description:
          "Attach compatible image or video reference media when it helps give the generation a more specific starting point.",
      },
      {
        eyebrow: "Keep the output",
        title: "Use the finished video in your workflow",
        description:
          "Completed generations are saved to your account so your team can keep working with the result.",
      },
    ],
    featuresTitle: "Video generation with a focused working surface.",
    featuresDescription:
      "AI Studio gives the creative brief, reference choice, and finished assets one shared home.",
    features: [
      {
        title: "A prompt with purpose",
        description:
          "Describe the video you want to create instead of starting from an empty editing timeline.",
        icon: FileText,
      },
      {
        title: "Reference-aware creation",
        description:
          "Add an image or video reference where it makes the intended creative direction easier to communicate.",
        icon: ImageIcon,
      },
      {
        title: "Saved results",
        description:
          "Keep finished generations in your account instead of losing the output when the session ends.",
        icon: Play,
      },
    ],
    faqs: [
      {
        question: "What is an AI UGC video generator?",
        answer:
          "It is a tool for creating short-form, creator-style video from a written brief, with optional reference media to guide the result.",
      },
      {
        question: "Can I use reference media when creating a video?",
        answer:
          "Yes. AI Studio supports compatible image and video references so you can provide more visual context for a generation.",
      },
      {
        question: "Where do finished videos go?",
        answer:
          "Finished generations are saved to your account for use in the rest of your UGCPilot workflow.",
      },
    ],
    relatedPages: [
      {
        title: "Instagram carousel maker",
        description: "Create a companion carousel when a message needs more explanation.",
        href: "/instagram-carousel-maker",
      },
      {
        title: "AI social media manager",
        description: "See how generation fits into a wider content workflow.",
        href: "/ai-social-media-manager",
      },
      {
        title: "Mobile app marketing guide",
        description: "Build a launch sequence that helps users understand your app.",
        href: "/guides/mobile-app-marketing",
      },
    ],
    ctaTitle: "Give your next video a clear creative starting point.",
    ctaDescription:
      "Open AI Studio, set the direction, add reference media where useful, and create a short-form video.",
  },
  startups: {
    canonicalPath: "/social-media-marketing-for-startups",
    eyebrow: "Social media marketing for startups",
    title: "Build a social routine your startup can actually keep.",
    description:
      "Turn what your company knows into a consistent mix of short videos, text-led posts, and carousels that your team reviews before publishing.",
    proof: "One offer → several useful formats → a repeatable publishing rhythm",
    workflowLabel: "The aim is a routine your team can maintain, not a one-off burst of posts.",
    workflow: [
      {
        eyebrow: "Choose one message",
        title: "Start with a customer question",
        description:
          "Pick one idea your audience needs help understanding: a problem, an outcome, a process, or a useful point of view.",
      },
      {
        eyebrow: "Match the format",
        title: "Make the message fit the medium",
        description:
          "Use a carousel when the explanation has steps, a short video when the hook needs movement, and text-led video when the point needs clarity.",
      },
      {
        eyebrow: "Review and repeat",
        title: "Create a pace your team can sustain",
        description:
          "Keep a review step before publishing, then use the approved work to build a consistent weekly content rhythm.",
      },
    ],
    featuresTitle: "A content system for teams with limited time.",
    featuresDescription:
      "UGCPilot keeps the strategy brief, creative work, and approval decision close enough to move quickly without losing judgment.",
    features: [
      {
        title: "Work from what you know",
        description:
          "Start from your company context so posts explain the offer, customer, and category you actually understand.",
        icon: FileText,
      },
      {
        title: "Use more than one format",
        description:
          "Choose the content form that gives each message the best chance to be understood.",
        icon: ImageIcon,
      },
      {
        title: "Keep an approval step",
        description:
          "Move faster while preserving a final decision by someone who knows the product and audience.",
        icon: CircleCheckBig,
      },
    ],
    faqs: [
      {
        question: "How often should a startup post on social media?",
        answer:
          "Choose a frequency your team can maintain with useful, reviewed work. A consistent routine built around real customer questions is more practical than a large burst that cannot continue.",
      },
      {
        question: "What should a startup post about?",
        answer:
          "Start with the questions, problems, proof points, and working methods that help a potential customer understand what your company does.",
      },
      {
        question: "Which social format should I use?",
        answer:
          "Use the format that suits the message. A carousel can explain a sequence, a short video can make a hook immediate, and a text-led video can make a concise point readable.",
      },
    ],
    relatedPages: [
      {
        title: "Instagram carousel maker",
        description: "Use a carousel when your idea needs a clear sequence of slides.",
        href: "/instagram-carousel-maker",
      },
      {
        title: "AI social media manager",
        description: "See the content workflow that supports a repeatable routine.",
        href: "/ai-social-media-manager",
      },
      {
        title: "Marketing for startups guide",
        description: "Choose the message before choosing the channel.",
        href: "/guides/marketing-for-startups",
      },
    ],
    ctaTitle: "Make the next post easier to begin and easier to approve.",
    ctaDescription:
      "Start with your business context, choose a format for one useful message, and build the routine from there.",
  },
  manager: {
    canonicalPath: "/ai-social-media-manager",
    eyebrow: "AI social media manager",
    title: "Keep social content moving without losing the human decision.",
    description:
      "UGCPilot brings business context, creative formats, review, and available publishing workflows together so your team can manage the content process in one place.",
    proof: "Business context → content formats → review → publishing decision",
    workflowLabel: "The work stays connected from the first business brief to the final publish decision.",
    workflow: [
      {
        eyebrow: "Context",
        title: "Start from the business, not a blank prompt",
        description:
          "Use your website and business details to establish the offer and audience behind the content work.",
      },
      {
        eyebrow: "Creation",
        title: "Choose the right content format",
        description:
          "Work with carousel, hook-video, and text-led video formats from the same content workspace.",
      },
      {
        eyebrow: "Decision",
        title: "Review before a post moves forward",
        description:
          "Keep media, copy, captions, account selection, and timing close to the person approving the final action.",
      },
    ],
    featuresTitle: "A content workflow that leaves room for judgment.",
    featuresDescription:
      "Use AI to move the creative process forward while your team retains control of the final post.",
    features: [
      {
        title: "One working context",
        description:
          "Keep the business information that shapes your content close to the creative work it informs.",
        icon: FileText,
      },
      {
        title: "Format flexibility",
        description:
          "Use a video, text-led video, or carousel when each message calls for a different way to explain it.",
        icon: ImageIcon,
      },
      {
        title: "Human approval",
        description:
          "Review the output before selecting account and timing for a publishing workflow.",
        icon: CircleCheckBig,
      },
    ],
    faqs: [
      {
        question: "What does an AI social media manager do?",
        answer:
          "It helps a team organize and accelerate parts of the social content process, such as creating formats, reviewing work, and preparing posts for publishing.",
      },
      {
        question: "Does UGCPilot replace the person managing social media?",
        answer:
          "UGCPilot is designed to support the content workflow. The team still decides which ideas represent the business and what should be approved for publishing.",
      },
      {
        question: "Can I use the same business context across formats?",
        answer:
          "Yes. The workspace uses your business context as a shared starting point for the content formats you choose to create.",
      },
    ],
    relatedPages: [
      {
        title: "Social media marketing for startups",
        description: "Turn the workflow into a sustainable founder-led content routine.",
        href: "/social-media-marketing-for-startups",
      },
      {
        title: "AI UGC video generator",
        description: "Create short-form video as part of the larger content process.",
        href: "/ai-ugc-video-generator",
      },
      {
        title: "SaaS marketing guide",
        description: "Build a repeatable system for explaining the product and earning attention.",
        href: "/guides/saas-marketing",
      },
    ],
    ctaTitle: "Bring your social content work into one focused workspace.",
    ctaDescription:
      "Add the business context, choose the format, review the result, and make the final publishing decision with confidence.",
  },
} satisfies Record<string, SeoLandingPageContent>;

function toJsonLd(content: SeoLandingPageContent) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "UGCPilot",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: `https://getugcpilot.com${content.canonicalPath}`,
        description: content.description,
      },
      {
        "@type": "FAQPage",
        mainEntity: content.faqs.map((faq) => ({
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

export function SeoLandingPage({
  content,
}: {
  content: SeoLandingPageContent;
}) {
  return (
    <main className="instagram-theme min-h-screen overflow-x-hidden bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(content) }}
      />
      <LandingHeader initialHasSession={false} />

      <section className="relative overflow-hidden px-4 pb-18 pt-28 sm:px-6 sm:pb-24 sm:pt-36 lg:px-8 lg:pb-28">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[470px] bg-[radial-gradient(ellipse_65%_50%_at_50%_0%,rgba(255,107,69,0.14),transparent_76%)]" />
        <div className="mx-auto grid max-w-[1200px] items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-18">
          <div className="max-w-3xl">
            <p className="inline-flex items-center rounded-full border border-primary/35 bg-primary/[0.08] px-3 py-1.5 text-xs font-semibold text-primary shadow-sm">
              {content.eyebrow}
            </p>
            <h1 className="mt-6 text-4xl font-semibold leading-[0.98] tracking-[-0.05em] text-foreground-strong sm:text-5xl lg:text-6xl">
              {content.title}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
              {content.description}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <LandingAuthCta
                className="group inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                initialHasSession={false}
              />
              <Link
                href="#workflow"
                className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-card px-6 text-base font-semibold text-foreground-strong transition-colors hover:border-primary/60 hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                See the workflow
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[520px]">
            <div className="absolute -inset-5 -z-10 rounded-[42px] bg-primary/[0.07] blur-2xl" />
            <div className="overflow-hidden rounded-[26px] border border-border bg-card shadow-floating">
              <div className="border-b border-border bg-card-muted/70 px-5 py-4 sm:px-6">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                    Content route
                  </span>
                  <span className="size-2 rounded-full bg-primary shadow-[0_0_14px_rgba(255,107,69,0.95)]" aria-hidden="true" />
                </div>
                <p className="mt-2 text-sm font-medium leading-6 text-foreground-strong">
                  {content.proof}
                </p>
              </div>
              <ol className="divide-y divide-border px-5 sm:px-6">
                {content.workflow.map((step, index) => (
                  <li key={step.title} className="flex gap-4 py-5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/[0.1] text-xs font-bold text-primary">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                        {step.eyebrow}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-foreground-strong">
                        {step.title}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="m-4 rounded-2xl border border-primary/20 bg-primary/[0.06] px-4 py-3 text-sm font-medium leading-6 text-foreground-strong sm:m-5">
                {content.workflowLabel}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="border-y border-border bg-card-muted/45 px-4 py-18 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-[1200px]">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-primary">How it works</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.04em] text-foreground-strong sm:text-4xl">
              A working sequence that gives every decision its place.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {content.workflow.map((step, index) => (
              <article key={step.title} className="rounded-[22px] border border-border bg-card p-6 shadow-card sm:p-7">
                <p className="font-mono text-xs font-bold text-primary">{String(index + 1).padStart(2, "0")}</p>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.13em] text-muted">
                  {step.eyebrow}
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-foreground-strong">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted">{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-18 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div>
            <p className="text-sm font-semibold text-primary">Built for the work</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.04em] text-foreground-strong sm:text-4xl">
              {content.featuresTitle}
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted">
              {content.featuresDescription}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {content.features.map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className="flex gap-4 rounded-[20px] border border-border bg-card p-5 shadow-card">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/[0.1] text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-foreground-strong">{feature.title}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-muted">{feature.description}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-card-muted/45 px-4 py-18 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
          <div>
            <p className="text-sm font-semibold text-primary">Questions, answered</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.04em] text-foreground-strong sm:text-4xl">
              What to expect from the workflow.
            </h2>
          </div>
          <div className="divide-y divide-border rounded-[22px] border border-border bg-card px-5 shadow-card sm:px-7">
            {content.faqs.map((faq) => (
              <details key={faq.question} className="group py-5">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-5 text-base font-semibold text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary transition-transform duration-200 group-open:scale-150 motion-reduce:transition-none" aria-hidden="true" />
                </summary>
                <p className="mt-3 max-w-2xl pr-6 text-sm leading-6 text-muted">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-18 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-[1200px]">
          <p className="text-sm font-semibold text-primary">Explore next</p>
          <div className="mt-3 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.04em] text-foreground-strong sm:text-4xl">
              Build the content path that fits the message.
            </h2>
            <Link href="/pricing" className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
              View pricing <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {content.relatedPages.map((page) => (
              <Link key={page.href} href={page.href} className="group rounded-[22px] border border-border bg-card p-6 shadow-card transition-[transform,border-color,box-shadow] hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-floating focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                <h3 className="text-lg font-semibold text-foreground-strong">{page.title}</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted">{page.description}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                  Explore the workflow <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-18 sm:px-6 sm:pb-24 lg:px-8">
        <div className="mx-auto max-w-[1200px] overflow-hidden rounded-[28px] border border-primary/30 bg-[linear-gradient(130deg,rgba(255,107,69,0.18),rgba(255,107,69,0.05)_58%,rgba(255,255,255,0.02))] px-6 py-10 shadow-floating sm:px-10 sm:py-14 lg:px-14">
          <Check className="size-6 text-primary" aria-hidden="true" />
          <h2 className="mt-5 max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.04em] text-foreground-strong sm:text-4xl">
            {content.ctaTitle}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted">{content.ctaDescription}</p>
          <div className="mt-8">
            <LandingAuthCta
              className="group inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              initialHasSession={false}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
