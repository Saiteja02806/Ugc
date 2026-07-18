"use client";

import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Scissors,
  Video,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { buttonClassName } from "@/components/ui/button";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { cn } from "@/lib/utils";
import type {
  HookVideoCameraStyle,
  HookVideoEmotion,
  HookVideoProvider,
} from "@/lib/video/types";

type HookVideoGenerateResponse =
  | {
      ok: true;
      jobId: string;
      message: string;
      videoId: string;
    }
  | {
      ok: false;
      error: string;
    };

type HookVideoJobStatusResponse =
  | {
      ok: true;
      job: {
        id: string;
        status: "cancelled" | "completed" | "failed" | "processing" | "queued";
        isTerminal: boolean;
        output: {
          ok: boolean;
          videoId: string | null;
          provider: string | null;
          key: string | null;
          url: string | null;
        } | null;
        error: string | null;
      };
    }
  | {
      ok: false;
      error: string;
    };

type VideoUiStatus =
  | "idle"
  | "submitting"
  | "queued"
  | "running"
  | "success"
  | "error";

type HookInput = {
  hookIdea: string;
  productName: string;
  productDescription: string;
  provider: HookVideoProvider;
  emotion: HookVideoEmotion;
  cameraStyle: HookVideoCameraStyle;
};

const initialHookInput: HookInput = {
  hookIdea: "I did not expect this app to save me this much time.",
  productName: "UGC product",
  productDescription: "A useful digital product for busy creators.",
  provider: "veo",
  emotion: "surprised",
  cameraStyle: "iphone_selfie",
};

const emotionOptions: Array<{ label: string; value: HookVideoEmotion }> = [
  { label: "Surprised", value: "surprised" },
  { label: "Excited", value: "excited" },
  { label: "Curious", value: "curious" },
  { label: "Skeptical", value: "skeptical" },
  { label: "Confident", value: "confident" },
];

const cameraStyleOptions: Array<{
  label: string;
  value: HookVideoCameraStyle;
}> = [
  { label: "iPhone selfie", value: "iphone_selfie" },
  { label: "TikTok UGC", value: "tiktok_ugc" },
  { label: "Home office", value: "home_office" },
  { label: "Desk setup", value: "desk_setup" },
];

const providerOptions: Array<{ label: string; value: HookVideoProvider }> = [
  { label: "Veo 3.1 Lite", value: "veo" },
  { label: "Runway low cost", value: "runway" },
];

function getAwsVideoStatusMessage(status: string, label: string) {
  if (status === "queued") {
    return `${label} queued.`;
  }

  if (status === "processing") {
    return `${label} generating.`;
  }

  return `${label} status: ${status}`;
}

function isWorking(status: VideoUiStatus) {
  return status === "submitting" || status === "queued" || status === "running";
}

function StatusMessage({
  message,
  status,
}: {
  message: string;
  status: VideoUiStatus;
}) {
  const working = isWorking(status);

  return (
    <div
      className={cn(
        "mt-4 rounded-lg border px-4 py-3 text-sm leading-6",
        status === "error"
          ? "border-error/25 bg-error/5 text-error"
          : status === "success"
            ? "border-success/25 bg-success/5 text-[#087443]"
            : "border-border bg-card-muted text-muted",
      )}
    >
      <div className="flex gap-2">
        {status === "error" ? (
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
        ) : status === "success" ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
        ) : working ? (
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
        ) : null}
        <p>{message}</p>
      </div>
    </div>
  );
}

