import { notFound } from "next/navigation";
import { HookKeyframePreview } from "./preview";

/** Actual components with an isolated, non-spending adapter. Never served in production. */
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <HookKeyframePreview />;
}
