import { FounderWorkflowGuide, workflowGuide, workflowGuideMetadata } from "@/components/marketing/founder-workflow-guide";

const guide = workflowGuide("wall-of-text-video-for-saas");
export const metadata = workflowGuideMetadata(guide);

export default function Page() {
  return <FounderWorkflowGuide guide={guide} />;
}
