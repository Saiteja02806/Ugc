import { notFound } from "next/navigation";
import { AudioLibraryPreview } from "./preview";

/** Actual picker component with an isolated, non-spending adapter. Never served in production. */
export default async function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <AudioLibraryPreview />;
}
