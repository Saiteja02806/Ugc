import { notFound } from "next/navigation";
import { HookKeyframePreview } from "./preview";

/** Actual components with an isolated, non-spending adapter. Never served in production. */
export default async function Page({ searchParams }: { searchParams: Promise<{ format?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const query = await searchParams;
  return <HookKeyframePreview preparationFormat={query.format === "talking_head" ? "talking_head" : "hook"} />;
}
