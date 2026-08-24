"use client";

import {
  CheckCircle2,
  ImagePlus,
  Inbox,
  LoaderCircle,
  RefreshCw,
  Send,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type {
  ProductFeedbackItem,
  ProductFeedbackType,
} from "@/lib/feedback/product-feedback-types";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";

type FeedbackApiResponse = {
  error?: string;
  ok?: boolean;
};

type FeedbackAttachmentUploadResponse =
  | {
      attachmentId: string;
      ok: true;
      requiredHeaders: Record<string, string>;
      uploadUrl: string;
    }
  | { error?: string; ok?: false };

type FeedbackAdminApiResponse = {
  canReview?: boolean;
  message?: string;
  ok?: boolean;
  submissions?: ProductFeedbackItem[];
};

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ATTACHMENT_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function SupportFeedbackSettings({
  showOwnerInbox = false,
  type,
}: {
  showOwnerInbox?: boolean;
  type: ProductFeedbackType;
}) {
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const isTicket = type === "support_ticket";
  const actionLabel = isTicket ? "Raised Ticket" : "Request Feature";

  function chooseAttachment(file: File) {
    if (!ATTACHMENT_CONTENT_TYPES.has(file.type)) {
      setError("Attach a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) {
      setError("Choose an image up to 10 MB.");
      return;
    }

    setAttachment(file);
    setError(null);
  }

  function removeAttachment() {
    setAttachment(null);
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in again before sending your request.");
      }

      const attachmentId = attachment
        ? await uploadFeedbackAttachment({ file: attachment, token })
        : undefined;

      const response = await fetch("/api/feedback", {
        body: JSON.stringify({
          ...(attachmentId ? { attachmentId } : {}),
          description,
          sourcePath: `${window.location.pathname}${window.location.hash}`,
          title,
          type,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const data = (await response.json().catch(() => null)) as
        | FeedbackApiResponse
        | null;

      if (!response.ok || data?.ok !== true) {
        throw new Error(data?.error || "Could not send this request. Try again.");
      }

      setSuccess(
        isTicket
          ? "Ticket raised. The UGC Pilot team can now review the issue and your account context."
          : "Feature requested. The UGC Pilot team can now review your idea.",
      );
      setTitle("");
      setDescription("");
      removeAttachment();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Could not send this request. Try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="px-5 py-5 sm:px-6 sm:py-6">
        <form
          id={`${type}-form`}
          className="overflow-hidden rounded-[var(--radius-control)] border border-border bg-card-muted/30"
          onSubmit={(event) => void submitFeedback(event)}
        >
          <div className="border-b border-border px-4 py-4 sm:px-5">
            <p className="text-sm leading-6 text-muted">
              {isTicket
                ? "Include the steps that led to the problem. Your account email is attached automatically."
                : "Explain the outcome you want and why it would help your workflow."}
            </p>
          </div>

          <div className="space-y-5 px-4 py-5 sm:px-5">
            <div className="space-y-2">
              <Label htmlFor="feedback-title">
                {isTicket ? "What went wrong?" : "Feature name"}
              </Label>
              <Input
                id="feedback-title"
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                minLength={3}
                required
                disabled={isSubmitting}
                placeholder={
                  isTicket
                    ? "Example: My scheduled post did not publish"
                    : "Example: Reusable brand voice presets"
                }
                className="h-11 bg-card"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="feedback-description">
                  {isTicket ? "Explain the issue" : "Describe the feature"}
                </Label>
                <span className="text-xs font-medium tabular-nums text-muted-subtle">
                  {description.length}/4000
                </span>
              </div>
              <textarea
                id="feedback-description"
                name="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={4000}
                minLength={10}
                required
                disabled={isSubmitting}
                rows={6}
                placeholder={
                  isTicket
                    ? "What were you doing, what happened, and what did you expect instead?"
                    : "What should it do, when would you use it, and how would it help?"
                }
                className="w-full resize-y rounded-lg border border-input bg-card px-3 py-2.5 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:bg-card-muted disabled:opacity-70"
              />
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="feedback-attachment">Attach Image</Label>
                <Badge variant="outline">Optional</Badge>
              </div>
              <p className="text-xs leading-5 text-muted">
                JPG, PNG, or WebP up to 10 MB. The image is stored with your request for the UGC Pilot team to review.
              </p>
              {attachment ? (
                <div className="flex min-w-0 items-center gap-3 rounded-control border border-border bg-card px-3 py-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-brand-soft text-primary">
                    <ImagePlus className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground-strong">
                      {attachment.name}
                    </p>
                    <p className="text-xs text-muted">
                      {formatFileSize(attachment.size)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Remove attached image"
                    disabled={isSubmitting}
                    onClick={removeAttachment}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => attachmentInputRef.current?.click()}
                >
                  <ImagePlus data-icon="inline-start" aria-hidden="true" />
                  Attach Image
                </Button>
              )}
              <input
                ref={attachmentInputRef}
                id="feedback-attachment"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={isSubmitting}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) chooseAttachment(file);
                  event.target.value = "";
                }}
              />
            </div>

            {error ? (
              <Alert variant="destructive" role="alert">
                <AlertTitle>Request not sent</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex justify-end">
              <Button
                type="submit"
                size="lg"
                disabled={
                  isSubmitting ||
                  title.trim().length < 3 ||
                  description.trim().length < 10
                }
              >
                {isSubmitting ? (
                  <LoaderCircle
                    data-icon="inline-start"
                    className="animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : (
                  <Send data-icon="inline-start" aria-hidden="true" />
                )}
                {isSubmitting ? "Sending…" : actionLabel}
              </Button>
            </div>
          </div>
        </form>

        {success ? (
          <Alert
            className="mt-4 border-success/25 bg-success/5"
            aria-live="polite"
          >
            <CheckCircle2 className="text-success" aria-hidden="true" />
            <AlertTitle className="text-success">Request received</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      {showOwnerInbox ? <FeedbackOwnerInbox /> : null}
    </>
  );
}

function FeedbackOwnerInbox() {
  const [accessState, setAccessState] = useState<
    "checking" | "denied" | "granted"
  >("checking");
  const [submissions, setSubmissions] = useState<ProductFeedbackItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadSubmissions = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    setError(null);

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        setAccessState("denied");
        return;
      }

      const response = await fetch("/api/admin/feedback", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json().catch(() => null)) as
        | FeedbackAdminApiResponse
        | null;

      if (response.status === 401 || response.status === 403) {
        setAccessState("denied");
        return;
      }

      if (response.ok && data?.canReview === false) {
        setAccessState("denied");
        return;
      }

      if (!response.ok || data?.ok !== true || !data.canReview) {
        setAccessState("granted");
        throw new Error(
          data?.message || "Could not load customer requests. Try again.",
        );
      }

      setSubmissions(data.submissions ?? []);
      setAccessState("granted");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load customer requests. Try again.",
      );
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSubmissions(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSubmissions]);

  if (accessState !== "granted") {
    return null;
  }

  return (
    <>
      <Separator />
      <section aria-labelledby="feedback-owner-inbox-title">
        <header className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-brand-soft text-primary">
              <Inbox className="size-5" aria-hidden="true" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3
                  id="feedback-owner-inbox-title"
                  className="text-sm font-bold text-foreground-strong"
                >
                  Customer requests
                </h3>
                <Badge variant="pro">Owner</Badge>
                <Badge variant="outline">{submissions.length} recent</Badge>
              </div>
              <p className="mt-1 text-sm leading-6 text-muted">
                The latest support tickets and feature requests, including the
                submitting account.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadSubmissions(true)}
            disabled={isRefreshing}
            className="w-full sm:w-auto"
          >
            <RefreshCw
              data-icon="inline-start"
              className={
                isRefreshing ? "animate-spin motion-reduce:animate-none" : ""
              }
              aria-hidden="true"
            />
            Refresh
          </Button>
        </header>

        {error ? (
          <div className="px-5 pb-5 sm:px-6">
            <Alert variant="destructive" aria-live="polite">
              <AlertTitle>Customer requests unavailable</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : submissions.length > 0 ? (
          <div className="divide-y divide-border border-t border-border">
            {submissions.map((submission) => (
              <article key={submission.id} className="px-5 py-5 sm:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          submission.type === "support_ticket"
                            ? "destructive"
                            : "info"
                        }
                      >
                        {submission.type === "support_ticket"
                          ? "Ticket"
                          : "Feature"}
                      </Badge>
                      <Badge variant="outline">{submission.status}</Badge>
                    </div>
                    <h4 className="mt-2 text-sm font-bold text-foreground-strong">
                      {submission.title}
                    </h4>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted">
                      {submission.description}
                    </p>
                    {submission.attachment ? (
                      <FeedbackAttachmentPreview
                        attachment={submission.attachment}
                        feedbackId={submission.id}
                      />
                    ) : null}
                  </div>
                  <div className="shrink-0 text-left text-xs leading-5 text-muted-subtle sm:max-w-56 sm:text-right">
                    <p className="font-semibold text-muted">
                      {submission.userDisplayName ||
                        submission.userEmail ||
                        "UGC Pilot user"}
                    </p>
                    {submission.userEmail ? (
                      <p className="break-all">{submission.userEmail}</p>
                    ) : null}
                    <time dateTime={submission.createdAt}>
                      {formatDateTime(submission.createdAt)}
                    </time>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="border-t border-border px-5 py-8 text-center sm:px-6">
            <p className="text-sm font-semibold text-foreground-strong">
              No customer requests yet
            </p>
            <p className="mt-1 text-sm text-muted">
              New tickets and feature requests will appear here.
            </p>
          </div>
        )}
      </section>
    </>
  );
}

function FeedbackAttachmentPreview({
  attachment,
  feedbackId,
}: {
  attachment: NonNullable<ProductFeedbackItem["attachment"]>;
  feedbackId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  async function showAttachment() {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const token = await getCurrentUserIdToken();
      if (!token) throw new Error("Sign in again before viewing the image.");

      const response = await fetch(
        `/api/admin/feedback/${encodeURIComponent(feedbackId)}/attachment`,
        {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error || "Could not load the attached image.");
      }

      const blob = await response.blob();
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      setImageUrl(URL.createObjectURL(blob));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load the attached image.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function hideAttachment() {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
  }

  return (
    <div className="mt-3 rounded-control border border-border bg-card-muted/35 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-foreground-strong">
            Attached image: {attachment.fileName}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {attachment.width} × {attachment.height} · {formatFileSize(attachment.sizeBytes)}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void (imageUrl ? hideAttachment() : showAttachment())}
          disabled={isLoading}
        >
          {isLoading ? (
            <LoaderCircle
              data-icon="inline-start"
              className="animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : null}
          {isLoading ? "Loading image" : imageUrl ? "Hide image" : "View image"}
        </Button>
      </div>
      {error ? <p className="mt-2 text-xs text-error" role="alert">{error}</p> : null}
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={`Attached image: ${attachment.fileName}`}
          className="mt-3 max-h-96 w-full rounded-control border border-border bg-card object-contain"
        />
      ) : null}
    </div>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Recently";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

async function uploadFeedbackAttachment({
  file,
  token,
}: {
  file: File;
  token: string;
}) {
  const preparedResponse = await fetch("/api/feedback/attachment/upload-url", {
    body: JSON.stringify({
      contentType: file.type,
      fileName: file.name,
      fileSize: file.size,
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const prepared = (await preparedResponse.json().catch(() => null)) as
    | FeedbackAttachmentUploadResponse
    | null;

  if (!preparedResponse.ok || prepared?.ok !== true) {
    throw new Error(
      prepared && "error" in prepared && prepared.error
        ? prepared.error
        : "Could not prepare the image attachment.",
    );
  }

  const uploadResponse = await fetch(prepared.uploadUrl, {
    body: file,
    headers: prepared.requiredHeaders,
    method: "PUT",
  });

  if (!uploadResponse.ok) {
    throw new Error("Could not upload the image attachment. Try again.");
  }

  return prepared.attachmentId;
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
