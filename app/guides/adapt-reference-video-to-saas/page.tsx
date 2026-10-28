import { FounderWorkflowGuide, workflowGuide, workflowGuideMetadata } from "@/components/marketing/founder-workflow-guide";

const guide = workflowGuide("adapt-reference-video-to-saas");
export const metadata = workflowGuideMetadata(guide);

export default function Page() {
  return <FounderWorkflowGuide guide={guide} />;
}
