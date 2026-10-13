import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { InlineSchedulePreview } from "./preview";

/** Development-only presentation check. It never creates a schedule. */
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <AppShell activeKey="explore" focusNavigation><InlineSchedulePreview /></AppShell>;
}
