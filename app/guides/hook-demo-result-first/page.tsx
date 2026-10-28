import { FounderWorkflowGuide, workflowGuide, workflowGuideMetadata } from "@/components/marketing/founder-workflow-guide";

const guide = workflowGuide("hook-demo-result-first");
export const metadata = workflowGuideMetadata(guide);

export default function Page() {
  return <FounderWorkflowGuide guide={guide} />;
}
