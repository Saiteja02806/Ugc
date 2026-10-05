import type { ReactNode } from "react";

/** Optional presentation for the existing generators inside Recreate. */
export type RecreateGenerationView = {
  emptyContent: ReactNode;
  contextBanner?: ReactNode;
  preview: boolean;
  referenceImageUrl?: string;
};
