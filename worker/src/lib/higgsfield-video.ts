import { downloadVideoToBuffer } from "./download-video.js";
import { ProviderOperationTerminalError, ProviderOperationPollingError, ProviderRequestNotSubmittedError } from "./generation-provider.js";
import { getRequiredProviderEnv } from "./provider-env.js";

// Compatibility only: never submit another Higgsfield generation.
export async function resumeLegacyHiggsfieldVideoBuffer(params: {
  onOperationSucceeded: (operationId: string, outputUrl?: string) => Promise<void>;
  providerOperationId?: string;
  providerOutputUrl?: string;
}) {
  const requestId = params.providerOperationId;
  if (!requestId) {
    throw new ProviderRequestNotSubmittedError("Higgsfield generation is disabled; only existing requests can be recovered.");
  }
  if (params.providerOutputUrl && /^https:\/\//i.test(params.providerOutputUrl)) {
    return downloadVideoToBuffer(params.providerOutputUrl);
  }
  const credentials = getRequiredProviderEnv("HF_CREDENTIALS");
  if (!/^[^:\s]+:[^:\s]+$/.test(credentials)) {
    throw new ProviderRequestNotSubmittedError("Legacy HF_CREDENTIALS must use key-id:key-secret format.");
  }
  const deadline = Date.now() + 24 * 60_000;
  while (Date.now() < deadline) {
    const response = await fetch(
      `https://api.higgsfield.ai/requests/${encodeURIComponent(requestId)}/status`,
      { headers: { Authorization: `Key ${credentials}` }, signal: AbortSignal.timeout(30_000) },
    );
    if (response.ok) {
      const result = await response.json() as { error?: string; status: string; video?: { url?: string } };
      if (result.status === "completed") {
        const url = result.video?.url;
        if (!url || !/^https:\/\//i.test(url)) {
          throw new ProviderOperationTerminalError("Legacy Seedance request completed without a usable video URL.");
        }
        await params.onOperationSucceeded(requestId, url);
        return downloadVideoToBuffer(url);
      }
      if (["failed", "nsfw", "canceled", "cancelled"].includes(result.status)) {
        throw new ProviderOperationTerminalError(`Legacy Seedance request ended with status ${result.status}.`);
      }
    } else if (response.status >= 400 && response.status < 500 && response.status !== 404 && response.status !== 429) {
      throw new ProviderOperationTerminalError(`Legacy Seedance status returned HTTP ${response.status}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new ProviderOperationPollingError("Legacy Seedance request is still processing; resume without resubmitting.");
}
