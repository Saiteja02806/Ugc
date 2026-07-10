"use client";

import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Globe2,
  Loader2,
  PenLine,
  Smartphone,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";

import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { cn } from "@/lib/utils";

const aiIdePrompt = `Analyze this mobile app codebase and return a concise business-context report for marketing creative generation. Do not include source code, secrets, or implementation details. Use the following headings:\n\n- App name\n- App category\n- One-sentence product summary\n- Target users\n- Main user problem\n- Core features\n- Key benefits\n- Differentiators\n- Brand tone\n- Claims to avoid\n- Suggested visual keywords\n\nOnly state facts supported by the codebase and product copy. Keep every item short.`;

type IntakeType = "manual" | "mobile_app_ai_prompt" | "website";
type RequestStatus = "idle" | "loading" | "retrying" | "saving";

type ManualProfileDraft = {
  brandTone: string;
  businessName: string;
  category: string;
  mainProblem: string;
  productSummary: string;
  targetAudience: string;
  valueProps: string;
};

type ProfileSummary = {
  id: string;
  intakeType: IntakeType;
  preparationError: string | null;
  preparationStatus: "failed" | "preparing";
  profileVersion: number;
};

type PipelineState = "failed" | "input" | "preparing";

const intakeOptions = [
  {
    description: "We read your public product pages and organize the useful details.",
    icon: Globe2,
    label: "Website",
    value: "website",
  },
  {
    description: "Use your AI IDE to summarize the app, then paste the result here.",
    icon: Smartphone,
    label: "Mobile app",
    value: "mobile_app_ai_prompt",
  },
  {
    description: "Enter the product, audience and positioning details yourself.",
    icon: PenLine,
    label: "Manual",
    value: "manual",
  },
] as const;

const initialManualDraft: ManualProfileDraft = {
  brandTone: "",
  businessName: "",
  category: "",
  mainProblem: "",
  productSummary: "",
  targetAudience: "",
  valueProps: "",
};

