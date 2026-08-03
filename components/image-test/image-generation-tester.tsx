"use client";

import {
  AlertCircle,
  CheckCircle2,
  ImageIcon,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";

import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ImageResult = {
  url: string;
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
      message: string;
    };

type StatusResponse =
  | {
      ok: true;
      job: {
        error: string | null;
        id: string;
        isTerminal: boolean;
        output: {
          generationId: string | null;
          key: string | null;
          ok: boolean;
          url: string | null;
        } | null;
        status: string;
      };
    }
  | {
      ok: false;
      message: string;
    };

const defaultPrompt =
  "Vertical 9:16 UGC creator selfie, friendly SaaS productivity creator, natural lighting, modern home office, clean text-safe area at the top";

function getJobMessage(status: string) {
  if (status === "queued") {
    return "OpenAI image generation is queued in GCP Cloud Tasks.";
  }

  if (status === "processing") {
    return "Generating the image with OpenAI, then saving it to Cloud Storage.";
  }

  return `GCP worker status: ${status}`;
}

export function ImageGenerationTester() {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [jobId, setJobId] = useState<string | null>(null);
  const [images, setImages] = useState<ImageResult[]>([]);
  const [message, setMessage] = useState(
    "Click generate to test OpenAI image generation through GCP.",
  );
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );

  useEffect(() => {
    if (!jobId || status !== "loading") {
      return;
    }

    const activeJobId = jobId;
    let stopped = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function pollJob() {
      try {
        const response = await fetch(
          `/api/image-test/status?jobId=${encodeURIComponent(activeJobId)}`,
          {
            cache: "no-store",
          },
        );
        const data = (await response.json()) as StatusResponse;

        if (stopped) {
          return;
        }

        if (!data.ok) {
          setStatus("error");
          setMessage(data.message);
          setJobId(null);
          return;
        }

        if (!response.ok) {
          setStatus("error");
          setMessage("Could not read the GCP worker job status.");
          setJobId(null);
          return;
        }

        if (data.job.status === "completed" && data.job.output?.url) {
          setImages([{ url: data.job.output.url }]);
          setStatus("success");
          setMessage("OpenAI image generated and saved to Cloud Storage.");
          setJobId(null);
          return;
        }

        if (data.job.isTerminal) {
          setStatus("error");
          setMessage(
            data.job.error ??
              "OpenAI image generation finished without returning an image URL.",
          );
          setJobId(null);
          return;
        }

        setMessage(getJobMessage(data.job.status));
        timeoutId = setTimeout(pollJob, 2_500);
      } catch {
        if (stopped) {
          return;
        }

        setStatus("error");
        setMessage("Could not reach the image generation status route.");
        setJobId(null);
      }
    }

    timeoutId = setTimeout(pollJob, 1_000);

    return () => {
      stopped = true;
      clearTimeout(timeoutId);
    };
  }, [jobId, status]);

  async function handleGenerate() {
    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt) {
      setStatus("error");
      setMessage("Add a prompt before generating an image.");
      return;
    }

    setStatus("loading");
    setJobId(null);
    setMessage("Starting OpenAI image generation through GCP...");
    setImages([]);

    try {
      const response = await fetch("/api/image-test/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: trimmedPrompt,
        }),
      });

      const data = (await response.json()) as GenerateResponse;

      if (!data.ok) {
        setStatus("error");
        setMessage(data.message);
        return;
      }

      if (!response.ok) {
        setStatus("error");
        setMessage("Could not start OpenAI image generation.");
        return;
      }

      setJobId(data.jobId);
      setMessage("OpenAI image generation started. Waiting for GCP...");
    } catch {
      setStatus("error");
      setMessage("Could not reach the internal OpenAI image generation route.");
    }
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,520px)_1fr]">
      <div className="rounded-lg border border-border bg-card p-5 shadow-soft sm:p-6">
        <div className="flex items-center gap-2">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-primary">Image test</p>
            <h2 className="text-xl font-bold text-foreground">
              Send one prompt
            </h2>
          </div>
        </div>

        <label className="mt-6 flex flex-col gap-2">
          <span className="text-sm font-semibold text-foreground">Prompt</span>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="min-h-36 resize-y rounded-lg border border-border bg-card px-4 py-3 text-sm leading-6 text-foreground outline-none transition placeholder:text-muted focus:border-primary focus:ring-4 focus:ring-primary/15"
            placeholder="Describe the UGC creator image you want to generate."
          />
        </label>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={status === "loading"}
          className={buttonClassName({
            className: "mt-6 w-full disabled:cursor-not-allowed disabled:opacity-70",
          })}
        >
          {status === "loading" ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Generating
            </>
          ) : (
            <>
              <ImageIcon className="mr-2 size-4" />
              Generate test image
            </>
          )}
        </button>

        <div
          className={cn(
            "mt-4 rounded-lg border px-4 py-3 text-sm leading-6",
            status === "error"
              ? "border-error/25 bg-error/5 text-error"
              : status === "success"
                ? "border-success/25 bg-success/5 text-success"
                : "border-border bg-card-muted text-muted",
          )}
        >
          <div className="flex gap-2">
            {status === "error" ? (
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
            ) : status === "success" ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            ) : null}
            <p>{message}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 shadow-soft sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">Result</p>
            <h2 className="text-xl font-bold text-foreground">
              Generated preview
            </h2>
          </div>
          <span className="rounded-full border border-border bg-card-muted px-3 py-1 text-xs font-semibold text-muted">
            9:16
          </span>
        </div>

        {status === "loading" ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="aspect-[9/16] animate-pulse rounded-lg border border-border bg-card-muted" />
          </div>
        ) : images.length > 0 ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {images.map((image, index) => (
              <figure
                key={`${image.url}-${index}`}
                className="overflow-hidden rounded-lg border border-border bg-card-muted"
              >
                <div className="aspect-[9/16] bg-card-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.url}
                    alt={`Generated UGC image ${index + 1}`}
                    className="size-full object-cover"
                  />
                </div>
                <figcaption className="border-t border-border bg-card px-3 py-2 text-xs font-semibold text-muted">
                  Cloud Storage preview
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <div className="mt-6 flex min-h-[520px] items-center justify-center rounded-lg border border-dashed border-border bg-card-muted p-6 text-center">
            <div>
              <div className="mx-auto flex size-14 items-center justify-center rounded-lg border border-border bg-card text-primary">
                <ImageIcon className="size-7" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-foreground">
                No image generated yet
              </h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted">
                Use this screen to confirm OpenAI image generation, GCP workers,
                Cloud Storage upload and delivery in one pass.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
