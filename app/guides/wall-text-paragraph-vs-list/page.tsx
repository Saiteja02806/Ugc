import { FounderWorkflowGuide, workflowGuide, workflowGuideMetadata } from "@/components/marketing/founder-workflow-guide";

const guide = workflowGuide("wall-text-paragraph-vs-list");
export const metadata = workflowGuideMetadata(guide);

export default function Page() {
  return <FounderWorkflowGuide guide={guide} />;
}