export function BusinessProfileOnboarding() {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [intakeType, setIntakeType] = useState<IntakeType>("website");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [aiIdeContext, setAiIdeContext] = useState("");
  const [manual, setManual] = useState<ManualProfileDraft>(initialManualDraft);
  const [existingProfile, setExistingProfile] = useState<ProfileSummary | null>(null);
  const [status, setStatus] = useState<RequestStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const websiteInputId = useId();
  const websiteHintId = useId();
  const aiContextInputId = useId();
  const aiContextHintId = useId();
  const isSaving = status === "saving";
  const isRetrying = status === "retrying";
  const hasUnsavedChanges =
    websiteUrl.trim().length > 0 ||
    aiIdeContext.trim().length > 0 ||
    Object.values(manual).some((value) => value.trim().length > 0);

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    const controller = new AbortController();

    async function loadProfile() {
      try {
        const token = await getCurrentUserIdToken();

        if (!token) {
          throw new Error("Could not verify your sign-in session.");
        }

        const response = await fetch("/api/business-profile", {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => null)) as {
          message?: string;
          ok?: boolean;
          profile?: ProfileSummary | null;
        } | null;

        if (!response.ok || !data?.ok) {
          throw new Error(data?.message ?? "Could not load your business profile.");
        }

        setExistingProfile(data.profile ?? null);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load your business profile.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setStatus("idle");
        }
      }
    }

    void loadProfile();

    return () => controller.abort();
  }, [authLoading, user]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus("saving");

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in before creating your business profile.");
      }

      const response = await fetch("/api/business-profile", {
        body: JSON.stringify({
          aiIdeContext,
          intakeType,
          manual,
          websiteUrl,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const data = (await response.json().catch(() => null)) as {
        message?: string;
        ok?: boolean;
      } | null;

      if (!response.ok || !data?.ok) {
        throw new Error(data?.message ?? "Could not create your business profile.");
      }

      router.replace("/dashboard");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not create your business profile.",
      );
      setStatus("idle");
    }
  }

  async function retryPreparation() {
    setError(null);
    setStatus("retrying");

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in again before retrying carousel preparation.");
      }

      const response = await fetch("/api/business-profile/retry", {
        headers: { Authorization: `Bearer ${token}` },
        method: "POST",
      });
      const data = (await response.json().catch(() => null)) as {
        message?: string;
        ok?: boolean;
      } | null;

      if (!response.ok || !data?.ok) {
        throw new Error(data?.message ?? "Could not retry carousel preparation.");
      }

      router.replace("/dashboard");
    } catch (retryError) {
      setError(
        retryError instanceof Error
          ? retryError.message
          : "Could not retry carousel preparation.",
      );
      setStatus("idle");
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(aiIdePrompt);
      setCopied(true);
      setError(null);
    } catch {
      setError("Could not copy the prompt. Select the prompt text and copy it manually.");
    }
  }

  function selectIntakeType(value: IntakeType) {
    setIntakeType(value);
    setCopied(false);
    setError(null);
  }

  if (authLoading || (Boolean(user) && status === "loading")) {
    return (
      <OnboardingFrame pipelineState="input">
        <div
          aria-busy="true"
          className="flex min-h-[420px] items-center justify-center"
        >
          <div className="flex items-center gap-3 text-sm font-medium text-muted">
            <Loader2
              className="size-5 animate-spin text-brand motion-reduce:animate-none"
              aria-hidden="true"
            />
            Checking your business profile…
          </div>
        </div>
      </OnboardingFrame>
    );
  }

  if (existingProfile) {
    return (
      <OnboardingFrame
        pipelineState={
          existingProfile.preparationStatus === "failed" ? "failed" : "preparing"
        }
      >
        <ExistingProfileState
          error={error}
          isRetrying={isRetrying}
          profile={existingProfile}
          onRetry={() => void retryPreparation()}
        />
      </OnboardingFrame>
    );
  }

  return (
    <OnboardingFrame
      pipelineState="input"
      confirmNavigation={hasUnsavedChanges}
    >
      <form onSubmit={submit} className="mx-auto w-full max-w-[760px]">
        <header>
          <div className="flex items-center gap-3 text-xs font-semibold text-muted-subtle">
            <span className="font-mono tabular-nums text-primary">01</span>
            <span className="h-px w-8 bg-border-strong" aria-hidden="true" />
            <span>Business context</span>
          </div>
          <h2 className="mt-5 max-w-2xl text-balance text-[32px] font-semibold leading-[1.12] text-foreground-strong sm:text-4xl">
            How should we learn about your product?
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-6 text-muted">
            Start with the source that already explains your product best. We will turn it into one focused creative brief.
          </p>
        </header>

        <fieldset className="mt-8">
          <legend className="sr-only">Business context source</legend>
          <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-surface-subtle p-1.5">
            {intakeOptions.map((option) => {
              const Icon = option.icon;
              const selected = intakeType === option.value;

              return (
                <label
                  key={option.value}
                  className={cn(
                    "relative flex min-h-14 touch-manipulation cursor-pointer flex-col items-center justify-center gap-1 rounded-md px-2 py-2.5 text-center transition-[background-color,color,box-shadow] duration-200 focus-within:ring-2 focus-within:ring-focus focus-within:ring-offset-2 focus-within:ring-offset-surface-subtle sm:min-h-12 sm:flex-row sm:gap-2 sm:px-3",
                    selected
                      ? "bg-foreground-strong text-white"
                      : "text-muted hover:bg-white hover:text-foreground",
                    isSaving && "cursor-not-allowed opacity-60",
                  )}
                >
                  <input
                    type="radio"
                    name="business-context-source"
                    value={option.value}
                    checked={selected}
                    disabled={isSaving}
                    onChange={() => selectIntakeType(option.value)}
                    className="sr-only"
                  />
                  <Icon
                    className={cn("size-4 shrink-0", selected && "text-brand")}
                    strokeWidth={1.9}
                    aria-hidden="true"
                  />
                  <span className="whitespace-nowrap text-xs font-semibold sm:text-sm">
                    {option.label}
                  </span>
                </label>
              );
            })}
          </div>
          <div className="mt-4 flex items-start gap-3">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
            <p className="text-sm leading-6 text-muted">
              {intakeOptions.find((option) => option.value === intakeType)?.description}
            </p>
          </div>
        </fieldset>

        {intakeType === "website" ? (
          <section className="mt-10 border-t border-border pt-8" aria-labelledby="website-source-title">
            <h3 id="website-source-title" className="text-lg font-semibold text-foreground-strong">
              Connect your website
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              We will read public product pages and organize only the context needed for creative ideas.
            </p>
            <label htmlFor={websiteInputId} className="mt-7 block text-sm font-semibold text-foreground">
              Website URL
            </label>
            <input
              id={websiteInputId}
              type="url"
              name="websiteUrl"
              inputMode="url"
              autoComplete="url"
              required
              disabled={isSaving}
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              placeholder="https://yourbusiness.com"
              aria-describedby={websiteHintId}
              className="mt-2 h-14 w-full rounded-lg border border-border-strong bg-white px-4 text-base text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-subtle focus:border-focus focus:ring-2 focus:ring-focus/15 disabled:cursor-not-allowed disabled:bg-card-muted"
            />
            <p id={websiteHintId} className="mt-2 text-xs leading-5 text-muted-subtle">
              Use the main public URL. Sign-in pages and private content are not required.
            </p>
          </section>
        ) : null}

        {intakeType === "mobile_app_ai_prompt" ? (
          <section className="mt-10 border-t border-border pt-8" aria-labelledby="mobile-source-title">
            <h3 id="mobile-source-title" className="text-lg font-semibold text-foreground-strong">
              Bring context from your app codebase
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Run the prompt in the AI IDE that already understands your app, then paste its answer below.
            </p>

            <ol className="mt-6 space-y-7">
              <li>
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <StepNumber value="1" />
                    <h4 className="text-sm font-semibold text-foreground">Copy the analysis prompt</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyPrompt()}
                    className="inline-flex h-11 touch-manipulation items-center gap-2 rounded-md border border-border-strong bg-white px-3 text-xs font-semibold text-foreground transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                  >
                    {copied ? (
                      <Check className="size-4 text-success" aria-hidden="true" />
                    ) : (
                      <Copy className="size-4" aria-hidden="true" />
                    )}
                    <span aria-live="polite">{copied ? "Copied" : "Copy prompt"}</span>
                  </button>
                </div>
                <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-foreground-strong p-4 font-mono text-xs leading-5 text-white/80 sm:p-5">
                  {aiIdePrompt}
                </pre>
              </li>

              <li>
                <div className="flex items-center gap-3">
                  <StepNumber value="2" />
                  <h4 className="text-sm font-semibold text-foreground">Paste the AI IDE result</h4>
                </div>
                <label htmlFor={aiContextInputId} className="sr-only">
                  AI IDE business context
                </label>
                <textarea
                  id={aiContextInputId}
                  name="aiIdeContext"
                  autoComplete="off"
                  required
                  minLength={20}
                  maxLength={24_000}
                  disabled={isSaving}
                  value={aiIdeContext}
                  onChange={(event) => setAiIdeContext(event.target.value)}
                  rows={11}
                  placeholder="Paste the complete business-context report here…"
                  aria-describedby={aiContextHintId}
                  className="mt-4 min-h-56 w-full resize-y rounded-lg border border-border-strong bg-white p-4 text-sm leading-6 text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-subtle focus:border-focus focus:ring-2 focus:ring-focus/15 disabled:cursor-not-allowed disabled:bg-card-muted"
                />
                <div
                  id={aiContextHintId}
                  className="mt-2 flex items-center justify-between gap-4 text-xs leading-5 text-muted-subtle"
                >
                  <span>Do not paste source code, secrets or credentials.</span>
                  <span className="shrink-0 font-mono tabular-nums">
                    {aiIdeContext.length.toLocaleString()}/24,000
                  </span>
                </div>
              </li>
            </ol>
          </section>
        ) : null}

        {intakeType === "manual" ? (
          <section className="mt-10 border-t border-border pt-8" aria-labelledby="manual-source-title">
            <h3 id="manual-source-title" className="text-lg font-semibold text-foreground-strong">
              Describe the business directly
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Give concise, factual details. These become the source of truth for personalized ideas.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field
                label="Business name"
                name="businessName"
                autoComplete="organization"
                value={manual.businessName}
                required
                maxLength={120}
                disabled={isSaving}
                placeholder="Acme Health"
                onChange={(value) => setManual({ ...manual, businessName: value })}
              />
              <Field
                label="Category"
                name="category"
                value={manual.category}
                required
                maxLength={120}
                disabled={isSaving}
                placeholder="Fitness and wellness"
                onChange={(value) => setManual({ ...manual, category: value })}
              />
              <Field
                label="Target audience"
                name="targetAudience"
                value={manual.targetAudience}
                required
                minLength={3}
                maxLength={600}
                disabled={isSaving}
                placeholder="Busy professionals who want consistent workouts"
                className="sm:col-span-2"
                onChange={(value) => setManual({ ...manual, targetAudience: value })}
              />
              <Field
                label="Main problem"
                name="mainProblem"
                value={manual.mainProblem}
                required
                maxLength={360}
                disabled={isSaving}
                placeholder="They struggle to plan workouts around an unpredictable schedule"
                className="sm:col-span-2"
                onChange={(value) => setManual({ ...manual, mainProblem: value })}
              />
              <Field
                label="Product summary"
                name="productSummary"
                value={manual.productSummary}
                required
                minLength={20}
                maxLength={1_000}
                disabled={isSaving}
                placeholder="Explain what the product does in two or three sentences"
                multiline
                className="sm:col-span-2"
                onChange={(value) => setManual({ ...manual, productSummary: value })}
              />
              <Field
                label="Key benefits"
                name="valueProps"
                value={manual.valueProps}
                required
                minLength={3}
                maxLength={1_000}
                disabled={isSaving}
                placeholder="List one benefit per line"
                hint="One benefit per line produces cleaner creative angles."
                multiline
                className="sm:col-span-2"
                onChange={(value) => setManual({ ...manual, valueProps: value })}
              />
              <Field
                label="Brand tone"
                name="brandTone"
                value={manual.brandTone}
                maxLength={160}
                disabled={isSaving}
                placeholder="Direct, optimistic and practical"
                hint="Optional"
                className="sm:col-span-2"
                onChange={(value) => setManual({ ...manual, brandTone: value })}
              />
            </div>
          </section>
        ) : null}

        {error ? <ErrorNotice message={error} /> : null}

        <footer className="mt-10 flex flex-col gap-5 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-md text-xs leading-5 text-muted-subtle">
            One business profile is saved to this account. Carousel preparation starts automatically.
          </p>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex h-12 w-full shrink-0 touch-manipulation items-center justify-center gap-2 rounded-md bg-brand px-5 text-sm font-semibold text-foreground-strong transition-[filter,transform] hover:brightness-95 active:translate-y-px active:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isSaving ? (
              <Loader2
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <Sparkles className="size-4" aria-hidden="true" />
            )}
            <span aria-live="polite">
              {isSaving ? getSavingLabel(intakeType) : "Save and prepare ideas"}
            </span>
          </button>
        </footer>
      </form>
    </OnboardingFrame>
  );
}

