"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  Check,
  Copy,
  Download,
  Eye,
  ImagePlus,
  Loader2,
  Megaphone,
  MessageCircleHeart,
  MousePointerClick,
  PenLine,
  RefreshCw,
  Rocket,
  Smartphone,
  Sparkles,
  Trash2,
  TrendingUp,
  UserPlus,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type RefObject,
} from "react";

import { ProductLogoMark } from "@/components/brand/product-logo";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field as FormField,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { getBusinessProfileGateQueryKey } from "@/lib/business-profiles/profile-gate-query";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import {
  persistJobIdInUrl,
  useBackgroundJob,
  usePersistedJobIdFromUrl,
} from "@/lib/jobs/background-job-client";
import { cn } from "@/lib/utils";

const aiIdePrompt = `Analyze this mobile app codebase and return a concise business-context report for marketing creative generation. Do not include source code, secrets, or implementation details. Use the following headings:\n\n- App name\n- App category\n- One-sentence product summary\n- Target users\n- Main user problem\n- Core features\n- Key benefits\n- Differentiators\n- Brand tone\n- Claims to avoid\n- Suggested visual keywords\n\nOnly state facts supported by the codebase and product copy. Keep every item short.`;

const BUSINESS_LOGO_MAX_BYTES = 2 * 1024 * 1024;
const acceptedLogoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

type IntakeType = "manual" | "mobile_app_ai_prompt" | "website";
type OnboardingStep = 1 | 2 | 3;
type RequestStatus = "analyzing" | "idle" | "loading" | "saving";
type PrimaryGoal =
  | "increase_revenue"
  | "generate_leads"
  | "increase_signups"
  | "increase_installs"
  | "grow_views"
  | "brand_awareness"
  | "grow_following"
  | "increase_engagement"
  | "website_traffic"
  | "product_launch";

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
  analysisConfidence: "high" | "low" | "medium";
  analysisSummary: string | null;
  businessName: string | null;
  id: string;
  intakeType: IntakeType;
  logoStorageKey: string | null;
  logoUrl: string | null;
  onboardingComplete: boolean;
  onboardingCompletedAt: string | null;
  onboardingMissingFields: string[];
  onboardingRequiredVersion: number;
  onboardingStep: OnboardingStep;
  onboardingStatus: "completed" | "incomplete";
  onboardingVersion: number;
  preparationError: string | null;
  preparationStatus: "failed" | "preparing";
  primaryGoal: PrimaryGoal | null;
  primaryGoals: PrimaryGoal[];
  profileVersion: number;
};

function WebsiteIntakeIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="2.5" y="3.5" width="19" height="17" rx="3.5" strokeWidth="1.75" />
      <path d="M2.5 8.5h19" strokeWidth="1.5" />
      <circle cx="5.5" cy="6" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="8" cy="6" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="6" r="0.75" fill="currentColor" stroke="none" />
      <path d="M6 13h6.5" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M6 16.5h4" strokeWidth="1.75" strokeLinecap="round" opacity="0.6" />
      <path
        d="M17 12l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