function VideoPreview({
  label,
  onOpenInEdit,
  status,
  url,
}: {
  label: string;
  onOpenInEdit?: () => void;
  status: VideoUiStatus;
  url: string | null;
}) {
  const working = isWorking(status);

  return (
    <div className="mt-5 flex min-h-72 items-center justify-center rounded-lg border border-dashed border-border bg-card-muted p-4">
      {url ? (
        <div className="grid w-full max-w-sm gap-3">
          <video
            src={url}
            controls
            className="aspect-[9/16] max-h-[520px] w-full rounded-lg border border-border bg-black object-cover shadow-soft"
          />
          {onOpenInEdit ? (
            <button
              type="button"
              onClick={onOpenInEdit}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#173454] px-4 text-sm font-bold text-white transition hover:bg-foreground"
            >
              <Scissors className="size-4" aria-hidden="true" />
              Open in Edit
            </button>
          ) : null}
        </div>
      ) : working ? (
        <div className="text-center">
          <Loader2 className="mx-auto size-8 animate-spin text-primary" />
          <p className="mt-4 text-sm font-semibold text-muted">{label}</p>
        </div>
      ) : (
        <div className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-lg border border-border bg-card text-primary">
            <Video className="size-6" />
          </div>
          <p className="mt-4 text-sm font-semibold text-muted">{label}</p>
        </div>
      )}
    </div>
  );
}

