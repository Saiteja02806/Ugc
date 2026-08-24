"use client";

import {
  CheckCircle2,
  Inbox,
  LoaderCircle,
  RefreshCw,
  Send,
} from "lucide-react";
import {
  useCallback,
  useEffect,
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

type FeedbackAdminApiResponse = {
  canReview?: boolean;
  message?: string;
  ok?: boolean;
  submissions?: ProductFeedbackItem[];
};

export function SupportFeedbackSettings({
  showOwnerInbox = false,
  type,
}: {
  showOwnerInbox?: boolean;
  type: ProductFeedbackType;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const isTicket = type === "support_ticket";
  const actionLabel = isTicket ? "Raised Ticket" : "Request Feature";

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

      const response = await fetch("/api/feedback", {
        body: JSON.stringify({
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

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Recently";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
