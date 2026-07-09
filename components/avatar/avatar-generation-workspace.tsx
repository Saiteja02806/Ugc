"use client";

import {
  AlertCircle,
  CheckCircle2,
  ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";

import { buttonClassName } from "@/components/ui/button";
import { VideoGenerationPanel } from "@/components/avatar/video-generation-panel";
import { cn } from "@/lib/utils";

type AvatarInput = {
  persona: string;
  ageRange: string;
  hair: string;
  expression: string;
  background: string;
};

type GenerateResponse =
  | {
      ok: true;
      generationId: string;
      jobId: string;
      message: string;
    }
  | {
      ok: false;
      error: string;
    };

type JobStatusResponse =
  | {
      ok: true;
      job: {
        id: string;
        status: string;
        isTerminal: boolean;
        output: {
          ok: boolean;
          generationId: string | null;
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

type UiStatus = "idle" | "submitting" | "queued" | "running" | "success" | "error";

const initialInput: AvatarInput = {
  persona: "SaaS productivity creator",
  ageRange: "Late 20s",
  hair: "curly dark brown hair, natural skin texture, warm expression",
  expression: "surprised",
  background: "modern home office",
};

const ageRangeOptions = [
  "Early 20s",
  "Late 20s",
  "Early 30s",
  "Late 30s",
  "40s",
];

const expressionOptions = [
  "surprised",
  "friendly smile",
  "curious",
  "confident",
  "excited",
];

function getStatusMessage(status: string) {
  if (status === "queued") {
    return "Preparing avatar generation...";
  }

  if (status === "processing") {
    return "Generating avatar image with OpenAI...";
  }

  return "Checking avatar generation status...";
}

export function AvatarGenerationWorkspace({
  projectId,
}: {
  projectId: string;
}) {
  const [input, setInput] = useState<AvatarInput>(initialInput);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("Ready to generate a base avatar.");
  const [pollJobId, setPollJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<UiStatus>("idle");

  const isWorking =
    status === "submitting" || status === "queued" || status === "running";

  function updateInput(field: keyof AvatarInput, value: string) {
    setInput((currentInput) => ({
      ...currentInput,
      [field]: value,
    }));
  }

  async function handleGenerate() {
    setStatus("submitting");
    setMessage("Starting avatar generation...");
    setImageUrl(null);
    setPollJobId(null);

    try {
      const response = await fetch("/api/debug/test-generate-avatar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          input,
        }),
      });
      const data = (await response.json()) as GenerateResponse;

      if (!response.ok || !data.ok) {
        setStatus("error");
        setMessage(
          data.ok
            ? "Could not start avatar generation."
            : data.error || "Could not start avatar generation.",
        );
        return;
      }

      setStatus("queued");
      setMessage("Avatar generation queued.");
      setPollJobId(data.jobId);
    } catch {
      setStatus("error");
      setMessage("Could not reach the avatar generation route.");
    }
  }

  useEffect(() => {
    if (!pollJobId) {
      return;
    }

    const jobId = pollJobId;
    let isActive = true;

    async function pollStatus() {
      try {
        const response = await fetch(
          `/api/debug/avatar-run-status?jobId=${encodeURIComponent(jobId)}`,
        );
        const data = (await response.json()) as JobStatusResponse;

        if (!isActive) {
          return;
        }

        if (!response.ok || !data.ok) {
          setStatus("error");
          setMessage(
            data.ok
              ? "Could not check avatar generation status."
              : data.error || "Could not check avatar generation status.",
          );
          setPollJobId(null);
          return;
        }

        if (data.job.status === "completed" && data.job.output?.url) {
          setImageUrl(data.job.output.url);
          setStatus("success");
          setMessage("Avatar image generated and uploaded to CloudFront.");
          setPollJobId(null);
          return;
        }

        if (data.job.isTerminal) {
          setStatus("error");
          setMessage(data.job.error ?? "Avatar generation failed. Please try again.");
          setPollJobId(null);
          return;
        }

        setStatus(data.job.status === "processing" ? "running" : "queued");
        setMessage(getStatusMessage(data.job.status));
      } catch {
        if (!isActive) {
          return;
        }

        setStatus("error");
        setMessage("Could not reach the avatar status route.");
        setPollJobId(null);
      }
    }

    void pollStatus();
    const interval = window.setInterval(() => {
      void pollStatus();
    }, 2500);

    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, [pollJobId]);

  return (
    <div className="grid gap-5">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,520px)_1fr]">
        <div className="rounded-lg border border-border bg-card p-5 shadow-soft sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UserRound className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-primary">Base avatar</p>
            <h2 className="text-xl font-bold text-foreground">
              Creator profile
            </h2>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-foreground">
              Persona
            </span>
            <input
              value={input.persona}
              onChange={(event) => updateInput("persona", event.target.value)}
              className="h-11 rounded-lg border border-border bg-white px-4 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-primary focus:ring-4 focus:ring-primary/15"
              placeholder="SaaS productivity creator"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-foreground">
                Age range
              </span>
              <select
                value={input.ageRange}
                onChange={(event) => updateInput("ageRange", event.target.value)}
                className="h-11 rounded-lg border border-border bg-white px-4 text-sm font-semibold text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
              >
                {ageRangeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-foreground">
                Expression
              </span>
              <select
                value={input.expression}
                onChange={(event) =>
                  updateInput("expression", event.target.value)
                }
                className="h-11 rounded-lg border border-border bg-white px-4 text-sm font-semibold text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
              >
                {expressionOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-foreground">
              Appearance
            </span>
            <textarea
              value={input.hair}
              onChange={(event) => updateInput("hair", event.target.value)}
              className="min-h-24 resize-y rounded-lg border border-border bg-white px-4 py-3 text-sm leading-6 text-foreground outline-none transition placeholder:text-muted focus:border-primary focus:ring-4 focus:ring-primary/15"
              placeholder="Hair, face, styling, and natural details"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-foreground">
              Background
            </span>
            <input
              value={input.background}
              onChange={(event) => updateInput("background", event.target.value)}
              className="h-11 rounded-lg border border-border bg-white px-4 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-primary focus:ring-4 focus:ring-primary/15"
              placeholder="modern home office"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={isWorking}
          className={buttonClassName({
            className: "mt-6 w-full disabled:cursor-not-allowed disabled:opacity-70",
          })}
        >
          {isWorking ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Generating
            </>
          ) : imageUrl ? (
            <>
              <RefreshCw className="mr-2 size-4" />
              Generate another avatar
            </>
          ) : (
            <>
              <Sparkles className="mr-2 size-4" />
              Generate avatar
            </>
          )}
        </button>

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
            ) : isWorking ? (
              <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
            ) : null}
            <p>{message}</p>
          </div>
        </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">Preview</p>
            <h2 className="mt-1 text-xl font-bold text-foreground">
              Generated avatar
            </h2>
          </div>
          <span
            className={cn(
              "w-fit rounded-full border px-3 py-1 text-xs font-semibold",
              status === "success"
                ? "border-success/25 bg-success/5 text-[#087443]"
                : status === "error"
                  ? "border-error/25 bg-error/5 text-error"
                  : "border-border bg-card-muted text-muted",
            )}
          >
            {status === "success"
              ? "Completed"
              : status === "error"
                ? "Needs retry"
                : isWorking
                  ? "Generating"
                  : "Ready"}
          </span>
        </div>

        <div className="mt-6 flex min-h-[620px] items-center justify-center rounded-lg border border-dashed border-border bg-card-muted p-4 sm:p-6">
          {imageUrl ? (
            <figure className="w-full max-w-md overflow-hidden rounded-lg border border-border bg-card shadow-soft">
              <div className="aspect-[9/16] bg-card-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="Generated UGC creator avatar"
                  className="size-full object-cover"
                />
              </div>
              <figcaption className="border-t border-border bg-card px-4 py-3 text-sm font-semibold text-muted">
                Base avatar candidate
              </figcaption>
            </figure>
          ) : (
            <div className="text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-lg border border-border bg-card text-primary">
                <ImageIcon className="size-7" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-foreground">
                No avatar generated yet
              </h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted">
                Generate one base creator image to confirm the OpenAI,
                AWS worker, S3, and CloudFront path.
              </p>
            </div>
          )}
        </div>
        </div>
      </section>

      <VideoGenerationPanel avatarImageUrl={imageUrl} projectId={projectId} />
    </div>
  );
}
