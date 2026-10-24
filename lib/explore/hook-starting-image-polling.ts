import type { HookKeyframeJob } from "./hook-keyframe-client";

/** Status reads only. Submission and receipt validation never use this policy. */
export class HookStartingImageReadError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export function isRecoverableStartingImageRead(error: unknown) {
  if (error instanceof HookStartingImageReadError) {
    return [408, 409, 429].includes(error.status) || error.status >= 500;
  }
  return error instanceof TypeError || error instanceof Error &&
    (error.name === "TimeoutError" || error.message === "Loading took too long. Try again.");
}

type StatusQuery = { state: { error: unknown; data?: HookKeyframeJob } };
const canRecoverOnReturn = (query: StatusQuery) => !query.state.data?.isTerminal &&
  (!query.state.error || isRecoverableStartingImageRead(query.state.error));

export const startingImageStatusPolling = {
  retry: false,
  staleTime: 0,
  refetchOnMount: canRecoverOnReturn,
  refetchOnWindowFocus: canRecoverOnReturn,
  refetchOnReconnect: canRecoverOnReturn,
  refetchInterval: (query: StatusQuery) => {
    if (query.state.data?.isTerminal) return false;
    if (query.state.error) return isRecoverableStartingImageRead(query.state.error) ? 15_000 : false;
    return 3_000;
  },
};
