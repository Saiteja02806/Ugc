import { notFound } from "next/navigation";

import { CreateContentWorkspace } from "@/components/create-content/create-content-workspace";

export default function CreateContentPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <CreateContentWorkspace />;
}
