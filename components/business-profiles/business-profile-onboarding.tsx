"use client";

import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Globe2,
  Loader2,
  PenLine,
  RefreshCw,
  Smartphone,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";

import { ProductLogoMark } from "@/components/brand/product-logo";
import { SocialPlatformIcon } from "@/components/social/platform-icon";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field as FormField,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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

const countFormatter = new Intl.NumberFormat("en");

const profileControlClassName =
  "h-12 w-full rounded-lg border border-border bg-card-muted px-3 text-sm leading-6 text-foreground outline-none transition-[background-color,border-color,box-shadow] placeholder:text-muted-subtle hover:border-border-strong focus-visible:border-focus focus-visible:ring-2 focus-visible:ring-focus/20 disabled:cursor-not-allowed disabled:bg-card disabled:opacity-70";

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
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
  const [profileLoadAttempt, setProfileLoadAttempt] = useState(0);
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
          setProfileLoadFailed(true);
          setError(
            getFriendlyProfileError(
              loadError,
              "Could not load your business profile. Check your connection and try again.",
            ),
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
  }, [authLoading, profileLoadAttempt, user]);

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
    setProfileLoadFailed(false);
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
        getFriendlyProfileError(
          submitError,
          "Could not create your business profile. Review the details and try again.",
        ),
      );
      setStatus("idle");
    }
  }

  async function retryPreparation() {
    setError(null);
    setProfileLoadFailed(false);
    setStatus("retrying");

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in again before retrying Trending preparation.");
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
        throw new Error(data?.message ?? "Could not retry Trending preparation.");
      }

      router.replace("/dashboard");
    } catch (retryError) {
      setError(
        getFriendlyProfileError(
          retryError,
          "Could not retry Trending preparation. Check your connection and try again.",
        ),
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
      setProfileLoadFailed(false);
      setError("Could not copy the prompt. Select the prompt text and copy it manually.");
    }
  }

  function selectIntakeType(value: IntakeType) {
    setIntakeType(value);
    setCopied(false);
    setError(null);
    setProfileLoadFailed(false);
  }

  function retryProfileLoad() {
    setError(null);
    setProfileLoadFailed(false);
    setStatus("loading");
    setProfileLoadAttempt((attempt) => attempt + 1);
  }

  if (authLoading || (Boolean(user) && status === "loading")) {
    return (
      <OnboardingFrame pipelineState="input">
        <ProfileLoadingState />
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
      <form
        onSubmit={submit}
        className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-card shadow-card"
      >
        <div
          className="h-1 bg-[linear-gradient(90deg,var(--instagram-orange),var(--instagram-rose),var(--instagram-violet))]"
          aria-hidden="true"
        />

        <div className="px-5 py-6 sm:px-7 sm:py-7">
          <header>
            <Badge variant="secondary">Source details</Badge>
            <h2 className="mt-4 max-w-2xl text-balance text-2xl font-bold tracking-[-0.025em] text-foreground-strong sm:text-[30px]">
              Choose the source you trust most
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted sm:text-[15px]">
              Start with the place that already explains your product clearly.
              UGC Pilot turns it into one reusable creative brief.
            </p>
          </header>

          <FieldSet className="mt-7">
            <FieldLegend className="sr-only">
              Business context source
            </FieldLegend>
            <div className="grid gap-3 sm:grid-cols-3">
            {intakeOptions.map((option) => {
              const Icon = option.icon;
              const selected = intakeType === option.value;

              return (
                <label
                  key={option.value}
                  className={cn(
                    "relative flex min-h-32 touch-manipulation cursor-pointer flex-col rounded-xl border p-4 text-left transition-[background-color,border-color,box-shadow,transform] duration-200 focus-within:ring-2 focus-within:ring-focus focus-within:ring-offset-2 focus-within:ring-offset-card motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                    selected
                      ? "border-primary/50 bg-selected shadow-[0_10px_26px_rgb(225_101_64_/_0.08)]"
                      : "border-border bg-card-muted/55 hover:-translate-y-0.5 hover:border-border-strong hover:bg-card-muted",
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
                  <span className="flex items-start justify-between gap-3">
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg border",
                        selected
                          ? "border-primary/25 bg-primary/10 text-primary"
                          : "border-border bg-background text-muted",
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span
                      className={cn(
                        "flex size-5 items-center justify-center rounded-full border",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-transparent",
                      )}
                      aria-hidden="true"
                    >
                      <Check className="size-3" />
                    </span>
                  </span>
                  <span className="mt-4 text-sm font-bold text-foreground-strong">
                    {option.label}
                  </span>
                  <span className="mt-1 text-xs leading-5 text-muted">
                    {option.description}
                  </span>
                </label>
              );
            })}
            </div>
          </FieldSet>
        </div>

        <Separator />

        <div className="px-5 py-7 sm:px-7 sm:py-8">
        {intakeType === "website" ? (
          <section aria-labelledby="website-source-title">
            <h3
              id="website-source-title"
              className="text-lg font-bold text-foreground-strong"
            >
              Website details
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              We only read public product pages and organize the facts needed
              for Instagram creative.
            </p>
            <FormField className="mt-6">
              <FieldLabel htmlFor={websiteInputId}>Website URL</FieldLabel>
              <input
                id={websiteInputId}
                type="url"
                name="websiteUrl"
                inputMode="url"
                autoComplete="url"
                spellCheck={false}
                required
                disabled={isSaving}
                value={websiteUrl}
                onChange={(event) => setWebsiteUrl(event.target.value)}
                placeholder="https://yourbusiness.com…"
                aria-describedby={websiteHintId}
                className={profileControlClassName}
              />
              <FieldDescription id={websiteHintId}>
                Use the main public URL. Sign-in pages and private content are
                not required.
              </FieldDescription>
            </FormField>
          </section>
        ) : null}

        {intakeType === "mobile_app_ai_prompt" ? (
          <section aria-labelledby="mobile-source-title">
            <h3
              id="mobile-source-title"
              className="text-lg font-bold text-foreground-strong"
            >
              Bring context from your app
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Run this prompt in the AI IDE that already understands the
              codebase, then paste its factual report below.
            </p>

            <ol className="mt-7 flex flex-col gap-8">
              <li>
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <StepNumber value="1" />
                    <h4 className="text-sm font-bold text-foreground">
                      Copy the analysis prompt
                    </h4>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => void copyPrompt()}
                  >
                    {copied ? (
                      <Check
                        data-icon="inline-start"
                        className="text-success"
                        aria-hidden="true"
                      />
                    ) : (
                      <Copy data-icon="inline-start" aria-hidden="true" />
                    )}
                    <span aria-live="polite">{copied ? "Copied" : "Copy prompt"}</span>
                  </Button>
                </div>
                <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-background p-4 font-mono text-xs leading-5 text-muted sm:p-5">
                  {aiIdePrompt}
                </pre>
              </li>

              <li>
                <div className="flex items-center gap-3">
                  <StepNumber value="2" />
                  <h4 className="text-sm font-bold text-foreground">
                    Paste the AI IDE result
                  </h4>
                </div>
                <FormField className="mt-4">
                  <FieldLabel htmlFor={aiContextInputId} className="sr-only">
                    AI IDE business context
                  </FieldLabel>
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
                    className={cn(
                      profileControlClassName,
                      "min-h-56 resize-y py-3",
                    )}
                  />
                  <div
                    id={aiContextHintId}
                    className="flex items-center justify-between gap-4 text-xs leading-5 text-muted-subtle"
                  >
                    <span>Do not paste source code, secrets, or credentials.</span>
                    <span className="shrink-0 font-mono tabular-nums">
                      {formatCount(aiIdeContext.length)}/24,000
                    </span>
                  </div>
                </FormField>
              </li>
            </ol>
          </section>
        ) : null}

        {intakeType === "manual" ? (
          <section aria-labelledby="manual-source-title">
            <h3
              id="manual-source-title"
              className="text-lg font-bold text-foreground-strong"
            >
              Enter the business facts
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Keep each answer concise and factual. These details become the
              source of truth for personalized recommendations in Trending.
            </p>
            <FieldGroup className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <ProfileField
                label="Business name"
                name="businessName"
                autoComplete="organization"
                value={manual.businessName}
                required
                maxLength={120}
                disabled={isSaving}
                placeholder="Enter your business name…"
                onChange={(value) => setManual({ ...manual, businessName: value })}
              />
              <ProfileField
                label="Category"
                name="category"
                value={manual.category}
                required
                maxLength={120}
                disabled={isSaving}
                placeholder="Enter your category or industry…"
                onChange={(value) => setManual({ ...manual, category: value })}
              />
              <ProfileField
                label="Target audience"
                name="targetAudience"
                value={manual.targetAudience}
                required
                minLength={3}
                maxLength={600}
                disabled={isSaving}
                placeholder="Describe the people your business serves…"
                className="sm:col-span-2"
                onChange={(value) => setManual({ ...manual, targetAudience: value })}
              />
              <ProfileField
                label="Main problem"
                name="mainProblem"
                value={manual.mainProblem}
                required
                maxLength={360}
                disabled={isSaving}
                placeholder="Describe the main problem they need solved…"
                className="sm:col-span-2"
                onChange={(value) => setManual({ ...manual, mainProblem: value })}
              />
              <ProfileField
                label="Product summary"
                name="productSummary"
                value={manual.productSummary}
                required
                minLength={20}
                maxLength={1_000}
                disabled={isSaving}
                placeholder="Explain what the product does in two or three sentences…"
                multiline
                className="sm:col-span-2"
                onChange={(value) => setManual({ ...manual, productSummary: value })}
              />
              <ProfileField
                label="Key benefits"
                name="valueProps"
                value={manual.valueProps}
                required
                minLength={3}
                maxLength={1_000}
                disabled={isSaving}
                placeholder="List one benefit per line…"
                hint="One benefit per line produces cleaner creative angles."
                multiline
                className="sm:col-span-2"
                onChange={(value) => setManual({ ...manual, valueProps: value })}
              />
              <ProfileField
                label="Brand tone"
                name="brandTone"
                value={manual.brandTone}
                maxLength={160}
                disabled={isSaving}
                placeholder="Describe the voice you want to use…"
                hint="Optional"
                className="sm:col-span-2"
                onChange={(value) => setManual({ ...manual, brandTone: value })}
              />
            </FieldGroup>
          </section>
        ) : null}

          {error ? (
            <ErrorNotice
              message={error}
              onRetry={profileLoadFailed ? retryProfileLoad : undefined}
            />
          ) : null}
        </div>

        <Separator />

        <footer className="flex flex-col gap-5 bg-card-muted/35 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div className="max-w-lg">
            <p className="text-sm font-medium text-foreground">
              One profile grounds every personalized idea.
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-subtle">
              Nothing is published until you review and approve it.
            </p>
          </div>
          <Button
            type="submit"
            disabled={isSaving}
            size="lg"
            className="h-11 w-full px-4 sm:w-auto"
          >
            {isSaving ? (
              <Loader2
                data-icon="inline-start"
                className="animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <Sparkles data-icon="inline-start" aria-hidden="true" />
            )}
            <span aria-live="polite">
              {isSaving ? getSavingLabel(intakeType) : "Save profile & prepare ideas"}
            </span>
          </Button>
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
    <main className="instagram-theme min-h-dvh bg-background text-foreground">
      <a
        href="#business-profile-content"
        className="sr-only z-50 rounded-lg bg-card px-3 py-2 text-sm font-semibold text-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus-visible:ring-2 focus-visible:ring-focus"
      >
        Skip to business profile
      </a>

      <header className="border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1080px] items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/dashboard"
            onClick={handleNavigation}
            className="flex min-h-11 touch-manipulation items-center gap-2.5 rounded-lg focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary p-1.5 shadow-sm">
              <ProductLogoMark
                className="size-full"
                imageClassName="brightness-0 invert"
                sizes="36px"
              />
            </span>
            <span className="text-base font-bold text-foreground-strong">
              UGC Pilot
            </span>
          </Link>
          <Link
            href="/dashboard"
            onClick={handleNavigation}
            className={cn(
              buttonVariants({ size: "lg", variant: "ghost" }),
              "h-10 px-3 text-muted",
            )}
          >
            <ArrowLeft data-icon="inline-start" aria-hidden="true" />
            <span className="hidden sm:inline">Back to Trending</span>
            <span className="sm:hidden">Back</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[960px] px-4 py-8 sm:px-6 sm:py-11 lg:py-14">
        <header className="max-w-3xl">
          <div className="flex items-center gap-2">
            <SocialPlatformIcon className="size-5" platform="instagram" />
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
              Instagram business profile
            </p>
          </div>
          <h1 className="mt-4 text-balance text-[34px] font-bold leading-[1.08] tracking-[-0.04em] text-foreground-strong sm:text-[44px]">
            Give every Trending recommendation the right business context.
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-sm leading-6 text-muted sm:text-base sm:leading-7">
            Add one trusted source for your product, audience, and positioning.
            UGC Pilot uses it to ground Reel hooks, text-led videos, and
            carousel posts.
          </p>
        </header>

        <ContextPipeline state={pipelineState} />

        <div
          id="business-profile-content"
          className="mt-8 min-w-0 scroll-mt-24 sm:mt-10"
        >
          {children}
        </div>
      </div>
    </main>
  );
}

function ContextPipeline({ state }: { state: PipelineState }) {
  const steps = [
    {
      description: "Website, app brief, or manual facts",
      label: "Source",
    },
    {
      description: "Product, audience, and positioning",
      label: "Creative brief",
    },
    {
      description: "Reels, text-led videos, and carousels",
      label: "Trending",
    },
  ];

  return (
    <nav className="mt-8 border-y border-border" aria-label="Business profile progress">
      <ol className="grid grid-cols-3">
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
              className="relative flex min-w-0 flex-col gap-2 px-2 py-4 text-center sm:flex-row sm:items-center sm:gap-3 sm:px-5 sm:text-left [&+li]:border-l [&+li]:border-border"
            >
              <span
                className={cn(
                  "mx-auto flex size-8 shrink-0 items-center justify-center rounded-lg border text-xs font-bold sm:mx-0",
                  complete && "border-success/25 bg-success/10 text-success",
                  active &&
                    "border-transparent bg-[linear-gradient(135deg,var(--instagram-orange),var(--instagram-rose),var(--instagram-violet))] text-white",
                  failed && "border-error/30 bg-error/10 text-error",
                  !complete && !active && !failed &&
                    "border-border bg-card-muted text-muted",
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
              <div className="min-w-0">
                <p
                  className={cn(
                    "truncate text-xs font-bold sm:text-sm",
                    active || complete || failed ? "text-foreground-strong" : "text-muted",
                  )}
                >
                  {step.label}
                </p>
                <p className="mt-0.5 hidden text-xs leading-5 text-muted md:block">
                  {step.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
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
    <section className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-card shadow-card">
      <div
        className="h-1 bg-[linear-gradient(90deg,var(--instagram-orange),var(--instagram-rose),var(--instagram-violet))]"
        aria-hidden="true"
      />
      <div className="px-5 py-7 sm:px-8 sm:py-8">
        <Badge variant={failed ? "destructive" : "outline"}>
          {failed ? (
            <AlertCircle data-icon="inline-start" aria-hidden="true" />
          ) : (
            <CheckCircle2 data-icon="inline-start" aria-hidden="true" />
          )}
          {failed ? "Needs attention" : "Profile active"}
        </Badge>

        <div className="mt-5 flex items-start gap-4">
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl",
              failed ? "bg-error/10 text-error" : "bg-success/10 text-success",
            )}
          >
            {failed ? (
              <AlertCircle className="size-5" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="size-5" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0">
            <h2 className="max-w-xl text-balance text-2xl font-bold tracking-[-0.025em] text-foreground-strong sm:text-[30px]">
              {failed
                ? "Trending preparation needs attention"
                : "Your Instagram creative brief is active"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              {failed
                ? "Your business profile is saved, but the first personalized ideas did not start preparing."
                : "Your saved profile now grounds Reel hooks, text-led videos, and carousel posts across the workspace."}
            </p>
          </div>
        </div>

        <dl className="mt-7 grid overflow-hidden rounded-xl border border-border bg-card-muted/45 sm:grid-cols-2">
          <div className="px-4 py-4 sm:border-r sm:border-border">
            <dt className="text-xs font-medium text-muted-subtle">
              Context source
            </dt>
            <dd className="mt-1 text-sm font-bold text-foreground">
              {getIntakeLabel(profile.intakeType)}
            </dd>
          </div>
          <div className="border-t border-border px-4 py-4 sm:border-t-0">
            <dt className="text-xs font-medium text-muted-subtle">
              Profile version
            </dt>
            <dd className="mt-1 font-mono text-sm font-bold tabular-nums text-foreground">
              {formatCount(profile.profileVersion)}
            </dd>
          </div>
        </dl>

        {failed && profile.preparationError ? (
          <ErrorNotice message={profile.preparationError} />
        ) : null}
        {error ? <ErrorNotice message={error} /> : null}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          {failed ? (
            <Button
              type="button"
              onClick={onRetry}
              disabled={isRetrying}
              size="lg"
              className="h-11"
            >
              {isRetrying ? (
                <Loader2
                  data-icon="inline-start"
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <RefreshCw data-icon="inline-start" aria-hidden="true" />
              )}
              <span aria-live="polite">
                {isRetrying ? "Retrying preparation…" : "Retry preparation"}
              </span>
            </Button>
          ) : null}
          <Link
            href="/dashboard"
            className={cn(
              buttonVariants({
                size: "lg",
                variant: failed ? "outline" : "default",
              }),
              "h-11",
            )}
          >
            <Sparkles data-icon="inline-start" aria-hidden="true" />
            Open Trending
          </Link>
        </div>
      </div>
    </section>
  );
}

function ProfileField({
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
  const describedBy = hint || maxLength ? hintId : undefined;

  return (
    <FormField className={className}>
      <div className="flex items-center justify-between gap-3">
        <FieldLabel htmlFor={inputId} className="font-medium">
          {label}
        </FieldLabel>
        {hint === "Optional" ? (
          <span className="text-xs text-muted-subtle">Optional</span>
        ) : null}
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
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            profileControlClassName,
            "min-h-28 resize-y py-2.5",
          )}
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
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className={profileControlClassName}
        />
      )}
      {hint || maxLength ? (
        <div
          id={hintId}
          className="flex items-start justify-between gap-3 text-xs leading-5 text-muted-subtle"
        >
          <span>{hint !== "Optional" ? hint : null}</span>
          {maxLength ? (
            <span className="shrink-0 font-mono tabular-nums">
              {formatCount(value.length)}/{formatCount(maxLength)}
            </span>
          ) : null}
        </div>
      ) : null}
    </FormField>
  );
}

function StepNumber({ value }: { value: string }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-selected text-xs font-bold text-primary">
      {value}
    </span>
  );
}

function ErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Alert variant="destructive" className="mt-6" aria-live="polite">
      <AlertCircle aria-hidden="true" />
      <AlertTitle>Business profile needs attention</AlertTitle>
      <AlertDescription className="break-words">{message}</AlertDescription>
      {onRetry ? (
        <AlertAction>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw data-icon="inline-start" aria-hidden="true" />
            Retry
          </Button>
        </AlertAction>
      ) : null}
    </Alert>
  );
}

function ProfileLoadingState() {
  return (
    <section
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-card shadow-card"
    >
      <span className="sr-only">Checking your business profile…</span>
      <div
        className="h-1 bg-[linear-gradient(90deg,var(--instagram-orange),var(--instagram-rose),var(--instagram-violet))]"
        aria-hidden="true"
      />
      <div className="flex flex-col gap-6 px-5 py-7 sm:px-7">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-8 w-80 max-w-full" />
          <Skeleton className="h-4 w-[520px] max-w-full" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <Separator />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </section>
  );
}

function formatCount(value: number) {
  return countFormatter.format(value);
}

function getFriendlyProfileError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.trim();

  if (!message || /(?:typeerror|fetch failed)/i.test(message)) {
    return fallback;
  }

  return message;
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