export function VideoGenerationPanel({
  avatarImageUrl,
  projectId,
}: {
  avatarImageUrl: string | null;
  projectId: string;
}) {
  const router = useRouter();
  const [hookInput, setHookInput] = useState<HookInput>(initialHookInput);
  const [hookMessage, setHookMessage] = useState("Ready for UGC hook video.");
  const [hookJobId, setHookJobId] = useState<string | null>(null);
  const [hookStatus, setHookStatus] = useState<VideoUiStatus>("idle");
  const [hookVideoUrl, setHookVideoUrl] = useState<string | null>(null);

  function updateHookInput<TField extends keyof HookInput>(
    field: TField,
    value: HookInput[TField],
  ) {
    setHookInput((currentInput) => ({
      ...currentInput,
      [field]: value,
    }));
  }

  useEffect(() => {
    if (!hookJobId) {
      return;
    }

    const jobId = hookJobId;
    let isActive = true;

    async function pollHookStatus() {
      try {
        const token = await getCurrentUserIdToken();
        if (!token) throw new Error("Sign in to check video status.");
        const response = await fetch(
          `/api/debug/hook-video-run-status?jobId=${encodeURIComponent(jobId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const data = (await response.json()) as HookVideoJobStatusResponse;

        if (!isActive) {
          return;
        }

        if (!response.ok || !data.ok) {
          setHookStatus("error");
          setHookMessage(
            data.ok
              ? "Could not check hook video status."
              : data.error || "Could not check hook video status.",
          );
          setHookJobId(null);
          return;
        }

        if (data.job.status === "completed" && data.job.output?.url) {
          setHookVideoUrl(data.job.output.url);
          setHookStatus("success");
          setHookMessage(
            `UGC hook video ready${
              data.job.output.provider ? ` via ${data.job.output.provider}` : ""
            }.`,
          );
          setHookJobId(null);
          return;
        }

        if (data.job.isTerminal) {
          setHookStatus("error");
          setHookMessage(data.job.error ?? "UGC hook video generation failed.");
          setHookJobId(null);
          return;
        }

        setHookStatus(data.job.status === "processing" ? "running" : "queued");
        setHookMessage(getAwsVideoStatusMessage(data.job.status, "UGC hook video"));
      } catch {
        if (!isActive) {
          return;
        }

        setHookStatus("error");
        setHookMessage("Could not reach the hook video status route.");
        setHookJobId(null);
      }
    }

    void pollHookStatus();
    const interval = window.setInterval(() => {
      void pollHookStatus();
    }, 3000);

    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, [hookJobId]);

  async function handleGenerateHookVideo() {
    setHookStatus("submitting");
    setHookMessage("Starting UGC hook video...");
    setHookJobId(null);
    setHookVideoUrl(null);

    try {
      const token = await getCurrentUserIdToken();
      if (!token) throw new Error("Sign in before generating videos.");
      const response = await fetch("/api/debug/test-generate-hook-video", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...hookInput,
          avatarImageUrl,
          projectId,
        }),
      });
      const data = (await response.json()) as HookVideoGenerateResponse;

      if (!response.ok || !data.ok) {
        setHookStatus("error");
        setHookMessage(
          data.ok
            ? "Could not start UGC hook video."
            : data.error || "Could not start UGC hook video.",
        );
        return;
      }

      setHookStatus("queued");
      setHookMessage("UGC hook video queued.");
      setHookJobId(data.jobId);
    } catch {
      setHookStatus("error");
      setHookMessage("Could not reach the UGC hook video route.");
    }
  }

  async function openHookVideoInEdit() {
    if (!hookVideoUrl) {
      return;
    }
    await openServerVideoInEdit(hookVideoUrl, router);
  }

  return (
    <section className="grid gap-5">
      <div className="rounded-lg border border-border bg-card p-5 shadow-soft sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Video className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-primary">Video</p>
            <h2 className="text-xl font-bold text-foreground">
              Create UGC hook video
            </h2>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-foreground">
              Hook idea
            </span>
            <textarea
              value={hookInput.hookIdea}
              onChange={(event) =>
                updateHookInput("hookIdea", event.target.value)
              }
              className="min-h-24 resize-y rounded-lg border border-border bg-white px-4 py-3 text-sm leading-6 text-foreground outline-none transition placeholder:text-muted focus:border-primary focus:ring-4 focus:ring-primary/15"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-foreground">
                Provider
              </span>
              <select
                value={hookInput.provider}
                onChange={(event) =>
                  updateHookInput(
                    "provider",
                    event.target.value as HookVideoProvider,
                  )
                }
                className="h-11 rounded-lg border border-border bg-white px-4 text-sm font-semibold text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
              >
                {providerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-foreground">
                Emotion
              </span>
              <select
                value={hookInput.emotion}
                onChange={(event) =>
                  updateHookInput(
                    "emotion",
                    event.target.value as HookVideoEmotion,
                  )
                }
                className="h-11 rounded-lg border border-border bg-white px-4 text-sm font-semibold text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
              >
                {emotionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-foreground">
              Camera style
            </span>
            <select
              value={hookInput.cameraStyle}
              onChange={(event) =>
                updateHookInput(
                  "cameraStyle",
                  event.target.value as HookVideoCameraStyle,
                )
              }
              className="h-11 rounded-lg border border-border bg-white px-4 text-sm font-semibold text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
            >
              {cameraStyleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-foreground">
              Product name
            </span>
            <input
              value={hookInput.productName}
              onChange={(event) =>
                updateHookInput("productName", event.target.value)
              }
              className="h-11 rounded-lg border border-border bg-white px-4 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-primary focus:ring-4 focus:ring-primary/15"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-foreground">
              Product description
            </span>
            <textarea
              value={hookInput.productDescription}
              onChange={(event) =>
                updateHookInput("productDescription", event.target.value)
              }
              className="min-h-20 resize-y rounded-lg border border-border bg-white px-4 py-3 text-sm leading-6 text-foreground outline-none transition placeholder:text-muted focus:border-primary focus:ring-4 focus:ring-primary/15"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={handleGenerateHookVideo}
          disabled={isWorking(hookStatus)}
          className={buttonClassName({
            className: "mt-6 w-full disabled:cursor-not-allowed disabled:opacity-70",
          })}
        >
          {isWorking(hookStatus) ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Generating
            </>
          ) : (
            <>
              <Video className="mr-2 size-4" />
              Generate UGC hook video
            </>
          )}
        </button>

        <StatusMessage message={hookMessage} status={hookStatus} />
        <VideoPreview
          label="UGC hook video preview"
          onOpenInEdit={hookVideoUrl ? openHookVideoInEdit : undefined}
          status={hookStatus}
          url={hookVideoUrl}
        />
      </div>
    </section>
  );
}

async function openServerVideoInEdit(videoUrl: string, router: ReturnType<typeof useRouter>) {
  const token = await getCurrentUserIdToken();
  if (!token) throw new Error("Sign in before opening Edit.");
  const response = await fetch("/api/media?collection=video&sourceTypes=generated_video", { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
  const data = (await response.json()) as { assets?: Array<{ id: string; url: string }> };
  const asset = data.assets?.find((item) => item.url === videoUrl);
  router.push(asset ? `/edit/${encodeURIComponent(asset.id)}` : "/avatars?tab=videos");
}
