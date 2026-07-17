export async function sendBackgroundJobMessageWithBestEffortAttachment(params: {
  attachMessage: (messageId: string) => Promise<{ id: string }>;
  jobId: string;
  onAttachmentError?: (error: unknown) => void;
  sendMessage: () => Promise<{ messageId: string }>;
}) {
  const message = await params.sendMessage();

  try {
    const updatedJob = await params.attachMessage(message.messageId);

    return updatedJob.id;
  } catch (error) {
    params.onAttachmentError?.(error);
    // SendMessage already succeeded. The worker can claim this delivery before
    // metadata persistence returns, so attachment failure must never mark live
    // generation work failed.
    return params.jobId;
  }
}
