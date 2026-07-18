export type SocialPublishRetryClaim = {
  jobId: string | null;
  outcome:
    | "action_required"
    | "already_published"
    | "already_queued"
    | "cancelled"
    | "connection_unavailable"
    | "media_unavailable"
    | "not_found"
    | "not_retryable"
    | "retry_created"
    | "scheduling_retry_required";
};

type PublishRetryDeliveryDependencies = {
  attachMessage: (params: {
    awsMessageId: string;
    jobId: string;
  }) => Promise<unknown>;
  reportError?: (
    event: "message_attach_failed" | "message_send_failed",
    details: Record<string, unknown>,
  ) => void;
  sendMessage: (params: {
    jobId: string;
    jobType: "publish_social_post";
  }) => Promise<{ messageId: string }>;
};

export async function deliverSocialPublishRetry(
  claim: SocialPublishRetryClaim,
  dependencies: PublishRetryDeliveryDependencies,
) {
  if (claim.outcome !== "retry_created" || !claim.jobId) {
    return { delivery: "not_required" as const };
  }

  let message: { messageId: string };

  try {
    message = await dependencies.sendMessage({
      jobId: claim.jobId,
      jobType: "publish_social_post",
    });
  } catch (error) {
    dependencies.reportError?.("message_send_failed", {
      error,
      jobId: claim.jobId,
    });

    return { delivery: "reconciliation" as const };
  }

  try {
    await dependencies.attachMessage({
      awsMessageId: message.messageId,
      jobId: claim.jobId,
    });
  } catch (error) {
    dependencies.reportError?.("message_attach_failed", {
      error,
      jobId: claim.jobId,
      messageId: message.messageId,
    });
  }

  return {
    delivery: "queue" as const,
    messageId: message.messageId,
  };
}
