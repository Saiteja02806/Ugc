import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Create a Hook", robots: { index: false, follow: false } };

export default function CreateHookPage() {
  notFound();
}
