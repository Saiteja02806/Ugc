import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CREATIVE_ASSETS_VIDEOS_HREF } from "@/lib/edit/routes";

export const metadata: Metadata = {
  title: "Edit",
  description: "Choose a video to trim, overlay text, and prepare for scheduling.",
};

export default function EditPage() {
  redirect(CREATIVE_ASSETS_VIDEOS_HREF);
}