const intakeOptions = [
  {
    description: "We read your public product pages and organize the useful details.",
    icon: WebsiteIntakeIcon,
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

const goalOptions = [
  { icon: BadgeDollarSign, label: "Increase Sales & Revenue", value: "increase_revenue" },
  { icon: UserPlus, label: "Generate Leads", value: "generate_leads" },
  { icon: TrendingUp, label: "Get More Sign-ups", value: "increase_signups" },
  { icon: Download, label: "Increase App Installs", value: "increase_installs" },
  { icon: Eye, label: "Grow Views & Reach", value: "grow_views" },
  { icon: Megaphone, label: "Build Brand Awareness", value: "brand_awareness" },
  { icon: UsersRound, label: "Grow Social Following", value: "grow_following" },
  { icon: MessageCircleHeart, label: "Increase Engagement", value: "increase_engagement" },
  { icon: MousePointerClick, label: "Drive Website Traffic", value: "website_traffic" },
  { icon: Rocket, label: "Promote a Product Launch", value: "product_launch" },
] as const satisfies ReadonlyArray<{
  icon: typeof BadgeDollarSign;
  label: string;
  value: PrimaryGoal;
}>;

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
  "h-12 w-full rounded-xl border border-border bg-card-muted/60 px-3.5 text-sm leading-6 text-foreground outline-none transition-[background-color,border-color,box-shadow,transform] placeholder:text-muted-subtle hover:border-border-strong focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:bg-card disabled:opacity-70";

export function BusinessProfileOnboarding() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { loading: authLoading, user } = useAuth();
  const persistedJobId = usePersistedJobIdFromUrl();
  const backgroundJobQuery = useBackgroundJob(persistedJobId);
  const backgroundJob = backgroundJobQuery.data;
  const backgroundJobTerminal =
    backgroundJob?.status === "cancelled" ||
    backgroundJob?.status === "completed" ||
    backgroundJob?.status === "failed";
  const [step, setStep] = useState<OnboardingStep>(1);
  const [intakeType, setIntakeType] = useState<IntakeType>("website");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [aiIdeContext, setAiIdeContext] = useState("");
  const [manual, setManual] = useState<ManualProfileDraft>(initialManualDraft);
  const [businessName, setBusinessName] = useState("");
  const [primaryGoals, setPrimaryGoals] = useState<PrimaryGoal[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoStorageKey, setLogoStorageKey] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadedLogoKey, setUploadedLogoKey] = useState<string | null>(null);
  const [identityDirty, setIdentityDirty] = useState(false);
  const [goalDirty, setGoalDirty] = useState(false);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [status, setStatus] = useState<RequestStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
  const [profileLoadAttempt, setProfileLoadAttempt] = useState(0);
  const [copied, setCopied] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const idempotencyPayloadRef = useRef<string | null>(null);
  const logoObjectUrlRef = useRef<string | null>(null);
  const latestPrimaryGoalsRef = useRef(primaryGoals);
  const verifiedJobRef = useRef<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const isAnalyzing =
    status === "analyzing" || Boolean(persistedJobId && !backgroundJobTerminal);
  const isBusy = status === "saving" || isAnalyzing;
  const hasUnsavedChanges =
    websiteUrl.trim().length > 0 ||
    aiIdeContext.trim().length > 0 ||
    Object.values(manual).some((value) => value.trim().length > 0) ||
    identityDirty ||
    goalDirty;

  useEffect(() => {
    latestPrimaryGoalsRef.current = primaryGoals;
  }, [primaryGoals]);

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    const currentUserId = user.uid;
    const controller = new AbortController();

    async function loadProfile() {
      try {
        const loadedProfile = await fetchProfile(controller.signal);
        hydrateProfile(loadedProfile);

        if (loadedProfile?.onboardingComplete) {
          queryClient.setQueryData(
            getBusinessProfileGateQueryKey(currentUserId),
            { onboardingComplete: true },
          );
          router.replace("/dashboard");
          router.refresh();
          return;
        }

        if (
          loadedProfile &&
          !persistedJobId &&
          loadedProfile.onboardingStep !== 1
        ) {
          moveToStep(loadedProfile.onboardingStep);
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setProfileLoadFailed(true);
          setError(
            getFriendlyError(
              loadError,
              "Could not load your business profile. Check your connection and try again.",
            ),
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setStatus(persistedJobId ? "analyzing" : "idle");
        }
      }
    }

    void loadProfile();
    return () => controller.abort();
  }, [
    authLoading,
    persistedJobId,
    profileLoadAttempt,
    queryClient,
    router,
    user,
  ]);

  useEffect(() => {
    if (!backgroundJob || !backgroundJobTerminal) {
      return;
    }

    const verificationKey = `${backgroundJob.id}:${backgroundJob.status}`;
    if (verifiedJobRef.current === verificationKey) {
      return;
    }
    verifiedJobRef.current = verificationKey;

    if (backgroundJob.status !== "completed") {
      persistJobIdInUrl(null);
      idempotencyKeyRef.current = null;
      idempotencyPayloadRef.current = null;
      const failureUpdate = window.setTimeout(() => {
        setStatus("idle");
        setError(
          backgroundJob.error?.message ??
            "We could not analyze that source. Check it and try again.",
        );
      }, 0);
      return () => window.clearTimeout(failureUpdate);
    }

    async function verifyCompletedProfile() {
      try {
        const loadedProfile = await fetchProfile();
        if (!loadedProfile) {
          throw new Error("Business analysis completed without a saved profile.");
        }
        hydrateProfile(loadedProfile);
        persistJobIdInUrl(null);
        idempotencyKeyRef.current = null;
        idempotencyPayloadRef.current = null;
        setStatus("idle");
        setError(null);
        moveToStep(2);
      } catch (verificationError) {
        setStatus("idle");
        setError(
          getFriendlyError(
            verificationError,
            "The analysis finished, but we could not load it. Try again.",
          ),
        );
      }
    }

    void verifyCompletedProfile();
  }, [backgroundJob, backgroundJobTerminal]);

  useEffect(
    () => () => {
      if (logoObjectUrlRef.current) {
        URL.revokeObjectURL(logoObjectUrlRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!hasUnsavedChanges || persistedJobId) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges, persistedJobId]);

  useEffect(() => {
    if (
      !user ||
      !profile ||
      step !== 3 ||
      !goalDirty ||
      status !== "idle"
    ) {
      return;
    }

    const controller = new AbortController();
    const goalsToSave = primaryGoals;
    const goalsFingerprint = JSON.stringify(goalsToSave);
    const timer = window.setTimeout(async () => {
      try {
        const token = await getCurrentUserIdToken();
        if (!token) {
          throw new Error("Sign in before saving your onboarding goals.");
        }

        const response = await fetch("/api/business-profile", {
          body: JSON.stringify({
            action: "save_goal_draft",
            primaryGoals: goalsToSave,
          }),
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          method: "PATCH",
          signal: controller.signal,
        });
        const data = await readProfileResponse(response);

        if (JSON.stringify(latestPrimaryGoalsRef.current) === goalsFingerprint) {
          setProfile(data.profile);
          setGoalDirty(false);
          setError(null);
        }
      } catch (saveError) {
        if (!controller.signal.aborted) {
          setError(
            getFriendlyError(
              saveError,
              "Could not save your goal choices. They will still be saved when you finish onboarding.",
            ),
          );
        }
      }
    }, 700);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [goalDirty, primaryGoals, profile, status, step, user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (step === 1) {
      await startBusinessAnalysis();
      return;
    }

    if (step === 2) {
      await saveBusinessIdentity();
      return;
    }

    await completeOnboarding();
  }

  async function startBusinessAnalysis() {
    setError(null);
    setProfileLoadFailed(false);
    setStatus("saving");

    try {
      const token = await getCurrentUserIdToken();
      if (!token) {
        throw new Error("Sign in before creating your business profile.");
      }

      const payload = { aiIdeContext, intakeType, manual, websiteUrl };
      const payloadFingerprint = JSON.stringify(payload);
      if (idempotencyPayloadRef.current !== payloadFingerprint) {
        idempotencyPayloadRef.current = payloadFingerprint;
        idempotencyKeyRef.current = crypto.randomUUID();
      }
      const idempotencyKey = idempotencyKeyRef.current ?? crypto.randomUUID();
      idempotencyKeyRef.current = idempotencyKey;

      const response = await fetch("/api/business-profile", {
        body: JSON.stringify(payload),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        method: "POST",
      });
      const data = (await response.json().catch(() => null)) as {
        jobId?: string;
        message?: string;
        ok?: boolean;
      } | null;

      if (!response.ok || !data?.ok || !data.jobId) {
        throw new Error(data?.message ?? "Could not analyze your business information.");
      }

      setStatus("analyzing");
      persistJobIdInUrl(data.jobId);
    } catch (submitError) {
      setError(
        getFriendlyError(
          submitError,
          "Could not analyze your business information. Review the details and try again.",
        ),
      );
      setStatus("idle");
    }
  }

  async function saveBusinessIdentity() {
    const normalizedName = businessName.trim();
    if (!normalizedName) {
      setError("Enter the business name before continuing.");
      return;
    }

    setError(null);
    setStatus("saving");

    try {
      const token = await getCurrentUserIdToken();
      if (!token) {
        throw new Error("Sign in before saving your business identity.");
      }

      let nextLogoStorageKey = logoStorageKey;
      if (logoFile) {
        nextLogoStorageKey = uploadedLogoKey ?? (await uploadLogo(logoFile, token));
        setUploadedLogoKey(nextLogoStorageKey);
      }

      const response = await fetch("/api/business-profile", {
        body: JSON.stringify({
          action: "save_identity",
          businessName: normalizedName,
          logoStorageKey: nextLogoStorageKey,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const data = await readProfileResponse(response);
      hydrateProfile(data.profile);
      setLogoFile(null);
      clearLogoPreview();
      setUploadedLogoKey(null);
      setIdentityDirty(false);
      setStatus("idle");
      moveToStep(3);
    } catch (saveError) {
      setError(
        getFriendlyError(
          saveError,
          "Could not save your business name and logo. Try again.",
        ),
      );
      setStatus("idle");
    }
  }

  async function completeOnboarding() {
    if (primaryGoals.length === 0) {
      setError("Choose at least one goal before continuing.");
      return;
    }

    setError(null);
    setStatus("saving");

    try {
      if (!user) {
        throw new Error("Sign in before completing onboarding.");
      }

      const token = await getCurrentUserIdToken();
      if (!token) {
        throw new Error("Sign in before completing onboarding.");
      }
      const response = await fetch("/api/business-profile", {
        body: JSON.stringify({
          action: "complete",
          primaryGoals,
          timezone:
            Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const data = await readProfileResponse(response);
      if (!data.profile.onboardingComplete) {
        throw new Error("Onboarding was saved but is not complete yet.");
      }
      queryClient.setQueryData(
        getBusinessProfileGateQueryKey(user.uid),
        { onboardingComplete: true },
      );
      router.replace("/dashboard");
      router.refresh();
    } catch (completeError) {
      setError(
        getFriendlyError(
          completeError,
          "Could not finish onboarding. Try again.",
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
      setError("Could not copy the prompt. Select the prompt text and copy it manually.");
    }
  }

  function selectIntakeType(value: IntakeType) {
    setIntakeType(value);
    setCopied(false);
    setError(null);
  }

  function selectLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) {
      return;
    }
    if (!acceptedLogoTypes.has(file.type)) {
      setError("Upload a PNG, JPEG, or WebP logo.");
      return;
    }
    if (file.size < 1 || file.size > BUSINESS_LOGO_MAX_BYTES) {
      setError("Choose a logo smaller than 2 MB.");
      return;
    }
    setLogoFile(file);
    clearLogoPreview();
    const objectUrl = URL.createObjectURL(file);
    logoObjectUrlRef.current = objectUrl;
    setLogoPreviewUrl(objectUrl);
    setUploadedLogoKey(null);
    setIdentityDirty(true);
    setError(null);
  }

  function removeLogo() {
    setLogoFile(null);
    clearLogoPreview();
    setLogoStorageKey(null);
    setLogoUrl(null);
    setUploadedLogoKey(null);
    setIdentityDirty(true);
    setError(null);
  }

  function clearLogoPreview() {
    if (logoObjectUrlRef.current) {
      URL.revokeObjectURL(logoObjectUrlRef.current);
      logoObjectUrlRef.current = null;
    }
    setLogoPreviewUrl(null);
  }

  function hydrateProfile(nextProfile: ProfileSummary | null) {
    setProfile(nextProfile);
    if (!nextProfile) {
      return;
    }
    setBusinessName(nextProfile.businessName?.trim() ?? "");
    setLogoStorageKey(nextProfile.logoStorageKey);
    setLogoUrl(nextProfile.logoUrl);
    setPrimaryGoals(
      nextProfile.primaryGoals?.length
        ? nextProfile.primaryGoals
        : nextProfile.primaryGoal
          ? [nextProfile.primaryGoal]
          : [],
    );
    setIdentityDirty(false);
    setGoalDirty(false);
  }

  function moveToStep(nextStep: OnboardingStep) {
    setStep(nextStep);
    setError(null);
    window.setTimeout(() => headingRef.current?.focus(), 0);
  }

  function retryProfileLoad() {
    setError(null);
    setProfileLoadFailed(false);
    setStatus("loading");
    setProfileLoadAttempt((attempt) => attempt + 1);
  }

  if (authLoading || (Boolean(user) && status === "loading")) {
    return (
      <OnboardingFrame>
        <LoadingState />
      </OnboardingFrame>
    );
  }

  if (profileLoadFailed) {
    return (
      <OnboardingFrame>
        <LoadFailureState
          message={error ?? "Could not load your business profile."}
          onRetry={retryProfileLoad}
        />
      </OnboardingFrame>
    );
  }

  return (
    <OnboardingFrame>
      <form
        onSubmit={submit}
        className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-floating transition-all duration-300"
      >
        <div
          className="h-1.5 bg-[linear-gradient(90deg,var(--instagram-orange),var(--instagram-rose),var(--instagram-violet))]"
          aria-hidden="true"
        />

        {step === 1 ? (
          <BusinessInformationStep
            aiIdeContext={aiIdeContext}
            copied={copied}
            error={error}
            intakeType={intakeType}
            isSaving={isBusy}
            manual={manual}
            websiteUrl={websiteUrl}
            onAiIdeContextChange={setAiIdeContext}
            onCopyPrompt={() => void copyPrompt()}
            onIntakeTypeChange={selectIntakeType}
            onManualChange={setManual}
            onWebsiteUrlChange={setWebsiteUrl}
          />
        ) : null}

        {step === 2 ? (
          <BusinessIdentityStep
            businessName={businessName}
            error={error}
            headingRef={headingRef}
            isSaving={status === "saving"}
            logoPreviewUrl={logoPreviewUrl ?? logoUrl}
            profile={profile}
            onBack={() => moveToStep(1)}
            onBusinessNameChange={(value) => {
              setBusinessName(value);
              setIdentityDirty(true);
              setError(null);
            }}
            onLogoChange={selectLogo}
            onRemoveLogo={removeLogo}
          />
        ) : null}

        {step === 3 ? (
          <PrimaryGoalStep
            error={error}
            headingRef={headingRef}
            isSaving={status === "saving"}
            primaryGoals={primaryGoals}
            onBack={() => moveToStep(2)}
            onPrimaryGoalToggle={(value) => {
              setPrimaryGoals((currentGoals) =>
                currentGoals.includes(value)
                  ? currentGoals.filter((goal) => goal !== value)
                  : [...currentGoals, value],
              );
              setGoalDirty(true);
              setError(null);
            }}
          />
        ) : null}
      </form>
    </OnboardingFrame>
  );
}

export function BusinessInformationStep({
  aiIdeContext,
  copied,
  error,
  intakeType,
  isSaving,
  manual,
  onAiIdeContextChange,
  onCopyPrompt,
  onIntakeTypeChange,
  onManualChange,
  onWebsiteUrlChange,
  websiteUrl,
}: {
  aiIdeContext: string;
  copied: boolean;
  error: string | null;
  intakeType: IntakeType;
  isSaving: boolean;
  manual: ManualProfileDraft;
  onAiIdeContextChange: (value: string) => void;
  onCopyPrompt: () => void;
  onIntakeTypeChange: (value: IntakeType) => void;
  onManualChange: (value: ManualProfileDraft) => void;
  onWebsiteUrlChange: (value: string) => void;
  websiteUrl: string;
}) {
  const websiteInputId = useId();
  const websiteHintId = useId();
  const aiContextInputId = useId();
  const aiContextHintId = useId();

  return (
    <>
      <div className="px-5 py-6 sm:px-8 sm:py-8">
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
          <FieldLegend className="sr-only">Business context source</FieldLegend>
          <div className="grid gap-3.5 sm:grid-cols-3">
            {intakeOptions.map((option) => {
              const Icon = option.icon;
              const selected = intakeType === option.value;
              return (
                <label
                  key={option.value}
                  className={cn(
                    "relative flex min-h-36 touch-manipulation cursor-pointer flex-col rounded-2xl border p-4.5 text-left transition-all duration-200 focus-within:ring-2 focus-within:ring-focus focus-within:ring-offset-2 focus-within:ring-offset-card motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                    selected
                      ? "border-primary/60 bg-selected/90 shadow-[0_8px_24px_rgba(201,71,22,0.1)] ring-1 ring-primary/20"
                      : "border-border/80 bg-card-muted/50 hover:-translate-y-0.5 hover:border-border-strong hover:bg-card-muted/80 shadow-xs",
                    isSaving && "cursor-not-allowed opacity-60",
                  )}
                >
                  <input
                    type="radio"
                    name="business-context-source"
                    value={option.value}
                    checked={selected}
                    disabled={isSaving}
                    onChange={() => onIntakeTypeChange(option.value)}
                    className="sr-only"
                  />
                  <span className="flex items-start justify-between gap-3">
                    <span className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl border transition-colors shadow-xs",
                      selected
                        ? "border-primary/25 bg-primary/10 text-primary"
                        : "border-border/80 bg-card text-muted",
                    )}>
                      <Icon className="size-4.5" aria-hidden="true" />
                    </span>
                    <span className={cn(
                      "flex size-5.5 items-center justify-center rounded-full border transition-all",
                      selected
                        ? "border-primary bg-primary text-primary-foreground shadow-xs scale-105"
                        : "border-border-strong bg-card text-transparent",
                    )} aria-hidden="true">
                      <Check className="size-3.5 stroke-[2.5]" />
                    </span>
                  </span>
                  <span className="mt-4 text-[15px] font-bold tracking-tight text-foreground-strong">{option.label}</span>
                  <span className="mt-1 text-xs leading-5 text-muted">{option.description}</span>
                </label>
              );
            })}
          </div>
        </FieldSet>
      </div>

      <Separator />

      <div className="px-5 py-7 sm:px-8 sm:py-8">
        {intakeType === "website" ? (
          <section aria-labelledby="website-source-title">
            <h3 id="website-source-title" className="text-lg font-bold text-foreground-strong">Website details</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              We only read public product pages and organize the facts needed for Instagram creative.
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
                onChange={(event) => onWebsiteUrlChange(event.target.value)}
                placeholder="https://yourbusiness.com…"
                aria-describedby={websiteHintId}
                className={profileControlClassName}
              />
              <FieldDescription id={websiteHintId}>
                Use the main public URL. Sign-in pages and private content are not required.
              </FieldDescription>
            </FormField>
          </section>
        ) : null}

        {intakeType === "mobile_app_ai_prompt" ? (
          <section aria-labelledby="mobile-source-title">
            <h3 id="mobile-source-title" className="text-lg font-bold text-foreground-strong">Bring context from your app</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Run this prompt in the AI IDE that already understands the codebase, then paste its factual report below.
            </p>
            <ol className="mt-7 flex flex-col gap-8">
              <li>
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <StepNumber value="1" />
                    <h4 className="text-sm font-bold text-foreground">Copy the analysis prompt</h4>
                  </div>
                  <Button type="button" variant="outline" size="lg" className="h-10 rounded-xl px-4 font-medium" onClick={onCopyPrompt} disabled={isSaving}>
                    {copied ? <Check data-icon="inline-start" className="text-success stroke-[2.5]" aria-hidden="true" /> : <Copy data-icon="inline-start" aria-hidden="true" />}
                    <span aria-live="polite">{copied ? "Copied" : "Copy prompt"}</span>
                  </Button>
                </div>
                <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-border/80 bg-card p-4.5 font-mono text-xs leading-5 text-muted shadow-xs sm:p-5">{aiIdePrompt}</pre>
              </li>
              <li>
                <div className="flex items-center gap-3">
                  <StepNumber value="2" />
                  <h4 className="text-sm font-bold text-foreground">Paste the AI IDE result</h4>
                </div>
                <FormField className="mt-4">
                  <FieldLabel htmlFor={aiContextInputId} className="sr-only">AI IDE business context</FieldLabel>
                  <textarea
                    id={aiContextInputId}
                    name="aiIdeContext"
                    autoComplete="off"
                    required
                    minLength={20}
                    maxLength={24_000}
                    disabled={isSaving}
                    value={aiIdeContext}
                    onChange={(event) => onAiIdeContextChange(event.target.value)}
                    rows={11}
                    placeholder="Paste the complete business-context report here…"
                    aria-describedby={aiContextHintId}
                    className={cn(profileControlClassName, "min-h-56 resize-y py-3")}
                  />
                  <div id={aiContextHintId} className="flex items-center justify-between gap-4 text-xs leading-5 text-muted-subtle">
                    <span>Do not paste source code, secrets, or credentials.</span>
                    <span className="shrink-0 font-mono tabular-nums">{formatCount(aiIdeContext.length)}/24,000</span>
                  </div>
                </FormField>
              </li>
            </ol>
          </section>
        ) : null}

        {intakeType === "manual" ? (
          <section aria-labelledby="manual-source-title">
            <h3 id="manual-source-title" className="text-lg font-bold text-foreground-strong">Enter the business facts</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Keep each answer concise and factual. These details become the source of truth for personalized recommendations in Trending.
            </p>
            <FieldGroup className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <ProfileField label="Business name" name="businessName" autoComplete="organization" value={manual.businessName} required maxLength={120} disabled={isSaving} placeholder="Enter your business name…" onChange={(value) => onManualChange({ ...manual, businessName: value })} />
              <ProfileField label="Category" name="category" value={manual.category} required maxLength={120} disabled={isSaving} placeholder="Enter your category or industry…" onChange={(value) => onManualChange({ ...manual, category: value })} />
              <ProfileField label="Target audience" name="targetAudience" value={manual.targetAudience} required minLength={3} maxLength={600} disabled={isSaving} placeholder="Describe the people your business serves…" className="sm:col-span-2" onChange={(value) => onManualChange({ ...manual, targetAudience: value })} />
              <ProfileField label="Main problem" name="mainProblem" value={manual.mainProblem} required maxLength={360} disabled={isSaving} placeholder="Describe the main problem they need solved…" className="sm:col-span-2" onChange={(value) => onManualChange({ ...manual, mainProblem: value })} />
              <ProfileField label="Product summary" name="productSummary" value={manual.productSummary} required minLength={20} maxLength={1_000} disabled={isSaving} placeholder="Explain what the product does in two or three sentences…" multiline className="sm:col-span-2" onChange={(value) => onManualChange({ ...manual, productSummary: value })} />
              <ProfileField label="Key benefits" name="valueProps" value={manual.valueProps} required minLength={3} maxLength={1_000} disabled={isSaving} placeholder="List one benefit per line…" hint="One benefit per line produces cleaner creative angles." multiline className="sm:col-span-2" onChange={(value) => onManualChange({ ...manual, valueProps: value })} />
              <ProfileField label="Brand tone" name="brandTone" value={manual.brandTone} maxLength={160} disabled={isSaving} placeholder="Describe the voice you want to use…" hint="Optional" className="sm:col-span-2" onChange={(value) => onManualChange({ ...manual, brandTone: value })} />
            </FieldGroup>
          </section>
        ) : null}

        {error ? <ErrorNotice message={error} /> : null}
      </div>

      <Separator />
      <footer className="flex flex-col gap-5 bg-card-muted/35 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="max-w-lg">
          <p className="text-sm font-medium text-foreground">One profile grounds every personalized idea.</p>
          <p className="mt-1 text-xs leading-5 text-muted-subtle">Nothing is published until you review and approve it.</p>
        </div>
        <Button type="submit" disabled={isSaving} size="lg" className="h-12 w-full rounded-xl px-6 font-semibold shadow-sm sm:w-auto">
          {isSaving ? <Loader2 data-icon="inline-start" className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Sparkles data-icon="inline-start" aria-hidden="true" />}
          <span aria-live="polite">{isSaving ? getSavingLabel(intakeType) : "Save profile & prepare ideas"}</span>
        </Button>
      </footer>
    </>
  );
}

export function BusinessIdentityStep({
  businessName,
  error,
  headingRef,
  isSaving,
  logoPreviewUrl,
  onBack,
  onBusinessNameChange,
  onLogoChange,
  onRemoveLogo,
  profile,
}: {
  businessName: string;
  error: string | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
  isSaving: boolean;
  logoPreviewUrl: string | null;
  onBack: () => void;
  onBusinessNameChange: (value: string) => void;
  onLogoChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveLogo: () => void;
  profile: ProfileSummary | null;
}) {
  const logoInputId = useId();

  return (
    <div className="px-5 py-7 sm:px-8 sm:py-8">
      <Badge variant="secondary">Step 2 of 3</Badge>
      <h2 ref={headingRef} tabIndex={-1} className="mt-4 text-2xl font-bold tracking-[-0.03em] text-foreground-strong outline-none sm:text-[32px]">
        Add your business name
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted sm:text-base">
        Enter the name customers know. You can also add a logo now, or skip it and continue.
      </p>

      {profile?.analysisSummary ? (
        <div className="mt-6 rounded-2xl border border-border/80 bg-card-muted/45 p-4.5 shadow-xs">
          <div className="flex items-start gap-3.5">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success border border-success/20 shadow-xs"><Check className="size-4 stroke-[2.5]" aria-hidden="true" /></span>
            <div>
              <p className="text-sm font-semibold text-foreground-strong">Business source analyzed</p>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">{profile.analysisSummary}</p>
            </div>
          </div>
        </div>
      ) : null}

      <FormField className="mt-7" data-invalid={Boolean(error)}>
        <FieldLabel htmlFor="business-name">Business name</FieldLabel>
        <input
          id="business-name"
          name="businessName"
          autoComplete="organization"
          autoFocus
          required
          maxLength={120}
          disabled={isSaving}
          placeholder="Your business or product name"
          value={businessName}
          onChange={(event) => onBusinessNameChange(event.target.value)}
          aria-describedby="business-name-help"
          aria-invalid={Boolean(error)}
          className={profileControlClassName}
        />
        <FieldDescription id="business-name-help">Enter the name you want UGC Pilot to use in personalized content.</FieldDescription>
      </FormField>

      <FormField className="mt-6">
        <FieldLabel htmlFor={logoInputId}>Business logo <span className="font-normal text-muted-subtle">(optional)</span></FieldLabel>
        <div className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-card-muted/45 p-5 shadow-xs sm:flex-row sm:items-center">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border-strong/70 bg-card text-muted shadow-xs">
            {logoPreviewUrl ? (
              <Image src={logoPreviewUrl} alt="Business logo preview" width={80} height={80} unoptimized className="size-full object-contain p-1" />
            ) : (
              <ImagePlus className="size-6 text-muted-subtle" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground-strong">{logoPreviewUrl ? "Logo ready" : "Add a logo if you have one"}</p>
            <p className="mt-1 text-xs leading-5 text-muted">PNG, JPEG, or WebP. Maximum 2 MB.</p>
            <div className="mt-3 flex flex-wrap gap-2.5">
              <label htmlFor={logoInputId} className={cn(
                "inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border-strong bg-card px-4 text-sm font-medium text-foreground transition-all hover:bg-card-muted hover:border-foreground/30 shadow-xs focus-within:ring-2 focus-within:ring-focus",
                isSaving && "pointer-events-none opacity-55",
              )}>
                <ImagePlus className="size-4" aria-hidden="true" />
                {logoPreviewUrl ? "Replace logo" : "Upload logo"}
              </label>
              <input id={logoInputId} type="file" accept="image/png,image/jpeg,image/webp" disabled={isSaving} onChange={onLogoChange} className="sr-only" />
              {logoPreviewUrl ? (
                <Button type="button" variant="ghost" size="lg" className="rounded-xl h-10 px-3 font-medium text-muted hover:text-error" disabled={isSaving} onClick={onRemoveLogo}>
                  <Trash2 data-icon="inline-start" className="size-4" aria-hidden="true" />Remove
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </FormField>

      {error ? <FieldError className="mt-4">{error}</FieldError> : null}

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row">
        <Button type="button" variant="outline" size="lg" className="h-12 rounded-xl px-6 font-semibold sm:w-auto hover:bg-card-muted" onClick={onBack} disabled={isSaving}>
          <ArrowLeft data-icon="inline-start" aria-hidden="true" />Back
        </Button>
        <Button type="submit" size="lg" className="h-12 flex-1 rounded-xl font-semibold shadow-sm transition-transform active:scale-[0.99]" disabled={isSaving || !businessName.trim()}>
          {isSaving ? <Loader2 data-icon="inline-start" className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ArrowRight data-icon="inline-end" aria-hidden="true" />}
          {isSaving ? "Saving identity…" : "Continue"}
        </Button>
      </div>
    </div>
  );
}

export function PrimaryGoalStep({
  error,
  headingRef,
  isSaving,
  onBack,
  onPrimaryGoalToggle,
  primaryGoals,
}: {
  error: string | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
  isSaving: boolean;
  onBack: () => void;
  onPrimaryGoalToggle: (value: PrimaryGoal) => void;
  primaryGoals: PrimaryGoal[];
}) {
  return (
    <div className="px-5 py-7 sm:px-8 sm:py-8">
      <Badge variant="secondary">Step 3 of 3</Badge>
      <h2 ref={headingRef} tabIndex={-1} className="mt-4 text-2xl font-bold tracking-[-0.03em] text-foreground-strong outline-none sm:text-[32px]">
        What do you want to achieve?
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted sm:text-base">
        Select every goal that matters. We will use the complete set to personalize your hooks.
      </p>

      <FieldSet className="mt-7">
        <FieldLegend className="sr-only">Content goals</FieldLegend>
        <div className="mb-3.5 flex items-center justify-between gap-4">
          <p className="text-sm font-semibold text-foreground-strong">Content goals</p>
          <span className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
            primaryGoals.length > 0
              ? "bg-primary/10 text-primary border border-primary/20"
              : "bg-card-muted text-muted border border-border",
          )} aria-live="polite">
            {primaryGoals.length === 0
              ? "Select at least one"
              : `${primaryGoals.length} selected`}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {goalOptions.map((option) => {
            const Icon = option.icon;
            const selected = primaryGoals.includes(option.value);
            return (
              <label key={option.value} className={cn(
                "group relative flex min-h-[80px] cursor-pointer items-center gap-3.5 rounded-2xl border px-4.5 py-3.5 text-left transition-all duration-200 focus-within:ring-2 focus-within:ring-focus focus-within:ring-offset-2 focus-within:ring-offset-card motion-reduce:transition-none",
                selected
                  ? "border-primary/60 bg-selected/90 shadow-[0_8px_24px_rgba(201,71,22,0.1)] ring-1 ring-primary/20"
                  : "border-border/80 bg-card hover:-translate-y-0.5 hover:border-border-strong hover:bg-card-muted/40 shadow-xs",
                isSaving && "cursor-not-allowed opacity-60",
              )}>
                <input
                  type="checkbox"
                  name="primary-goals"
                  value={option.value}
                  checked={selected}
                  disabled={isSaving}
                  onChange={() => onPrimaryGoalToggle(option.value)}
                  className="sr-only"
                />
                <span className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl border transition-colors shadow-xs",
                  selected
                    ? "border-primary/25 bg-primary/10 text-primary"
                    : "border-border/70 bg-card-muted/70 text-muted group-hover:border-border-strong group-hover:text-foreground",
                )}>
                  <Icon className="size-5 stroke-[1.85]" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground-strong">
                  {option.label}
                </span>
                <span className={cn(
                  "flex size-5.5 shrink-0 items-center justify-center rounded-lg border-2 transition-all",
                  selected
                    ? "border-primary bg-primary text-primary-foreground shadow-xs scale-105"
                    : "border-border-strong/80 bg-card text-transparent group-hover:border-foreground/30",
                )} aria-hidden="true">
                  <Check className="size-3.5 stroke-[2.5]" />
                </span>
              </label>
            );
          })}
        </div>
      </FieldSet>

      {error ? <FieldError className="mt-4">{error}</FieldError> : null}

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="outline" size="lg" className="h-12 rounded-xl px-6 font-semibold sm:min-w-28 hover:bg-card-muted" onClick={onBack} disabled={isSaving}>
          <ArrowLeft data-icon="inline-start" aria-hidden="true" />Back
        </Button>
        <Button type="submit" size="lg" className="h-12 rounded-xl font-semibold sm:min-w-60 shadow-sm transition-transform active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed" disabled={isSaving || primaryGoals.length === 0}>
          {isSaving ? <Loader2 data-icon="inline-start" className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Sparkles data-icon="inline-start" aria-hidden="true" />}
          {isSaving ? "Personalizing Trending…" : "Enter Trending"}
        </Button>
      </div>
    </div>
  );
}

export function OnboardingFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="instagram-theme relative min-h-dvh overflow-x-hidden bg-background text-foreground">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(circle_at_15%_0%,var(--instagram-orange),transparent_32%),radial-gradient(circle_at_85%_0%,var(--instagram-violet),transparent_30%)] opacity-[0.055]"
        aria-hidden="true"
      />
      <a href="#business-profile-content" className="sr-only rounded-lg bg-card px-3 py-2 text-sm font-semibold text-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus-visible:ring-2 focus-visible:ring-focus">Skip to business setup</a>
      <header className="relative border-b border-border/80 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] w-full max-w-[960px] items-center justify-between gap-4 px-5 sm:px-6">
          <div className="flex items-center gap-2.5" aria-label="UGC Pilot">
            <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary p-1.5 shadow-sm">
              <ProductLogoMark className="size-full" imageClassName="brightness-0 invert" sizes="36px" />
            </span>
            <span className="text-base font-bold text-foreground-strong">UGC Pilot</span>
          </div>
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Business setup</span>
        </div>
      </header>

      <div className="relative mx-auto w-full max-w-[820px] px-4 py-8 sm:px-6 sm:py-10 lg:py-12">
        <header className="max-w-[680px]">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Set up Trending</p>
          <h1 className="mt-3 text-[32px] font-bold leading-[1.12] tracking-[-0.04em] text-foreground-strong sm:text-[40px]">
            Help Trending understand your business
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted sm:text-base sm:leading-7">
            Add the essential details once so every hook starts with the right business context.
          </p>
        </header>
        <div id="business-profile-content" className="mt-7 scroll-mt-24 sm:mt-8">{children}</div>
      </div>
    </main>
  );
}

function ProfileField({
  autoComplete,
  className,
  disabled,
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
  disabled: boolean;
  hint?: string;
  label: string;
  maxLength?: number;
  minLength?: number;
  multiline?: boolean;
  name: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  value: string;
}) {
  const inputId = useId();
  const hintId = useId();
  const describedBy = hint || maxLength ? hintId : undefined;

  return (
    <FormField className={className}>
      <FieldLabel htmlFor={inputId}>{label}{!required ? <span className="font-normal text-muted-subtle"> (optional)</span> : null}</FieldLabel>
      {multiline ? (
        <textarea id={inputId} name={name} autoComplete={autoComplete} value={value} required={required} minLength={minLength} maxLength={maxLength} disabled={disabled} placeholder={placeholder} rows={4} aria-describedby={describedBy} onChange={(event) => onChange(event.target.value)} className={cn(profileControlClassName, "min-h-28 resize-y py-3")} />
      ) : (
        <input id={inputId} name={name} autoComplete={autoComplete} value={value} required={required} minLength={minLength} maxLength={maxLength} disabled={disabled} placeholder={placeholder} aria-describedby={describedBy} onChange={(event) => onChange(event.target.value)} className={profileControlClassName} />
      )}
      {hint || maxLength ? (
        <div id={hintId} className="flex items-start justify-between gap-3 text-xs leading-5 text-muted-subtle">
          <span>{hint !== "Optional" ? hint : null}</span>
          {maxLength ? <span className="shrink-0 font-mono tabular-nums">{formatCount(value.length)}/{formatCount(maxLength)}</span> : null}
        </div>
      ) : null}
    </FormField>
  );
}

function StepNumber({ value }: { value: string }) {
  return <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-selected text-xs font-bold text-primary">{value}</span>;
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <Alert variant="destructive" className="mt-6" aria-live="polite">
      <AlertCircle aria-hidden="true" />
      <AlertTitle>Business profile needs attention</AlertTitle>
      <AlertDescription className="break-words">{message}</AlertDescription>
    </Alert>
  );
}

function LoadingState() {
  return (
    <section role="status" aria-busy="true" className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-card shadow-card">
      <span className="sr-only">Checking your business profile...</span>
      <div className="flex flex-col gap-6 px-5 py-7 sm:px-8">
        <Skeleton className="h-5 w-24" /><Skeleton className="h-9 w-96 max-w-full" /><Skeleton className="h-4 w-[520px] max-w-full" />
        <div className="grid gap-3 sm:grid-cols-3"><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-28 rounded-xl" /></div>
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </section>
  );
}

function LoadFailureState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="rounded-[var(--radius-panel)] border border-border bg-card p-5 shadow-card sm:p-8">
      <Alert variant="destructive">
        <AlertCircle aria-hidden="true" /><AlertTitle>We could not check your setup</AlertTitle><AlertDescription>{message}</AlertDescription>
        <AlertAction><Button type="button" variant="outline" size="sm" onClick={onRetry}><RefreshCw data-icon="inline-start" aria-hidden="true" />Try again</Button></AlertAction>
      </Alert>
    </section>
  );
}

async function fetchProfile(signal?: AbortSignal) {
  const token = await getCurrentUserIdToken();
  if (!token) {
    throw new Error("Could not verify your sign-in session.");
  }
  const response = await fetch("/api/business-profile", {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  const data = (await response.json().catch(() => null)) as {
    message?: string;
    ok?: boolean;
    profile?: ProfileSummary | null;
  } | null;
  if (!response.ok || !data?.ok) {
    throw new Error(data?.message ?? "Could not load your business profile.");
  }
  return data.profile ?? null;
}

async function readProfileResponse(response: Response) {
  const data = (await response.json().catch(() => null)) as {
    message?: string;
    ok?: boolean;
    profile?: ProfileSummary;
  } | null;
  if (!response.ok || !data?.ok || !data.profile) {
    throw new Error(data?.message ?? "Could not save this onboarding step.");
  }
  return { profile: data.profile };
}

async function uploadLogo(file: File, token: string) {
  const preparedResponse = await fetch("/api/business-profile/logo/upload-url", {
    body: JSON.stringify({ contentType: file.type, fileSize: file.size }),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    method: "POST",
  });
  const prepared = (await preparedResponse.json().catch(() => null)) as {
    key?: string;
    message?: string;
    ok?: boolean;
    requiredHeaders?: Record<string, string>;
    uploadUrl?: string;
  } | null;
  if (!preparedResponse.ok || !prepared?.ok || !prepared.key || !prepared.uploadUrl) {
    throw new Error(prepared?.message ?? "Could not prepare the logo upload.");
  }
  const uploadResponse = await fetch(prepared.uploadUrl, {
    body: file,
    headers: prepared.requiredHeaders,
    method: "PUT",
  });
  if (!uploadResponse.ok) {
    throw new Error("The logo upload did not finish. Try again.");
  }
  return prepared.key;
}

function formatCount(value: number) {
  return countFormatter.format(value);
}

function getFriendlyError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }
  const message = error.message.trim();
  return !message || /(?:typeerror|fetch failed)/i.test(message) ? fallback : message;
}

function getSavingLabel(intakeType: IntakeType) {
  if (intakeType === "website") return "Analyzing website…";
  if (intakeType === "mobile_app_ai_prompt") return "Structuring app context…";
  return "Preparing creative brief…";
}
