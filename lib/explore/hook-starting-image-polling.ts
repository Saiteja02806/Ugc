import type { HookKeyframeJob } from "./hook-keyframe-client";

/** Status reads only. Submission and receipt validation never use this policy. */
export class HookStartingImageReadError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function isRecoverableStartingImageRead(error: unknown) {
  if (error instanceof HookStartingImageReadError) {
    return [404, 408, 409, 429].includes(error.status) || error.status >= 500;
  }
  return error instanceof TypeError || error instanceof Error &&
    (error.name === "TimeoutError" || error.message === "Loading took too long. Try again.");
}

export async function startingImageStatusPolling<T>(
  fetcher: () => Promise<T>,
  options: {
    attempts?: number;
    delayMs?: number;
    signal?: AbortSignal;
    isTerminal?: (result: T) => boolean;
  } = {}
): Promise<T> {
  const attempts = options.attempts ?? 30;
  const delayMs = options.delayMs ?? 1500;
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    if (options.signal?.aborted) {
      throw new Error("Polling was cancelled.");
    }

    try {
      const result = await fetcher();
      if (options.isTerminal && options.isTerminal(result)) {
        return result;
      }
      if (!options.isTerminal) {
        return result;
      }
    } catch (err) {
      lastError = err;
      if (!isRecoverableStartingImageRead(err)) {
        throw err;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw lastError instanceof Error ? lastError : new Error("Polling timed out.");
}
