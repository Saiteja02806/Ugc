import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "AI Studio",
  description: "Configure Instagram images and short-form videos in one focused workspace.",
};

export default function ImageGenPage() {
  redirect("/ai-studio?mode=images");
}