function OnboardingFrame({
  children,
  confirmNavigation = false,
  pipelineState,
}: {
  children: React.ReactNode;
  confirmNavigation?: boolean;
  pipelineState: PipelineState;
}) {
  function handleNavigation(event: React.MouseEvent<HTMLAnchorElement>) {
    if (
      confirmNavigation &&
      !window.confirm("Leave business setup? Your unsaved details will be lost.")
    ) {
      event.preventDefault();
    }
  }

  return (
    <main className="min-h-screen bg-foreground-strong text-foreground">
      <a
        href="#business-profile-content"
        className="sr-only z-[110] rounded-md bg-white px-3 py-2 text-sm font-semibold text-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to business profile
      </a>

      <div className="grid min-h-screen w-full lg:grid-cols-[minmax(320px,390px)_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="flex flex-col bg-foreground-strong px-5 py-5 text-white sm:px-8 sm:py-7 lg:min-h-screen lg:px-10 lg:py-8">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/dashboard"
              onClick={handleNavigation}
              className="flex min-h-11 touch-manipulation items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-foreground-strong"
            >
              <span className="flex size-9 items-center justify-center rounded-md bg-brand text-foreground-strong">
                <Sparkles className="size-[18px]" aria-hidden="true" />
              </span>
              <span className="text-base font-semibold text-white">UGC Studio</span>
            </Link>
            <Link
              href="/dashboard"
              onClick={handleNavigation}
              aria-label="Back to Trending"
              className="inline-flex size-11 touch-manipulation items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-foreground-strong lg:hidden"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
            </Link>
          </div>

          <ContextPipeline state={pipelineState} />
        </aside>

        <section className="min-w-0 bg-white lg:min-h-screen">
          <header className="hidden h-16 items-center justify-end border-b border-border px-8 lg:flex xl:px-12">
          <Link
            href="/dashboard"
            onClick={handleNavigation}
            className="inline-flex h-11 touch-manipulation items-center gap-2 rounded-md px-3 text-sm font-medium text-muted transition-colors hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Trending
          </Link>
          </header>
          <div
            id="business-profile-content"
            className="min-w-0 scroll-mt-4 px-5 py-9 sm:px-10 sm:py-12 lg:px-12 lg:py-14 xl:px-16"
          >
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

function ContextPipeline({ state }: { state: PipelineState }) {
  const steps = [
    {
      description: "Choose the strongest source for your product facts.",
      label: "Source",
    },
    {
      description: "We structure the useful facts into a creative brief.",
      label: "Brief",
    },
    {
      description: "Personalized carousel ideas start preparing automatically.",
      label: "Ideas",
    },
  ];

  return (
    <div className="flex flex-1 flex-col pt-8 lg:pt-16">
      <p className="text-sm font-medium text-white/60">Business setup</p>
      <h1 className="mt-3 max-w-xs text-balance text-[28px] font-semibold leading-[1.14] text-white sm:text-[32px]">
        Turn product context into ready-to-use ideas.
      </h1>
      <p className="mt-4 max-w-sm text-sm leading-6 text-white/60">
        Set the source once. Every personalized carousel starts from the same reliable brief.
      </p>

      <ol className="mt-8 grid grid-cols-3 gap-2 lg:mt-12 lg:grid-cols-1 lg:gap-0">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const complete = state !== "input" && stepNumber < 3;
          const active =
            (state === "input" && stepNumber === 1) ||
            (state === "preparing" && stepNumber === 3);
          const failed = state === "failed" && stepNumber === 3;

          return (
            <li
              key={step.label}
              aria-current={active ? "step" : undefined}
              className="relative flex min-w-0 flex-col items-center text-center lg:min-h-[104px] lg:flex-row lg:items-start lg:gap-4 lg:text-left"
            >
              {index < steps.length - 1 ? (
                <span className="absolute left-[calc(50%+22px)] right-[calc(-50%+22px)] top-[18px] h-px bg-white/15 lg:bottom-0 lg:left-[18px] lg:right-auto lg:top-9 lg:h-auto lg:w-px" />
              ) : null}
              <span
                className={cn(
                  "relative z-10 flex size-9 shrink-0 items-center justify-center rounded-md border text-xs font-semibold",
                  complete && "border-white bg-white text-foreground-strong",
                  active && "border-brand bg-brand text-foreground-strong",
                  failed && "border-error bg-error text-white",
                  !complete && !active && !failed &&
                    "border-white/20 bg-white/[0.04] text-white/50",
                )}
              >
                {complete ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : failed ? (
                  <AlertCircle className="size-4" aria-hidden="true" />
                ) : (
                  stepNumber
                )}
              </span>
              <div className="mt-2 min-w-0 lg:mt-0">
                <p
                  className={cn(
                    "text-xs font-semibold lg:text-sm",
                    active || complete || failed ? "text-white" : "text-white/50",
                  )}
                >
                  {step.label}
                </p>
                <p className="mt-1.5 hidden max-w-[240px] text-xs leading-5 text-white/50 lg:block">
                  {step.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-auto hidden border-t border-white/10 pt-7 lg:block">
        <div className="flex items-start gap-3">
          <ClipboardCheck className="mt-0.5 size-[18px] shrink-0 text-brand" aria-hidden="true" />
          <p className="max-w-[250px] text-xs leading-5 text-white/60">
            One account, one business profile, one source of truth for every idea.
          </p>
        </div>
      </div>
    </div>
  );
}

function ExistingProfileState({
  error,
  isRetrying,
  onRetry,
  profile,
}: {
  error: string | null;
  isRetrying: boolean;
  onRetry: () => void;
  profile: ProfileSummary;
}) {
  const failed = profile.preparationStatus === "failed";

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <div className="flex items-center gap-3 text-xs font-semibold text-muted-subtle">
        <span className="font-mono tabular-nums text-primary">03</span>
        <span className="h-px w-8 bg-border-strong" aria-hidden="true" />
        <span>Profile status</span>
      </div>
      <div className="mt-6 flex items-start gap-4">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-lg",
            failed ? "bg-error/10 text-error" : "bg-success/10 text-success",
          )}
        >
          {failed ? (
            <AlertCircle className="size-5" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="size-5" aria-hidden="true" />
          )}
        </span>
        <div>
          <h2 className="max-w-xl text-balance text-[30px] font-semibold leading-[1.15] text-foreground-strong sm:text-4xl">
            {failed ? "Carousel preparation needs attention" : "Your creative brief is active"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            {failed
              ? "Your business profile was saved, but carousel preparation did not start successfully."
              : "Your profile is saved. Open Trending to follow personalized carousel preparation and review ready ideas."}
          </p>
        </div>
      </div>

      <dl className="mt-8 grid grid-cols-1 border-y border-border sm:grid-cols-2">
        <div className="py-4 sm:border-r sm:border-border sm:pr-6">
          <dt className="text-xs font-medium text-muted-subtle">Context source</dt>
          <dd className="mt-1 text-sm font-semibold text-foreground">
            {getIntakeLabel(profile.intakeType)}
          </dd>
        </div>
        <div className="border-t border-border py-4 sm:border-t-0 sm:pl-6">
          <dt className="text-xs font-medium text-muted-subtle">Profile version</dt>
          <dd className="mt-1 font-mono text-sm font-medium tabular-nums text-foreground">
            {profile.profileVersion}
          </dd>
        </div>
      </dl>

      {failed && profile.preparationError ? (
        <ErrorNotice message={profile.preparationError} />
      ) : null}
      {error ? <ErrorNotice message={error} /> : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        {failed ? (
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="inline-flex h-12 touch-manipulation items-center justify-center gap-2 rounded-md bg-brand px-5 text-sm font-semibold text-foreground-strong transition-[filter,transform] hover:brightness-95 active:translate-y-px active:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRetrying ? (
              <Loader2
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <Sparkles className="size-4" aria-hidden="true" />
            )}
            <span aria-live="polite">
              {isRetrying ? "Retrying preparation…" : "Retry preparation"}
            </span>
          </button>
        ) : null}
        <Link
          href="/dashboard"
          className={cn(
            "inline-flex h-12 touch-manipulation items-center justify-center gap-2 rounded-md px-5 text-sm font-semibold transition-[filter,background-color,color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
            failed
              ? "border border-border-strong bg-white text-foreground hover:bg-card-muted"
              : "bg-brand text-foreground-strong hover:brightness-95",
          )}
        >
          <Sparkles className="size-4" aria-hidden="true" />
          Open Trending
        </Link>
      </div>
    </div>
  );
}

function Field({
  autoComplete = "off",
  className,
  disabled = false,
  hint,
  label,
  maxLength,
  minLength,
  multiline = false,
  name,
  onChange,
  placeholder,
  required = false,
  value,
}: {
  autoComplete?: string;
  className?: string;
  disabled?: boolean;
  hint?: string;
  label: string;
  maxLength?: number;
  minLength?: number;
  multiline?: boolean;
  name: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
}) {
  const inputId = useId();
  const hintId = useId();
  const controlClassName =
    "mt-2 w-full rounded-md border border-border-strong bg-white px-3 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-muted-subtle focus:border-focus focus:ring-2 focus:ring-focus/15 disabled:cursor-not-allowed disabled:bg-card-muted";

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
        {hint ? <span className="text-xs text-muted-subtle">{hint}</span> : null}
      </div>
      {multiline ? (
        <textarea
          id={inputId}
          name={name}
          autoComplete={autoComplete}
          value={value}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          disabled={disabled}
          placeholder={placeholder}
          rows={4}
          aria-describedby={maxLength ? hintId : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={cn(controlClassName, "min-h-28 resize-y py-2.5")}
        />
      ) : (
        <input
          id={inputId}
          name={name}
          autoComplete={autoComplete}
          value={value}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          disabled={disabled}
          placeholder={placeholder}
          aria-describedby={maxLength ? hintId : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={cn(controlClassName, "h-11")}
        />
      )}
      {maxLength ? (
        <div id={hintId} className="mt-1 flex justify-end font-mono text-[11px] tabular-nums text-muted-subtle">
          {value.length.toLocaleString()}/{maxLength.toLocaleString()}
        </div>
      ) : null}
    </div>
  );
}

function StepNumber({ value }: { value: string }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand text-xs font-semibold text-foreground-strong">
      {value}
    </span>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mt-6 flex items-start gap-3 rounded-md border border-error/20 bg-error/5 px-3 py-3 text-sm leading-6 text-error"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 break-words">{message}</span>
    </div>
  );
}

function getSavingLabel(intakeType: IntakeType) {
  if (intakeType === "website") {
    return "Analyzing website…";
  }

  if (intakeType === "mobile_app_ai_prompt") {
    return "Structuring app context…";
  }

  return "Preparing creative brief…";
}

function getIntakeLabel(intakeType: IntakeType) {
  if (intakeType === "mobile_app_ai_prompt") {
    return "Mobile app context";
  }

  if (intakeType === "manual") {
    return "Manual details";
  }

  return "Website";
}
