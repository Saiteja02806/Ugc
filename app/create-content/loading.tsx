import { WorkspaceContentLoading } from "@/components/layout/workspace-content-loading";

export default function CreateContentLoading() {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return <WorkspaceContentLoading label="Loading Create Content" />;
}
